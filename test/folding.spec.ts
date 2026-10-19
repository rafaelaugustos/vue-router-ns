import { afterEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick, ref } from 'nativescript-vue'
import * as folding from '../src/folding.js'
import { RouterSplitView } from '../src/index.js'
import { mount, page, paths } from './helpers.js'
import { View, setPlatform } from './shims/core.js'
import { views } from './shims/nativescript-vue.js'

const viewport = { x: 0, y: 24, width: 1000, height: 700, rtl: false }
const hinge: folding.WindowFold = {
  left: 480,
  right: 520,
  top: 0,
  bottom: 800,
  vertical: true,
  separating: true,
  occluding: true,
}
const calculate = (folds: folding.WindowFold[], overrides = {}) =>
  folding.splitGeometry({ ...viewport, ...overrides }, folds, 840, 320)
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('fold geometry', () => {
  it('reserves an occluding hinge and reverses pane order in RTL', () => {
    expect(calculate([hinge])).toMatchObject({
      columns: '480, 40, *',
      expanded: true,
      listColumn: 0,
      detailColumn: 2,
    })
    expect(calculate([hinge], { rtl: true })).toMatchObject({
      columns: '480, 40, *',
      listColumn: 2,
      detailColumn: 0,
    })
  })
  it('uses view-local coordinates and separates horizontal tabletop panes', () => {
    expect(
      calculate([
        { ...hinge, vertical: false, left: 0, right: 1000, top: 360, bottom: 380 },
      ]),
    ).toMatchObject({ columns: '*', rows: '336, 20, *', listRow: 0, detailRow: 2 })
    expect(calculate([hinge], { x: 100, width: 800 })).toMatchObject({
      columns: '380, 40, *',
      expanded: true,
    })
  })
  it('uses a separating zero-width fold even below the width breakpoint', () => {
    expect(
      calculate([{ ...hinge, left: 300, right: 300, occluding: false }], { width: 600 }),
    ).toMatchObject({ columns: '300, 0, *', expanded: true })
  })
  it.each([
    [{ ...hinge, separating: false, occluding: false }],
    [{ ...hinge, left: 1200, right: 1240 }],
    [{ ...hinge, top: 800, bottom: 900 }],
    [{ ...hinge, right: 400 }],
    [{ ...hinge, left: NaN }],
  ])('falls back for irrelevant or invalid geometry: %j', (feature) => {
    expect(calculate([feature])).toMatchObject({
      columns: '320, *',
      rows: '*',
      expanded: true,
    })
  })
  it('clips a partially overlapping hinge and keeps both frames in the usable region', () => {
    expect(calculate([{ ...hinge, left: -10, right: 20 }])).toMatchObject({
      columns: '0, 20, *',
      expanded: false,
      listColumn: 2,
      detailColumn: 2,
    })
    expect(calculate([{ ...hinge, left: 980, right: 1010 }])).toMatchObject({
      columns: '980, 20, *',
      expanded: false,
      listColumn: 0,
      detailColumn: 0,
    })
  })
  it('rounds fractional DIPs outward so native integer grid lengths cannot cover the fold', () => {
    expect(calculate([{ ...hinge, left: 420.5714, right: 420.5714 }])).toMatchObject({
      columns: '420, 1, *',
    })
  })
  it('does not activate a second pane for a sub-DIP remainder truncated by the grid', () => {
    expect(calculate([{ ...hinge, left: 980, right: 999.8 }])).toMatchObject({
      expanded: false,
      listColumn: 0,
      detailColumn: 0,
    })
  })
  it('retains width-based layout without a relevant display feature', () => {
    expect(calculate([])).toMatchObject({ columns: '320, *', expanded: true })
    expect(calculate([], { width: 400 })).toMatchObject({ columns: '*', expanded: false })
    expect(calculate([], { rtl: true })).toMatchObject({
      columns: '*, 320',
      listColumn: 1,
      detailColumn: 0,
    })
  })
})

it('changes posture without replacing Frames, native entries, drafts or guards, including under a modal', async () => {
  let update!: (folds: readonly folding.WindowFold[]) => void
  const stop = vi.fn()
  vi.spyOn(folding, 'observeWindowFolds').mockImplementation((_view, changed) => {
    update = changed
    return stop
  })
  const enabled = ref(true)
  const { router, app } = await mount(
    [
      { path: '/list', component: page('list') },
      { path: '/one', component: page('one') },
      { path: '/two', component: page('two') },
      { path: '/modal', component: page('modal'), modal: true },
    ],
    { render: () => h(RouterSplitView, { list: '/list', foldAware: enabled.value }) },
  )
  const [list, detail] = views.get('Frame')!.slice(-2) as any[]
  const layout = list.parent
  layout.width = 1000
  layout.notify({ eventName: 'layoutChanged' })
  await router.push('/one')
  await router.push('/two')
  const entries = [...router.stack.value]
  const nativePages = [
    list.currentPage,
    detail.currentPage,
    ...detail.backStack.map((e: any) => e.resolvedPage),
  ]
  const guard = vi.fn()
  router.beforeEach(guard)
  for (const fold of [
    hinge,
    { ...hinge, vertical: false, left: 0, right: 1000, top: 400, bottom: 420 },
  ]) {
    update([fold])
    await nextTick()
    expect(router.stack.value).toEqual(entries)
    expect([
      list.currentPage,
      detail.currentPage,
      ...detail.backStack.map((e: any) => e.resolvedPage),
    ]).toEqual(nativePages)
  }
  expect(guard).not.toHaveBeenCalled()
  await router.push('/modal')
  update([hinge])
  await nextTick()
  await router.back()
  expect(detail.currentPage).toBe(nativePages[1])
  expect(paths(router.stack.value)).toEqual(['/list', '/one', '/two'])
  enabled.value = false
  await nextTick()
  expect(stop).toHaveBeenCalledOnce()
  expect(layout.columns).toBe('320, *')
  app.unmount()
})

