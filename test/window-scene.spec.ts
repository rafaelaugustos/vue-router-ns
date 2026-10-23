import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { Frame, setPlatform } from './shims/core.js'
import { watchWindowSceneState } from '../src/window-state.ios.js'
import type { RouterWindow } from '../src/windows.js'

const stops: (() => void)[] = []
beforeEach(() => setPlatform('ios'))
afterEach(() => {
  for (const stop of stops.splice(0)) stop()
})

function fixture() {
  const delegate = {}
  const entries = [{ key: 'first' }, { key: 'second' }]
  const pages = entries.map((entry) => ({
    ios: { _entry: entry, _delegate: delegate, _transition: { name: 'slide' } } as any,
    _setupUI: vi.fn(function (this: any) {
      this.ios = {}
    }),
  }))
  const frame = new Frame()
  let current = pages[1]
  Object.defineProperties(frame, {
    currentPage: { get: () => current },
    backStack: { get: () => [{ resolvedPage: pages[0] }] },
  })
  const initialize = vi.fn()
  frame.initNativeView = initialize
  const callbacks = new Map<string, () => void>()
  const window = {
    rootView: frame,
    on: (event: string, fn: () => void) => callbacks.set(event, fn),
    off: (event: string) => callbacks.delete(event),
  } as unknown as RouterWindow
  const stop = watchWindowSceneState(window)
  stops.push(stop)
  const detach = () => callbacks.get('sceneDidDisconnect')?.()
  const rebuild = (count = 0) => {
    for (const page of pages) page.ios = null
    const controller = {
      viewControllers: { count },
      setViewControllersAnimated: vi.fn(),
      delegate: undefined,
    }
    frame.ios = { controller }
    frame.initNativeView()
    return controller
  }
  return {
    frame,
    pages,
    entries,
    delegate,
    detach,
    rebuild,
    initialize,
    stop,
    callbacks,
    replace: () => {
      current = undefined
    },
  }
}

it('rebuilds the native stack using retained pages and navigation metadata', () => {
  const f = fixture()
  f.detach()
  const controller = f.rebuild()
  expect(f.initialize).toHaveBeenCalledOnce()
  expect(controller.setViewControllersAnimated).toHaveBeenCalledWith(
    f.pages.map((page) => page.ios),
    false,
  )
  expect(controller.delegate).toBe(f.delegate)
  for (const [index, page] of f.pages.entries()) {
    expect(page._setupUI).toHaveBeenCalledOnce()
    expect(page.ios._entry).toBe(f.entries[index])
    expect(page.ios._delegate).toBe(f.delegate)
    expect(page.ios._transition).toEqual({ name: 'slide' })
  }
  expect(f.frame.initNativeView).toBe(f.initialize)
})

it('does not overwrite a stack already reconstructed by Core', () => {
  const f = fixture()
  f.detach()
  const controller = f.rebuild(2)
  expect(controller.setViewControllersAnimated).not.toHaveBeenCalled()
  expect(f.pages[0]!._setupUI).not.toHaveBeenCalled()
})

it('does not resurrect entries removed before reattachment', () => {
  const f = fixture()
  f.detach()
  f.replace()
  expect(f.rebuild().setViewControllersAnimated).not.toHaveBeenCalled()
})

it('removes pending native hooks when the owning router closes', () => {
  const f = fixture()
  f.detach()
  f.stop()
  expect(f.callbacks.size).toBe(0)
  expect(f.frame.initNativeView).toBe(f.initialize)
  expect(f.rebuild().setViewControllersAnimated).not.toHaveBeenCalled()
})

it('does not wrap native initialization twice for duplicate disconnect events', () => {
  const f = fixture()
  f.detach()
  f.detach()
  expect(f.rebuild().setViewControllersAnimated).toHaveBeenCalledOnce()
  expect(f.initialize).toHaveBeenCalledOnce()
  expect(f.frame.initNativeView).toBe(f.initialize)
})

it('leaves Android frame recreation to Core', () => {
  setPlatform('android')
  const f = fixture()
  expect(f.callbacks.size).toBe(0)
  f.detach()
  expect(f.rebuild().setViewControllersAnimated).not.toHaveBeenCalled()
})
