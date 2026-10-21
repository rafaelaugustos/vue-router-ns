import { Application, type View } from '@nativescript/core'

/** Structural subset of NativeWindow, so older core declarations remain usable. */
export interface RouterWindow {
  readonly id: string
  readonly state: string
  readonly isPrimary?: boolean
  readonly ios?: { readonly scene?: unknown }
  readonly android?: { readonly activity: unknown }
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
  return () => {
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

export function openRouteWindow(fullPath: string, options?: OpenWindowOptions): void {
  const app = Application as typeof Application & {
    openWindow?: (options: OpenWindowOptions) => void
  }
  if (!hasNativeWindows() || typeof app.openWindow !== 'function')
    throw new Error('Opening route windows requires NativeScript core 9.1 or later')
  app.openWindow({
    data: { ...options?.data, [ROUTE_DATA]: { version: 1, fullPath } },
  })
}
