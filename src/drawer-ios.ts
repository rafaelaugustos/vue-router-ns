import { LayoutBase, Utils, View } from '@nativescript/core'
import type { DrawerLayoutLike } from './drawer.js'
import type { DrawerGeometry } from './drawer-geometry.js'

declare const UIView: any
declare const UIViewController: any
declare const NSObject: any
declare const UIColor: any
declare const UIPanGestureRecognizer: any
declare const UITapGestureRecognizer: any
declare const UIGestureRecognizerDelegate: any
declare const interop: any
declare const CGAffineTransformMakeTranslation: (x: number, y: number) => any
declare const UIAccessibilityIsReduceMotionEnabled: () => boolean
declare const UIAccessibilityIsVoiceOverRunning: () => boolean
declare const UIAccessibilityFocusedElement: (technology: string) => any
declare const UIAccessibilityNotificationVoiceOverIdentifier: string
declare const UIAccessibilityPostNotification: (notification: number, target: any) => void
declare const UIAccessibilityLayoutChangedNotification: number

let Host: any
let Gestures: any
const clamp = (value: number) => Math.max(0, Math.min(1, value))

/** Native views stay mounted: only the pane's transform and scrim alpha change. */
export class IOSDrawerLayoutView extends LayoutBase implements DrawerLayoutLike {
  private widthValue = 300
  private directionValue: 'ltr' | 'rtl' | undefined
  private targetOpen = false
  private settledOpen = false
  private progress = 0
  private paneWidth = 0
  private revision = 0
  private draggingFrom = 0
  private dragWasOpen = false
  private scrim: any
  private gestures: any
  private pan: any
  private tap: any
  private focusOrigin: any
  private contentAccessibility: boolean | undefined
  private childControllers = new Set<any>()
  private geometry: DrawerGeometry | undefined

  get drawerGeometry() {
    return this.geometry!
  }
  set drawerGeometry(value: DrawerGeometry) {
    const changed = value.presentation !== (this.geometry?.presentation ?? 'overlay')
    this.geometry = value
    if (changed) {
      this.stopAnimation()
      const wasOpen = this.settledOpen
      this.targetOpen = this.settledOpen = false
      this.progress = 0
      this.isolate(false)
      if (this.pan) this.pan.enabled = !this.permanent
      if (this.pane) this.pane.hidden = !this.permanent
      if (this.scrim) this.scrim.hidden = true
      this.apply(0)
      if (wasOpen) this.notify({ eventName: 'drawerClosed', object: this })
      if (
        UIAccessibilityIsVoiceOverRunning() &&
        !this.nativeViewProtected?.window?.rootViewController?.presentedViewController
      ) {
        UIAccessibilityPostNotification(
          UIAccessibilityLayoutChangedNotification,
          this.permanent ? this.pane : this.content,
        )
      }
      this.focusOrigin = undefined
    }
    this.requestLayout()
  }
  private get permanent() {
    return this.geometry?.presentation === 'permanent'
  }

  /** LayoutBase inserts UIViews, but UIKit containers also need controller ownership. */
  private attachControllers() {
    const controllerOf = (view: View): any =>
      view.viewController ?? (view.ios instanceof UIViewController ? view.ios : undefined)
    let ancestor: View | undefined = this
    let parent: any
    while (ancestor && !parent) {
      parent = controllerOf(ancestor)
      ancestor = ancestor.parent as View | undefined
    }
    if (!parent) return
    const current = new Set<any>()
    const visit = (view: View) => {
      const controller = controllerOf(view)
      if (controller) {
        if (!controller.parentViewController) {
          parent.addChildViewController(controller)
          controller.didMoveToParentViewController(parent)
          this.childControllers.add(controller)
        }
        if (this.childControllers.has(controller)) current.add(controller)
        return
      }
      view.eachChildView((child) => {
        visit(child)
        return true
      })
    }
    this.eachChildView((child) => {
      visit(child)
      return true
    })
    for (const controller of this.childControllers) {
      if (current.has(controller)) continue
      controller.willMoveToParentViewController(null)
      controller.removeFromParentViewController()
      this.childControllers.delete(controller)
    }
  }

