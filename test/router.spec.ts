import { defineComponent, h, nextTick, ref, type ShallowRef } from 'nativescript-vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  isNavigationFailure,
  NavigationFailureType,
  onBeforeRouteLeave,
  onPageActivated,
  onPageDeactivated,
  RouterLink,
  RouterView,
  useBackGesture,
  useRoute,
  useRouter,
  type BackGesture,
  type NavigationGuard,
  type RouteLocation,
  type RouteRecordRaw,
  type SavedStacks,
  type ZoomSource,
  type Router,
} from '../src/index.js'
import { events, mount, page, paths, settle } from './helpers.js'
import { views } from './shims/nativescript-vue.js'
import {
  Activity,
  Application,
  backOwner,
  Device,
  Frame,
  pressAndroidBack,
  SharedTransition,
  swipeAndroidBack,
  View,
} from './shims/core.js'
import { dismissAttempted } from '../src/ios.js'
import { reselected } from '../src/tabs.js'

const Home = page('Home')
const List = page('List')
const Detail = page('Detail')
const Settings = page('Settings')

const routes = [
  { path: '/', name: 'home', component: Home },
  { path: '/list', name: 'list', component: List },
  { path: '/items/:id', name: 'item', component: Detail, props: true },
  { path: '/settings', name: 'settings', component: Settings },
]

describe('stack', () => {
  it('starts on the initial route', async () => {
    const { router, frame } = await mount(routes)

    expect(router.currentRoute.value.name).toBe('home')
    expect(paths(router.stack.value)).toEqual(['/'])
    expect(frame().backStack).toHaveLength(0)
    expect(Frame.navigations[0]!.animated).toBe(false)
  })

  it('pushes pages on top of the native stack', async () => {
    const { router, frame } = await mount(routes)

    await router.push('/list')
    await router.push({ name: 'item', params: { id: 7 }, query: { tab: 'info' } })

    expect(router.currentRoute.value.fullPath).toBe('/items/7?tab=info')
    expect(router.currentRoute.value.params).toEqual({ id: '7' })
    expect(paths(router.stack.value)).toEqual(['/', '/list', '/items/7?tab=info'])
    expect(frame().backStack).toHaveLength(2)
  })

  it('goes back and destroys the page it leaves', async () => {
    const { router, frame } = await mount(routes)
    await router.push('/list')

    await router.back()

    expect(router.currentRoute.value.path).toBe('/')
    expect(frame().backStack).toHaveLength(0)
    expect(events).toContain('unmount List')
    expect(events).not.toContain('unmount Home')
  })

  it('replaces the page on top', async () => {
    const { router, frame } = await mount(routes)
    await router.push('/list')

    await router.replace('/settings')

    expect(paths(router.stack.value)).toEqual(['/', '/settings'])
    expect(frame().backStack).toHaveLength(1)
    expect(events).toContain('unmount List')
  })

  it('accepts `replace: true` in the location, like Vue Router', async () => {
    const { router } = await mount(routes)
    await router.push('/list')

    await router.push({ path: '/settings', replace: true })

    expect(paths(router.stack.value)).toEqual(['/', '/settings'])
  })

  it('clears the history', async () => {
    const { router, frame } = await mount(routes)
    await router.push('/list')
    await router.push('/settings')

    await router.push('/', { clearHistory: true })

    expect(paths(router.stack.value)).toEqual(['/'])
    expect(frame().backStack).toHaveLength(0)
    expect(events.filter((event) => event.startsWith('unmount'))).toEqual([
      'unmount Home',
      'unmount List',
      'unmount Settings',
    ])
  })

  it('goes back several pages, or back to a given one', async () => {
    const { router } = await mount(routes)
    await router.push('/list')
    await router.push('/items/1')
    await router.push('/items/2')
    await router.push('/settings')

    await router.go(-2)
    expect(paths(router.stack.value)).toEqual(['/', '/list', '/items/1'])

    await router.push('/settings')
    await router.backTo({ name: 'list' })
    expect(paths(router.stack.value)).toEqual(['/', '/list'])

    await expect(router.backTo('/settings')).rejects.toThrow(
      'No page matching "/settings"',
    )
  })

  it('ignores back() on the first page and go() forward', async () => {
    const { router } = await mount(routes)

    expect(await router.back()).toBeUndefined()
    expect(await router.go(1)).toBeUndefined()
    expect(paths(router.stack.value)).toEqual(['/'])
  })

  it('passes transitions and options to the frame', async () => {
    const { router } = await mount([
      ...routes,
      { path: '/fade', component: List, transition: 'fade' },
    ])

    await router.push('/list', { transition: 'slideTop', animated: true })
    await router.push('/fade')

    expect(Frame.navigations[1]).toMatchObject({
      transition: { name: 'slideTop' },
      animated: true,
    })
    expect(Frame.navigations[2]).toMatchObject({ transition: { name: 'fade' } })
  })

  it('throws for routes that do not exist', async () => {
    const { router } = await mount(routes)

    await expect(router.push('/nope')).rejects.toThrow('No route matches "/nope"')
    await expect(router.push({ name: 'nope' })).rejects.toThrow('No route named "nope"')
  })
})

