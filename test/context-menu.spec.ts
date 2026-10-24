import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  defineComponent,
  h,
  onMounted,
  onUnmounted,
  ref,
  withDirectives,
} from 'nativescript-vue'
import {
  RouterLink,
  vRoutePreview,
  usePageActions,
  attachRouteMenu,
  type PageActions,
  type RoutePreviewOptions,
} from '../src/index.js'
import { events, mount, page, settle } from './helpers.js'
import { views } from './shims/nativescript-vue.js'

afterEach(() => vi.unstubAllGlobals())

function stubUIKit() {
  vi.stubGlobal('NSObject', {
    extend: (methods: object) => {
      class Delegate {
        owner: any
        static new() {
          return new Delegate()
        }
      }
      Object.assign(Delegate.prototype, methods)
      return Delegate
    },
  })
  vi.stubGlobal('UIContextMenuInteractionDelegate', {})
  vi.stubGlobal('UIContextMenuInteraction', {
    alloc: () => ({
      initWithDelegate: (delegate: any) => ({
        delegate,
        updated: undefined as any,
        updateVisibleMenuWithBlock(block: (menu: unknown) => unknown) {
          this.updated = block(this.updated)
        },
        dismissMenu: vi.fn(),
      }),
    }),
  })
  vi.stubGlobal('UIContextMenuConfiguration', {
    configurationWithIdentifierPreviewProviderActionProvider: (
      identifier: unknown,
      preview: (() => unknown) | null,
      actions: (() => unknown) | null,
    ) => ({ identifier, preview, actions }),
  })
  vi.stubGlobal('NSMutableArray', {
    new: () => {
      const items: unknown[] = []
      return { items, addObject: (item: unknown) => items.push(item) }
    },
  })
  vi.stubGlobal('UIMenu', {
    menuWithTitleChildren: (_title: string, children: { items: unknown[] }) => ({
      children: children.items,
    }),
  })
  vi.stubGlobal('UIAction', {
    actionWithTitleImageIdentifierHandler: (
      title: string,
      image: unknown,
      _identifier: null,
      handler: () => void,
    ) => ({ title, image, handler, attributes: 0 }),
  })
  vi.stubGlobal('UIImage', { systemImageNamed: (name: string) => ({ name }) })
  vi.stubGlobal('UIMenuElementAttributes', { Destructive: 2, Disabled: 1 })
  vi.stubGlobal('UIContextMenuInteractionCommitStyle', { Pop: 1 })
  vi.stubGlobal('CGSizeMake', (width: number, height: number) => ({ width, height }))
}

const Preview = defineComponent({
  name: 'Preview',
  props: { id: String },
  setup(props) {
    onMounted(() => events.push('mount Preview'))
    onUnmounted(() => events.push('unmount Preview'))
    return () => h('Label', { text: `Preview ${props.id}` })
  },
})

function row(options: () => RoutePreviewOptions) {
  return defineComponent({
    name: 'List',
    setup() {
      onMounted(() => events.push('mount List'))
      return () =>
        h('Page', {}, [
          withDirectives(h('GridLayout', { id: 'row' }), [[vRoutePreview, options()]]),
        ])
    },
  })
}

const animator = () => ({
  preferredCommitStyle: 0,
  addCompletion(callback: () => void) {
    callback()
  },
})

