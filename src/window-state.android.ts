import { Device, isAndroid, Utils } from '@nativescript/core'
import type { RouterWindow } from './windows.js'

declare const android: any

interface Bundle {
  getString(key: string): string | null
  putString(key: string, value: string): void
  getBundle(key: string): Bundle | null
  remove(key: string): void
}
interface Activity {
  getClass(): { getName(): string }
}

const MARKER = 'vue-router-ns:window-process:v1'
// Retain the process identity when a dev bundler reevaluates this module.
const identity = Symbol.for('vue-router-ns:window-process:v1')
const globals = globalThis as typeof globalThis & { [identity]?: string }
const token = (globals[identity] ??= `${Date.now()}-${Math.random()}`)
const windows = new Set<RouterWindow>()
let stop: (() => void) | undefined

/**
 * Core 9.1.3 uses a process-wide moduleLoaded flag when restoring Activities.
 * After process death, the second old task can therefore try to restore native
 * Fragments whose JS Frames no longer exist. Android 29's pre-create callback
 * lets us discard just that stale navigation state before FragmentActivity runs.
 * Only bundles previously saved by a router-owned Activity carry our marker.
 */
export function watchWindowActivityState(window: RouterWindow): () => void {
  if (
    !isAndroid ||
    Number(Device.sdkVersion) < 29 ||
    typeof android === 'undefined' ||
    typeof android.app?.Application?.ActivityLifecycleCallbacks !== 'function'
  )
    return () => {}
  windows.add(window)
  if (!stop) {
    const application = Utils.android.getApplication()
    const callbacks = new android.app.Application.ActivityLifecycleCallbacks({
      onActivityPreCreated(activity: Activity, state: Bundle | null) {
        if (!state) return
        const marker = state.getString(MARKER)
        if (!marker) return
        let saved: { token?: string; activity?: string }
        try {
          saved = JSON.parse(marker)
        } catch {
          return
        }
        if (
          !saved ||
          typeof saved.token !== 'string' ||
          saved.token === token ||
          saved.activity !== activity.getClass().getName()
        )
          return

        // Preserve the window ID, application metadata, ActivityResult registry,
        // saved-state handles and all unrelated Bundle entries. These specific
        // keys belong to Core's old JS root/Frame and AndroidX FragmentManager.
        state
          .getBundle('androidx.lifecycle.BundlableSavedStateRegistry.key')
          ?.remove('android:support:fragments')
        state.remove('android:support:fragments')
        state.remove('com.tns.activity.rootViewId')
        state.remove('com.tns.activity')
      },
      onActivitySaveInstanceState(activity: Activity, state: Bundle) {
        if (![...windows].some((owner) => owner.android?.activity === activity)) return
        state.putString(
          MARKER,
          JSON.stringify({ token, activity: activity.getClass().getName() }),
        )
      },
      onActivityCreated() {},
      onActivityStarted() {},
      onActivityResumed() {},
      onActivityPaused() {},
      onActivityStopped() {},
      onActivityDestroyed() {},
      onActivityPostCreated() {},
      onActivityPreStarted() {},
      onActivityPostStarted() {},
      onActivityPreResumed() {},
      onActivityPostResumed() {},
      onActivityPrePaused() {},
      onActivityPostPaused() {},
      onActivityPreStopped() {},
      onActivityPostStopped() {},
      onActivityPreSaveInstanceState() {},
      onActivityPostSaveInstanceState() {},
      onActivityPreDestroyed() {},
      onActivityPostDestroyed() {},
    })
    application.registerActivityLifecycleCallbacks(callbacks)
    stop = () => application.unregisterActivityLifecycleCallbacks(callbacks)
  }
  let released = false
  return () => {
    if (released) return
    released = true
    windows.delete(window)
    if (!windows.size) {
      stop?.()
      stop = undefined
    }
  }
}
