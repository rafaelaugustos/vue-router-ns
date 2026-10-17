import { Application, Device, isAndroid, Utils, View } from '@nativescript/core'
import { createNativeView, type Component } from 'nativescript-vue'
import type { BottomSheetOptions, BottomSheetState } from '../types.js'

interface Behavior {
  setPeekHeight(px: number): void
  setMaxHeight(px: number): void
  setFitToContents(value: boolean): void
  setHalfExpandedRatio(value: number): void
  setSkipCollapsed(value: boolean): void
  setDraggable(value: boolean): void
  setHideable(value: boolean): void
  setState(state: number): void
}

interface SheetDialog {
  _domId: number
  super: { onBackPressed(): void }
  getBehavior(): Behavior
  getOnBackPressedDispatcher(): {
    addCallback(owner: unknown, callback: unknown): void
    onBackPressed(): void
  }
  setCancelable(value: boolean): void
  setCanceledOnTouchOutside(value: boolean): void
  setDismissWithAnimation(value: boolean): void
  isShowing(): boolean
  cancel(): void
  findViewById(id: number): { setOnClickListener(listener: object): void } | null
  getWindow(): { setSoftInputMode(mode: number): void }
}

interface SheetFragment {
  owner: ModalRoot | undefined
  presentation: Presentation | undefined
  super: {
    onCreate(saved: unknown): void
    onStart(): void
    onDismiss(dialog: unknown): void
    onDestroy(): void
  }
  setArguments(args: unknown): void
  getArguments(): { getInt(key: string): number }
  getActivity(): any
  getTheme(): number
  getDialog(): SheetDialog
  getFragmentManager(): unknown
  show(manager: unknown, tag: string): void
  dismissAllowingStateLoss(): void
}

interface BackCallback {
  _dialog: WeakRef<SheetDialog>
  setEnabled(enabled: boolean): void
}

/** The private View members core's own Android modal uses. */
interface ModalRoot {
  _domId: number
  _context: unknown
  _modalParent: View | null
  _dialogFragment: SheetFragment | null
  _isAddedToNativeVisualTree: boolean
  isLoaded: boolean
  nativeViewProtected: unknown
  horizontalAlignment: string
  verticalAlignment: string
  height: number | string
  notify(args: object): void
  closeModal(): void
  _showNativeModalView(parent: ModalParent, options: unknown): void
  _raiseShowingModallyEvent(): void
  _raiseShownModallyEvent(): void
  _setupAsRootView(context: unknown): void
  _tearDownUI(force?: boolean): void
  callLoaded(): void
  callUnloaded(): void
}

interface ModalParent {
  isLoaded: boolean
  once(event: string, callback: () => void): void
  _getRootFragmentManager(): unknown
}

interface Presentation {
  owner: ModalRoot
  sheet: BottomSheetOptions
  animated: boolean
  cancelable: boolean
  windowSoftInputMode: number | undefined
  held: boolean
  behavior: Behavior | undefined
  dialog: SheetDialog | undefined
  attempt(): void
}

declare const com: {
  google: {
    android: {
      material: {
        R: { id: { touch_outside: number } }
        bottomsheet: {
          BottomSheetDialog: {
            extend(
              name: string,
              methods: object,
            ): new (context: unknown, theme: number) => SheetDialog
          }
          BottomSheetDialogFragment: {
            extend(name: string, methods: object): new () => SheetFragment
          }
          BottomSheetBehavior: {
            STATE_COLLAPSED: number
            STATE_HALF_EXPANDED: number
            STATE_EXPANDED: number
            STATE_HIDDEN: number
          }
        }
      }
    }
  }
}
declare const androidx: {
  activity: {
    OnBackPressedCallback: {
      extend(name: string, methods: object): new (enabled: boolean) => BackCallback
    }
  }
}
declare const android: {
  os: { Bundle: new () => { putInt(key: string, value: number): void } }
  view: {
    View: { OnClickListener: new (impl: { onClick(view: unknown): void }) => object }
  }
}

const DOM_ID = 'vue-router-ns:domId'
const presentations = new Map<number, Presentation>()
let SheetDialogClass: (new (context: unknown, theme: number) => SheetDialog) | undefined
let SheetFragmentClass: (new () => SheetFragment) | undefined
let SheetBackCallback: (new (enabled: boolean) => BackCallback) | undefined

/** Whether Material's bottom sheet classes are in this build. Release builds need the dependency added. */
export function supportsBottomSheets(): boolean {
  if (!isAndroid || typeof com === 'undefined') return false
  try {
    return (
      typeof com.google.android.material.bottomsheet.BottomSheetDialog?.extend ===
      'function'
    )
  } catch {
    return false
  }
}

export function assertBottomSheetsAvailable() {
  if (supportsBottomSheets()) return
  throw new Error(
    '[vue-router-ns] Material bottom sheets need com.google.android.material in this build. ' +
      'Add `implementation "com.google.android.material:material:1.12.0"` to ' +
      'App_Resources/Android/app.gradle; debug builds get it from the runtime, release builds do not.',
  )
}