  get drawerWidth() {
    return this.widthValue
  }
  get drawerDirection() {
    return this.directionValue
  }
  set drawerDirection(value: 'ltr' | 'rtl' | undefined) {
    this.directionValue = value
    if (this.nativeViewProtected) this.applyDirection()
    this.requestLayout()
  }
  private applyDirection() {
    // UIKit inherits this from the container. Core's inherited CSS direction
    // otherwise force-sets every nested navigation view, breaking its gesture
    // graph on iOS 18 (including TextField input with native Back enabled).
    this.nativeViewProtected.semanticContentAttribute =
      this.directionValue === 'rtl' ? 4 : this.directionValue === 'ltr' ? 3 : 0
  }
  set drawerWidth(value: number) {
    this.widthValue = Number.isFinite(value) ? Math.max(0, value) : 300
    this.requestLayout()
  }
  get isDrawerOpen() {
    return this.targetOpen
  }
  private get pane() {
    return this.getChildAt(1)?.nativeViewProtected
  }
  private get content() {
    return this.getChildAt(0)?.nativeViewProtected
  }
  private get sign() {
    return this.nativeViewProtected?.effectiveUserInterfaceLayoutDirection === 1 ? -1 : 1
  }

  override createNativeView(): any {
    Host ??= UIView.extend(
      {
        accessibilityPerformEscape(this: any) {
          const owner = this.drawerOwner?.deref() as IOSDrawerLayoutView | undefined
          if (!owner?.isDrawerOpen) return false
          owner.closeDrawer()
          return true
        },
      },
      { name: 'VueRouterDrawerHost' },
    )
    const native = Host.new()
    native.drawerOwner = new WeakRef(this)
    native.clipsToBounds = true
    return native
  }

  override initNativeView() {
    super.initNativeView()
    this.applyDirection()
    Gestures ??= NSObject.extend(
      {
        pan(this: any, recognizer: any) {
          this.owner?.deref()?.drag(recognizer)
        },
        tap(this: any) {
          this.owner?.deref()?.closeDrawer()
        },
        gestureRecognizerShouldBegin(this: any, recognizer: any) {
          return this.owner?.deref()?.shouldBegin(recognizer) ?? false
        },
        gestureRecognizerShouldReceiveTouch(this: any, _recognizer: any, touch: any) {
          const owner = this.owner?.deref() as IOSDrawerLayoutView | undefined
          if (!owner || owner.permanent) return false
          if (owner.isDrawerOpen) return true
          const native = owner.nativeViewProtected
          const x = touch.locationInView(native).x
          const edge = owner.sign === 1 ? x : native.bounds.size.width - x
          return edge >= 0 && edge <= 24
        },
      },
      {
        name: 'VueRouterDrawerGestures',
        protocols: [UIGestureRecognizerDelegate],
        exposedMethods: {
          pan: { returns: interop.types.void, params: [interop.types.id] },
          tap: { returns: interop.types.void, params: [interop.types.id] },
        },
      },
    )
    this.gestures = Gestures.new()
    this.gestures.owner = new WeakRef(this)
    this.pan = UIPanGestureRecognizer.alloc().initWithTargetAction(this.gestures, 'pan')
    this.pan.maximumNumberOfTouches = 1
    this.pan.delegate = this.gestures
    this.nativeViewProtected.addGestureRecognizer(this.pan)
    this.scrim = UIView.new()
    this.scrim.backgroundColor = UIColor.blackColor
    this.scrim.alpha = 0
    this.scrim.hidden = true
    this.scrim.isAccessibilityElement = false
    this.tap = UITapGestureRecognizer.alloc().initWithTargetAction(this.gestures, 'tap')
    this.scrim.addGestureRecognizer(this.tap)
    this.nativeViewProtected.addSubview(this.scrim)
  }

  override onMeasure(widthSpec: number, heightSpec: number) {
    const { layout } = Utils
    const width = layout.getMeasureSpecSize(widthSpec)
    const height = layout.getMeasureSpecSize(heightSpec)
    const paneWidth = this.permanent
      ? layout.toDevicePixels(this.geometry!.pane.width)
      : Math.min(
          layout.toDevicePixels(this.drawerWidth),
          Math.max(0, width - layout.toDevicePixels(44)),
        )
    this.eachChildView((child) => {
      View.measureChild(
        this,
        child,
        layout.makeMeasureSpec(
          this.getChildIndex(child) === 1
            ? paneWidth
            : this.permanent
              ? layout.toDevicePixels(this.geometry!.content.width)
              : width,
          layout.EXACTLY,
        ),
        layout.makeMeasureSpec(
          this.permanent
            ? layout.toDevicePixels(
                (this.getChildIndex(child) === 1
                  ? this.geometry!.pane
                  : this.geometry!.content
                ).height,
              )
            : height,
          layout.EXACTLY,
        ),
      )
      return true
    })
    this.setMeasuredDimension(width, height)
  }

