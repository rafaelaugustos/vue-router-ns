import { isAndroid, type View } from '@nativescript/core'

/** Internal geometry is in device-independent window coordinates. */
export interface WindowFold {
  left: number
  top: number
  right: number
  bottom: number
  vertical: boolean
  separating: boolean
  occluding: boolean
}
export interface SplitViewport {
  x: number
  y: number
  width: number
  height: number
  rtl: boolean
}
export interface SplitGeometry {
  columns: string
  rows: string
  listColumn: number
  detailColumn: number
  listRow: number
  detailRow: number
  expanded: boolean
}

/** Reserve a physical fold strip without changing Frame or Page ownership. */
export function splitGeometry(
  view: SplitViewport,
  folds: readonly WindowFold[],
  breakpoint: number,
  listWidth: number,
): SplitGeometry {
  const base: SplitGeometry = {
    columns: '*',
    rows: '*',
    listColumn: 0,
    detailColumn: 0,
    listRow: 0,
    detailRow: 0,
    expanded: view.width >= breakpoint,
  }
  for (const fold of folds) {
    if (!fold.separating && !fold.occluding) continue
    const start = fold.vertical ? fold.left - view.x : fold.top - view.y
    const end = fold.vertical ? fold.right - view.x : fold.bottom - view.y
    const length = fold.vertical ? view.width : view.height
    const crossStart = fold.vertical ? fold.top - view.y : fold.left - view.x
    const crossEnd = fold.vertical ? fold.bottom - view.y : fold.right - view.x
    const crossLength = fold.vertical ? view.height : view.width
    if (
      ![start, end, length, crossStart, crossEnd].every(Number.isFinite) ||
      end < start ||
      crossEnd <= 0 ||
      crossStart >= crossLength ||
      end <= 0 ||
      start >= length
    )
      continue
    // GridLayout parses string lengths as integer DIPs. Round away from the fold.
    const before = Math.max(0, Math.floor(start))
    const after = Math.max(0, Math.floor(length) - Math.ceil(end))
    const gap = Math.max(0, Math.ceil(Math.min(length, end)) - before)
    const expanded = before > 0 && after > 0
    const first = expanded ? (fold.vertical && view.rtl ? 2 : 0) : before > after ? 0 : 2
    const second = expanded ? 2 - first : first
    return {
      ...base,
      expanded,
      columns: fold.vertical ? `${before}, ${gap}, *` : '*',
      rows: fold.vertical ? '*' : `${before}, ${gap}, *`,
      listColumn: fold.vertical ? first : 0,
      detailColumn: fold.vertical ? second : 0,
      listRow: fold.vertical ? 0 : first,
      detailRow: fold.vertical ? 0 : second,
    }
  }
  if (base.expanded) {
    const width = Math.min(listWidth, view.width / 2)
    base.columns = view.rtl ? `*, ${width}` : `${width}, *`
    base.listColumn = view.rtl ? 1 : 0
    base.detailColumn = view.rtl ? 0 : 1
  }
  return base
}

declare const android: any
declare const androidx: any
declare const java: any

function ownerActivity(view: View): any {
  let context = view.nativeViewProtected?.getContext()
  const seen = new Set()
  while (context && !seen.has(context)) {
    if (context instanceof android.app.Activity) return context
    seen.add(context)
    context = context.getBaseContext?.()
  }
}

export function splitViewport(view: View): SplitViewport {
  const { width, height } = view.getActualSize()
  const result = { x: 0, y: 0, width, height, rtl: false }
  if (isAndroid && view.nativeViewProtected && typeof android !== 'undefined') {
    const native = view.nativeViewProtected
    const location = (Array as any).create('int', 2)
    native.getLocationInWindow(location)
    const density = native.getResources().getDisplayMetrics().density
    result.x = (location[0] + native.getPaddingLeft()) / density
    result.y = (location[1] + native.getPaddingTop()) / density
    result.width =
      (native.getWidth() - native.getPaddingLeft() - native.getPaddingRight()) / density
    result.height =
      (native.getHeight() - native.getPaddingTop() - native.getPaddingBottom()) / density
    result.rtl = native.getLayoutDirection() === 1
  }
  return result
}

/** Optional WindowManager bridge; a missing dependency retains width-only layout. */
export function observeWindowFolds(
  view: View,
  changed: (folds: readonly WindowFold[]) => void,
): () => void {
  if (!isAndroid || typeof androidx === 'undefined' || typeof android === 'undefined')
    return () => {}
  let Adapter: any, Tracker: any, Feature: any
  try {
    Adapter = androidx.window?.java?.layout?.WindowInfoTrackerCallbackAdapter
    Tracker = androidx.window?.layout?.WindowInfoTracker
    Feature = androidx.window?.layout?.FoldingFeature
  } catch {
    return () => {}
  }
  if (!Adapter || !Tracker || !Feature) return () => {}
  let detach: (() => void) | undefined
  let generation = 0
  const unload = () => {
    generation++
    detach?.()
    detach = undefined
    changed([])
  }
  const load = () => {
    unload()
    const activity = ownerActivity(view)
    if (!activity) return
    const current = generation
    const adapter = new Adapter(Tracker.getOrCreate(activity))
    const consumer = new androidx.core.util.Consumer({
      accept(info: any) {
        if (current !== generation) return
        const density = view.nativeViewProtected
          .getResources()
          .getDisplayMetrics().density
        const features = info.getDisplayFeatures()
        const folds: WindowFold[] = []
        for (let i = 0; i < features.size(); i++) {
          const feature = features.get(i)
          if (!(feature instanceof Feature)) continue
          const bounds = feature.getBounds()
          // Kotlin companion constants are not consistently exposed by native metadata.
          folds.push({
            left: bounds.left / density,
            top: bounds.top / density,
            right: bounds.right / density,
            bottom: bounds.bottom / density,
            vertical: String(feature.getOrientation()) === 'VERTICAL',
            separating: feature.isSeparating(),
            occluding: String(feature.getOcclusionType()) === 'FULL',
          })
        }
        changed(folds)
      },
    })
    const executor = new java.util.concurrent.Executor({
      execute(task: any) {
        activity.runOnUiThread(task)
      },
    })
    detach = () => adapter.removeWindowLayoutInfoListener(consumer)
    adapter.addWindowLayoutInfoListener(activity, executor, consumer)
  }
  view.on('loaded', load)
  view.on('unloaded', unload)
  if (view.isLoaded) load()
  return () => {
    view.off('loaded', load)
    view.off('unloaded', unload)
    unload()
  }
}

/** Parent movement and RTL changes need not change the GridLayout's own bounds. */
export function observeSplitViewport(view: View, changed: () => void): () => void {
  if (!isAndroid || typeof android === 'undefined' || !android.view?.ViewTreeObserver)
    return () => {}
  let detach: (() => void) | undefined
  const unload = () => {
    detach?.()
    detach = undefined
  }
  const load = () => {
    unload()
    const observer = view.nativeViewProtected?.getViewTreeObserver()
    if (!observer?.isAlive()) return
    const listener = new android.view.ViewTreeObserver.OnPreDrawListener({
      onPreDraw() {
        changed()
        return true
      },
    })
    observer.addOnPreDrawListener(listener)
    detach = () => {
      if (observer.isAlive()) observer.removeOnPreDrawListener(listener)
    }
    changed()
  }
  view.on('loaded', load)
  view.on('unloaded', unload)
  if (view.isLoaded) load()
  return () => {
    view.off('loaded', load)
    view.off('unloaded', unload)
    unload()
  }
}
