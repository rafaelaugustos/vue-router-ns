import { describe, it, expect, vi } from 'vitest'
import { h, ref, defineComponent, getCurrentInstance } from 'nativescript-vue'
import {
  RouterTabs,
  RouterTab,
  RouterView,
  RouterSplitView,
  type RouteRecordRaw,
} from '../src/index.js'
import { mount, page, settle, paths } from './helpers.js'
import { Frame, TabView, installMaterial, View } from './shims/core.js'
import { views } from './shims/nativescript-vue.js'

const routes: RouteRecordRaw[] = [
  { path: '/', component: page('Root') },
  { path: '/detail', component: page('Detail'), meta: { tabBarVisibility: 'hidden' } },
  { path: '/visible', component: page('Visible'), meta: { tabBarVisibility: 'visible' } },
  {
    path: '/blocked',
    component: page('Blocked'),
    meta: { tabBarVisibility: 'hidden' },
    beforeEnter: () => false,
  },
  {
    path: '/broken',
    component: async () => {
      throw new Error('load failed')
    },
    meta: { tabBarVisibility: 'hidden' },
  },
  {
    path: '/group',
    meta: { tabBarVisibility: 'hidden' },
    children: [
      {
        path: 'inherited',
        component: page('Inherited'),
        meta: { tabBarVisibility: 'inherit' },
      },
      {
        path: 'visible',
        component: page('Override'),
        meta: { tabBarVisibility: 'visible' },
      },
    ],
  },
]
const tree = (props = {}, initial = '/', prefix = '') =>
  h(RouterTabs, props, () =>
    ['a', 'b'].map((name) =>
      h(RouterTab, { name, title: name }, () =>
        h(RouterView, { name: prefix + name, initial }),
      ),
    ),
  )
function controller(index = -1) {
  const view = views.get('TabView')!.at(index) as TabView
  const native = {
    tabBarHidden: false,
    setTabBarHiddenAnimated: vi.fn((value: boolean, _animated?: boolean) => {
      native.tabBarHidden = value
    }),
  }
  view.ios = native
  ;(view as any).requestLayout = vi.fn()
  view.notify({ eventName: 'loaded', object: view })
  return { view, native }
}