it('subscribes to the owning Activity, converts pixels and drops callbacks after unload/disposal', () => {
  setPlatform('android')
  class Activity {
    runOnUiThread(task: any) {
      task.run()
    }
  }
  class Feature {
    static Orientation = { VERTICAL: 'vertical' }
    static OcclusionType = { FULL: 'full' }
    getBounds() {
      return { left: 960, right: 1040, top: 0, bottom: 1600 }
    }
    getOrientation() {
      return { toString: () => 'VERTICAL' }
    }
    getOcclusionType() {
      return { toString: () => 'FULL' }
    }
    isSeparating() {
      return true
    }
  }
  const activity = new Activity(),
    added: any[][] = [],
    removed: any[] = []
  class Adapter {
    addWindowLayoutInfoListener(...args: any[]) {
      added.push(args)
    }
    removeWindowLayoutInfoListener(consumer: any) {
      removed.push(consumer)
    }
  }
  class Impl {
    constructor(impl: object) {
      Object.assign(this, impl)
    }
  }
  vi.stubGlobal('android', { app: { Activity } })
  const getOrCreate = vi.fn(() => ({}))
  vi.stubGlobal('androidx', {
    core: { util: { Consumer: Impl } },
    window: {
      java: { layout: { WindowInfoTrackerCallbackAdapter: Adapter } },
      layout: { WindowInfoTracker: { getOrCreate }, FoldingFeature: Feature },
    },
  })
  vi.stubGlobal('java', { util: { concurrent: { Executor: Impl } } })
  const view = new View()
  view.native = {
    getContext: () => ({ getBaseContext: () => activity }),
    getResources: () => ({ getDisplayMetrics: () => ({ density: 2 }) }),
  }
  const changed = vi.fn()
  const dispose = folding.observeWindowFolds(view as any, changed)
  expect(getOrCreate).toHaveBeenCalledWith(activity)
  expect(added[0]![0]).toBe(activity)
  const info = { getDisplayFeatures: () => ({ size: () => 1, get: () => new Feature() }) }
  added[0]![2].accept(info)
  expect(changed).toHaveBeenLastCalledWith([{ ...hinge, top: 0, bottom: 800 }])
  view.notify({ eventName: 'unloaded' })
  const calls = changed.mock.calls.length
  added[0]![2].accept(info)
  expect(changed).toHaveBeenCalledTimes(calls)
  view.notify({ eventName: 'loaded' })
  expect(added).toHaveLength(2)
  dispose()
  expect(removed).toHaveLength(2)
  expect(view.listenerCount('loaded')).toBe(0)
  expect(view.listenerCount('unloaded')).toBe(0)
})

it('observes parent movement/RTL layout passes and detaches native observers', () => {
  setPlatform('android')
  class Listener {
    constructor(impl: object) {
      Object.assign(this, impl)
    }
  }
  vi.stubGlobal('android', {
    view: { ViewTreeObserver: { OnPreDrawListener: Listener } },
  })
  const added: any[] = [],
    removed: any[] = []
  const view = new View()
  view.native = {
    getViewTreeObserver: () => ({
      isAlive: () => true,
      addOnPreDrawListener: (listener: any) => added.push(listener),
      removeOnPreDrawListener: (listener: any) => removed.push(listener),
    }),
  }
  const changed = vi.fn()
  const dispose = folding.observeSplitViewport(view as any, changed)
  expect(changed).toHaveBeenCalledOnce()
  expect(added[0].onPreDraw()).toBe(true)
  expect(changed).toHaveBeenCalledTimes(2)
  view.notify({ eventName: 'unloaded' })
  expect(removed).toEqual([added[0]])
  view.notify({ eventName: 'loaded' })
  expect(added).toHaveLength(2)
  dispose()
  expect(removed).toEqual(added)
  expect(view.listenerCount('loaded')).toBe(0)
})

it('retains width-only behavior without the optional WindowManager dependency', () => {
  setPlatform('android')
  vi.stubGlobal('android', { app: {} })
  vi.stubGlobal('androidx', {})
  const view = new View(),
    changed = vi.fn()
  const stop = folding.observeWindowFolds(view as any, changed)
  expect(view.listenerCount('loaded')).toBe(0)
  stop()
  expect(changed).not.toHaveBeenCalled()
})