export function bottomSheetOptions(
  sheet: boolean | BottomSheetOptions,
): BottomSheetOptions {
  return sheet === true ? {} : sheet || {}
}

export interface BottomSheetPresenterOptions {
  sheet: BottomSheetOptions
  animated: boolean
  cancelable: boolean
  windowSoftInputMode: number | undefined
  /** The user tapped outside while a leave guard holds the sheet. */
  onDismissAttempt(): void
}

export interface BottomSheetPresenter {
  /** Keeps the sheet from being dragged away or tapped away while a leave guard is active. */
  hold(hold: boolean): void
  /** Presents `component` from `target`, like `$showModal`. Resolves with the close result. */
  present(
    component: Component,
    props: Record<string, unknown>,
    target: View | undefined,
  ): Promise<unknown>
}

/**
 * Presents a modal route in a Material `BottomSheetDialog` instead of core's
 * dialog. Core's own modal bookkeeping (`showModal`, `closeModal`,
 * `shownModally`) is kept; only the native presentation is replaced, through
 * the same private hooks core's Android view uses.
 */
export function createBottomSheetPresenter(
  options: BottomSheetPresenterOptions,
): BottomSheetPresenter {
  let presentation: Presentation | undefined
  let held = false
  return {
    hold(hold) {
      held = hold
      if (presentation) {
        presentation.held = hold
        applyHold(presentation)
      }
    },
    present(component, props, target) {
      const view = createNativeView(component, props)
      view.mount()
      const root = view.nativeView as unknown as ModalRoot
      presentation = {
        owner: root,
        sheet: options.sheet,
        animated: options.animated,
        cancelable: options.cancelable,
        windowSoftInputMode: options.windowSoftInputMode,
        held,
        behavior: undefined,
        dialog: undefined,
        attempt: options.onDismissAttempt,
      }
      const current = presentation
      root._showNativeModalView = function (parent, modalOptions) {
        showSheet(this, parent, modalOptions, current)
      }
      let done = false
      return new Promise<unknown>((resolve, reject) => {
        const parent = target ?? Application.getRootView()
        parent.showModal(root as unknown as View, {
          animated: current.animated,
          cancelable: current.cancelable,
          closeCallback(data: unknown) {
            if (done) return
            done = true
            view.unmount()
            resolve(data)
          },
        })
        if (!root._modalParent) {
          done = true
          view.unmount()
          reject(
            new Error(
              'Could not present the bottom sheet: the target refused to show a modal',
            ),
          )
        }
      })
    },
  }
}

function showSheet(
  root: ModalRoot,
  parent: ModalParent,
  modalOptions: unknown,
  presentation: Presentation,
) {
  if (Application.inBackground && !parent.isLoaded) {
    parent.once('loaded', () => showSheet(root, parent, modalOptions, presentation))
    return
  }
  const common = Object.getPrototypeOf(View.prototype) as {
    _showNativeModalView?: (
      this: ModalRoot,
      parent: ModalParent,
      options: unknown,
    ) => void
  }
  common._showNativeModalView?.call(root, parent, modalOptions)
  defineClasses()
  const fragment = new SheetFragmentClass!()
  const args = new android.os.Bundle()
  args.putInt(DOM_ID, root._domId)
  fragment.setArguments(args)
  presentations.set(root._domId, presentation)
  root._dialogFragment = fragment
  root._raiseShowingModallyEvent()
  fragment.show(parent._getRootFragmentManager(), String(root._domId))
}

const STATES: Record<BottomSheetState, () => number> = {
  collapsed: () =>
    com.google.android.material.bottomsheet.BottomSheetBehavior.STATE_COLLAPSED,
  halfExpanded: () =>
    com.google.android.material.bottomsheet.BottomSheetBehavior.STATE_HALF_EXPANDED,
  expanded: () =>
    com.google.android.material.bottomsheet.BottomSheetBehavior.STATE_EXPANDED,
}

function configure(presentation: Presentation, dialog: SheetDialog) {
  const { sheet } = presentation
  const behavior = dialog.getBehavior()
  presentation.behavior = behavior
  presentation.dialog = dialog
  const px = (dip: number) => Utils.layout.toDevicePixels(dip)
  if (sheet.peekHeight !== undefined) behavior.setPeekHeight(px(sheet.peekHeight))
  if (sheet.maxHeight !== undefined) behavior.setMaxHeight(px(sheet.maxHeight))
  if (sheet.fitToContents !== undefined) behavior.setFitToContents(sheet.fitToContents)
  if (sheet.halfExpandedRatio !== undefined)
    behavior.setHalfExpandedRatio(sheet.halfExpandedRatio)
  if (sheet.skipCollapsed !== undefined) behavior.setSkipCollapsed(sheet.skipCollapsed)
  if (sheet.draggable !== undefined) behavior.setDraggable(sheet.draggable)
  behavior.setState(STATES[sheet.state ?? 'collapsed']())
  applyHold(presentation)
  // Material's own listener closes on any outside tap; this one asks the guards first
  dialog.setCanceledOnTouchOutside(false)
  dialog.findViewById(com.google.android.material.R.id.touch_outside)?.setOnClickListener(
    new android.view.View.OnClickListener({
      onClick() {
        if (!dialog.isShowing()) return
        if (presentation.held) presentation.attempt()
        else if (presentation.cancelable) dialog.cancel()
      },
    }),
  )
}