  override onLayout(left: number, top: number, right: number, bottom: number) {
    this.attachControllers()
    const width = right - left
    const height = bottom - top
    const paneWidth = this.permanent
      ? Utils.layout.toDevicePixels(this.geometry!.pane.width)
      : Math.min(
          Utils.layout.toDevicePixels(this.drawerWidth),
          Math.max(0, width - Utils.layout.toDevicePixels(44)),
        )
    this.paneWidth = Utils.layout.toDeviceIndependentPixels(paneWidth)
    const content = this.getChildAt(0)
    const pane = this.getChildAt(1)
    if (content) {
      if (this.permanent) {
        const rect = this.geometry!.content
        const px = Utils.layout.toDevicePixels
        View.layoutChild(
          this,
          content,
          px(rect.x),
          px(rect.y),
          px(rect.x + rect.width),
          px(rect.y + rect.height),
        )
      } else View.layoutChild(this, content, 0, 0, width, height)
    }
    if (pane) {
      // Core lays out an untransformed frame; reapply our transform afterwards.
      pane.nativeViewProtected.transform = CGAffineTransformMakeTranslation(0, 0)
      if (this.permanent) {
        const rect = this.geometry!.pane
        const px = Utils.layout.toDevicePixels
        View.layoutChild(
          this,
          pane,
          px(rect.x),
          px(rect.y),
          px(rect.x + rect.width),
          px(rect.y + rect.height),
        )
      } else {
        const start = this.sign === 1 ? 0 : width - paneWidth
        View.layoutChild(this, pane, start, 0, start + paneWidth, height)
      }
    }
    this.scrim.frame = this.nativeViewProtected.bounds
    this.nativeViewProtected.bringSubviewToFront(this.scrim)
    if (this.pane) this.nativeViewProtected.bringSubviewToFront(this.pane)
    this.apply(this.progress)
    if (this.targetOpen !== this.settledOpen) this.settle(this.targetOpen, false)
  }

  openDrawer() {
    this.settle(true)
  }
  closeDrawer() {
    this.settle(false)
  }

  override onLoaded() {
    super.onLoaded()
    this.attachControllers()
    if (this.targetOpen) this.settle(true, false)
    this.requestLayout()
  }

  private shouldBegin(recognizer: any): boolean {
    if (this.permanent) return false
    const native = this.nativeViewProtected
    const velocity = recognizer.velocityInView(native)
    if (Math.abs(velocity.x) <= Math.abs(velocity.y) || !this.paneWidth) return false
    if (this.targetOpen) return true
    const location = recognizer.locationInView(native)
    const translation = recognizer.translationInView(native)
    const origin = location.x - translation.x
    const edge = this.sign === 1 ? origin : native.bounds.size.width - origin
    if (edge > 24 || edge < 0 || velocity.x * this.sign <= 0) return false
    // Leave a pushed page's edge to UIKit and the router's existing back guard.
    // Never replace its delegate or disable interactivePopGestureRecognizer.
    let responder = this.content?.hitTestWithEvent(
      native.convertPointToView(location, this.content),
      null,
    )
    while (responder) {
      const navigation = responder.navigationController
      if (navigation?.viewControllers?.count > 1) return false
      responder = responder.nextResponder
    }
    return true
  }

  private drag(recognizer: any) {
    if (this.permanent) return
    if (recognizer.state === 1) {
      this.dragWasOpen = this.targetOpen
      this.stopAnimation()
      this.draggingFrom = this.progress
      this.isolate(true)
      this.pane.hidden = false
      this.scrim.hidden = false
    }
    if (recognizer.state === 1 || recognizer.state === 2) {
      this.apply(
        clamp(
          this.draggingFrom +
            (recognizer.translationInView(this.nativeViewProtected).x * this.sign) /
              this.paneWidth,
        ),
      )
    } else if (recognizer.state === 3) {
      const projected =
        this.progress +
        ((recognizer.velocityInView(this.nativeViewProtected).x * this.sign) /
          this.paneWidth) *
          0.15
      this.settle(projected > 0.5)
    } else if (recognizer.state === 4 || recognizer.state === 5) {
      this.settle(this.dragWasOpen)
    }
  }

