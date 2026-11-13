import { computed, shallowRef, type Ref } from 'nativescript-vue'
import { parseIntent } from './intents.js'
import type {
  IgnoredIntent,
  IntentIgnoredReason,
  IntentResolution,
  IntentResult,
  NavigationIntent,
} from './intents.js'
import type { RouteLocation } from './types.js'

/** App-owned authentication flow identity and current permission. Neither callback may be async. */
export interface IntentResumePolicy {
  /** Stable object through the intended login; replace on sign-out/account change. */
  scope(): object | null | undefined
  /** Pure permission check, repeated after waits and throughout guards. */
  authorize(location: RouteLocation, intent: NavigationIntent): boolean
  /** Pending lifetime in milliseconds, at most five minutes. Defaults to five minutes. */
  maxAge?: number
}
export interface IntentSuspensionState {
  readonly status: 'pending' | 'resuming' | 'settled' | 'cancelled'
  readonly reason?: IntentIgnoredReason
}
export interface SuspendedIntent {
  readonly status: 'suspended'
  readonly intent: NavigationIntent
  readonly state: Readonly<Ref<IntentSuspensionState>>
  /** Once authorized, all calls return the same attempt's promise. Guards still run. */
  resume(): Promise<IntentResult>
  /** Invalidates future admission; does not roll back a native transition already started. */
  cancel(): void
}
export interface IntentLease {
  finish(): void
}
interface Dependencies {
  resolve(intent: NavigationIntent): IntentResolution
  execute(
    intent: NavigationIntent,
    check: (location: RouteLocation) => IntentIgnoredReason | undefined,
  ): Promise<IntentResult>
  reserve(intent: NavigationIntent): IntentLease | IgnoredIntent
  closed(): boolean
}

const MAX_AGE = 300_000
const ignored = (reason: IntentIgnoredReason): IgnoredIntent => ({
  status: 'ignored',
  reason,
})

/** One pending authentication flow per router. No persistence, login detection or native allocation. */
export function createIntentResumer(deps: Dependencies) {
  let current: ((reason: IntentIgnoredReason) => void) | undefined
  const invalidate = (reason: IntentIgnoredReason) => {
    current?.(reason)
  }

  function suspend(
    original: NavigationIntent,
    policy: IntentResumePolicy,
  ): SuspendedIntent | IgnoredIntent {
    let scope: IntentResumePolicy['scope'],
      authorize: IntentResumePolicy['authorize'],
      identity: object
    let age: number
    try {
      scope = policy.scope.bind(policy)
      authorize = policy.authorize.bind(policy)
      age = policy.maxAge ?? MAX_AGE
      if (!Number.isSafeInteger(age) || age <= 0 || age > MAX_AGE)
        return ignored('invalid')
      const value = scope()
      if (value && typeof (value as any).then === 'function') {
        void Promise.resolve(value).catch(() => {})
        return ignored('unauthorized')
      }
      if (!value || typeof value !== 'object') return ignored('unauthorized')
      identity = value
    } catch {
      return ignored('invalid')
    }
    const expiresAt = Math.min(original.expiresAt ?? Infinity, Date.now() + age)
    const intent = parseIntent({ ...original, expiresAt })
    if ('status' in intent) return intent
    const lease = deps.reserve(intent)
    if ('status' in lease) return lease
    invalidate('superseded')
    const state = shallowRef<IntentSuspensionState>({ status: 'pending' })
    let reason: IntentIgnoredReason | undefined
    let running: Promise<IntentResult> | undefined
    let released = false
    const finish = () => {
      if (released) return
      released = true
      clearTimeout(timer)
      lease.finish()
      scope = () => undefined
      authorize = () => false
      identity = {}
      if (current === cancel) current = undefined
    }
    const cancel = (cause: IntentIgnoredReason) => {
      if (state.value.status === 'settled' || state.value.status === 'cancelled') return
      reason ??= cause
      if (state.value.status === 'pending') {
        state.value = { status: 'cancelled', reason }
        finish()
      } else state.value = { status: 'resuming', reason }
    }
    current = cancel
    const timer = setTimeout(() => cancel('expired'), Math.max(0, expiresAt - Date.now()))
    const check = (location: RouteLocation): IntentIgnoredReason | undefined => {
      if (reason) return reason
      if (deps.closed()) return 'owner-closed'
      if (Date.now() >= expiresAt) return 'expired'
      try {
        if (scope() !== identity) return 'scope-changed'
        const allowed = authorize(location, intent)
        // Fail closed for an accidentally async policy, also consuming its rejection.
        if (allowed && typeof (allowed as any).then === 'function') {
          void Promise.resolve(allowed).catch(() => {})
          return 'unauthorized'
        }
        if (allowed !== true) return 'unauthorized'
      } catch {
        return 'unauthorized'
      }
    }
    const handle: SuspendedIntent = {
      status: 'suspended',
      intent,
      state: computed(() => state.value),
      resume() {
        if (running) return running
        if (reason) return Promise.resolve(ignored(reason))
        const resolved = deps.resolve(intent)
        if (resolved.status === 'ignored') {
          cancel(resolved.reason)
          return Promise.resolve(resolved)
        }
        const denied = check(resolved.location)
        if (denied) {
          // Clicking before authentication does not consume the pending request.
          if (denied !== 'unauthorized') cancel(denied)
          return Promise.resolve(ignored(denied))
        }
        // Install the promise before any execution callback can reenter resume().
        running = Promise.resolve()
          .then(() =>
            deps.execute(intent, (location) => {
              const denied = check(location)
              if (denied) reason ??= denied
              return denied
            }),
          )
          .then((result) => {
            if (result.status === 'ignored') reason ??= result.reason
            return result
          })
          .finally(() => {
            state.value = { status: 'settled', ...(reason ? { reason } : {}) }
            finish()
          })
        state.value = { status: 'resuming' }
        return running
      },
      cancel: () => cancel('cancelled'),
    }
    return Object.freeze(handle)
  }
  return { suspend, invalidate }
}
