import type { IntentResult, NavigationIntent, Router } from 'vue-router-ns'

/** Application example, not a package API. Create one instance per account session. */
export interface IntentWindow {
  readonly key: string
  readonly router: Pick<Router, 'window' | 'resolveIntent' | 'openIntent'>
}
export type WindowPolicy = (
  | { mode: 'reuse' | 'focus'; key: string }
  | { mode: 'new'; key: string; restore: 'saved' | 'fresh' }
) & { history: 'append' | 'reset' }
export interface WindowPorts {
  /** All windows in this example share routes and URL mapping. No navigation here. */
  resolve: Router['resolveIntent']
  find(key: string): IntentWindow | undefined
  /** Register a fresh public owner; resolve after its native mount. Bound this wait. */
  open(
    key: string,
    restore: 'saved' | 'fresh',
    current: () => boolean,
  ): Promise<IntentWindow | undefined>
  /** Request and observe native activation; rejection must propagate. */
  focus(owner: IntentWindow): Promise<void>
}

export function createWindowIntentPolicy(ports: WindowPorts) {
  let disposed = false,
    sequence = 0
  const pending = new Set<string>(),
    recent = new Set<string>(),
    opening = new Set<string>()
  const ignored = (
    reason: Extract<IntentResult, { status: 'ignored' }>['reason'],
  ): IntentResult => ({ status: 'ignored', reason })

  async function dispatch(
    request: unknown,
    selection: WindowPolicy,
  ): Promise<IntentResult> {
    if (disposed) return ignored('scope-changed')
    // Snapshot trusted app policy before callbacks/awaits. Never read it from a payload.
    const policy = { ...selection }
    if (
      !['reuse', 'focus', 'new'].includes(policy.mode) ||
      typeof policy.key !== 'string' ||
      !policy.key.trim() ||
      policy.key.length > 128 ||
      !['append', 'reset'].includes(policy.history) ||
      (policy.mode === 'new' && !['saved', 'fresh'].includes(policy.restore))
    )
      return ignored('invalid')
    const preview = ports.resolve(request)
    if (preview.status === 'ignored') return preview
    if (disposed) return ignored('scope-changed')
    const intent = preview.intent
    // A fresh native identity cannot satisfy an assertion on an existing owner.
    if (policy.mode === 'new' && intent.target?.windowId) return ignored('wrong-window')
    const delivery =
      intent.delivery && JSON.stringify([intent.delivery.scope, intent.delivery.id])
    if (delivery && (pending.has(delivery) || recent.has(delivery)))
      return ignored('repeat')
    if (pending.size >= 32) return ignored('busy')
    const key = delivery ?? `local:${++sequence}`
    pending.add(key)
    let ownsOpening = false,
      active = true
    const expired = () => intent.expiresAt !== undefined && intent.expiresAt <= Date.now()
    const current = () => !disposed && active && !expired()
    try {
      let owner: IntentWindow | undefined
      if (policy.mode === 'new') {
        if (ports.find(policy.key)) return ignored('target-unavailable')
        if (disposed) return ignored('scope-changed')
        if (expired()) return ignored('expired')
        if (opening.has(policy.key)) return ignored('busy')
        opening.add(policy.key)
        ownsOpening = true
        owner = await ports.open(policy.key, policy.restore, current)
      } else owner = ports.find(policy.key)
      if (disposed) return ignored('scope-changed')
      if (expired()) return ignored('expired')
      if (!owner) return ignored('target-unavailable')
      const window = owner.router.window.value
      const check = () =>
        disposed
          ? ('scope-changed' as const)
          : !window ||
              window.state === 'closed' ||
              owner!.router.window.value !== window ||
              ports.find(policy.key) !== owner
            ? ('owner-closed' as const)
            : expired()
              ? ('expired' as const)
              : undefined
      let denied = check()
      if (denied) return ignored(denied)
      if (
        owner.key !== policy.key ||
        (intent.target?.windowId && intent.target.windowId !== window!.id)
      )
        return ignored('wrong-window')
      const effective: NavigationIntent = {
        ...intent,
        target: { ...intent.target, windowId: window!.id },
        options: {
          ...intent.options,
          replace: false,
          clearHistory: policy.history === 'reset',
        },
      }
      // The receiving router resolves again, including after OS creation/restoration.
      const resolved = owner.router.resolveIntent(effective)
      if (resolved.status === 'ignored') return resolved
      denied = check()
      if (denied) return ignored(denied)
      if (policy.mode !== 'reuse') await ports.focus(owner)
      denied = check()
      if (denied) return ignored(denied)
      return await owner.router.openIntent(effective)
    } finally {
      active = false
      if (ownsOpening) opening.delete(policy.key)
      pending.delete(key)
      if (delivery && !disposed) {
        recent.add(delivery)
        if (recent.size > 256) recent.delete(recent.values().next().value!)
      }
    }
  }
  return {
    dispatch,
    /** Sign-out/account replacement invalidates handoffs; already-started OS work is app-owned. */
    dispose() {
      disposed = true
      recent.clear()
      pending.clear()
      opening.clear()
    },
  }
}
