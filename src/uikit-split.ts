import * as Core from '@nativescript/core'
import type { Frame, View } from '@nativescript/core'

declare const NSObject: { extend(methods: object, options: object): new () => any }
declare const UISplitViewControllerDelegate: unknown

/** UIKit's double-column container requires the optional Core SplitView. */
export function supportsUIKitSplitView(): boolean {
  return (
    Core.isIOS &&
    Number.parseFloat(Core.Device.sdkVersion) >= 18 &&
    typeof Core.SplitView === 'function'
  )
}

export interface UIKitSplitView extends View {
  viewController: any
  /** Called after UIKit changes column visibility or size class. */
  columnsChanged?: () => void
  hasDetail: boolean
  showPrimary(): void
  showSecondary(): void
}

let ViewClass: (new () => UIKitSplitView) | undefined
let DelegateClass: (new () => any) | undefined

function delegateClass() {
  if (DelegateClass) return DelegateClass
  const forward = (self: any, method: string, ...args: any[]) => {
    self.inner?.[method]?.(...args)
    self.owner.deref()?.columnsChanged?.()
  }
  DelegateClass = NSObject.extend(
    {
      splitViewControllerDidCollapse(this: any, controller: any) {
        forward(this, 'splitViewControllerDidCollapse', controller)
      },
      splitViewControllerDidExpand(this: any, controller: any) {
        forward(this, 'splitViewControllerDidExpand', controller)
      },
      splitViewControllerDidShowColumn(this: any, controller: any, column: number) {
        forward(this, 'splitViewControllerDidShowColumn', controller, column)
      },
      splitViewControllerDidHideColumn(this: any, controller: any, column: number) {
        forward(this, 'splitViewControllerDidHideColumn', controller, column)
      },
      splitViewControllerWillChangeToDisplayMode(this: any) {
        this.owner.deref()?.columnsChanged?.()
      },
      splitViewControllerCollapseSecondaryViewControllerOntoPrimaryViewController(
        this: any,
        controller: any,
        secondary: any,
        primary: any,
      ) {
        return (
          this.inner?.splitViewControllerCollapseSecondaryViewControllerOntoPrimaryViewController?.(
            controller,
            secondary,
            primary,
          ) ?? true
        )
      },
      splitViewControllerTopColumnForCollapsingToProposedTopColumn(this: any) {
        // Core always chooses secondary, including an empty detail column.
        return this.owner.deref()?.hasDetail ? 2 : 0
      },
      splitViewControllerDisplayModeForExpandingToProposedDisplayMode(
        _controller: any,
        proposed: number,
      ) {
        // Core's default requests three columns, even for its double-column style.
        return proposed
      },
    },
    { protocols: [UISplitViewControllerDelegate] },
  )
  return DelegateClass!
}

/**
 * Resolve lazily: importing the router on Android or an older Core must not
 * instantiate UIKit classes. Core retains ownership of column containment and
 * layout; its delegate continues receiving lifecycle/visibility callbacks.
 */
export function uikitSplitViewClass(): new () => UIKitSplitView {
  if (!supportsUIKitSplitView())
    throw new Error(
      '[vue-router-ns] RouterUIKitSplitView requires iOS 18+ and Core SplitView (9.1+)',
    )
  if (ViewClass) return ViewClass
  // The narrow override surface includes Core's button helpers, marked private
  // in its declarations. Do not replace either Frame's navigation delegate.
  const Base: any = Core.SplitView
  class RouterUIKitSplit extends Base {
    hasDetail = false
    columnsChanged?: () => void
    private routerDelegate: any
    _getSplitStyle() {
      return 1 // DoubleColumn, independent of Core's global SplitStyle.
    }
    createNativeView() {
      const view = super.createNativeView()
      const Delegate = delegateClass()
      this.routerDelegate = new Delegate()
      this.routerDelegate.inner = this.viewController.delegate
      this.routerDelegate.owner = new WeakRef(this)
      this.viewController.delegate = this.routerDelegate
      if (this.viewController.displayModeButtonVisibility !== undefined)
        this.viewController.displayModeButtonVisibility = 0 // Automatic
      return view
    }
    // Let UIKit own its system column controls. Core's helpers overwrite app
    // ActionItems and insert a blank display-mode button when collapsed.
    attachPrimaryButton() {}
    _attachSecondaryDisplayModeButton() {}
    onLoaded() {
      super.onLoaded()
      const root = this.viewController.view.window?.rootViewController
      if (root && root !== this.viewController)
        throw new Error('[vue-router-ns] RouterUIKitSplitView must be the window root')
      this.columnsChanged?.()
    }
    disposeNativeView() {
      this.columnsChanged = undefined
      if (this.viewController?.delegate === this.routerDelegate)
        this.viewController.delegate = this.routerDelegate.inner
      this.routerDelegate = undefined
      super.disposeNativeView()
    }
  }
  ViewClass = RouterUIKitSplit as unknown as new () => UIKitSplitView
  return ViewClass
}

/** Use UIKit's actual view hierarchy, including an overlaid or hidden primary. */
export function visibleUIKitColumns(view: UIKitSplitView, list: Frame, detail: Frame) {
  const showing = (frame: Frame) => {
    let native = (frame as any).ios?.controller?.view
    if (!native?.window) return false
    while (native) {
      if (native.hidden || native.alpha === 0) return false
      native = native.superview
    }
    return true
  }
  return { list: showing(list), detail: view.hasDetail && showing(detail) }
}
