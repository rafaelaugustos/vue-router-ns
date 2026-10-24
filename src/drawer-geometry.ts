import type { SplitViewport, WindowFold } from './folding.js'

export type DrawerPresentation = 'overlay' | 'permanent' | 'auto'
export type ResolvedDrawerPresentation = Exclude<DrawerPresentation, 'auto'>
export interface DrawerRect {
  x: number
  y: number
  width: number
  height: number
}
export interface DrawerGeometry {
  presentation: ResolvedDrawerPresentation
  width: number
  height: number
  pane: DrawerRect
  content: DrawerRect
}

/** Geometry only: neither a route host nor a new owner of the mounted stacks. */
export function drawerGeometry(
  view: SplitViewport,
  folds: readonly WindowFold[],
  presentation: DrawerPresentation,
  breakpoint: number,
  requestedWidth: number,
): DrawerGeometry {
  const width = Math.max(0, view.width)
  const height = Math.max(0, view.height)
  const permanent =
    presentation === 'permanent' ||
    (presentation === 'auto' &&
      width >= (Number.isFinite(breakpoint) ? Math.max(0, breakpoint) : 840))
  const paneWidth = Math.min(
    Number.isFinite(requestedWidth) ? Math.max(0, requestedWidth) : 300,
    permanent ? width / 2 : Math.max(0, width - 44),
  )
  const result: DrawerGeometry = {
    presentation: permanent ? 'permanent' : 'overlay',
    width,
    height,
    pane: { x: view.rtl ? width - paneWidth : 0, y: 0, width: paneWidth, height },
    content: {
      x: permanent && !view.rtl ? paneWidth : 0,
      y: 0,
      width: width - (permanent ? paneWidth : 0),
      height,
    },
  }
  if (!permanent) return result
  for (const fold of folds) {
    if (!fold.separating && !fold.occluding) continue
    const start = Math.floor(fold.vertical ? fold.left - view.x : fold.top - view.y)
    const end = Math.ceil(fold.vertical ? fold.right - view.x : fold.bottom - view.y)
    const crossStart = fold.vertical ? fold.top - view.y : fold.left - view.x
    const crossEnd = fold.vertical ? fold.bottom - view.y : fold.right - view.x
    const length = fold.vertical ? width : height
    const crossLength = fold.vertical ? height : width
    if (
      ![start, end, crossStart, crossEnd].every(Number.isFinite) ||
      end < start ||
      end <= 0 ||
      start >= length ||
      crossEnd <= 0 ||
      crossStart >= crossLength
    )
      continue
    const before = Math.max(0, start)
    const afterStart = Math.min(length, end)
    const after = length - afterStart
    if (fold.vertical && before > 0 && after > 0) {
      const first = { x: 0, y: 0, width: before, height }
      const second = { x: afterStart, y: 0, width: after, height }
      result.pane = view.rtl ? second : first
      result.content = view.rtl ? first : second
    } else {
      // A horizontal hinge keeps the navigation pane beside its content, on
      // the larger usable segment. Never place interactive controls on a hinge.
      const offset = before >= after ? 0 : afterStart
      const available = Math.max(before, after)
      if (fold.vertical) {
        const pane = Math.min(paneWidth, available / 2)
        result.pane = {
          x: offset + (view.rtl ? available - pane : 0),
          y: 0,
          width: pane,
          height,
        }
        result.content = {
          x: offset + (view.rtl ? 0 : pane),
          y: 0,
          width: available - pane,
          height,
        }
      } else {
        result.pane.y = result.content.y = offset
        result.pane.height = result.content.height = available
      }
    }
    break
  }
  return result
}
