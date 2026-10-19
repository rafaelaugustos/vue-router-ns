import {
  defineComponent,
  h,
  onMounted,
  onUnmounted,
  ref,
  type Ref,
  type Component,
  getCurrentInstance,
  registerElement,
} from 'nativescript-vue'
import { describe, expect, it, vi } from 'vitest'
import {
  onBeforeRouteLeave,
  onPageActivated,
  useRoute,
  useRouter,
  useNativeHost,
  RouterView,
  isNavigationFailure,
  NavigationFailureType,
  type RouteLocation,
  type Router,
  useNavigationFocus,
  type NavigationFocus,
} from '../src/index.js'
import { mount, page, paths, settle } from './helpers.js'
import { Page, Frame, View, ActionBar, setScreenReaderEnabled } from './shims/core.js'
import { views } from './shims/nativescript-vue.js'

const layout = (name: string, setup?: () => void) =>
  defineComponent({
    name,
    setup(_, { slots }) {
      setup?.()
      const route = useRoute()
      return () =>
        h('Page', [
          h('ActionBar', { title: `${name}: ${route.path}` }),
          h('StackLayout', slots.default?.()),
        ])
    },
  })
const content = (setup?: () => void) =>
  defineComponent({
    setup() {
      setup?.()
      return () => h('Label', { text: 'Content' })
    },
  })

