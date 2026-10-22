import {
  Frame,
  isAndroid,
  isIOS,
  type AndroidActivityBackPressedEventData,
  type EventData,
  type NavigationEntry,
  type Page,
} from '@nativescript/core'
import { type Component } from 'nativescript-vue'
import { mountFramePage, disposeFramePage } from './frame-page.js'
import { windowOf } from '../windows.js'
import { backOwnerOf, hasBackGestures, watchBackGestures } from '../android.js'
import { previewBack } from '../back-preview.js'
import {
  NATIVE_HOST_VERSION,
  type NativeHost,
  type NativeHostBackOptions,
  type NativeHostDelegate,
  type NativeHostPushOptions,
} from '../host.js'
import { watchDismissAttempts } from '../ios.js'

export interface FrameHostOptions {
  /**
   * The frame is presented modally: the host can be closed, and the Android
   * back inside its dialog and the iOS dismissal attempts are its own.
   */
  modal?: boolean
  /** A name other than `'frame'` or `'modal-frame'`, for a presenter wrapping the frame. */
  kind?: string
  /** What holds the user's dismissal, instead of iOS's `modalInPresentation`. */
  holdDismissal?: (hold: boolean) => void
}

/** The pages a frame holds, bottom to top. */
export function framePages(frame: Frame): Page[] {
  return [
    ...frame.backStack.map((entry) => entry.resolvedPage),
    frame.currentPage,
  ].filter((page): page is Page => !!page)
}

export function ownsFrameBack(frame: Frame): boolean {
  return Frame.topmost(windowOf(frame) as never) === frame
}

/** Mounts `component` in `frame` the way `<RouterView>` does. */
export function navigateFrame(
  frame: Frame,
  component: Component,
  options: NativeHostPushOptions,
) {
  if (options.replace && frame.currentEntry) frame.currentEntry.backstackVisible = false
  const navigation: NavigationEntry & { frame: Frame } = { frame }
  if (options.transition) navigation.transition = options.transition
  if (options.initial) navigation.animated = false
  else if (options.animated !== undefined) navigation.animated = options.animated
  if (options.clearHistory) navigation.clearHistory = true
  mountFramePage(frame, component, navigation)
}

/** Pops `frame` back to `target`, which must be in its back stack. */
export function popFrame(frame: Frame, target: Page, options: NativeHostBackOptions) {
  const entry = frame.backStack.find((candidate) => candidate.resolvedPage === target)
  if (!entry) throw new Error('The page is no longer in the native stack')
  // the frame animates a pop the way the page being popped came in
  if (options.animated !== undefined && frame.currentEntry)
    frame.currentEntry.animated = options.animated
  frame.goBack(entry)
}

/**
 * The host behind `<RouterView>` and modal routes: one NativeScript `Frame`,
 * whose back stack is the source of history.
 */
export function createFrameHost(
  frame: Frame,
  options: FrameHostOptions = {},
): NativeHost<Frame> {
  const modal = !!options.modal
  let delegate: NativeHostDelegate | undefined
  let detach: (() => void) | undefined
  let disposed = false

  return {
    version: NATIVE_HOST_VERSION,
    kind: options.kind ?? (modal ? 'modal-frame' : 'frame'),
    capabilities: {
      replace: true,
      clearHistory: true,
      pinnedRoot: false,
      close: modal,
      cancellableDismissal: modal,
      multipleVisible: false,
    },
    get native() {
      return disposed ? null : frame
    },
    get loaded() {
      return !!frame.isLoaded
    },
    attach(target) {
      delegate = target
      const onNavigated = () => delegate?.changed()
      const onBackPressed = (args: EventData) => {
        ;(args as AndroidActivityBackPressedEventData).cancel = true
        delegate?.backPressed()
      }

      let stopGestures: (() => void) | undefined
      const onShown = () => {
        stopGestures?.()
        const dialog = backOwnerOf(frame.nativeView)
        stopGestures = dialog
          ? watchBackGestures(dialog, () => delegate?.backGesture())
          : undefined
      }

      let stopDismiss: (() => void) | undefined
      const onPresented = () => {
        stopDismiss?.()
        stopDismiss = watchDismissAttempts(frame, () => delegate?.dismissAttempted())
      }

      frame.on(Frame.navigatedToEvent, onNavigated)
      if (isAndroid && modal) {
        frame.on('activityBackPressed', onBackPressed)
        if (hasBackGestures()) frame.on('shownModally', onShown)
      }
      if (isIOS && modal) frame.on('shownModally', onPresented)

      detach = () => {
        frame.off(Frame.navigatedToEvent, onNavigated)
        frame.off('activityBackPressed', onBackPressed)
        frame.off('shownModally', onShown)
        frame.off('shownModally', onPresented)
        stopGestures?.()
        stopDismiss?.()
      }
    },
    pages: () => framePages(frame),
    push(component, options) {
      navigateFrame(frame, component, options)
    },
    back(target, options) {
      if (target) popFrame(frame, target, options)
      else frame.closeModal()
    },
    holdDismissal(hold) {
      if (options.holdDismissal) {
        options.holdDismissal(hold)
        return
      }
      // iOS 13+ sheets close with a swipe; `modalInPresentation` turns that off
      const controller = frame.ios?.controller
      if (controller) controller.modalInPresentation = hold
    },
    previewBack: (top, below, commit, onDispose, options) =>
      previewBack(frame, top, below, commit, onDispose, options?.preferCore),
    ownsSystemBack: () => ownsFrameBack(frame),
    parts: () => [
      { role: 'main', native: frame, loaded: !!frame.isLoaded, pages: framePages(frame) },
    ],
    dispose() {
      if (disposed) return
      disposed = true
      detach?.()
      detach = undefined
      delegate = undefined
      for (const page of framePages(frame)) disposeFramePage(page)
    },
  }
}