describe('committed tab visibility', () => {
  it('follows push, visible override, native back, replacement and root resets', async () => {
    const { app, router } = await mount(routes, { render: () => tree() })
    const { native } = controller()
    await router.push('/detail', { frame: 'a' })
    await settle()
    expect(native.tabBarHidden).toBe(true)
    await router.push('/visible', { frame: 'a' })
    await settle()
    expect(native.tabBarHidden).toBe(false)
    const frame = views.get('Frame')!.at(-2) as Frame
    frame.popNatively()
    await settle()
    expect(native.tabBarHidden).toBe(true)
    await router.replace('/visible', { frame: 'a' })
    await settle()
    expect(native.tabBarHidden).toBe(false)
    await router.push('/detail', { frame: 'a' })
    await router.backToRoot({ frame: 'a' })
    await settle()
    expect(native.tabBarHidden).toBe(false)
    expect(paths(router.stack.value)).toEqual(['/'])
    expect(
      native.setTabBarHiddenAnimated.mock.calls.every((call) => call[1] === false),
    ).toBe(true)
    app.unmount()
  })
  it('keeps presentation through pending/rejected guards and a failed lazy load', async () => {
    const { app, router } = await mount(routes, { render: () => tree() })
    const { native } = controller()
    await router.push('/blocked', { frame: 'a' })
    await settle()
    expect(native.tabBarHidden).toBe(false)
    await expect(router.push('/broken', { frame: 'a' })).rejects.toThrow('load failed')
    expect(native.tabBarHidden).toBe(false)
    let allow!: (value: boolean) => void
    const stop = router.beforeEach(
      () => new Promise<boolean>((resolve) => (allow = resolve)),
    )
    const pending = router.push('/detail', { frame: 'a' })
    await settle()
    expect(native.tabBarHidden).toBe(false)
    allow(false)
    await pending
    stop()
    expect(native.tabBarHidden).toBe(false)
    await router.push('/detail', { frame: 'a' })
    await settle()
    const before = native.setTabBarHiddenAnimated.mock.calls.length
    // A cancelled gesture does not commit a native page change.
    const frame = views.get('Frame')!.at(-2) as Frame
    frame.notify({ eventName: Frame.navigatedToEvent, object: frame })
    await settle()
    expect(native.tabBarHidden).toBe(true)
    expect(native.setTabBarHiddenAnimated).toHaveBeenCalledTimes(before)
    app.unmount()
  })
  it('inherits matched parents, with explicit visible overrides', async () => {
    const { app, router } = await mount(routes, { render: () => tree() })
    const { native } = controller()
    await router.push('/group/inherited', { frame: 'a' })
    await settle()
    expect(native.tabBarHidden).toBe(true)
    await router.push('/group/visible', { frame: 'a' })
    await settle()
    expect(native.tabBarHidden).toBe(false)
    app.unmount()
  })
  it('changes only the selected tab and leaves modal metadata out of its presenter', async () => {
    const selected = ref('a')
    const { app, router } = await mount(routes, {
      render: () => tree({ selected: selected.value }),
    })
    const { native } = controller()
    await router.push('/detail', { frame: 'a' })
    await settle()
    expect(native.tabBarHidden).toBe(true)
    await router.push('/visible', { frame: 'a', modal: true })
    await settle()
    expect(native.tabBarHidden).toBe(true)
    await router.back()
    await settle()
    selected.value = 'b'
    await settle()
    expect(native.tabBarHidden).toBe(false)
    await router.push('/detail', { frame: 'b', modal: true })
    await settle()
    expect(native.tabBarHidden).toBe(false)
    await router.back()
    selected.value = 'a'
    await settle()
    expect(native.tabBarHidden).toBe(true)
    app.unmount()
    expect(native.tabBarHidden).toBe(false)
  })
  it('applies initial/restored hidden detail and deep links to an unopened tab', async () => {
    const { app, router } = await mount(routes, {
      render: () => tree({}, '/detail'),
      links: { schemes: ['tabs'], frame: () => 'b' },
      restore: {
        save() {},
        load: () => ({
          version: 2,
          savedAt: Date.now(),
          stacks: { a: ['/', '/detail'] },
        }),
      },
    })
    await settle()
    const { native, view } = controller()
    expect(native.tabBarHidden).toBe(true)
    await router.openLink('tabs://visible')
    await settle()
    expect(view.selectedIndex).toBe(1)
    expect(native.tabBarHidden).toBe(false)
    app.unmount()
  })
  it('isolates independent containers and nested RouterTabs', async () => {
    const nested = {
      ...routes[0]!,
      path: '/nested',
      component: { render: () => h('Page', {}, [tree({}, '/', 'inner-')]) },
    }
    const { app, router } = await mount([...routes, nested], {
      render: () =>
        h('GridLayout', {}, [tree({}, '/', 'left-'), tree({}, '/', 'right-')]),
    })
    const left = controller(-2).native,
      right = controller(-1).native
    await router.push('/detail', { frame: 'left-a' })
    await settle()
    expect(left.tabBarHidden).toBe(true)
    expect(right.tabBarHidden).toBe(false)
    await router.push('/nested', { frame: 'right-a' })
    await settle()
    const inner = controller().native
    await router.push('/detail', { frame: 'inner-a' })
    await settle()
    expect(inner.tabBarHidden).toBe(true)
    expect(right.tabBarHidden).toBe(false)
    expect(left.tabBarHidden).toBe(true)
    app.unmount()
  })
  it('follows the logical split top through compact and wide layouts', async () => {
    const { app, router } = await mount(routes, {
      render: () =>
        h(RouterTabs, {}, () =>
          h(RouterTab, { name: 'split' }, () =>
            h(RouterSplitView, { name: 'split', list: '/' }),
          ),
        ),
    })
    const { native } = controller()
    await router.push('/detail', { frame: 'split' })
    await settle()
    expect(native.tabBarHidden).toBe(true)
    const layout = views.get('Frame')!.at(-2)!.parent!
    layout.width = 1000
    layout.notify({ eventName: 'layoutChanged', object: layout })
    await settle()
    expect(native.tabBarHidden).toBe(true)
    await router.back({ frame: 'split' })
    await settle()
    expect(native.tabBarHidden).toBe(false)
    app.unmount()
  })
  it('retains policy and pages across covered HMR and reapplies the returning route', async () => {
    let context: { reload?: () => void } | undefined
    const setup = () => {
      context = getCurrentInstance()!.appContext
      return () => h('Page')
    }
    const component = Object.assign(defineComponent({ setup }), {
      __hmrId: 'visibility-covered',
    })
    const hmr = (globalThis as any).__VUE_HMR_RUNTIME__
    hmr.createRecord(component.__hmrId, component)
    const { app, router } = await mount(
      [{ path: '/', component, meta: { tabBarVisibility: 'hidden' } }, routes[2]!],
      {
        render: () =>
          h(RouterTabs, {}, () =>
            h(RouterTab, { name: 'a' }, () => h(RouterView, { name: 'a', initial: '/' })),
          ),
      },
    )
    const { native } = controller()
    await settle()
    expect(native.tabBarHidden).toBe(true)
    const reload = vi.fn()
    context!.reload = reload
    await router.push('/visible', { frame: 'a' })
    await settle()
    hmr.reload(component.__hmrId, { ...component, setup })
    await settle()
    expect(native.tabBarHidden).toBe(false)
    expect(reload).not.toHaveBeenCalled()
    await router.back({ frame: 'a' })
    await settle()
    expect(native.tabBarHidden).toBe(true)
    app.unmount()
  })
  it('keeps the sidebar navigator visible and ignores unsupported Core fallback', async () => {
    const sidebar = ref(true)
    const { app, router } = await mount(routes, {
      render: () => tree({ sidebar: sidebar.value }),
    })
    const { native } = controller()
    await router.push('/detail', { frame: 'a' })
    await settle()
    expect(native.tabBarHidden).toBe(false)
    sidebar.value = false
    await settle()
    expect(native.tabBarHidden).toBe(true)
    app.unmount()
    const fallback = await mount(routes, { platform: 'android', render: () => tree() })
    const view = views.get('TabView')!.at(-1) as TabView
    await fallback.router.push('/detail', { frame: 'a' })
    await settle()
    expect(view.visibility).toBe('visible')
    fallback.app.unmount()
  })
  it('collapses Material navigation and rail without changing frames or selection', async () => {
    const uninstall = installMaterial()
    try {
      const { app, router } = await mount(routes, {
        platform: 'android',
        render: () => tree(),
      })
      const host = views.get('RouterTabsHost')!.at(-1) as View
      const frames = views.get('Frame')!.slice(-2) as Frame[]
      await router.push('/detail', { frame: 'a' })
      await settle()
      let bar = views.get('RouterNavigationBar')!.at(-1) as View
      expect(bar.visibility).toBe('collapse')
      expect(bar.accessibilityHidden).toBe(true)
      host.width = 800
      host.notify({ eventName: 'layoutChanged', object: host })
      await settle()
      bar = views.get('RouterNavigationBar')!.at(-1) as View
      expect(bar.visibility).toBe('collapse')
      expect(views.get('Frame')!.slice(-2)).toEqual(frames)
      expect(frames[0]!.backStack).toHaveLength(1)
      await router.back({ frame: 'a' })
      await settle()
      expect(bar.visibility).toBe('visible')
      expect(bar.accessibilityHidden).toBe(false)
      app.unmount()
    } finally {
      uninstall()
    }
  })
})