describe('optional native layouts', () => {
  it('uses the default, an explicitly named layout, and false without extra native pages', async () => {
    const first = vi.fn()
    const second = vi.fn()
    const own = vi.fn()
    const { router, frame } = await mount(
      [
        { path: '/', component: content() },
        { path: '/other', component: content(), meta: { layout: 'other' } },
        { path: '/own', component: page('Own', own), meta: { layout: false } },
      ],
      {
        layouts: { default: layout('Default', first), other: layout('Other', second) },
        defaultLayout: 'default',
      },
    )
    const initial = frame().currentPage
    expect(initial).toBeInstanceOf(Page)
    await router.push('/other')
    expect(frame().currentPage).toBeInstanceOf(Page)
    await router.push('/own')
    expect(first).toHaveBeenCalledOnce()
    expect(second).toHaveBeenCalledOnce()
    expect(own).toHaveBeenCalledOnce()
    expect(frame().backStack).toHaveLength(2)
    await router.backToRoot()
    expect(frame().currentPage).toBe(initial)
    expect(first).toHaveBeenCalledOnce()
  })

  it('keeps the existing Page contract when layouts are absent or only registered', async () => {
    const setup = vi.fn()
    const { router, frame } = await mount(
      [
        { path: '/', component: page('Existing') },
        { path: '/other', component: page('Other') },
      ],
      { layouts: { default: layout('Unused', setup) } },
    )
    await router.push('/other')
    expect(setup).not.toHaveBeenCalled()
    expect(frame().currentPage).toBeInstanceOf(Page)
    expect(paths(router.stack.value)).toEqual(['/', '/other'])
  })

  it('keeps layout state, page state, route and stack context isolated per native entry', async () => {
    const contexts: { route: RouteLocation; router: Router; draft: Ref<string> }[] = []
    const layouts: { route: RouteLocation; draft: Ref<string> }[] = []
    const Shared = layout('Shared', () => {
      layouts.push({ route: useRoute(), draft: ref('layout') })
      expect(useNativeHost().kind).toBe('frame')
    })
    const Body = content(() => {
      contexts.push({ route: useRoute(), router: useRouter(), draft: ref('page') })
    })
    const { router, frame } = await mount([{ path: '/item/:id', component: Body }], {
      initial: '/item/1',
      layouts: { shared: Shared },
      defaultLayout: 'shared',
    })
    const first = frame().currentPage
    contexts[0]!.draft.value = 'first page draft'
    layouts[0]!.draft.value = 'first layout draft'
    await router.push('/item/2')
    await router.push({ path: '/item/2', force: true })
    expect(contexts).toHaveLength(3)
    expect(layouts).toHaveLength(3)
    expect(contexts[0]!.route).toBe(layouts[0]!.route)
    expect(contexts[0]!.route.params.id).toBe('1')
    expect(contexts[1]!.draft.value).toBe('page')
    expect(layouts[1]!.draft.value).toBe('layout')
    expect(contexts[1]!.route).not.toBe(contexts[2]!.route)
    await contexts[0]!.router.backToRoot()
    expect(frame().currentPage).toBe(first)
    expect(contexts[0]!.draft.value).toBe('first page draft')
    expect(layouts[0]!.draft.value).toBe('first layout draft')
  })

  it('passes route and navigation props to the destination, not the layout', async () => {
    let props: unknown
    const Body = defineComponent({
      props: ['id', 'draft'],
      setup(value) {
        props = value
        return () => h('Label')
      },
    })
    const { router } = await mount(
      [
        { path: '/', component: page('Home') },
        { path: '/item/:id', component: Body, props: true, meta: { layout: 'shared' } },
      ],
      { layouts: { shared: layout('Shared') } },
    )
    await router.push('/item/7', { props: { draft: 'hello' } })
    expect(props).toMatchObject({ id: '7', draft: 'hello' })
  })

  it('loads layouts lazily after guards, caches code, and mounts fresh instances', async () => {
    const order: string[] = []
    const setup = vi.fn()
    const loader = vi.fn(async () => {
      order.push('layout')
      return { default: layout('Lazy', setup) }
    })
    const { router } = await mount(
      [
        { path: '/', component: page('Home') },
        {
          path: '/item/:id',
          component: () => {
            order.push('page')
            return content()
          },
          meta: { layout: 'lazy' },
        },
      ],
      { layouts: { lazy: loader } },
    )
    const remove = router.beforeEach(() => false)
    await router.push('/item/1')
    expect(loader).not.toHaveBeenCalled()
    remove()
    router.beforeResolve(() => {
      order.push('beforeResolve')
    })
    await router.push('/item/1')
    await router.push('/item/2')
    expect(order).toEqual(['page', 'layout', 'beforeResolve', 'beforeResolve'])
    expect(loader).toHaveBeenCalledOnce()
    expect(setup).toHaveBeenCalledTimes(2)
  })

  it('reports unknown layouts before changing history or mounting a destination', async () => {
    const setup = vi.fn()
    const { router, frame } = await mount([
      { path: '/', component: page('Home') },
      { path: '/bad', component: content(setup), meta: { layout: 'missing' } },
    ])
    const onError = vi.fn()
    router.onError(onError)
    const initial = frame().currentPage
    await expect(router.push('/bad')).rejects.toThrow('Unknown native layout "missing"')
    expect(onError).toHaveBeenCalledOnce()
    expect(setup).not.toHaveBeenCalled()
    expect(frame().currentPage).toBe(initial)
    expect(paths(router.stack.value)).toEqual(['/'])
  })

  it('rejects loader failures once and permits a later retry', async () => {
    let fail = true
    const loader = vi.fn(async () => {
      if (fail) throw new Error('layout import failed')
      return layout('Recovered')
    })
    const { router } = await mount(
      [
        { path: '/', component: page('Home') },
        { path: '/target', component: content(), meta: { layout: 'lazy' } },
      ],
      { layouts: { lazy: loader } },
    )
    const onError = vi.fn()
    router.onError(onError)
    await expect(router.push('/target')).rejects.toThrow('layout import failed')
    expect(onError).toHaveBeenCalledOnce()
    fail = false
    await router.push('/target')
    expect(loader).toHaveBeenCalledTimes(2)
    expect(router.currentRoute.value.path).toBe('/target')
  })

  it('rejects an unknown default before creating native hosts', async () => {
    const { createRouter } = await import('../src/index.js')
    expect(() => createRouter({ routes: [], defaultLayout: 'missing' })).toThrow(
      'Unknown default native layout',
    )
    expect(() => createRouter({ routes: [], layouts: { ' ': layout('Blank') } })).toThrow(
      'non-empty name',
    )
  })

  it('inherits a parent layout while allowing a child to opt out', async () => {
    const setup = vi.fn()
    const { router } = await mount(
      [
        { path: '/', component: page('Home') },
        {
          path: '/parent',
          meta: { layout: 'shared' },
          children: [
            { path: 'child', component: content() },
            { path: 'own', component: page('Own'), meta: { layout: false } },
          ],
        },
      ],
      { layouts: { shared: layout('Shared', setup) } },
    )
    await router.push('/parent/child')
    await router.push('/parent/own')
    expect(setup).toHaveBeenCalledOnce()
  })

  it.each(['ios', 'android'] as const)(
    'keeps layout leave guards, lifecycle, modal results and disposal on %s',
    async (platform) => {
      let allow = false
      let modal!: Router
      const activated = vi.fn()
      const unmounted = vi.fn()
      const Shared = layout('Shared', () => {
        const route = useRoute()
        onPageActivated(activated)
        onUnmounted(unmounted)
        if (route.path === '/modal') {
          modal = useRouter()
          onBeforeRouteLeave(async () => allow)
        }
      })
      const { router, frame, app } = await mount(
        [
          { path: '/', component: content() },
          { path: '/modal', component: content(), modal: true },
          { path: '/own', component: page('Own'), meta: { layout: false } },
        ],
        { layouts: { shared: Shared }, defaultLayout: 'shared', platform },
      )
      const initial = frame().currentPage
      const result = router.pushForResult<string>('/modal')
      await settle()
      expect(isNavigationFailure(await modal.back(), NavigationFailureType.aborted)).toBe(
        true,
      )
      expect(router.currentRoute.value.path).toBe('/modal')
      allow = true
      await modal.back({ result: 'accepted' })
      expect(await result).toBe('accepted')
      expect(frame().currentPage).toBe(initial)
      expect(unmounted).toHaveBeenCalledOnce()
      expect(activated.mock.calls.length).toBeGreaterThanOrEqual(3)
      await router.replace('/own')
      expect(unmounted).toHaveBeenCalledTimes(2)
      app.unmount()
    },
  )

  it('does not recreate persistent containers when selecting another layout', async () => {
    const { router } = await mount(
      [
        { path: '/', component: content() },
        { path: '/other', component: content(), meta: { layout: 'other' } },
      ],
      {
        layouts: { shared: layout('Shared'), other: layout('Other') },
        defaultLayout: 'shared',
        render: () =>
          h('GridLayout', [
            h(RouterView, { name: 'left' }),
            h(RouterView, { name: 'right' }),
          ]),
      },
    )
    await settle()
    const frames = [...Frame.stack]
    await router.push('/other', { frame: 'left' })
    expect(Frame.stack).toHaveLength(2)
    expect(Frame.stack).toEqual(expect.arrayContaining(frames))
    expect(views.get('Frame')!.slice(-2)).toEqual(expect.arrayContaining(frames))
  })

  it('restores the modal initiator inside layout-owned Page content', async () => {
    const post = vi.fn()
    vi.stubGlobal('UIAccessibilityPostNotification', post)
    vi.stubGlobal('UIAccessibilityLayoutChangedNotification', 100)
    let focus!: NavigationFocus
    const Body = defineComponent({
      setup() {
        focus = useNavigationFocus({ initial: 'heading', return: 'trigger' })
        return () =>
          h('StackLayout', [
            h('Label', { id: 'heading' }),
            h('Button', { id: 'trigger' }),
          ])
      },
    })
    try {
      const { router, frame, app } = await mount(
        [
          { path: '/', component: Body },
          { path: '/modal', component: content(), modal: true },
        ],
        {
          layouts: { shared: layout('Shared') },
          defaultLayout: 'shared',
          before: () => setScreenReaderEnabled(true),
        },
      )
      await settle()
      const initial = frame().currentPage!
      focus.remember('trigger')
      const result = router.pushForResult('/modal')
      await settle()
      await router.back({ result: 'saved' })
      expect(await result).toBe('saved')
      await settle()
      expect(post).toHaveBeenLastCalledWith(
        100,
        initial.getViewById<View>('trigger')!.ios,
      )
      expect(initial.accessibilityHidden).toBe(false)
      app.unmount()
    } finally {
      vi.unstubAllGlobals()
      setScreenReaderEnabled(false)
    }
  })

  it('holds the selected layout per entry and changes it only for a new entry', async () => {
    const setup = vi.fn()
    const route = {
      path: '/',
      component: content(),
      meta: { layout: 'shared' as string | false },
    }
    const { router, frame } = await mount([route], {
      layouts: { shared: layout('Shared', setup) },
    })
    const first = frame().currentPage
    route.meta.layout = false
    expect(frame().currentPage).toBe(first)
    // A replacement uses the updated metadata, with a Page-owning destination.
    router.addRoute({ path: '/own', component: page('Own'), meta: { layout: false } })
    await router.replace('/own')
    expect(setup).toHaveBeenCalledOnce()
    expect(frame().currentPage).not.toBe(first)
  })

  it('diagnoses a destination Page and conflicting bars in a configured layout', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      await mount(
        [
          {
            path: '/',
            component: defineComponent({
              render: () => h('Page', [h('ActionBar'), h('Label')]),
            }),
          },
        ],
        {
          layouts: { shared: layout('Shared') },
          defaultLayout: 'shared',
        },
      )
      expect(warn.mock.calls.flat().join(' ')).toContain(
        'destination must render content without Page',
      )
      expect(warn.mock.calls.flat().join(' ')).toContain('layout owns ActionBar')
    } finally {
      warn.mockRestore()
    }
  })

  it('validates native Page/ActionBar classes through registered element aliases', async () => {
    registerElement('CustomPage', () => Page)
    registerElement('CustomBar', () => ActionBar)
    const Custom = defineComponent({
      setup(_, { slots }) {
        return () =>
          h('CustomPage', [h('CustomBar'), h('StackLayout', slots.default?.())])
      },
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      await mount([{ path: '/', component: content() }], {
        layouts: { custom: Custom },
        defaultLayout: 'custom',
      })
      expect(warn).not.toHaveBeenCalled()
    } finally {
      warn.mockRestore()
    }
  })

  it('diagnoses omitted or repeated destination slots', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const Repeated = defineComponent({
        setup(_, { slots }) {
          return () =>
            h('Page', [h('StackLayout', [...slots.default!(), ...slots.default!()])])
        },
      })
      await mount([{ path: '/', component: content() }], {
        layouts: { repeated: Repeated },
        defaultLayout: 'repeated',
      })
      expect(warn.mock.calls.flat().join(' ')).toContain('default slot exactly once')
    } finally {
      warn.mockRestore()
    }
  })
})

