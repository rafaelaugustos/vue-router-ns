import { Device } from '@nativescript/core'
import type { ShallowRef } from 'nativescript-vue'

export type BackGestureEdge = 'left' | 'right' | 'none'

export interface BackGesture {
  /** From 0 when the swipe starts to 1 when letting go would close the page. */
  progress: number
  /** The screen edge the swipe started from. */
  edge: BackGestureEdge
}

export type BackGestureTarget = ShallowRef<BackGesture | null>

interface BackEventCompat {
  getProgress(): number
  getSwipeEdge(): number
}

interface OnBackPressedDispatcher {
  addCallback(owner: OnBackPressedDispatcherOwner, callback: BackCallback): void
  onBackPressed(): void
}

export interface OnBackPressedDispatcherOwner {
  getOnBackPressedDispatcher(): OnBackPressedDispatcher
}

interface GestureHandler {
  start(event: BackEventCompat): void
  progress(event: BackEventCompat): void
  cancel(): void
  press(): void
}

interface BackCallback {
  setEnabled(enabled: boolean): void
  remove(): void
  _handler: GestureHandler
}

declare const androidx: {
  activity: {
    OnBackPressedCallback: {
      extend(name: string, methods: object): new (enabled: boolean) => BackCallback
    }
    ViewTreeOnBackPressedDispatcherOwner: {
      get(view: unknown): OnBackPressedDispatcherOwner | null
    }
  }
}

const EDGES: readonly BackGestureEdge[] = ['left', 'right', 'none']

let BackGestureCallback: (new (enabled: boolean) => BackCallback) | undefined

export function hasBackGestures(): boolean {
  return Number(Device.sdkVersion) >= 34
}

export function backOwnerOf(view: unknown): OnBackPressedDispatcherOwner | null {
  return view ? androidx.activity.ViewTreeOnBackPressedDispatcherOwner.get(view) : null
}

/**
 * Sits above the callback `@nativescript/core` registers, which only hears the
 * final press, and passes that press on to it, so `activityBackPressed`
 * listeners (the router among them) still get it.
 */
export function watchBackGestures(
  owner: OnBackPressedDispatcherOwner,
  target: () => BackGestureTarget | undefined,
): () => void {
  BackGestureCallback ??= androidx.activity.OnBackPressedCallback.extend(
    'org.nativescript.vuerouterns.BackGestureCallback',
    {
      handleOnBackStarted(this: BackCallback, event: BackEventCompat) {
        this._handler.start(event)
      },
      handleOnBackProgressed(this: BackCallback, event: BackEventCompat) {
        this._handler.progress(event)
      },
      handleOnBackCancelled(this: BackCallback) {
        this._handler.cancel()
      },
      handleOnBackPressed(this: BackCallback) {
        this._handler.press()
      },
    },
  )

  const ownerRef = new WeakRef(owner)
  const callback = new BackGestureCallback(true)
  let gesture: BackGestureTarget | undefined

  const progress = (event: BackEventCompat) => {
    if (!gesture) return
    gesture.value = {
      progress: event.getProgress(),
      edge: EDGES[event.getSwipeEdge()] ?? 'none',
    }
  }

  const end = () => {
    if (gesture) gesture.value = null
    gesture = undefined
  }

  callback._handler = {
    start(event) {
      gesture = target()
      progress(event)
    },
    progress,
    cancel: end,
    press() {
      end()
      const dispatcher = ownerRef.deref()?.getOnBackPressedDispatcher()
      if (!dispatcher) return
      callback.setEnabled(false)
      try {
        dispatcher.onBackPressed()
      } finally {
        callback.setEnabled(true)
      }
    },
  }

  owner.getOnBackPressedDispatcher().addCallback(owner, callback)

  return () => {
    end()
    callback.remove()
  }
}