describe('pages', () => {
  it('give each page its own route, frozen while others are pushed on top', async () => {
    const seen: RouteLocation[] = []
    const Item = page('Item', () => seen.push(useRoute()))
    const { router } = await mount([...routes, { path: '/item/:id', component: Item }])

    await router.push('/item/1')
    await router.push('/item/2')

    expect(seen.map((route) => route.params.id)).toEqual(['1', '2'])
    expect(router.currentRoute.value.params.id).toBe('2')
  })

  it('pass params as props when the record asks for it', async () => {
    let props: Record<string, unknown> = {}
    const Item = page('Item', (attrs) => (props = attrs))
    const { router } = await mount([
      ...routes,
      { path: '/item/:id', component: Item, props: true },
    ])

    await router.push('/item/3', { props: { preview: { title: 'Hi' } } })

    expect(props).toEqual({ id: '3', preview: { title: 'Hi' } })
  })

  it('load lazy components', async () => {
    const Lazy = page('Lazy')
    const loader = vi.fn(async () => ({ default: Lazy }))
    const { router } = await mount([...routes, { path: '/lazy', component: loader }])

    await router.push('/lazy')
    await router.back()
    await router.push('/lazy')

    expect(events.filter((event) => event === 'mount Lazy')).toHaveLength(2)
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('take a loader that returns the component itself', async () => {
    const Wrapped = page('Wrapped')
    const { router } = await mount([
      ...routes,
      { path: '/wrapped', component: () => Wrapped },
    ])

    await router.push('/wrapped')

    expect(events).toContain('mount Wrapped')
    expect(router.currentRoute.value.path).toBe('/wrapped')
  })

  it('know when they are on screen', async () => {
    const Tracked = page('Tracked', () => {
      onPageActivated(() => events.push('activated'))
      onPageDeactivated(() => events.push('deactivated'))
    })
    const { router } = await mount([...routes, { path: '/tracked', component: Tracked }])

    await router.push('/tracked')
    await router.push('/list')
    await router.back()

    expect(events.filter((event) => event.endsWith('activated'))).toEqual([
      'activated',
      'deactivated',
      'activated',
    ])
  })
})

describe('guards', () => {
  it('run in Vue Router order', async () => {
    const order: string[] = []
    const { router } = await mount([
      ...routes,
      {
        path: '/guarded',
        component: Settings,
        beforeEnter: () => void order.push('beforeEnter'),
      },
    ])
    router.beforeEach(() => void order.push('beforeEach'))
    router.beforeResolve(() => void order.push('beforeResolve'))
    router.afterEach(() => void order.push('afterEach'))

    await router.push('/guarded')

    expect(order).toEqual(['beforeEach', 'beforeEnter', 'beforeResolve', 'afterEach'])
  })

  it('redirect from a guard', async () => {
    const { router } = await mount([
      ...routes,
      { path: '/login', name: 'login', component: Home },
      { path: '/account', component: Settings, meta: { requiresAuth: true } },
    ])
    router.beforeEach((to) => (to.meta.requiresAuth ? { name: 'login' } : undefined))

    await router.push('/account')

    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.redirectedFrom?.path).toBe('/account')
  })

  it('redirect the initial page', async () => {
    const Login = page('Login')
    const { router, frame } = await mount(
      [
        { path: '/', component: Home, meta: { requiresAuth: true } },
        { path: '/login', component: Login },
      ],
      {
        before: (router) =>
          router.beforeEach((to) => (to.meta.requiresAuth ? '/login' : true)),
      },
    )

    expect(paths(router.stack.value)).toEqual(['/login'])
    expect(frame().backStack).toHaveLength(0)
    expect(events).not.toContain('mount Home')
  })

  it('abort with false', async () => {
    const { router } = await mount(routes)
    router.beforeEach((to) => to.path !== '/settings')

    const failure = await router.push('/settings')

    expect(isNavigationFailure(failure, NavigationFailureType.aborted)).toBe(true)
    expect(router.currentRoute.value.path).toBe('/')
  })

  it('surface errors through onError and the returned promise', async () => {
    const { router } = await mount(routes)
    const onError = vi.fn()
    router.onError(onError)
    router.beforeEach(() => {
      throw new Error('boom')
    })

    await expect(router.push('/list')).rejects.toThrow('boom')
    expect(onError).toHaveBeenCalledOnce()
  })

  it('tell back navigations apart', async () => {
    const { router } = await mount(routes)
    const types: string[] = []
    router.beforeEach((_to, _from, { type }) => void types.push(type))

    await router.push('/list')
    await router.replace('/settings')
    await router.back()

    expect(types).toEqual(['push', 'replace', 'back'])
  })

  it('skip beforeEnter when staying on the same record', async () => {
    const beforeEnter = vi.fn()
    const { router } = await mount([
      ...routes,
      { path: '/p/:id', component: Detail, beforeEnter },
    ])

    await router.push('/p/1')
    await router.push('/p/2')

    expect(beforeEnter).toHaveBeenCalledOnce()
  })
})

describe('leave guards', () => {
  const Form = (when?: () => boolean, answer = false) =>
    page('Form', () => onBeforeRouteLeave(() => answer, { when }))

  it('run when the page is removed, not when something is pushed over it', async () => {
    const leave = vi.fn(() => true)
    const Editor = page('Editor', () => onBeforeRouteLeave(leave))
    const { router } = await mount([...routes, { path: '/editor', component: Editor }])

    await router.push('/editor')
    await router.push('/list')
    expect(leave).not.toHaveBeenCalled()

    await router.back()
    await router.back()
    expect(leave).toHaveBeenCalledOnce()
  })

  it('keep the page when they say no', async () => {
    const { router } = await mount([...routes, { path: '/form', component: Form() }])
    await router.push('/form')

    const failure = await router.back()

    expect(isNavigationFailure(failure, NavigationFailureType.aborted)).toBe(true)
    expect(router.currentRoute.value.path).toBe('/form')
  })

  it('only guard while `when` holds, and block the iOS swipe meanwhile', async () => {
    const dirty = ref(true)
    const { router, frame } = await mount([
      ...routes,
      { path: '/form', component: Form(() => dirty.value) },
    ])
    await router.push('/form')
    const form = frame().currentPage!

    expect(form.enableSwipeBackNavigation).toBe(false)
    expect(await router.back()).toBeDefined()

    dirty.value = false
    await nextTick()
    expect(form.enableSwipeBackNavigation).toBe(true)
    expect(await router.back()).toBeUndefined()
    expect(router.currentRoute.value.path).toBe('/')
  })

  it('take over the iOS back button while active, and hand it back after', async () => {
    const dirty = ref(true)
    const { router, frame } = await mount([
      ...routes,
      { path: '/form', component: Form(() => dirty.value) },
    ])
    await router.push('/form')
    const item = frame().currentPage!.ios.navigationItem

    expect(item.backAction).toBeTypeOf('function')
    item.backAction()
    await settle()
    expect(router.currentRoute.value.path).toBe('/form')

    dirty.value = false
    await nextTick()
    expect(item.backAction).toBeNull()
  })

  it('leave the back button alone on iOS before 16', async () => {
    const { router, frame } = await mount(
      [...routes, { path: '/form', component: Form() }],
      { before: () => (Device.sdkVersion = '15.5') },
    )
    await router.push('/form')

    expect(frame().currentPage!.ios.navigationItem.backAction).toBeNull()
  })

  it('run for every page a multi-page back removes, top first', async () => {
    const order: string[] = []
    const Step = (name: string) =>
      page(name, () => onBeforeRouteLeave(() => void order.push(name)))
    const { router } = await mount([
      ...routes,
      { path: '/a', component: Step('a') },
      { path: '/b', component: Step('b') },
    ])
    await router.push('/a')
    await router.push('/b')

    await router.go(-2)

    expect(order).toEqual(['b', 'a'])
  })
})

describe('system back', () => {
  it('follows an iOS swipe it did not start', async () => {
    const { router, frame } = await mount(routes)
    const after = vi.fn()
    router.afterEach(after)
    await router.push('/list')

    frame().popNatively()

    expect(router.currentRoute.value.path).toBe('/')
    expect(after).toHaveBeenLastCalledWith(
      expect.objectContaining({ path: '/' }),
      expect.objectContaining({ path: '/list' }),
      undefined,
    )
  })

  it('routes the Android back button through the guards', async () => {
    const Form = page('Form', () => onBeforeRouteLeave(() => false))
    const { router } = await mount([...routes, { path: '/form', component: Form }], {
      platform: 'android',
    })
    await router.push('/form')

    expect(pressAndroidBack().cancel).toBe(true)
    await settle()

    expect(router.currentRoute.value.path).toBe('/form')
  })

  it('goes back on the Android back button when nothing objects', async () => {
    const { router } = await mount(routes, { platform: 'android' })
    await router.push('/list')

    expect(pressAndroidBack().cancel).toBe(true)
    await settle()

    expect(paths(router.stack.value)).toEqual(['/'])
  })

  it('lets Android close the app from the first page', async () => {
    await mount(routes, { platform: 'android' })

    expect(pressAndroidBack().cancel).toBe(false)
  })
})

describe('Android back gesture', () => {
  type Gesture = Readonly<ShallowRef<BackGesture | null>>
  const gestures: Record<string, Gesture> = {}
  const tracked = (name: string, setup?: () => void) =>
    page(name, () => {
      gestures[name] = useBackGesture()
      setup?.()
    })

  const gestureRoutes = [
    { path: '/', component: tracked('Home') },
    { path: '/list', component: tracked('List') },
    { path: '/pick', component: tracked('Picker'), modal: true },
    { path: '/locked', component: tracked('Locked'), modal: { cancelable: false } },
  ]

  it('reports the swipe to the page it would close', async () => {
    const { router } = await mount(gestureRoutes, { platform: 'android' })
    await router.push('/list')

    const swipe = swipeAndroidBack('right')
    expect(gestures.List!.value).toEqual({ progress: 0, edge: 'right' })
    swipe.move(0.4)
    expect(gestures.List!.value).toEqual({ progress: 0.4, edge: 'right' })
    expect(gestures.Home!.value).toBeNull()

    swipe.cancel()
    expect(gestures.List!.value).toBeNull()
    expect(paths(router.stack.value)).toEqual(['/', '/list'])
  })

  it('goes back through the router when the swipe is released', async () => {
    const leave = vi.fn()
    const { router } = await mount(gestureRoutes, {
      platform: 'android',
      before: (router) => router.beforeEach((to, from, info) => leave(info.type)),
    })
    await router.push('/list')

    const swipe = swipeAndroidBack()
    swipe.move(0.8)
    expect(swipe.release().cancel).toBe(true)
    expect(gestures.List!.value).toBeNull()
    await settle()

    expect(paths(router.stack.value)).toEqual(['/'])
    expect(leave).toHaveBeenLastCalledWith('back')
  })

  it('reports nothing while a leave guard is active', async () => {
    const dirty = ref(true)
    const Form = tracked('Form', () => onBeforeRouteLeave(() => false, { when: dirty }))
    const { router } = await mount(
      [...gestureRoutes, { path: '/form', component: Form }],
      {
        platform: 'android',
      },
    )
    await router.push('/form')

    swipeAndroidBack().move(0.5)
    expect(gestures.Form!.value).toBeNull()
    expect(pressAndroidBack().cancel).toBe(true)
    await settle()
    expect(router.currentRoute.value.path).toBe('/form')

    dirty.value = false
    swipeAndroidBack().move(0.5)
    expect(gestures.Form!.value).toEqual({ progress: 0.5, edge: 'left' })
  })

  it('reports nothing on the first page, and lets Android close the app', async () => {
    await mount(gestureRoutes, { platform: 'android' })

    const swipe = swipeAndroidBack()
    swipe.move(0.5)
    expect(gestures.Home!.value).toBeNull()

    expect(swipe.release().cancel).toBe(false)
    expect(Application.android.foregroundActivity!.finished).toBe(true)
  })

  it('follows swipes inside a modal, unless it is not cancelable', async () => {
    const { router } = await mount(gestureRoutes, { platform: 'android' })

    await router.push('/pick')
    await settle()
    const swipe = swipeAndroidBack()
    swipe.move(0.3)
    expect(gestures.Picker!.value).toEqual({ progress: 0.3, edge: 'left' })
    expect(gestures.Home!.value).toBeNull()
    swipe.release()
    await settle()
    expect(View.presented).toHaveLength(0)

    await router.push('/locked')
    await settle()
    swipeAndroidBack().move(0.3)
    expect(gestures.Locked!.value).toBeNull()
    pressAndroidBack()
    await settle()
    expect(View.presented).toHaveLength(1)
  })

  it('follows activities created later', async () => {
    const { router } = await mount(gestureRoutes, { platform: 'android' })
    await router.push('/list')

    const activity = new Activity()
    Application.android.foregroundActivity = activity
    Application.android.notify({ eventName: 'activityCreated', activity })

    swipeAndroidBack().move(0.6)
    expect(gestures.List!.value).toEqual({ progress: 0.6, edge: 'left' })
  })

  it('stays out of the way before Android 14, and once the app is unmounted', async () => {
    const legacy = await mount(gestureRoutes, {
      platform: 'android',
      before: () => (Device.sdkVersion = '33'),
    })
    expect(backOwner().getOnBackPressedDispatcher().enabledCount()).toBe(1)
    await legacy.router.push('/list')
    expect(pressAndroidBack().cancel).toBe(true)
    await settle()
    expect(paths(legacy.router.stack.value)).toEqual(['/'])

    const { app } = await mount(gestureRoutes, { platform: 'android' })
    const dispatcher = backOwner().getOnBackPressedDispatcher()
    expect(dispatcher.enabledCount()).toBe(2)
    app.unmount()
    expect(dispatcher.enabledCount()).toBe(1)
  })
})

describe('Android back preview', () => {
  /** Just enough of an android.view.View to watch what the preview does to it. */
  const nativeView = (width = 400) => {
    const view: any = {
      state: {
        x: 0,
        y: 0,
        scale: 1,
        scaleY: 1,
        alpha: 1,
        elevation: 0,
        background: null as unknown,
      },
      layoutParams: {},
      animation: 0,
      parent: null,
      children: [] as unknown[],
      getWidth: () => width,
      getAlpha: () => view.state.alpha,
      getScaleX: () => view.state.scale,
      getScaleY: () => view.state.scaleY,
      getTranslationX: () => view.state.x,
      getTranslationY: () => view.state.y,
      getElevation: () => view.state.elevation,
      getLayoutParams: () => view.layoutParams,
      setLayoutParams: (params: object) => (view.layoutParams = params),
      setTranslationY: (value: number) => (view.state.y = value),
      getParent: () => view.parent,
      getContext: () => null,
      getBackground: () => view.state.background,
      setBackground: (drawable: unknown) => (view.state.background = drawable),
      setElevation: (value: number) => (view.state.elevation = value),
      setTranslationX: (value: number) => (view.state.x = value),
      setScaleX: (value: number) => (view.state.scale = value),
      setScaleY: (value: number) => (view.state.scaleY = value),
      setAlpha: (value: number) => (view.state.alpha = value),
      addView: (child: any, index: number) => {
        view.children.splice(index, 0, child)
        child.parent = view
      },
      removeView: (child: any) => {
        view.children = view.children.filter((item: unknown) => item !== child)
        child.parent = null
      },
      animate: () => {
        const generation = view.animation
        const to: Record<string, any> = {}
        const animator = {
          cancel: () => view.animation++,
          translationX: (value: number) => ((to.x = value), animator),
          scaleX: (value: number) => ((to.scale = value), animator),
          scaleY: (value: number) => ((to.scaleY = value), animator),
          alpha: (value: number) => ((to.alpha = value), animator),
          setDuration: () => animator,
          withEndAction: (action: { run(): void }) => ((to.end = action), animator),
        }
        void Promise.resolve().then(() => {
          if (view.animation !== generation) return
          const { end, ...values } = to
          Object.assign(view.state, values)
          end?.run()
        })
        return animator
      },
    }
    return view
  }

  beforeEach(() => {
    Object.assign(globalThis, {
      java: {
        lang: {
          Runnable: class {
            constructor(impl: object) {
              Object.assign(this, impl)
            }
          },
        },
      },
      org: { nativescript: { widgets: { CommonLayoutParams: class {} } } },
      android: {
        R: { attr: { colorBackground: 1 } },
        util: {
          TypedValue: class {
            data = 0
          },
        },
        graphics: {
          drawable: {
            ColorDrawable: class {
              constructor(public color: number) {}
            },
          },
        },
      },
    })
  })

  afterEach(() => {
    for (const name of ['java', 'org', 'android']) delete (globalThis as any)[name]
  })

  const setup = async (options: { backPreview?: boolean; refuseBack?: boolean } = {}) => {
    const { router, frame, app } = await mount(routes, {
      platform: 'android',
      backPreview: options.backPreview,
      before: (router) => {
        if (options.refuseBack) router.beforeEach((to, from, { type }) => type !== 'back')
      },
    })
    await router.push('/list')
    const container = nativeView()
    frame().native = container
    const home = nativeView()
    const list = nativeView()
    frame().backStack[0]!.resolvedPage.native = home
    frame().currentPage!.native = list
    return { router, container, home, list, app }
  }

  it('puts the page below behind the one on top while the swipe moves', async () => {
    const { container, home, list } = await setup()

    const swipe = swipeAndroidBack()
    expect(container.children).toEqual([home])
    swipe.move(0.5)

    expect(list.state).toMatchObject({ scale: 0.95, x: 10 })
    expect(list.state.elevation).toBeGreaterThan(0)
    expect(list.state.background).toBeDefined()
    expect(home.state.x).toBe(-30)
  })

  it('settles back and takes the page below away when cancelled', async () => {
    const { router, container, list } = await setup()

    const swipe = swipeAndroidBack()
    swipe.move(0.4)
    swipe.cancel()
    await settle()

    expect(container.children).toEqual([])
    expect(list.state).toMatchObject({ x: 0, scale: 1, elevation: 0, background: null })
    expect(paths(router.stack.value)).toEqual(['/', '/list'])
  })

  it('finishes the swipe and goes back without animating when released', async () => {
    const { router, list } = await setup()

    const swipe = swipeAndroidBack()
    swipe.move(0.7)
    expect(swipe.release()).toBeUndefined()
    await settle()

    expect(paths(router.stack.value)).toEqual(['/'])
    expect(Frame.backs).toEqual([false])
    expect(list.state).toMatchObject({ x: 0, scale: 1, alpha: 1, elevation: 0 })
  })

  it('brings the page back when a guard refuses', async () => {
    const { router, container, list } = await setup({ refuseBack: true })

    const swipe = swipeAndroidBack()
    swipe.move(0.7)
    swipe.release()
    await settle()

    expect(paths(router.stack.value)).toEqual(['/', '/list'])
    expect(container.children).toEqual([])
    expect(list.state).toMatchObject({ x: 0, scale: 1, alpha: 1 })
  })

  it('reveals a faded previous page and restores its transforms on cancel', async () => {
    const { home, list } = await setup()
    Object.assign(home.state, { alpha: 0, scale: 0.8, scaleY: 0.7, x: 80, y: 40 })
    Object.assign(list.state, { elevation: 12, background: { color: 'red' } })
    const originalHome = { ...home.state }
    const originalList = { ...list.state }
    const swipe = swipeAndroidBack()
    swipe.move(0.5)
    expect(home.state).toMatchObject({ alpha: 1, scale: 1, scaleY: 1, y: 0 })
    swipe.cancel()
    await settle()
    expect(home.state).toEqual(originalHome)
    expect(list.state).toEqual(originalList)
  })

  it('mirrors movement for a swipe from the right edge', async () => {
    const { home, list } = await setup()
    const swipe = swipeAndroidBack('right')
    swipe.move(0.5)
    expect(list.state.x).toBe(-10)
    expect(home.state.x).toBe(30)
    swipe.cancel()
    await settle()
  })

  it('restores the page and reports a throwing guard', async () => {
    const { router, container, list } = await setup()
    const error = new Error('guard failed')
    const onError = vi.fn()
    router.onError(onError)
    router.beforeEach(() => {
      throw error
    })
    swipeAndroidBack().release()
    await settle()
    expect(onError).toHaveBeenCalledWith(error, expect.anything(), expect.anything())
    expect(paths(router.stack.value)).toEqual(['/', '/list'])
    expect(container.children).toEqual([])
    expect(list.state).toMatchObject({ alpha: 1, x: 0, scale: 1 })
  })

  it('cleans up before a guard redirects to a different page', async () => {
    const { router, container, list, home } = await setup()
    home.state.alpha = 0
    router.beforeEach((to, from, { type }) => (type === 'back' ? '/settings' : undefined))
    swipeAndroidBack().release()
    await settle()
    expect(paths(router.stack.value)).toEqual(['/', '/list', '/settings'])
    expect(container.children).toEqual([])
    expect(home.state.alpha).toBe(0)
    expect(list.state).toMatchObject({ alpha: 1, x: 0, scale: 1 })
  })

  it('does not pop a new page when navigation interrupts a released swipe', async () => {
    const { router, container, list } = await setup()
    const swipe = swipeAndroidBack()
    swipe.move(0.7)
    swipe.release()
    await router.push('/settings')
    await settle()
    expect(paths(router.stack.value)).toEqual(['/', '/list', '/settings'])
    expect(container.children).toEqual([])
    expect(list.state).toMatchObject({ alpha: 1, x: 0, scale: 1 })
  })

  it('can start another swipe before cancellation finishes', async () => {
    const { router, container, list } = await setup()
    const first = swipeAndroidBack()
    first.move(0.5)
    first.cancel()
    const second = swipeAndroidBack()
    second.move(0.7)
    expect(container.children).toHaveLength(1)
    second.release()
    await settle()
    expect(paths(router.stack.value)).toEqual(['/'])
    expect(Frame.backs).toEqual([false])
    expect(list.state).toMatchObject({ alpha: 1, x: 0, scale: 1 })
  })

  it('cleans up synchronously when unmounted during the settle animation', async () => {
    const { app, router, container, list } = await setup()
    const swipe = swipeAndroidBack()
    swipe.move(0.5)
    swipe.release()
    app.unmount()
    await settle()
    expect(container.children).toEqual([])
    expect(Frame.backs).toEqual([])
    expect(list.state).toMatchObject({ alpha: 1, x: 0, scale: 1 })
  })

  it.each(['cancel', 'commit'] as const)(
    'reveals shared elements with transition alpha during %s',
    async (action) => {
      const { home } = await setup()
      let transitionAlpha = 0
      const shared = new View()
      shared.native = {
        getTransitionAlpha: () => transitionAlpha,
        setTransitionAlpha: (value: number) => (transitionAlpha = value),
      }
      const elements = vi
        .spyOn(SharedTransition, 'getSharedElements')
        .mockReturnValue({ presenting: [shared] })
      try {
        const swipe = swipeAndroidBack()
        swipe.move(0.5)
        expect(transitionAlpha).toBe(1)
        if (action === 'cancel') swipe.cancel()
        else swipe.release()
        await settle()
        expect(transitionAlpha).toBe(action === 'cancel' ? 0 : 1)
        expect(home.state.alpha).toBe(1)
      } finally {
        elements.mockRestore()
      }
    },
  )

  it('keeps the previous page visible after completing a pop', async () => {
    const { home } = await setup()
    home.state.alpha = 0
    swipeAndroidBack().release()
    await settle()
    expect(home.state).toMatchObject({ alpha: 1, scale: 1, scaleY: 1, x: 0, y: 0 })
  })

  it('falls back to ordinary back if the previous view is already attached', async () => {
    const { router, home, container } = await setup()
    home.parent = {}
    const swipe = swipeAndroidBack()
    swipe.move(0.5)
    expect(container.children).toEqual([])
    expect(swipe.release().cancel).toBe(true)
    await settle()
    expect(paths(router.stack.value)).toEqual(['/'])
  })

  it('does not navigate after unmounting while a guard is pending', async () => {
    const { router, app, container } = await setup()
    let release!: () => void
    router.beforeEach(() => new Promise<void>((resolve) => (release = resolve)))
    swipeAndroidBack().release()
    await settle()
    app.unmount()
    release()
    await settle()
    expect(Frame.backs).toEqual([])
    expect(container.children).toEqual([])
  })

  it('previews pages inside a modal without closing the modal', async () => {
    const { router } = await mount(
      [...routes, { path: '/pick', component: Home, modal: true }],
      { platform: 'android' },
    )
    await router.push('/pick')
    await router.push('/list')
    const frame = View.presented[0]!.view as Frame
    const container = nativeView()
    const home = nativeView()
    const list = nativeView()
    frame.native = container
    frame.backStack[0]!.resolvedPage.native = home
    frame.currentPage!.native = list
    const swipe = swipeAndroidBack()
    swipe.move(0.5)
    expect(container.children).toEqual([home])
    expect(list.state.scale).toBe(0.95)
    swipe.release()
    await settle()
    expect(View.presented).toHaveLength(1)
    expect(paths(router.stack.value)).toEqual(['/pick'])
    expect(home.state.alpha).toBe(1)
  })

  it('stays off with backPreview: false', async () => {
    const { router, container } = await setup({ backPreview: false })

    const swipe = swipeAndroidBack()
    swipe.move(0.5)
    expect(container.children).toEqual([])
    expect(swipe.release().cancel).toBe(true)
    await settle()

    expect(paths(router.stack.value)).toEqual(['/'])
  })
})

describe('concurrency', () => {
  it('turns a double tap into a single page', async () => {
    const { router } = await mount(routes)

    const first = router.push('/list')
    await new Promise((resolve) => setTimeout(resolve, 0))
    const second = router.push('/list')

    expect(await first).toBeUndefined()
    expect(isNavigationFailure(await second, NavigationFailureType.duplicated)).toBe(true)
    expect(paths(router.stack.value)).toEqual(['/', '/list'])
  })

  it('keeps the last of two navigations started in the same tick', async () => {
    const { router } = await mount(routes)

    const [first, second] = await Promise.all([
      router.push('/list'),
      router.push('/settings'),
    ])

    expect(isNavigationFailure(first, NavigationFailureType.cancelled)).toBe(true)
    expect(second).toBeUndefined()
    expect(paths(router.stack.value)).toEqual(['/', '/settings'])
  })

  it('lets a newer navigation cancel one still in its guards', async () => {
    const { router } = await mount(routes)
    let release!: () => void
    router.beforeEach((to) =>
      to.path === '/list'
        ? new Promise<void>((resolve) => (release = resolve))
        : undefined,
    )

    const slow = router.push('/list')
    await settle()
    const fast = router.push('/settings')
    release()

    expect(isNavigationFailure(await slow, NavigationFailureType.cancelled)).toBe(true)
    expect(await fast).toBeUndefined()
    expect(paths(router.stack.value)).toEqual(['/', '/settings'])
  })

  it('waits for the first page when used before it is up', async () => {
    const { router } = await mount(routes)
    await router.push('/list')

    expect(paths(router.stack.value)).toEqual(['/', '/list'])
  })
})

describe('modals', () => {
  const Compose = page('Compose')
  const Picker = page('Picker')
  const modalRoutes = [
    ...routes,
    { path: '/compose', component: Compose, modal: { fullscreen: true } },
    { path: '/pick', component: Picker, modal: true },
  ]

  it('present modal routes in their own frame', async () => {
    const { router } = await mount(modalRoutes)

    await router.push('/compose')

    expect(View.presented).toHaveLength(1)
    expect(View.presented[0]!.view).toBeInstanceOf(Frame)
    expect(View.presented[0]!.options).toMatchObject({ fullscreen: true })
    expect(router.currentRoute.value.path).toBe('/compose')
  })

  it('push inside the modal from its pages, and close it from its first page', async () => {
    let modalRouter!: Router
    const Compose = page('Compose', () => (modalRouter = useRouter() as Router))
    const { router } = await mount([
      ...routes,
      { path: '/compose', component: Compose, modal: true },
    ])
    await router.push('/compose')

    await modalRouter.push('/list')
    expect(paths(modalRouter.stack.value)).toEqual(['/compose', '/list'])
    expect(paths(router.stack.value)).toEqual(['/compose', '/list'])

    await modalRouter.back()
    await modalRouter.back()

    expect(View.presented).toHaveLength(0)
    expect(router.currentRoute.value.path).toBe('/')
    expect(events).toContain('unmount Compose')
  })

  it('deliver a result to pushForResult', async () => {
    const { router } = await mount(modalRoutes)

    const result = router.pushForResult<string>('/pick')
    await settle()
    await router.back({ result: 'blue' })

    expect(await result).toBe('blue')
  })

  it('resolve pushForResult with undefined when closed by the system', async () => {
    const { router } = await mount(modalRoutes)
    const after = vi.fn()
    router.afterEach(after)

    const result = router.pushForResult('/pick')
    await settle()
    View.presented[0]!.view.closeModal()

    expect(await result).toBeUndefined()
    expect(router.currentRoute.value.path).toBe('/')
    expect(after).toHaveBeenLastCalledWith(
      expect.objectContaining({ path: '/' }),
      expect.objectContaining({ path: '/pick' }),
      undefined,
    )
  })

  it('work with plain pages too', async () => {
    const { router } = await mount(routes)

    const result = router.pushForResult<number>('/list')
    await settle()
    await router.back({ result: 42 })

    expect(await result).toBe(42)
  })

  it('do not open twice on a double tap', async () => {
    const { router } = await mount(modalRoutes)

    await Promise.all([router.push('/compose'), router.push('/compose')])

    expect(View.presented).toHaveLength(1)
  })

  it('cover the pages below', async () => {
    const Tracked = page('Tracked', () => onPageDeactivated(() => events.push('covered')))
    const { router } = await mount([
      ...modalRoutes,
      { path: '/tracked', component: Tracked },
    ])
    await router.push('/tracked')

    await router.push('/pick')

    expect(events).toContain('covered')
  })

  it('close on the Android back button, unless not cancelable', async () => {
    const { router } = await mount(
      [
        ...modalRoutes,
        { path: '/locked', component: Picker, modal: { cancelable: false } },
      ],
      { platform: 'android' },
    )

    await router.push('/pick')
    expect(pressAndroidBack().cancel).toBe(true)
    await settle()
    expect(View.presented).toHaveLength(0)

    await router.push('/locked')
    pressAndroidBack()
    await settle()
    expect(View.presented).toHaveLength(1)
  })
})

describe('transitions', () => {
  const zooms: { options: any; provider: () => unknown }[] = []
  const source = (view: View) => view as unknown as ZoomSource
  const Photo = page('Photo')
  const photoRoutes = [
    ...routes,
    { path: '/photo', component: Photo, transition: 'fade' },
    {
      path: '/draft',
      component: page('Draft', () => onBeforeRouteLeave(() => false)),
    },
  ]

  beforeEach(() => {
    zooms.length = 0
    Object.assign(globalThis, {
      UIViewControllerTransition: {
        zoomWithOptionsSourceViewProvider: (options: any, provider: () => unknown) => {
          const zoom = { options, provider }
          zooms.push(zoom)
          return zoom
        },
      },
      UIZoomTransitionOptions: { new: () => ({ interactiveDismissShouldBegin: null }) },
    })
  })

  afterEach(() => {
    delete (globalThis as any).UIViewControllerTransition
    delete (globalThis as any).UIZoomTransitionOptions
  })

  it('pass a shared transition through untouched', async () => {
    const instance = { id: 1 }
    const { router } = await mount(photoRoutes)

    await router.push('/list', { transition: { instance } as any })

    expect(Frame.navigations.at(-1)!.transition).toEqual({ instance })
  })

  it('zoom the page out of a view on iOS 18, instead of its transition', async () => {
    const { router, frame } = await mount(photoRoutes)
    const thumbnail = new View()

    await router.push('/photo', { zoomFrom: source(thumbnail) })

    expect(frame().currentPage!.ios.preferredTransition).toBe(zooms[0])
    expect(zooms[0]!.provider()).toBe(thumbnail.ios)
    expect(zooms[0]!.options.interactiveDismissShouldBegin()).toBe(true)
    expect(Frame.navigations.at(-1)!.transition).toBeUndefined()

    thumbnail.isLoaded = false
    expect(zooms[0]!.provider()).toBeNull()
  })

  it('let the zoom win over a transition passed along, and release a shared one', async () => {
    const { router } = await mount(photoRoutes)

    await router.push('/photo', {
      zoomFrom: source(new View()),
      transition: { instance: { id: 7 } } as any,
    })
    expect(Frame.navigations.at(-1)!.transition).toBeUndefined()
    expect(SharedTransition.finished).toEqual([7])

    const android = await mount(photoRoutes, { platform: 'android' })
    await android.router.push('/photo', {
      zoomFrom: source(new View()),
      transition: { instance: { id: 8 } } as any,
    })
    expect(Frame.navigations.at(-1)!.transition).toEqual({ instance: { id: 8 } })
    expect(SharedTransition.finished).toEqual([])
  })

  it('hold the zoom dismissal while a leave guard is active', async () => {
    const { router } = await mount(photoRoutes)

    await router.push('/draft', { zoomFrom: source(new View()) })

    expect(zooms[0]!.options.interactiveDismissShouldBegin()).toBe(false)
  })

  it('keep the usual transition before iOS 18, on Android, and without animation', async () => {
    const old = await mount(photoRoutes, { before: () => (Device.sdkVersion = '17.5') })
    await old.router.push('/photo', { zoomFrom: source(new View()) })
    expect(Frame.navigations.at(-1)!.transition).toEqual({ name: 'fade' })

    const android = await mount(photoRoutes, { platform: 'android' })
    await android.router.push('/photo', { zoomFrom: source(new View()) })
    expect(Frame.navigations.at(-1)!.transition).toEqual({ name: 'fade' })

    const still = await mount(photoRoutes)
    await still.router.push('/photo', { zoomFrom: source(new View()), animated: false })
    expect(still.frame().currentPage!.ios.preferredTransition).toBeUndefined()
    expect(zooms).toHaveLength(0)
  })

  it('zoom out of the child of a RouterLink with zoom', async () => {
    const Grid = defineComponent({
      render: () =>
        h('Page', [
          h(RouterLink, { to: '/photo', zoom: true }, () => h('Image', { src: 'thumb' })),
        ]),
    })
    const { router } = await mount([
      { path: '/', component: Grid },
      ...photoRoutes.slice(1),
    ])
    const thumbnail = views.get('Image')!.at(-1)!

    thumbnail.notify({ eventName: 'tap', object: thumbnail })
    await settle()

    expect(router.currentRoute.value.path).toBe('/photo')
    expect(zooms[0]!.provider()).toBe(thumbnail.ios)
  })
})

describe('iOS sheets', () => {
  const Filters = page('Filters')
  const sheetRoutes = [
    ...routes,
    {
      path: '/filters',
      component: Filters,
      modal: {
        ios: {
          detents: ['medium', 'large'],
          selectedDetent: 'medium',
          largestUndimmedDetent: 'medium',
          grabber: true,
          cornerRadius: 24,
        },
      },
    },
  ] satisfies RouteRecordRaw[]
  const sheet = () =>
    (View.presented.at(-1)!.view as any).ios.controller.sheetPresentationController

  it('are set up from the route before presenting', async () => {
    const { router } = await mount(sheetRoutes)

    await router.push('/filters')

    expect(sheet()).toEqual({
      detents: ['medium', 'large'],
      selectedDetentIdentifier: 'medium',
      largestUndimmedDetentIdentifier: 'medium',
      prefersGrabberVisible: true,
      preferredCornerRadius: 24,
    })
  })

  it('merge what push passes with the record, and name fractions', async () => {
    const { router } = await mount(sheetRoutes)

    await router.push('/filters', {
      modal: { ios: { detents: [0.4, 'large'], selectedDetent: 0.4 } },
    })

    expect(sheet()).toMatchObject({
      detents: [0.4, 'large'],
      selectedDetentIdentifier: 'fraction-0.4',
      prefersGrabberVisible: true,
    })
  })

  it('leave fractions out before iOS 16', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { router } = await mount(sheetRoutes, {
      before: () => (Device.sdkVersion = '15.4'),
    })

    await router.push('/filters', { modal: { ios: { detents: [0.4, 'large'] } } })

    expect(sheet().detents).toEqual(['large'])
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('iOS 16'))
    warn.mockRestore()
  })
})

