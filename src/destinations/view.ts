import { isIOS, View } from '@nativescript/core'
import type { NativeDestinationSession } from '../native-destinations.js'

declare const UIView: any
declare const UIViewController: any
declare const android: any
declare const androidx: any

let ViewClass: (new () => View) | undefined
let LifecycleClass: any

function ensureLifecycleClass() {
  LifecycleClass ??=
    androidx.fragment.app.FragmentManager.FragmentLifecycleCallbacks.extend({
      onFragmentDetached(this: any, _manager: any, fragment: any) {
        if (fragment === this.fragment) {
          const session = this.session
          // Do not navigate from inside FragmentManager's transaction.
          setTimeout(() => {
            if (this.session === session) void session.dismissed()
          }, 0)
        }
      },
    })
}

export function assertNativeInstance(native: any, id: string) {
  const valid = isIOS
    ? native instanceof UIViewController && !native.parentViewController
    : native instanceof androidx.fragment.app.Fragment && !native.isAdded()
  if (!valid)
    throw new Error(
      `Native destination "${id}" needs an unparented ${isIOS ? 'UIViewController' : 'AndroidX Fragment'}`,
    )
}

/** Lazily define the view: importing the router never touches platform globals. */
export function nativeDestinationView(): new () => View {
  if (ViewClass) return ViewClass
  class DestinationView extends View {
    session!: NativeDestinationSession
    private attachTimer?: ReturnType<typeof setTimeout>

    override createNativeView() {
      if (isIOS) return UIView.new()
      const container = new android.widget.FrameLayout(this._context)
      container.setId(android.view.View.generateViewId())
      return container
    }

    override onLoaded() {
      super.onLoaded()
      // Core adds the owning Page Fragment during its own transaction. Wait
      // until that transaction has completed before committing a child.
      this.attachTimer = setTimeout(() => {
        this.attachTimer = undefined
        if (this.isLoaded && !this.session.entry.disposed) {
          try {
            this.attach()
            this.session.attached()
          } catch (error) {
            this.session.failed(error)
          }
        }
      }, 0)
    }

    private attach() {
      if (this.session.detach) return
      const native = this.session.create().native as any
      const container = this.nativeViewProtected
      if (isIOS) {
        const parent = this.page?.viewController
        if (!parent) throw new Error('Native destination has no owning Page controller')
        this.session.detach = () => {
          if (native.parentViewController) native.willMoveToParentViewController(null)
          native.view.removeFromSuperview()
          if (native.parentViewController) native.removeFromParentViewController()
        }
        parent.addChildViewController(native)
        native.view.frame = container.bounds
        native.view.autoresizingMask = 18 // flexible width and height
        container.addSubview(native.view)
        native.didMoveToParentViewController(parent)
      } else {
        const manager = (this.page?.frame as any)?._getChildFragmentManager()
        if (!manager || manager.isStateSaved())
          throw new Error('Native destination has no ready owning Page FragmentManager')
        ensureLifecycleClass()
        const listener = new LifecycleClass()
        listener.fragment = native
        listener.session = this.session
        manager.registerFragmentLifecycleCallbacks(listener, false)
        this.session.detach = () => {
          listener.session = undefined
          listener.fragment = undefined
          manager.unregisterFragmentLifecycleCallbacks(listener)
          if (native.isAdded() && !manager.isDestroyed())
            manager.beginTransaction().remove(native).commitNowAllowingStateLoss()
        }
        manager
          .beginTransaction()
          .add(container.getId(), native, `router-native-${this.session.entry.key}`)
          .commitNow()
      }
    }

    override onUnloaded() {
      if (this.attachTimer) clearTimeout(this.attachTimer)
      this.attachTimer = undefined
      super.onUnloaded()
    }

    override disposeNativeView() {
      if (this.attachTimer) clearTimeout(this.attachTimer)
      this.attachTimer = undefined
      this.session?.release()
      super.disposeNativeView()
    }
  }
  ViewClass = DestinationView
  return ViewClass
}
