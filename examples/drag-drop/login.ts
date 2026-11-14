import type {
  IgnoredIntent,
  IntentResult,
  NavigationIntent,
  RouteLocation,
  SuspendedIntent,
} from 'vue-router-ns'
import type { DropOwner } from './policy'

export type DropLoginOutcome = IntentResult | SuspendedIntent
export interface DropLoginOptions {
  owner(): DropOwner | undefined
  /** Stable object across the intended login; replace on sign-out/account change. */
  session(): object | null | undefined
  authenticated(): boolean
  authorize(location: RouteLocation, intent: NavigationIntent): boolean
  /** Present login in owner.frame and resolve when it is visible, not when sign-in finishes. */
  presentLogin(owner: DropOwner, request: SuspendedIntent): Promise<void>
  maxAge?: number
}

/** Optional app handoff. The native transfer never waits for a user to finish login. */
export function createDropLogin(options: DropLoginOptions) {
  let disposed = false
  let pending: SuspendedIntent | undefined
  const ignored = (reason: IgnoredIntent['reason']): IgnoredIntent => ({
    status: 'ignored',
    reason,
  })

  async function handoff(
    intent: NavigationIntent,
    owner: DropOwner,
  ): Promise<DropLoginOutcome> {
    if (disposed) return ignored('cancelled')
    const { router, scope, windowId, frame } = owner
    const current = () =>
      !disposed &&
      options.owner() === owner &&
      owner.router === router &&
      owner.scope === scope &&
      owner.windowId === windowId &&
      owner.frame === frame &&
      router.window.value?.id === windowId &&
      router.window.value.state !== 'closed'
    if (!current()) return ignored('scope-changed')
    if (intent.target?.windowId !== windowId) return ignored('wrong-window')
    if (intent.target.frame !== frame) return ignored('target-unavailable')
    if (intent.delivery?.scope !== scope) return ignored('scope-changed')
    const resolved = router.resolveIntent(intent)
    if (resolved.status === 'ignored') return resolved
    const needsLogin = options.authenticated() !== true
    if (!needsLogin && options.authorize(resolved.location, resolved.intent) !== true)
      return ignored('unauthorized')
    if (!current()) return ignored('scope-changed')
    // Replacement is trusted application policy, never a field from the drag payload.
    const request = router.suspendIntent(
      needsLogin
        ? { ...resolved.intent, options: { ...resolved.intent.options, replace: true } }
        : resolved.intent,
      {
        scope: () => (current() ? options.session() : undefined),
        authorize: (location, candidate) =>
          current() &&
          options.authenticated() === true &&
          options.authorize(location, candidate) === true,
        maxAge: options.maxAge,
      },
    )
    if (request.status === 'ignored') return request
    pending = request
    if (!needsLogin) {
      try {
        return await request.resume()
      } finally {
        if (pending === request) pending = undefined
      }
    }
    try {
      await options.presentLogin(owner, request)
      if (!current()) {
        request.cancel()
        return ignored('cancelled')
      }
      if (request.state.value.status === 'cancelled')
        return ignored(request.state.value.reason ?? 'cancelled')
      return request
    } catch (error) {
      request.cancel()
      if (pending === request) pending = undefined
      throw error
    }
  }
  return {
    handoff,
    get pending() {
      return pending?.state.value.status === 'pending' ||
        pending?.state.value.status === 'resuming'
        ? pending
        : undefined
    },
    cancel() {
      pending?.cancel()
      pending = undefined
    },
    dispose() {
      disposed = true
      pending?.cancel()
      pending = undefined
    },
  }
}