describe('modal dismiss attempts on iOS', () => {
  const modalFrame = () =>
    View.presented.at(-1)!.view as unknown as Parameters<typeof dismissAttempted>[0]
  const guarded = (name: string, guard: NavigationGuard) =>
    page(name, () => onBeforeRouteLeave(guard))

  it('run the leave guard, and close the modal when it allows', async () => {
    const ask = vi.fn(async () => true)
    const after = vi.fn()
    const { router } = await mount(
      [...routes, { path: '/draft', component: guarded('Draft', ask), modal: true }],
      { before: (router) => router.afterEach(after) },
    )
    await router.push('/draft')
    await settle()

    dismissAttempted(modalFrame())
    await settle()

    expect(ask).toHaveBeenCalledTimes(1)
    expect(View.presented).toHaveLength(0)
    expect(router.currentRoute.value.path).toBe('/')
    expect(after).toHaveBeenLastCalledWith(
      expect.objectContaining({ path: '/' }),
      expect.objectContaining({ path: '/draft' }),
      undefined,
    )
  })

  it('keep the modal when the guard refuses', async () => {
    const { router } = await mount([
      ...routes,
      { path: '/draft', component: guarded('Draft', () => false), modal: true },
    ])
    await router.push('/draft')
    await settle()

    dismissAttempted(modalFrame())
    await settle()

    expect(View.presented).toHaveLength(1)
    expect(router.currentRoute.value.path).toBe('/draft')
  })

  it('ignore a second attempt while the guard is still asking', async () => {
    let answer!: (value: boolean) => void
    const ask = vi.fn(() => new Promise<boolean>((resolve) => (answer = resolve)))
    const { router } = await mount([
      ...routes,
      { path: '/draft', component: guarded('Draft', ask), modal: true },
    ])
    await router.push('/draft')
    await settle()

    dismissAttempted(modalFrame())
    await settle()
    dismissAttempted(modalFrame())
    await settle()
    expect(ask).toHaveBeenCalledTimes(1)

    answer(true)
    await settle()
    expect(View.presented).toHaveLength(0)
  })

  it('ask every page of the modal, top first', async () => {
    const order: string[] = []
    const { router } = await mount([
      ...routes,
      {
        path: '/draft',
        component: guarded('Draft', () => void order.push('draft')),
        modal: true,
      },
      { path: '/attach', component: guarded('Attach', () => void order.push('attach')) },
    ])
    await router.push('/draft')
    await settle()
    await router.push('/attach')

    dismissAttempted(modalFrame())
    await settle()

    expect(order).toEqual(['attach', 'draft'])
    expect(View.presented).toHaveLength(0)
  })
})

