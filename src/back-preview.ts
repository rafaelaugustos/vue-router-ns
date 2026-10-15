import { SharedTransition, type Frame, type Page } from '@nativescript/core'
import type { BackGestureEdge } from './android.js'

interface Animator {
  cancel(): void
  translationX(value: number): Animator
  scaleX(value: number): Animator
  scaleY(value: number): Animator
  alpha(value: number): Animator
  setDuration(ms: number): Animator
  withEndAction(action: object): Animator
}

interface NativeView {
  getElevation(): number
  getLayoutParams(): object
  setLayoutParams(params: object): void
  getWidth(): number
  getAlpha(): number
  getScaleX(): number
  getScaleY(): number
  getTranslationX(): number
  getTranslationY(): number
  setTranslationY(value: number): void
  getParent(): unknown
  getContext(): any
  getBackground(): unknown
  setBackground(drawable: unknown): void
  setElevation(value: number): void
  setTranslationX(value: number): void
  setScaleX(value: number): void
  setScaleY(value: number): void
  setAlpha(value: number): void
  animate(): Animator
}

interface Container extends NativeView {
  addView(view: NativeView, index: number, params: object): void
  removeView(view: NativeView): void
}

declare const java: { lang: { Runnable: new (impl: { run(): void }) => object } }
declare const org: {
  nativescript: { widgets: { CommonLayoutParams: new () => object } }
}
declare const android: {
  R: { attr: { colorBackground: number } }
  util: { TypedValue: new () => { data: number } }
  graphics: { drawable: { ColorDrawable: new (color: number) => object } }
}

export interface BackPreview {
  readonly active: boolean
  progress(progress: number, edge: BackGestureEdge): void
  cancel(): void
  /** Stops immediately when another navigation or teardown takes over. */
  dispose(): void
  /** Finishes the swipe and goes back. */
  commit(): void
}

const MIN_SCALE = 0.9
/** How far the page drifts toward the finger, as a share of the frame's width. */
const DRIFT = 0.05
/** How far the page below starts, as a share of the frame's width. */
const PARALLAX = 0.15
const SETTLE_MS = 200
const ELEVATION_DP = 8

/**
 * Shows the page below while the Android back swipe moves, the way native
 * fragments do. NativeScript keeps a page's native view while it waits in the
 * back stack, and reattaches that same view when going back, detaching it
 * from wherever it is first. So the router can put it behind the page on top
 * for the length of the swipe, and let the frame take it from there.
 */