describe('layout and destination HMR', () => {
  it.each([
    ['layout', 'return'],
    ['layout', 'discard'],
    ['destination', 'return'],
    ['destination', 'discard'],
  ] as const)('defers covered %s reload until %s', async (target, action) => {
    const layoutSetup = vi.fn()
    const contentSetup = vi.fn()
    let context: { reload?: () => void } | undefined
    // Capture the native page app's reload context from the selected component.
    const Destination = content(() => {
      contentSetup()
      context = getCurrentInstance()!.appContext
    })
    const Shared = layout('Shared', layoutSetup)
    const component = target === 'layout' ? Shared : Destination
    Object.assign(component, { __hmrId: `layout-covered-${target}-${action}` })
    const hmr = (
      globalThis as unknown as {
        __VUE_HMR_RUNTIME__: {
          createRecord(id: string, c: Component): void
          reload(id: string, c: Component): void
        }
      }
    ).__VUE_HMR_RUNTIME__
    const id = `layout-covered-${target}-${action}`
    hmr.createRecord(id, component)
    const { router, frame, app } = await mount(
      [
        { path: '/', component: Destination },
        { path: '/above', component: page('Above'), meta: { layout: false } },
        { path: '/fresh', component: page('Fresh'), meta: { layout: false } },
      ],
      { layouts: { shared: Shared }, defaultLayout: 'shared', diagnostics: true },
    )
    await router.push('/above')
    const original = frame().backStack[0]!.resolvedPage
    const reload = vi.fn()
    context!.reload = reload
    hmr.reload(id, { ...component })
    await settle()
    expect(reload).not.toHaveBeenCalled()
    expect(frame().backStack[0]!.resolvedPage).toBe(original)
    expect(layoutSetup).toHaveBeenCalledOnce()
    expect(contentSetup).toHaveBeenCalledOnce()
    if (action === 'return') await router.back()
    else await router.push('/fresh', { clearHistory: true })
    await settle()
    expect(reload).toHaveBeenCalledTimes(action === 'return' ? 1 : 0)
    expect(paths(router.stack.value)).toEqual([action === 'return' ? '/' : '/fresh'])
    app.unmount()
  })
})