describe('restore', () => {
  const storage = (initial: SavedStacks | null = null) => {
    let state = initial
    return {
      save: vi.fn((next: SavedStacks | null) => void (state = next)),
      load: vi.fn(() => state),
      get state() {
        return state
      },
    }
  }
  const tabs = () => [
    h(RouterView, { name: 'inbox', initial: '/' }),
    h(RouterView, { name: 'settings', initial: '/settings' }),
  ]
  const saved = (stacks: SavedStacks['stacks'], age = 0): SavedStacks => ({
    savedAt: Date.now() - age,
    stacks,
  })

  it('saves the paths of every stack after each navigation', async () => {
    const store = storage()
    const { router, frame } = await mount(
      [...routes, { path: '/pick', component: page('Picker'), modal: true }],
      { render: tabs, restore: store },
    )
    await settle()
    await router.push('/list', { frame: 'inbox' })
    await router.push('/items/1', { frame: 'inbox' })
    await router.push('/pick')

    expect(store.state).toMatchObject({
      stacks: { inbox: ['/', '/list', '/items/1'], settings: ['/settings'] },
    })
    expect(Object.keys(store.state!.stacks)).toEqual(['inbox', 'settings'])
    expect(Date.now() - store.state!.savedAt).toBeLessThan(1000)

    await router.back()
    frame().popNatively()
    expect(store.state!.stacks.inbox).toEqual(['/', '/list'])
  })

  it('rebuilds the saved stacks on launch, without animating', async () => {
    const store = storage(
      saved({ inbox: ['/', '/list', '/items/1'], settings: ['/settings', '/list'] }),
    )
    const { router } = await mount(routes, { render: tabs, restore: store })
    await settle()

    expect(store.state!.stacks).toEqual({
      inbox: ['/', '/list', '/items/1'],
      settings: ['/settings', '/list'],
    })
    expect(Frame.navigations.every((entry) => entry.animated === false)).toBe(true)
    expect(store.load).toHaveBeenCalledTimes(1)

    await router.back({ frame: 'settings' })
    expect(store.state!.stacks.settings).toEqual(['/settings'])
  })

  it('leaves old saves alone, unless maxAge says otherwise', async () => {
    const old = saved({ default: ['/', '/list'] }, 31 * 60 * 1000)

    const stale = await mount(routes, { restore: storage(old) })
    expect(paths(stale.router.stack.value)).toEqual(['/'])

    const kept = await mount(routes, { restore: { ...storage(old), maxAge: Infinity } })
    expect(paths(kept.router.stack.value)).toEqual(['/', '/list'])
  })

  it('starts over when a saved path has no route anymore', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { router } = await mount(routes, {
      restore: storage(saved({ default: ['/', '/gone'] })),
    })

    expect(paths(router.stack.value)).toEqual(['/'])
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Not restoring'),
      expect.anything(),
    )
    warn.mockRestore()
  })

  it('runs the guards while rebuilding', async () => {
    const { router } = await mount(routes, {
      restore: storage(saved({ default: ['/', '/items/1'] })),
      before: (router) =>
        router.beforeEach((to) => (to.path === '/items/1' ? '/list' : true)),
    })

    expect(paths(router.stack.value)).toEqual(['/', '/list'])
  })

  it('forgets the stacks when the app exits on its own', async () => {
    const store = storage()
    await mount(routes, { restore: store })

    Application.notify({ eventName: 'exit' })

    expect(store.state).toBeNull()
  })

  it('takes an async load', async () => {
    const state = saved({ default: ['/', '/list'] })
    const { router } = await mount(routes, {
      restore: { save: () => {}, load: () => Promise.resolve(state) },
    })

    expect(paths(router.stack.value)).toEqual(['/', '/list'])
  })
})

