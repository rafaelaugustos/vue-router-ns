import { afterEach, describe, expect, it, vi } from 'vitest'
import { Fragment, h, ref } from 'nativescript-vue'
import {
  RouterTab,
  RouterTabs,
  RouterView,
  NavigationFailureType,
  useNativeSearch,
  type NativeSearch,
} from '../src/index.js'
import { reselected } from '../src/tabs.js'
import { mount, page, paths, settle } from './helpers.js'
import {
  Frame,
  installMaterial,
  NavigationBarStub,
  pressAndroidBack,
  TabView,
  type View,
} from './shims/core.js'
import { views } from './shims/nativescript-vue.js'

afterEach(() => vi.unstubAllGlobals())

function tree(options: Record<string, unknown> = {}) {
  return () =>
    h(RouterTabs, options, () => [
      h(
        RouterTab,
        { name: 'a', title: 'Inbox', icon: 'tray', androidIcon: 'tab_inbox', badge: 2 },
        () => h(RouterView, { name: 'a', initial: '/', backToRootOnReselect: true }),
      ),
      h(RouterTab, { name: 'b', title: 'Settings' }, () =>
        h(RouterView, { name: 'b', initial: '/b', backToRootOnReselect: true }),
      ),
    ])
}
const routes = [
  { path: '/', component: page('Home') },
  { path: '/detail', component: page('Detail') },
  { path: '/b', component: page('B') },
  { path: '/b/detail', component: page('BDetail') },
]