/** A held sheet can't be dragged away: there is no Material callback for a refused drag. */
function applyHold(presentation: Presentation) {
  presentation.behavior?.setHideable(presentation.cancelable && !presentation.held)
}

/** What core's dialog does on back: the app's listeners first, then the view's, then the system. */
function backPressed(presentation: Presentation): boolean {
  const args = {
    eventName: 'activityBackPressed',
    object: presentation.owner,
    activity: presentation.owner._context,
    cancel: false,
  }
  Application.android.notify(args)
  if (args.cancel) return true
  presentation.owner.notify(args)
  return args.cancel
}

function defineClasses() {
  const material = com.google.android.material.bottomsheet
  SheetBackCallback ??= androidx.activity.OnBackPressedCallback.extend(
    'org.nativescript.vuerouterns.BottomSheetBackCallback',
    {
      handleOnBackPressed(this: BackCallback) {
        const dialog = this._dialog.deref()
        const presentation = dialog && presentations.get(dialog._domId)
        if (!dialog || !presentation) {
          this.setEnabled(false)
          return
        }
        if (backPressed(presentation)) return
        this.setEnabled(false)
        try {
          dialog.getOnBackPressedDispatcher().onBackPressed()
        } finally {
          this.setEnabled(true)
        }
      },
    },
  )
  SheetDialogClass ??= material.BottomSheetDialog.extend(
    'org.nativescript.vuerouterns.BottomSheetDialog',
    {
      onBackPressed(this: SheetDialog) {
        const presentation = presentations.get(this._domId)
        if (Number(Device.sdkVersion) < 33 && presentation && backPressed(presentation))
          return
        this.super.onBackPressed()
      },
    },
  )
  SheetFragmentClass ??= material.BottomSheetDialogFragment.extend(
    'org.nativescript.vuerouterns.BottomSheetFragment',
    {
      onCreate(this: SheetFragment, saved: unknown) {
        this.super.onCreate(saved)
        const presentation = presentations.get(this.getArguments().getInt(DOM_ID))
        // recreated after the process died: nothing to show anymore
        if (saved != null && !presentation) this.dismissAllowingStateLoss()
      },
      onCreateDialog(this: SheetFragment) {
        const id = this.getArguments().getInt(DOM_ID)
        const presentation = presentations.get(id)!
        this.presentation = presentation
        this.owner = presentation.owner
        presentation.owner._dialogFragment = this
        const dialog = new SheetDialogClass!(this.getActivity(), this.getTheme())
        dialog._domId = id
        if (Number(Device.sdkVersion) >= 33) {
          const callback = new SheetBackCallback!(true)
          callback._dialog = new WeakRef(dialog)
          dialog.getOnBackPressedDispatcher().addCallback(dialog, callback)
        }
        presentation.owner.horizontalAlignment = 'stretch'
        presentation.owner.verticalAlignment = 'stretch'
        if (presentation.sheet.height !== undefined)
          presentation.owner.height = presentation.sheet.height
        dialog.setCancelable(presentation.cancelable)
        dialog.setDismissWithAnimation(presentation.animated)
        return dialog
      },
      onCreateView(this: SheetFragment) {
        const owner = this.owner!
        const activity = this.getActivity()
        owner._setupAsRootView(activity)
        owner._isAddedToNativeVisualTree = true
        const window = this.getDialog().getWindow()
        const mode =
          this.presentation!.windowSoftInputMode ??
          activity.getWindow().getAttributes().softInputMode
        if (mode !== undefined) window.setSoftInputMode(mode)
        return owner.nativeViewProtected
      },
      onStart(this: SheetFragment) {
        this.super.onStart()
        const owner = this.owner!
        configure(this.presentation!, this.getDialog())
        if (!owner.isLoaded) owner.callLoaded()
        owner._raiseShownModallyEvent()
      },
      onDismiss(this: SheetFragment, dialog: unknown) {
        this.super.onDismiss(dialog)
        const owner = this.owner
        if (!owner) return
        if (
          this.getFragmentManager() &&
          !this.getActivity()?.isChangingConfigurations()
        ) {
          presentations.delete(owner._domId)
          owner.closeModal()
        }
        if (owner.isLoaded) owner.callUnloaded()
      },
      onDestroy(this: SheetFragment) {
        this.super.onDestroy()
        const owner = this.owner
        if (!owner) return
        if (owner.isLoaded) owner.callUnloaded()
        owner._isAddedToNativeVisualTree = false
        owner._tearDownUI(true)
      },
    },
  )
}