describe('tabs', () => {
  it('keep one stack per RouterView and navigate in the one a page lives in', async () => {
    let feedRouter!: Router
    const Feed = page('Feed', () => (feedRouter = useRouter() as Router))
    const Profile = page('Profile')
    const { router } = await mount(
      [
        { path: '/feed', component: Feed },
        { path: '/profile', component: Profile },
        { path: '/post/:id', component: Detail },
      ],
      {
        render: () => [
          h(RouterView, { name: 'feed', initial: '/feed' }),
          h(RouterView, { name: 'profile', initial: '/profile' }),
        ],
      },
    )
    await settle()

    await feedRouter.push('/post/1')
    await router.push('/post/2', { frame: 'profile' })

    expect(paths(feedRouter.stack.value)).toEqual(['/feed', '/post/1'])
    expect(router.currentRoute.value.path).toBe('/post/2')
    expect(Frame.stack).toHaveLength(2)
  })

  it('keep navigating while a tab that was never shown waits for its first page', async () => {
    const { router } = await mount(routes, {
      render: () => [
        h(RouterView, { name: 'inbox', initial: '/' }),
        h(RouterView, { name: 'settings', initial: '/settings', isLoaded: false }),
      ],
    })
    const settings = views.get('Frame')!.at(-1) as Frame

    await router.push('/list')
    await router.push('/items/9', { modal: true })
    await router.back()
    expect(paths(router.stack.value)).toEqual(['/', '/list'])

    const deepLink = router.push('/items/1', { frame: 'settings' })
    await settle()
    settings.load()
    await deepLink

    expect(paths(router.stack.value)).toEqual(['/settings', '/items/1'])
  })
})

