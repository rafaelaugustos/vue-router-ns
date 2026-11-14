import type { IntentResult, NavigationIntent, RouteLocation, Router } from 'vue-router-ns'

export const destinationType = 'org.nativescript.vue-router-ns.destination'
export interface DropOwner {
  router: Router
  scope: string
  windowId: string
  frame: string
}
export interface DropItem {
  type: string
  load(): { value: Promise<string>; cancel(): void }
}
export type DropResult<T = IntentResult> =
  | { status: 'ignored'; reason: string }
  | { status: 'settled'; intent: NavigationIntent; navigation: T }
export interface DropOptions {
  /** Stable app-owned registration for this target, not the focused Frame. */
  owner(): DropOwner | undefined
  /** Synchronous content/account permission; normal guards must also authorize. */
  authorize(location: RouteLocation): boolean
  stage?(stage: 'accepted' | 'loaded', id: string): void
}
export interface DropPolicy<T = IntentResult> {
  accepts(types: readonly string[]): boolean
  drop(
    id: string,
    items: readonly DropItem[],
    source?: 'drag-drop' | 'internal',
  ): Promise<DropResult<T>>
  dispose(): void
}
export interface DropHandoffOptions<T> extends DropOptions {
  /** App-owned delivery after validation; must preserve ownership through its own waits. */
  handoff(intent: NavigationIntent, owner: DropOwner): Promise<T>
}

/** Optional application policy. One pending copy/open per target; no moves. */
export function createDropPolicy<T>(options: DropHandoffOptions<T>): DropPolicy<T>
export function createDropPolicy(options: DropOptions): DropPolicy
export function createDropPolicy(
  options: DropOptions & Partial<DropHandoffOptions<unknown>>,
): DropPolicy<unknown> {
  let disposed = false
  let pending: (() => void) | undefined
  const recent = new Set<string>()
  const ignored = (reason: string): DropResult<unknown> => ({ status: 'ignored', reason })
  function accepts(types: readonly string[]) {
    if (disposed) return false
    const owner = options.owner(),
      window = owner?.router.window.value
    return (
      !!owner &&
      !!window &&
      window.id === owner.windowId &&
      window.state !== 'closed' &&
      !pending &&
      types.length === 1 &&
      types[0] === destinationType
    )
  }
  async function drop(
    id: string,
    items: readonly DropItem[],
    source: 'drag-drop' | 'internal' = 'drag-drop',
  ): Promise<DropResult<unknown>> {
    if (disposed) return ignored('disposed')
    const owner = options.owner()
    if (!owner) return ignored('target-unavailable')
    if (typeof id !== 'string' || !id.trim() || id.length > 128) return ignored('invalid')
    const router = owner.router,
      scope = owner.scope,
      windowId = owner.windowId,
      frame = owner.frame
    const key = JSON.stringify([scope, id])
    if (recent.has(key)) return ignored('repeat')
    if (pending) return ignored('busy')
    if (items.length !== 1) return ignored('multiple-items')
    const item = items[0]!
    if (item.type !== destinationType) return ignored('unsupported-type')
    let interrupted = 'disposed',
      cancelLoad = () => {}
    const aborted = new Promise<undefined>((resolve) => {
      pending = () => resolve(undefined)
    })
    const stop = pending!
    const timer = setTimeout(() => {
      interrupted = 'timeout'
      stop()
    }, 10000)
    recent.add(key)
    if (recent.size > 128) recent.delete(recent.values().next().value!)
    const current = () => {
      if (disposed) return 'disposed'
      if (
        options.owner() !== owner ||
        owner.router !== router ||
        owner.scope !== scope ||
        owner.windowId !== windowId ||
        owner.frame !== frame
      )
        return 'owner-changed'
      const window = router.window.value
      if (!window || window.id !== windowId || window.state === 'closed')
        return 'owner-closed'
    }
    try {
      const stale = current()
      if (stale) return ignored(stale)
      options.stage?.('accepted', id)
      let json: string | undefined
      try {
        const load = item.load()
        cancelLoad = load.cancel
        json = await Promise.race([load.value, aborted])
      } catch {
        return ignored(current() ?? 'provider-error')
      }
      if (json === undefined) return ignored(current() ?? interrupted)
      let invalidated = current()
      if (invalidated) return ignored(invalidated)
      options.stage?.('loaded', id)
      let payload: any
      try {
        if (
          typeof json !== 'string' ||
          json.length > 8192 ||
          encodeURIComponent(json).replace(/%[A-F\d]{2}/g, 'x').length > 8192
        )
          return ignored('invalid')
        payload = JSON.parse(json)
        if (
          !payload ||
          typeof payload !== 'object' ||
          Array.isArray(payload) ||
          Object.keys(payload).some(
            (k) => !['version', 'destination', 'expiresAt'].includes(k),
          )
        )
          return ignored('invalid')
      } catch {
        return ignored('invalid')
      }
      const ready = await Promise.race([router.isReady().then(() => true), aborted])
      if (!ready) return ignored(current() ?? interrupted)
      invalidated = current()
      if (invalidated) return ignored(invalidated)
      const resolution = router.resolveIntent({
        ...payload,
        source,
        delivery: { scope, id },
        target: { windowId, frame },
      })
      if (resolution.status === 'ignored') return resolution
      if (!options.authorize(resolution.location)) return ignored('unauthorized')
      invalidated = current()
      if (invalidated) return ignored(invalidated)
      // Provider/readiness timeout does not pretend to cancel an executing guard.
      clearTimeout(timer)
      const navigation = await (options.handoff
        ? options.handoff(resolution.intent, owner)
        : router.openIntent(resolution.intent))
      return { status: 'settled', intent: resolution.intent, navigation }
    } finally {
      clearTimeout(timer)
      pending = undefined
      cancelLoad()
    }
  }
  return {
    accepts,
    drop,
    dispose() {
      disposed = true
      pending?.()
      recent.clear()
    },
  }
}