describe('route context menus', () => {
  it('updates a visible native menu from shared state and rechecks availability before dispatch', async () => {
    stubUIKit()
    let actions!: PageActions
    const title = ref('Save'),
      allowed = ref(true),
      shown = ref(true),
      run = vi.fn()
    const component = defineComponent({
      setup() {
        actions = usePageActions([
          { id: 'save', title, enabled: allowed, visible: shown, destructive: true, run },
        ])
        const options = { to: '/', actions: actions.menu() }
        return () =>
          h('Page', {}, [withDirectives(h('GridLayout'), [[vRoutePreview, options]])])
      },
    })
    const { app } = await mount([{ path: '/', component }])
    const grid = views.get('GridLayout')!.at(-1)!
    const interaction = grid.ios.interactions[0]
    const config =
      interaction.delegate.contextMenuInteractionConfigurationForMenuAtLocation(
        null,
        null,
      )
    const native = config.actions()
    expect(native.children[0].attributes).toBe(2)
    title.value = 'Salvar'
    allowed.value = false
    expect(interaction.updated.children[0]).toMatchObject({
      title: 'Salvar',
      attributes: 3,
    })
    native.children[0].handler()
    expect(run).not.toHaveBeenCalled()
    shown.value = false
    expect(interaction.updated.children).toHaveLength(0)
    shown.value = allowed.value = true
    interaction.updated.children[0].handler()
    await settle()
    expect(run).toHaveBeenCalledOnce()
    grid.notify({ eventName: 'unloaded', object: grid })
    const lastUpdate = interaction.updated
    title.value = 'After unload'
    expect(interaction.updated).toBe(lastUpdate)
    native.children[0].handler()
    expect(run).toHaveBeenCalledOnce()
    app.unmount()
  })

  it('rejects both an action and a preview commit captured before row rebinding', async () => {
    stubUIKit()
    const oldRun = vi.fn(),
      newRun = vi.fn()
    const { router, app } = await mount([
      {
        path: '/',
        component: row(() => ({
          to: '/messages/1',
          preview: Preview,
          actions: [{ title: 'First item', run: oldRun }],
        })),
      },
      { path: '/messages/:id', component: page('Message') },
    ])
    const grid = views.get('GridLayout')!.at(-1)!
    const interaction = grid.ios.interactions[0],
      delegate = interaction.delegate
    const old = delegate.contextMenuInteractionConfigurationForMenuAtLocation(null, null)
    const oldAction = old.actions().children[0]
    attachRouteMenu(grid as any, {
      to: '/messages/2',
      actions: [{ title: 'Second item', run: newRun }],
    })
    const next = delegate.contextMenuInteractionConfigurationForMenuAtLocation(null, null)
    oldAction.handler()
    delegate.contextMenuInteractionWillPerformPreviewActionForMenuWithConfigurationAnimator(
      null,
      old,
      animator(),
    )
    await settle()
    expect(oldRun).not.toHaveBeenCalled()
    expect(router.currentRoute.value.path).toBe('/')
    next.actions().children[0].handler()
    expect(newRun).toHaveBeenCalledOnce()
    expect(interaction.dismissMenu).toHaveBeenCalled()
    app.unmount()
  })
  it('reports async actions and synchronous navigation failures from native callbacks', async () => {
    stubUIKit()
    const actionError = new Error('async action'),
      navigationError = new Error('sync navigation')
    const onError = vi.fn()
    const options = {
      to: '/',
      preview: Preview,
      onError,
      actions: [
        {
          title: 'Fail',
          run: async () => {
            throw actionError
          },
        },
      ],
    }
    const { app, router } = await mount([{ path: '/', component: row(() => options) }])
    const interaction = views.get('GridLayout')!.at(-1)!.ios.interactions[0]
    const delegate = interaction.delegate
    const config = delegate.contextMenuInteractionConfigurationForMenuAtLocation(
      null,
      null,
    )
    config.actions().children[0].handler()
    await settle()
    expect(onError).toHaveBeenCalledExactlyOnceWith(actionError)
    const push = vi.spyOn(router, 'push').mockImplementation(() => {
      throw navigationError
    })
    delegate.contextMenuInteractionWillPerformPreviewActionForMenuWithConfigurationAnimator(
      null,
      config,
      animator(),
    )
    await settle()
    expect(onError).toHaveBeenLastCalledWith(navigationError)
    expect(onError).toHaveBeenCalledTimes(2)
    push.mockRestore()
    app.unmount()
  })

  it('previews without touching the stack, commits through a push and lets the preview go', async () => {
    stubUIKit()
    const archive = vi.fn()
    const { app, router } = await mount([
      {
        path: '/',
        component: row(() => ({
          to: '/messages/1',
          preview: Preview,
          props: { id: '1' },
          size: { width: 300 },
          actions: [
            { title: 'Archive', image: 'archivebox', destructive: true, run: archive },
          ],
        })),
      },
      { path: '/messages/:id', component: page('Message') },
    ])
    const after = vi.fn()
    router.afterEach(after)
    const grid = views.get('GridLayout')!.at(-1)!
    expect(grid.ios.interactions).toHaveLength(1)
    const delegate = grid.ios.interactions[0].delegate

    const configuration = delegate.contextMenuInteractionConfigurationForMenuAtLocation(
      null,
      null,
    )
    const controller = configuration.preview()
    expect(events).toContain('mount Preview')
    expect(controller.preferredContentSize).toEqual({ width: 300, height: 200 })
    expect(controller.view.subviews).toHaveLength(1)
    expect(router.currentRoute.value.path).toBe('/')
    expect(after).not.toHaveBeenCalled()

    const menu = configuration.actions()
    expect(
      menu.children.map((action: any) => [
        action.title,
        action.image.name,
        action.attributes,
      ]),
    ).toEqual([['Archive', 'archivebox', 2]])
    menu.children[0].handler()
    expect(archive).toHaveBeenCalledOnce()

    const commit = animator()
    delegate.contextMenuInteractionWillPerformPreviewActionForMenuWithConfigurationAnimator(
      null,
      null,
      commit,
    )
    expect(commit.preferredCommitStyle).toBe(1)
    await settle()
    expect(router.currentRoute.value.path).toBe('/messages/1')
    expect(after).toHaveBeenCalledOnce()
    expect(events.filter((event) => event === 'mount Message')).toHaveLength(1)

    delegate.contextMenuInteractionWillEndForConfigurationAnimator(null, null, animator())
    expect(events).toContain('unmount Preview')

    grid.notify({ eventName: 'unloaded', object: grid })
    expect(grid.ios.interactions).toHaveLength(0)
    grid.notify({ eventName: 'loaded', object: grid })
    expect(grid.ios.interactions).toHaveLength(1)
    app.unmount()
  })

  it('keeps protected previews closed and reads the latest options on every press', async () => {
    stubUIKit()
    const allowed = ref(false)
    const to = ref('/messages/1')
    const { app, router } = await mount([
      {
        path: '/',
        component: row(() => ({
          to: to.value,
          preview: Preview,
          canPreview: () => allowed.value,
          actions: [{ title: 'Open later', to: '/messages/9' }],
        })),
      },
      { path: '/messages/:id', component: page('Message') },
    ])
    const delegate = views.get('GridLayout')!.at(-1)!.ios.interactions[0].delegate
    let configuration = delegate.contextMenuInteractionConfigurationForMenuAtLocation(
      null,
      null,
    )
    expect(configuration.preview).toBeNull()
    expect(configuration.actions).toBeTypeOf('function')

    allowed.value = true
    to.value = '/messages/2'
    await settle()
    configuration = delegate.contextMenuInteractionConfigurationForMenuAtLocation(
      null,
      null,
    )
    expect(configuration.preview).toBeTypeOf('function')
    delegate.contextMenuInteractionWillPerformPreviewActionForMenuWithConfigurationAnimator(
      null,
      null,
      animator(),
    )
    await settle()
    expect(router.currentRoute.value.path).toBe('/messages/2')
    app.unmount()
  })

  it('shows nothing for a route without preview or actions', async () => {
    stubUIKit()
    const { app } = await mount([{ path: '/', component: row(() => ({ to: '/' })) }])
    const delegate = views.get('GridLayout')!.at(-1)!.ios.interactions[0].delegate
    expect(
      delegate.contextMenuInteractionConfigurationForMenuAtLocation(null, null),
    ).toBeNull()
    app.unmount()
  })

  it('attaches through <RouterLink menu> once the child is loaded', async () => {
    stubUIKit()
    const Links = defineComponent({
      name: 'Links',
      setup() {
        return () =>
          h('Page', {}, [
            h(
              RouterLink,
              { to: '/messages/3', menu: { preview: Preview, props: { id: '3' } } },
              () => h('Button', { text: 'Open' }),
            ),
          ])
      },
    })
    const { app, router } = await mount([
      { path: '/', component: Links },
      { path: '/messages/:id', component: page('Message') },
    ])
    const button = views.get('Button')!.at(-1)!
    button.notify({ eventName: 'loaded', object: button })
    expect(button.ios.interactions).toHaveLength(1)
    const delegate = button.ios.interactions[0].delegate
    delegate.contextMenuInteractionConfigurationForMenuAtLocation(null, null).preview()
    expect(events).toContain('mount Preview')
    delegate.contextMenuInteractionWillPerformPreviewActionForMenuWithConfigurationAnimator(
      null,
      null,
      animator(),
    )
    await settle()
    expect(router.currentRoute.value.path).toBe('/messages/3')
    button.notify({ eventName: 'unloaded', object: button })
    expect(button.ios.interactions).toHaveLength(0)
    app.unmount()
  })

  it('offers the actions in an Android popup menu and opens from its first item', async () => {
    const popups: any[] = []
    class PopupMenu {
      items: { id: number; title: string }[] = []
      listener: any
      constructor(
        public context: unknown,
        public anchor: unknown,
      ) {
        popups.push(this)
      }
      getMenu() {
        return {
          clear: () => {
            this.items = []
          },
          add: (_group: number, id: number, _order: number, title: string) => {
            this.items.push({ id, title })
            return { setEnabled() {} }
          },
        }
      }
      setOnMenuItemClickListener(listener: any) {
        this.listener = listener
      }
      show() {}
      dismiss() {}
      setOnDismissListener() {}
    }
    ;(PopupMenu as any).OnMenuItemClickListener = function (this: any, impl: any) {
      return impl
    }
    ;(PopupMenu as any).OnDismissListener = function (this: any, impl: any) {
      return impl
    }
    vi.stubGlobal('android', {
      animation: { ValueAnimator: { areAnimatorsEnabled: () => true } },
      widget: { PopupMenu },
    })
    const archive = vi.fn()
    const { app, router } = await mount(
      [
        {
          path: '/',
          component: row(() => ({
            to: '/messages/1',
            openTitle: 'Read',
            actions: [{ title: 'Archive', run: archive }],
          })),
        },
        { path: '/messages/:id', component: page('Message') },
      ],
      { platform: 'android' },
    )
    const grid = views.get('GridLayout')!.at(-1)!
    grid.android = { getContext: () => 'context' }
    grid.notify({ eventName: 'longPress', object: grid })
    expect(popups).toHaveLength(1)
    expect(popups[0].items.map((item: any) => item.title)).toEqual(['Read', 'Archive'])
    popups[0].listener.onMenuItemClick({ getItemId: () => 1 })
    expect(archive).toHaveBeenCalledOnce()
    popups[0].listener.onMenuItemClick({ getItemId: () => 0 })
    await settle()
    expect(router.currentRoute.value.path).toBe('/messages/1')
    app.unmount()
  })
})