describe('tab reselect', () => {
  const tabs = (reselect: boolean) => () =>
    h('TabView', [
      h('TabViewItem', { title: 'Inbox' }, [
        h(RouterView, { name: 'inbox', initial: '/', backToRootOnReselect: reselect }),
      ]),
      h('TabViewItem', { title: 'Settings' }, [
        h(RouterView, {
          name: 'settings',
          initial: '/settings',
          backToRootOnReselect: reselect,
        }),
      ]),
    ])
  const tabView = () =>
    views.get('TabView')!.at(-1) as unknown as Parameters<typeof reselected>[0]

  it('goes back to the first page of the tab tapped again', async () => {
    const { router } = await mount(routes, { render: tabs(true) })
    await settle()
    await router.push('/list', { frame: 'inbox' })
    await router.push('/items/1', { frame: 'inbox' })
    await router.push('/items/2', { frame: 'settings' })

    reselected(tabView(), 0)
    await settle()

    expect(paths(router.stack.value)).toEqual(['/'])
    expect(Frame.backs).toEqual([undefined])

    reselected(tabView(), 1)
    await settle()
    expect(paths(router.stack.value)).toEqual(['/settings'])
  })

  it('does nothing on the first page, and goes through leave guards', async () => {
    const Form = page('Form', () => onBeforeRouteLeave(() => false))
    const { router } = await mount([...routes, { path: '/form', component: Form }], {
      render: tabs(true),
    })
    await settle()

    reselected(tabView(), 0)
    await settle()
    expect(Frame.backs).toEqual([])

    await router.push('/form', { frame: 'inbox' })
    reselected(tabView(), 0)
    await settle()
    expect(paths(router.stack.value)).toEqual(['/', '/form'])
  })

  it('stays out of the way without the option, and once the view is gone', async () => {
    const { router, app } = await mount(routes, { render: tabs(false) })
    await settle()
    await router.push('/list', { frame: 'inbox' })

    reselected(tabView(), 0)
    await settle()
    expect(paths(router.stack.value)).toEqual(['/', '/list'])

    app.unmount()
    expect(() => reselected(tabView(), 0)).not.toThrow()
  })

  it('back goes to the first page with backToRoot()', async () => {
    const { router } = await mount(routes)
    await router.push('/list')
    await router.push('/items/1')

    expect(await router.backToRoot({ animated: false })).toBeUndefined()

    expect(paths(router.stack.value)).toEqual(['/'])
    expect(Frame.backs).toEqual([false])
  })
})

