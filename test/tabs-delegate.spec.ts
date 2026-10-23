import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { onTabReselect, setSelectVeto } from '../src/tabs.js'
import { resetNative, setPlatform, TabView } from './shims/core.js'

const stops: (() => void)[] = []
beforeEach(() => {
  vi.useFakeTimers()
  resetNative()
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
})
afterEach(() => {
  stops.splice(0).forEach((stop) => stop())
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function fixture() {
  const view = new TabView()
  const controllers = [{}, {}]
  const tabs = controllers.map((viewController) => ({ viewController }))
  const list = (items: object[]) => ({
    count: items.length,
    indexOfObject: (item: object) => items.indexOf(item),
    objectAtIndex: (index: number) => items[index],
  })
  const inner = {
    tabBarControllerShouldSelectViewController: vi.fn(
      (c, vc) => c.selectedViewController !== vc,
    ),
    tabBarControllerDidSelectViewController: vi.fn((_c, vc) => {
      view.selectedIndex = controllers.indexOf(vc)
    }),
    tabBarControllerShouldSelectTab: vi.fn(
      (c, tab) => !!c.viewControllers || c.selectedTab !== tab,
    ),
    tabBarControllerDidSelectTabPreviousTab: vi.fn((c, tab, _previous) => {
      if (!c.viewControllers) view.selectedIndex = tabs.indexOf(tab)
    }),
  }
  const controller = (view.ios = {
    delegate: inner,
    viewControllers: list(controllers),
    tabs: list(tabs),
    selectedIndex: 0,
    selectedViewController: controllers[0],
    selectedTab: tabs[0],
  })
  const reselect = vi.fn()
  stops.push(onTabReselect(view, 0, () => reselect(0)))
  stops.push(onTabReselect(view, 1, () => reselect(1)))
  return { view, controller, controllers, tabs, inner, reselect }
}

describe('UIKit tab delegate', () => {
  it('does not reinstall a detached observer from an already queued loaded callback', async () => {
    const { controller, inner } = fixture()
    stops.splice(0).forEach((stop) => stop())
    await Promise.resolve()
    expect(controller.delegate).toBe(inner)
  })

  it('forwards legacy selection, vetoes changes and reports a genuine reselect', async () => {
    const { view, controller, controllers, inner, reselect } = fixture()
    await Promise.resolve()
    const delegate = controller.delegate
    setSelectVeto(view as any, () => false)
    expect(
      delegate.tabBarControllerShouldSelectViewController(controller, controllers[1]),
    ).toBe(false)
    expect(inner.tabBarControllerShouldSelectViewController).not.toHaveBeenCalled()
    vi.runAllTimers()
    setSelectVeto(view as any, undefined)
    expect(
      delegate.tabBarControllerShouldSelectViewController(controller, controllers[1]),
    ).toBe(true)
    controller.selectedViewController = controllers[1]
    delegate.tabBarControllerDidSelectViewController(controller, controllers[1])
    expect(view.selectedIndex).toBe(1)
    expect(reselect).not.toHaveBeenCalled()
    vi.runAllTimers()
    expect(
      delegate.tabBarControllerShouldSelectViewController(controller, controllers[1]),
    ).toBe(false)
    expect(reselect).toHaveBeenCalledExactlyOnceWith(1)
  })

  it.each(['controller', 'tab'] as const)(
    'coalesces repeated %s callbacks within one native event',
    async (mode) => {
      const { view, controller, controllers, tabs, inner, reselect } = fixture()
      if (mode === 'tab') controller.viewControllers = null as any
      await Promise.resolve()
      const delegate = controller.delegate
      const shouldSelect = () =>
        mode === 'tab'
          ? delegate.tabBarControllerShouldSelectTab(controller, tabs[1])
          : delegate.tabBarControllerShouldSelectViewController(
              controller,
              controllers[1],
            )
      const synchronize = () => {
        view.selectedIndex = 1
        // Also tolerate a callback reentering while selection is synchronized.
        shouldSelect()
      }
      inner.tabBarControllerDidSelectViewController.mockImplementation(synchronize)
      inner.tabBarControllerDidSelectTabPreviousTab.mockImplementation(synchronize)
      expect(shouldSelect()).toBe(true)
      controller.selectedViewController = controllers[1]
      controller.selectedTab = tabs[1]
      if (mode === 'tab')
        delegate.tabBarControllerDidSelectTabPreviousTab(controller, tabs[1], tabs[0])
      else delegate.tabBarControllerDidSelectViewController(controller, controllers[1])
      expect(view.selectedIndex).toBe(1)
      expect(reselect).not.toHaveBeenCalled()
      shouldSelect()
      expect(reselect).not.toHaveBeenCalled()
      // The next event turn is a new tap, with no millisecond debounce threshold.
      vi.runAllTimers()
      expect(shouldSelect()).toBe(false)
      expect(reselect).toHaveBeenCalledExactlyOnceWith(1)
    },
  )

  it('restores selection observation even if Core throws during synchronization', async () => {
    const { controller, controllers, inner, reselect } = fixture()
    await Promise.resolve()
    const delegate = controller.delegate
    inner.tabBarControllerDidSelectViewController.mockImplementation(() => {
      throw new Error('native failure')
    })
    expect(() =>
      delegate.tabBarControllerDidSelectViewController(controller, controllers[0]),
    ).toThrow('native failure')
    delegate.tabBarControllerShouldSelectViewController(controller, controllers[0])
    expect(reselect).toHaveBeenCalledExactlyOnceWith(0)
  })

  it('reports a repeated active-tab action once and does not debounce the next tap', async () => {
    const { controller, controllers, reselect } = fixture()
    await Promise.resolve()
    const delegate = controller.delegate
    for (let i = 0; i < 2; i++) {
      expect(
        delegate.tabBarControllerShouldSelectViewController(controller, controllers[0]),
      ).toBe(false)
    }
    expect(reselect).toHaveBeenCalledExactlyOnceWith(0)
    vi.runAllTimers()
    delegate.tabBarControllerShouldSelectViewController(controller, controllers[0])
    expect(reselect).toHaveBeenCalledTimes(2)
  })

  it('cleans pending selection state when the last subscriber detaches', async () => {
    const { view, controller, controllers, inner, reselect } = fixture()
    await Promise.resolve()
    controller.delegate.tabBarControllerShouldSelectViewController(
      controller,
      controllers[0],
    )
    expect(vi.getTimerCount()).toBe(1)
    stops.splice(0).forEach((stop) => stop())
    expect(vi.getTimerCount()).toBe(0)
    expect(controller.delegate).toBe(inner)
    expect(view.listenerCount('loaded')).toBe(0)
    stops.push(onTabReselect(view, 0, () => reselect(0)))
    await Promise.resolve()
    controller.delegate.tabBarControllerShouldSelectViewController(
      controller,
      controllers[0],
    )
    expect(reselect).toHaveBeenCalledTimes(2)
  })
})

describe('Android core TabView fallback', () => {
  it('only reselects on an in-bounds release on the current tab and detaches its listeners', () => {
    setPlatform('android')
    vi.stubGlobal('android', {
      view: {
        MotionEvent: { ACTION_UP: 1 },
        View: {
          OnTouchListener: class {
            constructor(methods: object) {
              Object.assign(this, methods)
            }
          },
        },
      },
    })
    const nativeItems = [0, 1].map(() => ({
      listener: null as any,
      setOnTouchListener(listener: any) {
        this.listener = listener
      },
      getWidth: () => 100,
      getHeight: () => 50,
    }))
    const view = Object.assign(new TabView(), {
      _tabLayout: {
        getItemCount: () => 2,
        getViewForItemAt: (index: number) => nativeItems[index],
      },
    })
    const reselect = vi.fn()
    stops.push(onTabReselect(view, 1, reselect))
    const release = (x = 10, action = 1) =>
      nativeItems[1]!.listener.onTouch(nativeItems[1], {
        getAction: () => action,
        getX: () => x,
        getY: () => 10,
      })
    expect(release()).toBe(false) // switching tabs is left to Core
    expect(reselect).not.toHaveBeenCalled()
    view.selectedIndex = 1
    release(10, 0)
    release(101)
    expect(reselect).not.toHaveBeenCalled()
    expect(release()).toBe(false)
    expect(reselect).toHaveBeenCalledTimes(1)
    stops.splice(0).forEach((stop) => stop())
    expect(nativeItems.map((item) => item.listener)).toEqual([null, null])
  })
})