describe('native tab host', () => {
  it('renders UIKit tabs, reveals a tab for a navigation into its stack and goes back to root on reselect', async () => {
    const selected = vi.fn()
    const reselect = vi.fn()
    const { app, router } = await mount(routes, {
      render: tree({ 'onUpdate:selected': selected, onReselect: reselect }),
    })
    const tabView = views.get('TabView')!.at(-1) as TabView
    const items = views.get('TabViewItem')!.slice(-2) as any[]
    expect(items.map((item) => [item.title, item.iconSource])).toEqual([
      ['Inbox', 'sys://tray'],
      ['Settings', undefined],
    ])
    expect(tabView.selectedIndex).toBe(0)

    await router.push('/b/detail', { frame: 'b' })
    expect(tabView.selectedIndex).toBe(1)
    expect(selected).toHaveBeenLastCalledWith('b')
    expect(router.currentRoute.value.path).toBe('/b/detail')

    tabView.selectedIndex = 0
    await settle()
    expect(selected).toHaveBeenLastCalledWith('a')

    await router.push('/detail', { frame: 'a' })
    reselected(tabView, 0)
    await settle()
    expect(reselect).toHaveBeenCalledWith('a')
    expect(router.currentRoute.value.path).toBe('/')
    app.unmount()
  })

  it('applies badges and the sidebar to the controller, and lets canSelect refuse a tap', async () => {
    vi.stubGlobal('UITabBarControllerMode', { Automatic: 0, TabSidebar: 1 })
    vi.stubGlobal('UITabBarControllerDelegate', {})
    vi.stubGlobal('NSObject', {
      extend(methods: object) {
        return class {
          constructor() {
            Object.assign(this, methods)
          }
        }
      },
    })
    const sidebar = ref(true)
    const allowed = ref(false)
    const canSelect = vi.fn(() => allowed.value)
    const selected = vi.fn()
    const { app } = await mount(routes, {
      render: () =>
        tree({
          sidebar: sidebar.value,
          canSelect,
          'onUpdate:selected': selected,
        })(),
    })
    const tabView = views.get('TabView')!.at(-1) as TabView
    const tabs = [{ badgeValue: 'old' }, { badgeValue: 'old' }]
    const controllers = [{}, {}]
    tabView.ios = {
      delegate: { tabBarControllerShouldSelectViewController: () => true },
      tabs: { count: 2, objectAtIndex: (index: number) => tabs[index] },
      viewControllers: { indexOfObject: (vc: object) => controllers.indexOf(vc) },
      selectedViewController: controllers[0],
      mode: 0,
    }
    tabView.isLoaded = false
    sidebar.value = false
    await settle()
    sidebar.value = true
    await settle()
    expect(tabView.ios.mode).toBe(0)
    expect(tabs.map((tab) => tab.badgeValue)).toEqual(['old', 'old'])
    tabView.isLoaded = true
    tabView.notify({ eventName: 'loaded', object: tabView })
    await settle()
    expect(tabs.map((tab) => tab.badgeValue)).toEqual(['2', null])
    expect(tabView.ios.mode).toBe(1)

    const tap = () => {
      if (
        tabView.ios.delegate.tabBarControllerShouldSelectViewController(
          tabView.ios,
          controllers[1],
        )
      )
        tabView.selectedIndex = 1
    }
    tap()
    expect(tabView.selectedIndex).toBe(0)
    expect(selected).not.toHaveBeenCalled()
    expect(canSelect).toHaveBeenCalledTimes(1)
    allowed.value = true
    tap()
    await settle()
    expect(tabView.selectedIndex).toBe(1)
    expect(canSelect).toHaveBeenCalledTimes(2)
    sidebar.value = false
    await settle()
    expect(tabView.ios.mode).toBe(0)
    app.unmount()
  })

  it('reveals an unopened iOS tab before waiting for its initial page', async () => {
    const canSelect = vi.fn(() => false)
    const { app, router } = await mount(routes, {
      links: { schemes: ['example'], frame: () => 'b' },
      render: () =>
        h(RouterTabs, { canSelect }, () => [
          h(RouterTab, { name: 'a' }, () => h(RouterView, { name: 'a' })),
          h(RouterTab, { name: 'b' }, () =>
            h(RouterView, { name: 'b', initial: '/b', isLoaded: false }),
          ),
        ]),
    })
    const tabView = views.get('TabView')!.at(-1) as TabView
    const frame = views.get('Frame')!.at(-1) as Frame
    const pending = router.openLink('example://b/detail')
    await settle()
    expect(tabView.selectedIndex).toBe(1)
    expect(canSelect).not.toHaveBeenCalled()
    frame.load()
    expect((await pending).failure).toBeUndefined()
    expect(paths(router.stack.value)).toEqual(['/b', '/b/detail'])
    app.unmount()
  })

  it('reveals duplicates, modal destinations and setStack without a new page push', async () => {
    const { app, router } = await mount(routes, { render: tree() })
    const tabView = views.get('TabView')!.at(-1) as TabView
    const duplicate = await router.push('/b', { frame: 'b' })
    await settle()
    expect(duplicate?.type).toBe(NavigationFailureType.duplicated)
    expect(tabView.selectedIndex).toBe(1)
    tabView.selectedIndex = 0
    await settle()
    await router.push('/b/detail', { frame: 'b', modal: true })
    expect(tabView.selectedIndex).toBe(1)
    await router.back()
    tabView.selectedIndex = 0
    await settle()
    await router.setStack(['/b'], { frame: 'b' })
    await settle()
    expect(tabView.selectedIndex).toBe(1)
    app.unmount()
  })

  it('restores histories without switching the chosen tab', async () => {
    const { app } = await mount(routes, {
      render: tree({ selected: 'a' }),
      restore: {
        save: vi.fn(),
        load: () => ({
          version: 2,
          savedAt: Date.now(),
          stacks: { a: ['/', '/detail'], b: ['/b', '/b/detail'] },
        }),
      },
    })
    await settle()
    const tabView = views.get('TabView')!.at(-1) as TabView
    expect(tabView.selectedIndex).toBe(0)
    expect(
      views
        .get('Frame')!
        .slice(-2)
        .map((frame) => (frame as Frame).backStack.length),
    ).toEqual([1, 1])
    app.unmount()
  })

  it('uses Material navigation on Android, hides the other tabs and switches to a rail when wide', async () => {
    const uninstall = installMaterial()
    try {
      let search!: NativeSearch
      const searching = page('B', () => {
        search = useNativeSearch({ query: ref('') })
      })
      const selected = vi.fn()
      const reselect = vi.fn()
      const { app, router } = await mount(
        [routes[0]!, routes[1]!, { path: '/b', component: searching }, routes[3]!],
        {
          platform: 'android',
          render: tree({ 'onUpdate:selected': selected, onReselect: reselect }),
        },
      )
      const host = views.get('RouterTabsHost')!.at(-1) as View
      const bar = views.get('RouterNavigationBar')!.at(-1) as any
      const context = { getTheme: () => ({ resolveAttribute: () => false }) }
      bar._context = context
      bar.native = bar.createNativeView()
      bar.initNativeView()
      const native = NavigationBarStub.created.at(-1)!
      expect(native.context).toMatchObject({ base: context, theme: 2 })
      expect(native.items.map((item) => [item.title, item.icon])).toEqual([
        ['Inbox', 7],
        ['Settings', 0],
      ])
      expect(native.badges.get(0)).toMatchObject({ number: 2, visible: true })
      expect(native.selected).toBe(0)
      const cells = host.children.slice(0, 2)
      expect(cells.map((cell) => cell.visibility)).toEqual(['visible', 'collapse'])
      expect(search.activate()).toBe(false)

      native.tap(1)
      await settle()
      expect(selected).toHaveBeenLastCalledWith('b')
      expect(cells.map((cell) => cell.visibility)).toEqual(['collapse', 'visible'])
      expect(search.activate()).toBe(true)
      expect(router.currentRoute.value.path).toBe('/b')

      await router.push('/b/detail', { frame: 'b' })
      native.tap(1)
      await settle()
      expect(reselect).toHaveBeenCalledWith('b')
      expect(router.currentRoute.value.path).toBe('/b')

      await router.push('/detail', { frame: 'a' })
      expect(selected).toHaveBeenLastCalledWith('a')
      expect(native.selected).toBe(0)

      await router.push('/b/detail', { frame: 'b' })
      native.tap(0)
      await settle()
      expect(router.currentRoute.value.path).toBe('/detail')
      pressAndroidBack()
      await settle()
      expect(router.currentRoute.value.path).toBe('/')
      native.tap(1)
      await settle()
      expect(router.currentRoute.value.path).toBe('/b/detail')

      host.width = 800
      host.notify({ eventName: 'layoutChanged', object: host })
      await settle()
      const rail = views.get('RouterNavigationBar')!.at(-1) as any
      expect(rail).not.toBe(bar)
      expect(rail.rail).toBe(true)
      app.unmount()
    } finally {
      uninstall()
    }
  })

  it('falls back to the core TabView on Android without Material', async () => {
    const { app } = await mount(routes, { platform: 'android', render: tree() })
    const tabView = views.get('TabView')!.at(-1) as any
    expect(tabView.androidTabsPosition).toBe('bottom')
    expect((views.get('TabViewItem')!.at(-2) as any).iconSource).toBe('tab_inbox')
    app.unmount()
  })

  it('preserves Material menu items through page, badge and label updates', async () => {
    const uninstall = installMaterial()
    try {
      const badge = ref<number | string | null>(2)
      const title = ref('Inbox')
      const icon = ref<string | undefined>('tab_inbox')
      const showSettings = ref(true)
      const { app, router } = await mount(routes, {
        platform: 'android',
        render: () =>
          h(RouterTabs, {}, () => [
            h(
              RouterTab,
              {
                name: 'a',
                title: title.value,
                androidIcon: icon.value,
                badge: badge.value,
              },
              () => h(RouterView, { name: 'a' }),
            ),
            ...(showSettings.value
              ? [
                  h(RouterTab, { name: 'b', title: 'Settings', badge: 3 }, () =>
                    h(RouterView, { name: 'b', initial: '/b' }),
                  ),
                ]
              : []),
          ]),
      })
      const bar = views.get('RouterNavigationBar')!.at(-1) as any
      bar._context = { getTheme: () => ({ resolveAttribute: () => false }) }
      bar.native = bar.createNativeView()
      bar.initNativeView()
      const native = NavigationBarStub.created.at(-1)!
      const [inbox, settings] = native.items
      native.tap(1)
      await settle()
      expect(native.items[0]).toBe(inbox)
      expect(native.items[1]).toBe(settings)
      badge.value = 1
      await settle()
      expect(native.items[0]).toBe(inbox)
      expect(native.items[1]).toBe(settings)
      expect(native.badges.get(0)?.number).toBe(1)
      expect(native.selected).toBe(1)
      title.value = 'Mail'
      icon.value = undefined
      badge.value = 'new'
      await settle()
      expect(native.items[0]).toBe(inbox)
      expect(inbox).toMatchObject({ title: 'Mail', icon: 0 })
      expect(native.badges.get(0)).toEqual({ text: 'new', visible: true })
      await router.push('/b/detail', { frame: 'b' })
      expect(native.items[1]).toBe(settings)
      badge.value = null
      showSettings.value = false
      await settle()
      expect(native.items.map((item) => item.title)).toEqual(['Mail'])
      expect(native.badges.size).toBe(0)
      expect(native.selected).toBe(0)
      app.unmount()
    } finally {
      uninstall()
    }
  })

  it('keeps three fragment-rendered destinations and their histories across rail changes', async () => {
    const uninstall = installMaterial()
    try {
      const { app, router } = await mount(routes, {
        platform: 'android',
        render: () =>
          h(RouterTabs, {}, () => [
            h(
              Fragment,
              {},
              ['a', 'b', 'c'].map((name) =>
                h(RouterTab, { key: name, name, title: name }, () =>
                  h(RouterView, { name, initial: '/' }),
                ),
              ),
            ),
          ]),
      })
      const host = views.get('RouterTabsHost')!.at(-1) as View
      const frames = views.get('Frame')!.slice(-3) as Frame[]
      for (const name of ['a', 'b', 'c']) await router.push('/detail', { frame: name })
      host.width = 800
      host.notify({ eventName: 'layoutChanged', object: host })
      await settle()
      expect(host.children.slice(0, 3).map((cell) => cell.visibility)).toEqual([
        'collapse',
        'collapse',
        'visible',
      ])
      expect(views.get('Frame')!.slice(-3)).toEqual(frames)
      expect(frames.map((frame) => frame.backStack.length)).toEqual([1, 1, 1])
      host.width = 400
      host.notify({ eventName: 'layoutChanged', object: host })
      await settle()
      expect(views.get('Frame')!.slice(-3)).toEqual(frames)
      expect(frames.map((frame) => frame.backStack.length)).toEqual([1, 1, 1])
      app.unmount()
    } finally {
      uninstall()
    }
  })
})