describe('setStack', () => {
  const Form = page('Form', () => onBeforeRouteLeave(() => false))
  const stackRoutes = [
    ...routes,
    { path: '/form', component: Form },
    { path: '/pick', component: page('Picker'), modal: true },
  ]
  const animated = () => Frame.navigations.slice(1).map((entry) => entry.animated)

  it('pushes what is missing on top of the pages both stacks share', async () => {
    const { router } = await mount(stackRoutes)

    expect(await router.setStack(['/', '/list', '/items/1'])).toBeUndefined()

    expect(paths(router.stack.value)).toEqual(['/', '/list', '/items/1'])
    expect(events).not.toContain('unmount Home')
    expect(animated()).toEqual([false, undefined])
  })

  it('goes back to the last shared page before pushing, without animating', async () => {
    const { router } = await mount(stackRoutes)
    await router.push('/list')
    await router.push('/items/1')

    await router.setStack(['/', '/settings'])

    expect(paths(router.stack.value)).toEqual(['/', '/settings'])
    expect(events).toContain('unmount List')
    expect(events).toContain('unmount Detail')
    expect(Frame.backs).toEqual([false])
    expect(animated().at(-1)).toBeUndefined()
  })

  it('only goes back, animated, when the target is a prefix of the stack', async () => {
    const { router } = await mount(stackRoutes)
    await router.push('/list')
    await router.push('/items/1')

    await router.setStack(['/'])

    expect(paths(router.stack.value)).toEqual(['/'])
    expect(Frame.backs).toEqual([undefined])
  })

  it('replaces everything when the stacks share nothing', async () => {
    const { router } = await mount(stackRoutes)
    await router.push('/list')

    await router.setStack(['/list', '/items/2'])

    expect(paths(router.stack.value)).toEqual(['/list', '/items/2'])
    expect(events).toContain('unmount Home')
    expect(Frame.navigations.at(-2)).toMatchObject({
      clearHistory: true,
      animated: false,
    })
  })

  it('does nothing when the stack already matches', async () => {
    const { router } = await mount(stackRoutes)
    await router.push('/list')
    const before = Frame.navigations.length

    expect(await router.setStack(['/', { name: 'list' }])).toBeUndefined()

    expect(Frame.navigations).toHaveLength(before)
    expect(Frame.backs).toEqual([])
  })

  it('runs the leave guards of the pages it drops', async () => {
    const { router } = await mount(stackRoutes)
    await router.push('/form')

    const failure = await router.setStack(['/', '/list'])

    expect(isNavigationFailure(failure, NavigationFailureType.aborted)).toBe(true)
    expect(paths(router.stack.value)).toEqual(['/', '/form'])
  })

  it('treats modal routes as pages, and targets a named frame', async () => {
    const { router } = await mount(stackRoutes, {
      render: () => [
        h(RouterView, { name: 'inbox', initial: '/' }),
        h(RouterView, { name: 'settings', initial: '/settings' }),
      ],
    })
    await settle()

    await router.setStack(['/settings', '/pick'], { frame: 'settings' })

    expect(View.presented).toHaveLength(0)
    expect(paths(router.stack.value)).toEqual(['/settings', '/pick'])
  })

  it('back() can skip the animation', async () => {
    const { router } = await mount(stackRoutes)
    await router.push('/list')

    await router.back({ animated: false })

    expect(Frame.backs).toEqual([false])
  })
})

