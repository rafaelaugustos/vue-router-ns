import { Application, isAndroid, Device, Utils, type View } from '@nativescript/core'
import type { LinkWindow } from './links.js'
import { watchWindowActivityState } from './window-state.android.js'
import { watchWindowSceneState } from './window-state.ios.js'

/** Structural subset of NativeWindow, so older core declarations remain usable. */
export interface RouterWindow extends LinkWindow {
  readonly id: string
  readonly state: string
  on(event: string, callback: (args: any) => void): void
  off(event: string, callback: (args: any) => void): void
}

export interface OpenWindowOptions {
  /** Serializable application data forwarded to the window content resolver. */
  data?: Record<string, unknown>
}

const ROUTE_DATA = '__vueRouterNS'
const owners = new WeakMap<RouterWindow, object>()

export function hasNativeWindows(): boolean {
  return typeof (Application as { getWindows?: unknown }).getWindows === 'function'
}

export function windowOf(view: View): RouterWindow | undefined {
  return (view as View & { getNativeWindow?(): RouterWindow }).getNativeWindow?.()
}

export function claimWindow(window: RouterWindow, owner: object): () => void {
  if (window.state === 'closed') throw new Error('Cannot bind a closed NativeWindow')
  const existing = owners.get(window)
  if (existing && existing !== owner)
    throw new Error(`NativeWindow "${window.id}" already has a router`)
  owners.set(window, owner)
  const stopState = watchWindowActivityState(window)
  const stopScenes = watchWindowSceneState(window)
  return () => {
    stopState()
    stopScenes()
    if (owners.get(window) === owner) owners.delete(window)
  }
}

/** Reads the resolved route supplied by router.openWindow() from request.data. */
export function getWindowRoute(
  data: Record<string, unknown> | undefined,
): string | undefined {
  const value = data?.[ROUTE_DATA]
  if (!value || typeof value !== 'object') return undefined
  const payload = value as { version?: unknown; fullPath?: unknown }
  return payload.version === 1 &&
    typeof payload.fullPath === 'string' &&
    payload.fullPath.startsWith('/')
    ? payload.fullPath
    : undefined
}

declare const android: any

export function openRouteWindow(
  fullPath: string,
  options?: OpenWindowOptions,
  owner?: RouterWindow,
): void {
  const app = Application as typeof Application & {
    openWindow?: (options: OpenWindowOptions) => void
  }
  if (!hasNativeWindows() || typeof app.openWindow !== 'function')
    throw new Error('Opening route windows requires NativeScript core 9.1 or later')
  const data: Record<string, unknown> = {
    ...options?.data,
    [ROUTE_DATA]: { version: 1, fullPath },
  }
  if (isAndroid && owner?.android?.activity) {
    const activity = owner.android.activity as {
      getClass?(): unknown
      isFinishing(): boolean
      isDestroyed(): boolean
      isInMultiWindowMode(): boolean
      startActivity(intent: unknown): void
    }
    if (typeof activity.getClass === 'function') {
      if (activity.isFinishing() || activity.isDestroyed())
        throw new Error('Cannot open a route window from an inactive Activity')
      // Core 9.1 uses the original Activity class, even after that Activity closes.
      // Use this router's live owner and the same public Intent payload contract.
      const Intent = android.content.Intent
      const intent = new Intent(activity, activity.getClass())
      let flags =
        Intent.FLAG_ACTIVITY_NEW_TASK |
        Intent.FLAG_ACTIVITY_MULTIPLE_TASK |
        Intent.FLAG_ACTIVITY_NEW_DOCUMENT
      if (Number(Device.sdkVersion) >= 24 && activity.isInMultiWindowMode())
        flags |= Intent.FLAG_ACTIVITY_LAUNCH_ADJACENT
      intent.setFlags(flags)
      for (const key of Object.keys(data))
        intent.putExtra(key, Utils.dataSerialize(data[key], true))
      activity.startActivity(intent)
      return
    }
  }
  app.openWindow({ data })
}
