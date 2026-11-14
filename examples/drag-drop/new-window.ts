import type {
  IgnoredIntent,
  IntentResult,
  NavigationIntent,
  RouteLocation,
  SuspendedIntent,
} from 'vue-router-ns'
import type { DropOwner } from './policy'

type Reason = IgnoredIntent['reason']
export interface WindowDropOptions {
  owner(): DropOwner | undefined
  /** Stable application session identity; rotate on sign-out/account change. */
  session(): object | null | undefined
  authorize(location: RouteLocation, intent: NavigationIntent): boolean
  /** Fresh unguessable action token, such as a UUID. */
  nextId(): string
  /** Includes drag, scene connection and readiness. At most 30 seconds. */
  maxAge?: number
}
export interface WindowDropOffer {
  status: 'offered'
  readonly data: Readonly<{ version: 1; windowDrag: string }>
  cancel(): void
}
export interface ClaimedWindowDrop {
  status: 'claimed'
  readonly origin: Readonly<{ windowId: string; frame: string }>
  /** Supply the exact new registration. Repeated calls share the first attempt. */
  deliver(
    owner: DropOwner,
    currentOwner: () => DropOwner | undefined,
  ): Promise<IntentResult>
  cancel(): void
}
interface Pending {
  check(): Reason | undefined
  claim(): ClaimedWindowDrop | IgnoredIntent
  release(reason?: Reason): void
}
const ignored = (reason: Reason): IgnoredIntent => ({ status: 'ignored', reason })