describe('withParents', () => {
  const nested = [
    ...routes.filter((route) => route.path !== '/settings'),
    {
      path: '/settings',
      component: Settings,
      children: [
        {
          path: 'account',
          name: 'account',
          component: page('Account'),
          children: [{ path: 'security', component: page('Security') }],
        },
      ],
    },
    { path: '/admin', children: [{ path: 'users', component: page('Users') }] },
    {
      path: '/users/:id',
      component: page('User'),
      children: [{ path: 'posts/:postId', name: 'post', component: page('Post') }],
    },
  ]

  it('pushes the parents that have a component before the page', async () => {
    const { router } = await mount(nested)

    expect(
      await router.push('/settings/account/security', { withParents: true }),
    ).toBeUndefined()

    expect(paths(router.stack.value)).toEqual([
      '/',
      '/settings',
      '/settings/account',
      '/settings/account/security',
    ])
    expect(Frame.navigations.slice(1).map((entry) => entry.animated)).toEqual([
      false,
      false,
      undefined,
    ])
  })

  it('picks up after the parent already on top', async () => {
    const { router } = await mount(nested)
    await router.push('/settings')

    await router.push('/settings/account/security', { withParents: true })

    expect(paths(router.stack.value)).toEqual([
      '/',
      '/settings',
      '/settings/account',
      '/settings/account/security',
    ])
    expect(Frame.navigations).toHaveLength(4)
  })

  it('skips parents without a component', async () => {
    const { router } = await mount(nested)

    await router.push('/admin/users', { withParents: true })

    expect(paths(router.stack.value)).toEqual(['/', '/admin/users'])
  })

  it('gives the parents their params', async () => {
    const { router } = await mount(nested)

    await router.push(
      { name: 'post', params: { id: 7, postId: 3 } },
      { withParents: true },
    )

    expect(paths(router.stack.value)).toEqual(['/', '/users/7', '/users/7/posts/3'])
  })

  it('with clearHistory, the parents become the whole stack', async () => {
    const { router } = await mount(nested)
    await router.push('/list')

    await router.push('/settings/account', { withParents: true, clearHistory: true })

    expect(paths(router.stack.value)).toEqual(['/settings', '/settings/account'])
    expect(events).toContain('unmount Home')
  })

  it('stops when a guard refuses a parent', async () => {
    const { router } = await mount(nested, {
      before: (router) => router.beforeEach((to) => to.path !== '/settings'),
    })

    const failure = await router.push('/settings/account', { withParents: true })

    expect(isNavigationFailure(failure, NavigationFailureType.aborted)).toBe(true)
    expect(paths(router.stack.value)).toEqual(['/'])
  })

  it('is a plain push when the page is already on top', async () => {
    const { router } = await mount(nested)
    await router.push('/settings/account', { withParents: true })

    const failure = await router.push('/settings/account', { withParents: true })

    expect(isNavigationFailure(failure, NavigationFailureType.duplicated)).toBe(true)
    expect(paths(router.stack.value)).toEqual(['/', '/settings', '/settings/account'])
  })
})

describe('redirect records', () => {
  it('follow redirects and keep the query', async () => {
    const { router } = await mount([
      ...routes,
      { path: '/old-settings', redirect: '/settings' },
      {
        path: '/u/:id',
        redirect: (to: RouteLocation) => ({ name: 'item', params: to.params }),
      },
    ])

    await router.push('/old-settings?from=email')
    expect(router.currentRoute.value.fullPath).toBe('/settings?from=email')
    expect(router.currentRoute.value.redirectedFrom?.path).toBe('/old-settings')

    await router.push('/u/9')
    expect(router.currentRoute.value.fullPath).toBe('/items/9')
  })
})