export function previewBack(
  frame: Frame,
  top: Page,
  below: Page,
  goBack: () => Promise<unknown>,
  onDispose: () => void = () => {},
): BackPreview | undefined {
  const container = frame.nativeView as Container | undefined
  const topView = top.nativeView as NativeView | undefined
  const belowView = below.nativeView as NativeView | undefined
  if (typeof container?.addView !== 'function' || !topView || !belowView) return undefined
  if (belowView.getParent() || frame.currentPage !== top) return undefined

  const width = container.getWidth()
  if (width <= 0) return undefined
  let direction = 1
  let phase: 'dragging' | 'settling' | 'disposed' = 'dragging'
  const params = belowView.getLayoutParams()
  const restoreTop = snapshot(topView)
  const accessibilityHidden = below.accessibilityHidden
  below.accessibilityHidden = true

  container.addView(belowView, 0, new org.nativescript.widgets.CommonLayoutParams())
  const unveil = reset(belowView)
  const restoreShared = revealSharedElements(below, top)
  const land = lift(topView)

  const place = (progress: number) => {
    const scale = 1 - (1 - MIN_SCALE) * progress
    topView.setScaleX(scale)
    topView.setScaleY(scale)
    topView.setTranslationX(direction * DRIFT * width * progress)
    belowView.setTranslationX(-direction * PARALLAX * width * (1 - progress))
  }

  const dispose = () => {
    if (phase === 'disposed') return
    phase = 'disposed'
    topView.animate().cancel()
    belowView.animate().cancel()
    // A completed pop has already handed this view back to the Frame.
    if (frame.currentPage !== below) {
      if (belowView.getParent() === container) container.removeView(belowView)
      belowView.setLayoutParams(params)
      unveil()
      restoreShared()
    }
    restoreTop()
    // A focus owner may already have made the returning page accessible.
    below.accessibilityHidden =
      frame.currentPage === below
        ? accessibilityHidden && below.accessibilityHidden
        : accessibilityHidden
    land()
    onDispose()
  }

  const settle = (
    view: NativeView,
    to: Partial<Record<'x' | 'scale' | 'alpha', number>>,
    done?: () => void,
  ) => {
    let animator = view.animate().setDuration(SETTLE_MS)
    if (to.x !== undefined) animator = animator.translationX(to.x)
    if (to.scale !== undefined) animator = animator.scaleX(to.scale).scaleY(to.scale)
    if (to.alpha !== undefined) animator = animator.alpha(to.alpha)
    if (done)
      animator.withEndAction(
        new java.lang.Runnable({
          run: () => {
            if (phase !== 'disposed') done()
          },
        }),
      )
  }

  place(0)

  const cancel = () => {
    if (phase === 'disposed') return
    phase = 'settling'
    settle(topView, { x: 0, scale: 1, alpha: 1 })
    settle(belowView, { x: -direction * PARALLAX * width }, dispose)
  }

  return {
    get active() {
      return phase !== 'disposed'
    },
    dispose,
    progress(progress, edge) {
      if (phase !== 'dragging') return
      direction = edge === 'right' ? -1 : 1
      place(Math.max(0, Math.min(1, progress)))
    },
    cancel,
    commit() {
      if (phase !== 'dragging') return
      phase = 'settling'
      settle(topView, { x: direction * width, alpha: 0 })
      settle(belowView, { x: 0 }, () => {
        // The router reports guard errors; rejection must still restore the views.
        void goBack().then((failure) => {
          if (failure) cancel()
          else dispose()
        }, cancel)
      })
    },
  }
}

/** Saves the native transforms without changing the page's NativeScript styles. */
function snapshot(view: NativeView): () => void {
  const saved = {
    alpha: view.getAlpha(),
    scaleX: view.getScaleX(),
    scaleY: view.getScaleY(),
    x: view.getTranslationX(),
    y: view.getTranslationY(),
  }
  return () => {
    view.setAlpha(saved.alpha)
    view.setScaleX(saved.scaleX)
    view.setScaleY(saved.scaleY)
    view.setTranslationX(saved.x)
    view.setTranslationY(saved.y)
  }
}

/** Reveals a page left faded or transformed by its outgoing transition. */
function reset(view: NativeView): () => void {
  const restore = snapshot(view)
  view.setAlpha(1)
  view.setScaleX(1)
  view.setScaleY(1)
  view.setTranslationY(0)
  return restore
}

/** AndroidX hides shared elements with a separate alpha, even when getAlpha() is 1. */
function revealSharedElements(below: Page, top: Page): () => void {
  const restore = SharedTransition.getSharedElements(below, top).presenting.flatMap(
    (view) => {
      const native = view.nativeView as
        | {
            getTransitionAlpha(): number
            setTransitionAlpha(alpha: number): void
          }
        | undefined
      if (!native) return []
      const alpha = native.getTransitionAlpha()
      native.setTransitionAlpha(1)
      return [() => native.setTransitionAlpha(alpha)]
    },
  )
  return () => {
    for (const reset of restore) reset()
  }
}

/** Gives the page on top a background and a shadow, so the page below doesn't show through. */
function lift(view: NativeView): () => void {
  const context = view.getContext()
  const background = view.getBackground()
  const elevation = view.getElevation()
  if (!background)
    view.setBackground(
      new android.graphics.drawable.ColorDrawable(themeBackground(context)),
    )
  const density = context?.getResources?.().getDisplayMetrics().density ?? 1
  view.setElevation(ELEVATION_DP * density)

  return () => {
    if (!background) view.setBackground(null)
    view.setElevation(elevation)
  }
}

function themeBackground(context: any): number {
  const value = new android.util.TypedValue()
  const found = context
    ?.getTheme?.()
    .resolveAttribute(android.R.attr.colorBackground, value, true)
  return found ? value.data : -1
}