/** App-owned, same-process correlation. No OS creation, persistent grant or global Frame. */
export function createWindowDropOffers(options: WindowDropOptions) {
  let disposed = false
  const pending = new Map<string, Pending>(),
    recent = new Map<string, Reason>()
  const authorized = (location: RouteLocation, intent: NavigationIntent) => {
    try {
      const value = options.authorize(location, intent)
      if (value && typeof (value as any).then === 'function') {
        void Promise.resolve(value).catch(() => {})
        return false
      }
      return value === true
    } catch {
      return false
    }
  }
  function offer(
    destination: NavigationIntent['destination'],
    source: 'drag-drop' | 'internal' = 'drag-drop',
  ): WindowDropOffer | IgnoredIntent {
    if (disposed) return ignored('cancelled')
    if (source !== 'drag-drop' && source !== 'internal') return ignored('invalid')
    if (pending.size >= 8) return ignored('busy')
    const owner = options.owner(),
      identity = options.session(),
      age = options.maxAge ?? 30000
    if (
      !owner ||
      !identity ||
      typeof identity !== 'object' ||
      typeof (identity as any).then === 'function'
    )
      return ignored('scope-changed')
    if (!Number.isSafeInteger(age) || age <= 0 || age > 30000) return ignored('invalid')
    const { router, scope, windowId, frame } = owner,
      window = router.window.value
    if (!window || window.id !== windowId || window.state === 'closed')
      return ignored('owner-closed')
    const sourceCurrent = (): Reason | undefined => {
      if (disposed) return 'cancelled'
      if (window.state === 'closed' || router.window.value !== window)
        return 'owner-closed'
      if (
        options.owner() !== owner ||
        owner.router !== router ||
        owner.scope !== scope ||
        owner.windowId !== windowId ||
        owner.frame !== frame ||
        options.session() !== identity
      )
        return 'scope-changed'
    }
    const token = options.nextId()
    if (
      typeof token !== 'string' ||
      !token.trim() ||
      token.length > 128 ||
      pending.has(token) ||
      recent.has(token)
    )
      return ignored('invalid')
    const expiresAt = Date.now() + age
    const preview = router.resolveIntent({
      version: 1,
      source,
      destination,
      delivery: { scope, id: token },
      expiresAt,
    })
    if (preview.status === 'ignored') return preview
    if (!authorized(preview.location, preview.intent)) return ignored('unauthorized')
    const stale = sourceCurrent()
    if (stale) return ignored(stale)
    // Keep validated public data private; later caller mutation cannot retarget the grant.
    const intent = JSON.parse(JSON.stringify(preview.intent)) as NavigationIntent
    let reason: Reason | undefined,
      claimed = false,
      released = false
    let suspension: SuspendedIntent | undefined,
      attempt: Promise<IntentResult> | undefined
    let binding: DropOwner | undefined, abort!: () => void
    const aborted = new Promise<false>((resolve) => {
      abort = () => resolve(false)
    })
    const record: Pending = {
      check() {
        return reason ?? (Date.now() >= expiresAt ? 'expired' : sourceCurrent())
      },
      release(cause = 'repeat') {
        if (released) return
        released = true
        reason = cause
        clearTimeout(timer)
        abort()
        suspension?.cancel()
        suspension = undefined
        pending.delete(token)
        if (!disposed) {
          recent.set(token, cause)
          if (recent.size > 128) recent.delete(recent.keys().next().value!)
        }
      },
      claim() {
        if (claimed) return ignored('repeat')
        const stale = record.check()
        if (stale) {
          record.release(stale)
          return ignored(stale)
        }
        const resolved = router.resolveIntent(intent)
        if (resolved.status === 'ignored') {
          record.release(resolved.reason)
          return resolved
        }
        if (!authorized(resolved.location, resolved.intent)) {
          record.release('unauthorized')
          return ignored('unauthorized')
        }
        const changed = record.check()
        if (changed) {
          record.release(changed)
          return ignored(changed)
        }
        claimed = true
        return {
          status: 'claimed',
          origin: Object.freeze({ windowId, frame }),
          cancel: () => record.release('cancelled'),
          deliver(target, currentOwner) {
            if (binding && binding !== target)
              return Promise.resolve(ignored('wrong-window'))
            if (attempt) return attempt
            binding = target
            const receiver = target.router,
              targetScope = target.scope,
              targetId = target.windowId,
              targetFrame = target.frame,
              targetWindow = receiver.window.value
            // Install the Promise before invoking readiness or other application callbacks.
            attempt = Promise.resolve()
              .then(async () => {
                const current = (): Reason | undefined => {
                  const stale = record.check()
                  if (stale) return stale
                  if (receiver === router || targetId === windowId) return 'wrong-window'
                  if (targetScope !== scope) return 'scope-changed'
                  if (
                    !targetWindow ||
                    targetWindow.id !== targetId ||
                    targetWindow.state === 'closed' ||
                    receiver.window.value !== targetWindow
                  )
                    return 'owner-closed'
                  if (
                    currentOwner() !== target ||
                    target.router !== receiver ||
                    target.scope !== targetScope ||
                    target.windowId !== targetId ||
                    target.frame !== targetFrame
                  )
                    return 'scope-changed'
                }
                let stale = current()
                if (stale) return ignored(stale)
                const ready = await Promise.race([
                  receiver.isReady().then(() => true),
                  aborted,
                ])
                stale = current()
                if (stale || !ready) return ignored(stale ?? 'expired')
                const effective = {
                  ...intent,
                  target: { windowId: targetId, frame: targetFrame },
                }
                const request = receiver.suspendIntent(effective, {
                  scope: () => (current() ? undefined : options.session()),
                  authorize: (location, candidate) =>
                    !current() && authorized(location, candidate),
                  maxAge: Math.max(1, expiresAt - Date.now()),
                })
                if (request.status === 'ignored') return request
                suspension = request
                return await request.resume()
              })
              .finally(() => record.release())
            return attempt
          },
        }
      },
    }
    const timer = setTimeout(() => record.release('expired'), age)
    pending.set(token, record)
    return {
      status: 'offered',
      data: Object.freeze({ version: 1, windowDrag: token }),
      cancel: () => record.release('cancelled'),
    }
  }
  return {
    offer,
    /** Call only for the declared activity type in the actual new-scene callback. */
    take(data: unknown): ClaimedWindowDrop | IgnoredIntent {
      if (disposed) return ignored('cancelled')
      if (
        !data ||
        typeof data !== 'object' ||
        Array.isArray(data) ||
        Object.keys(data).some((key) => !['version', 'windowDrag'].includes(key))
      )
        return ignored('invalid')
      const { version, windowDrag: token } = data as {
        version?: unknown
        windowDrag?: unknown
      }
      if (
        version !== 1 ||
        typeof token !== 'string' ||
        !token.trim() ||
        token.length > 128
      )
        return ignored('invalid')
      const record = pending.get(token)
      return record ? record.claim() : ignored(recent.get(token) ?? 'target-unavailable')
    },
    get pending() {
      return pending.size
    },
    dispose() {
      disposed = true
      for (const record of [...pending.values()]) record.release('cancelled')
      recent.clear()
    },
  }
}