  private stopAnimation() {
    ++this.revision
    const layer = this.pane?.layer
    const presentation = layer?.animationKeys()?.count ? layer.presentationLayer() : null
    if (presentation && this.paneWidth) {
      this.progress = clamp(1 + (presentation.transform.m41 * this.sign) / this.paneWidth)
    }
    this.pane?.layer.removeAllAnimations()
    this.scrim?.layer.removeAllAnimations()
    this.apply(this.progress)
  }

  private apply(progress: number) {
    this.progress = progress
    if (!this.pane || !this.scrim) return
    if (this.permanent) {
      this.pane.transform = CGAffineTransformMakeTranslation(0, 0)
      this.pane.hidden = false
      this.pane.accessibilityElementsHidden = false
      this.scrim.hidden = true
      this.scrim.alpha = 0
      return
    }
    this.pane.transform = CGAffineTransformMakeTranslation(
      (progress - 1) * this.paneWidth * this.sign,
      0,
    )
    this.scrim.alpha = progress * 0.32
    this.pane.accessibilityElementsHidden = progress === 0
  }

  private isolate(open: boolean) {
    if (!this.content || !this.pane) return
    if (open && this.contentAccessibility === undefined) {
      this.contentAccessibility = this.content.accessibilityElementsHidden
      if (UIAccessibilityIsVoiceOverRunning())
        this.focusOrigin = UIAccessibilityFocusedElement(
          UIAccessibilityNotificationVoiceOverIdentifier,
        )
      this.nativeViewProtected.endEditing(true)
    }
    this.content.accessibilityElementsHidden = open
      ? true
      : (this.contentAccessibility ?? false)
    this.pane.accessibilityViewIsModal = open
    if (!open) this.contentAccessibility = undefined
  }

  private attachedFocusTarget() {
    // VoiceOver can focus a UIAccessibilityElement (for example a bar item),
    // not just a UIView. Follow its accessibility container to the window.
    const visited = new Set<any>()
    let target = this.focusOrigin
    while (target && !visited.has(target)) {
      visited.add(target)
      if (target instanceof UIView)
        return target.window === this.nativeViewProtected.window
          ? this.focusOrigin
          : this.content
      target = target.accessibilityContainer
    }
    return this.content
  }

  private settle(open: boolean, animated = true) {
    if (this.permanent) return
    this.targetOpen = open
    if (
      !open &&
      !this.progress &&
      !this.settledOpen &&
      this.contentAccessibility === undefined
    )
      return
    if (!this.paneWidth || !this.pane || !this.isLoaded) return
    this.stopAnimation()
    const revision = this.revision
    this.isolate(true)
    this.pane.hidden = false
    this.scrim.hidden = false
    const finish = () => {
      if (revision !== this.revision) return
      this.apply(open ? 1 : 0)
      this.pane.hidden = !open
      this.scrim.hidden = !open
      this.isolate(open)
      const changed = this.settledOpen !== open
      this.settledOpen = open
      if (changed) {
        // A modal may have appeared while closing after navigation. Do not steal focus.
        const controller = this.nativeViewProtected.window?.rootViewController
        if (UIAccessibilityIsVoiceOverRunning() && !controller?.presentedViewController) {
          UIAccessibilityPostNotification(
            UIAccessibilityLayoutChangedNotification,
            open ? this.pane : this.attachedFocusTarget(),
          )
        }
        this.notify({ eventName: open ? 'drawerOpened' : 'drawerClosed', object: this })
      }
      if (!open) this.focusOrigin = undefined
    }
    if (!animated || UIAccessibilityIsReduceMotionEnabled()) {
      this.apply(open ? 1 : 0)
      finish()
    } else {
      UIView.animateWithDurationAnimationsCompletion(
        0.24,
        () => this.apply(open ? 1 : 0),
        finish,
      )
    }
  }

  override onUnloaded() {
    this.stopAnimation()
    this.isolate(false)
    this.focusOrigin = undefined
    super.onUnloaded()
  }

  override disposeNativeView() {
    this.stopAnimation()
    this.isolate(false)
    this.nativeViewProtected?.removeGestureRecognizer(this.pan)
    this.scrim?.removeGestureRecognizer(this.tap)
    this.scrim?.removeFromSuperview()
    if (this.pan) this.pan.delegate = null
    if (this.gestures) this.gestures.owner = undefined
    this.nativeViewProtected.drawerOwner = undefined
    for (const controller of this.childControllers) {
      controller.willMoveToParentViewController(null)
      controller.removeFromParentViewController()
    }
    this.childControllers.clear()
    this.pan = this.tap = this.gestures = this.scrim = this.focusOrigin = undefined
    super.disposeNativeView()
  }
}
