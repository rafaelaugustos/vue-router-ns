import { Device, type Frame, type Page } from '@nativescript/core'

type Callback = () => void

const attempts = new WeakMap<Frame, Callback>()

interface PresentationDelegate {
  presentationControllerDidAttemptToDismiss?(controller: any): void
  presentationControllerDidDismiss?(controller: any): void
  presentationControllerWillDismiss?(controller: any): void
  presentationControllerShouldDismiss?(controller: any): boolean
}

interface Wrapper extends PresentationDelegate {
  _inner: PresentationDelegate | null
  _frame: WeakRef<Frame>
}

declare const NSObject: { extend(methods: object, options: object): { new (): Wrapper } }
declare const UIAdaptivePresentationControllerDelegate: unknown

let DelegateWrapper: { new (): Wrapper } | undefined

/**
 * Runs `callback` when a swipe or an outside tap tries to close the modal
 * `frame` is in while `modalInPresentation` holds it. Core's delegate only
 * hears the dismissal itself, so this one sits in front of it and forwards.
 */
export function watchDismissAttempts(frame: Frame, callback: Callback): () => void {
  attempts.set(frame, callback)
  const wrapped = typeof NSObject !== 'undefined' ? wrap(frame) : undefined

  return () => {
    attempts.delete(frame)
    wrapped?.()
  }
}

declare const UIAction: { actionWithHandler(handler: () => void): object }

/**
 * Makes the ActionBar's back button run `callback` instead of popping the
 * page, or gives it back to the system with `null`. iOS 16 and later; the
 * button looks the same either way.
 */
export function holdBackButton(page: Page, callback: (() => void) | null) {
  const item = page.ios?.navigationItem
  if (!item || parseFloat(Device.sdkVersion) < 16) return
  item.backAction =
    callback && typeof UIAction !== 'undefined'
      ? UIAction.actionWithHandler(callback)
      : callback
}

/** What the delegate calls. Exported so tests can stand in for a swipe. */
export function dismissAttempted(frame: Frame) {
  attempts.get(frame)?.()
}

function wrap(frame: Frame): (() => void) | undefined {
  const presentation = frame.ios?.controller?.presentationController
  if (!presentation) return undefined

  DelegateWrapper ??= NSObject.extend(
    {
      presentationControllerDidAttemptToDismiss(this: Wrapper, controller: any) {
        const owner = this._frame.deref()
        if (owner) dismissAttempted(owner)
        this._inner?.presentationControllerDidAttemptToDismiss?.(controller)
      },
      presentationControllerDidDismiss(this: Wrapper, controller: any) {
        this._inner?.presentationControllerDidDismiss?.(controller)
      },
      presentationControllerWillDismiss(this: Wrapper, controller: any) {
        this._inner?.presentationControllerWillDismiss?.(controller)
      },
      presentationControllerShouldDismiss(this: Wrapper, controller: any) {
        return this._inner?.presentationControllerShouldDismiss?.(controller) ?? true
      },
    },
    { protocols: [UIAdaptivePresentationControllerDelegate] },
  )

  const wrapper = Object.assign(new DelegateWrapper(), {
    _frame: new WeakRef(frame),
    _inner: presentation.delegate ?? null,
  })
  presentation.delegate = wrapper

  return () => {
    if (presentation.delegate === wrapper) presentation.delegate = wrapper._inner
  }
}
