import type { Frame as NativeFrame } from '@nativescript/core'
import { createApp, h } from 'nativescript-vue'
import { describe, expect, it, vi } from 'vitest'
import {
  createRouter,
  mountNativeHost,
  supportsUIKitSplitView,
  type SavedStacks,
} from '../src/index.js'
import { createUIKitSplitHost } from '../src/hosts/uikit-split.js'
import { uikitSplitViewClass, type UIKitSplitView } from '../src/uikit-split.js'
import { describeNativeHostContract } from './host-contract.js'
import { page } from './helpers.js'
import { Frame, NativeWindow, resetNative, setPlatform } from './shims/core.js'

function fixture() {
  const list = new Frame()
  const detail = new Frame()
  list.ios.controller.view = { window: {}, hidden: false, alpha: 1 }
  detail.ios.controller.view = { window: {}, hidden: false, alpha: 1 }
  const view = {
    viewController: { collapsed: false },
    hasDetail: false,
    showPrimary: vi.fn(),
    showSecondary: vi.fn(),
    columnsChanged: undefined,
  } as unknown as UIKitSplitView
  const host = createUIKitSplitHost(
    view,
    list as unknown as NativeFrame,
    detail as unknown as NativeFrame,
  )
  return { view, host, list, detail, popNatively: () => detail.popNatively() }
}
describeNativeHostContract('UIKit split', fixture)

describe('UIKit column integration', () => {
  it('retains saved history when initial column layout precedes window restoration', async () => {
    resetNative()
    setPlatform('ios')
    let saved: SavedStacks | null = {
      version: 2,
      savedAt: Date.now(),
      windowKey: 'primary',
      stacks: { default: ['/', '/detail'] },
    }
    let finishLoad!: () => void
    const loading = new Promise<void>((resolve) => {
      finishLoad = resolve
    })
    const router = createRouter({
      routes: [
        { path: '/', component: page('List') },
        { path: '/detail', component: page('Detail') },
      ],
      restore: {
        load: async () => {
          await loading
          return saved
        },
        save: (state) => {
          saved = state
        },
      },
    })
    const app = createApp({ render: () => h('GridLayout') }).use(router)
    app.start()
    const { host, view, list } = fixture()
    list.isLoaded = false
    const unmount = mountNativeHost(router, 'default', host)
    const window = Object.assign(new NativeWindow('split'), { isPrimary: true })
    list.isLoaded = true
    window.setContent(list)
    view.columnsChanged!()
    await Promise.resolve()
    await Promise.resolve()
    view.columnsChanged!()
    finishLoad()
    await router.isReady()
    expect(router.stack.value.map((route) => route.path)).toEqual(['/', '/detail'])
    expect(saved!.stacks.default).toEqual(['/', '/detail'])
    unmount()
    app.unmount()
  })

  it('does not load a UIKit view on Android or Core without SplitView', () => {
    setPlatform('android')
    expect(supportsUIKitSplitView()).toBe(false)
    expect(uikitSplitViewClass).toThrow(/requires iOS/)
    setPlatform('ios')
    expect(supportsUIKitSplitView()).toBe(false)
  })

  it('keeps Pages through column visibility changes and detaches on disposal', async () => {
    resetNative()
    const router = createRouter({
      routes: [
        { path: '/', component: page('List') },
        { path: '/detail', component: page('Detail') },
      ],
    })
    const app = createApp({ render: () => h('GridLayout') })
    app.use(router).start()
    const { host, view, list, detail } = fixture()
    const unmount = mountNativeHost(router, 'default', host)
    await router.isReady()
    await router.push('/detail')
    const pages = [...host.pages()]
    expect(view.showSecondary).toHaveBeenCalledOnce()
    expect(host.visible!()).toEqual(pages)
    list.ios.controller.view.window = null
    view.viewController.collapsed = true
    view.columnsChanged!()
    expect(host.visible!()).toEqual([pages[1]])
    expect(host.pages()).toEqual(pages)
    expect(router.stack.value.map((route) => route.path)).toEqual(['/', '/detail'])
    list.ios.controller.view.window = {}
    detail.ios.controller.view.superview = { hidden: true }
    view.columnsChanged!()
    expect(host.visible!()).toEqual([pages[0]])
    await router.back()
    expect(view.showPrimary).toHaveBeenCalledOnce()
    expect(view.hasDetail).toBe(false)
    expect(host.pages()).toEqual([pages[0]])
    unmount()
    expect(view.columnsChanged).toBeUndefined()
    expect(host.native).toBeNull()
    host.dispose()
  })
})
