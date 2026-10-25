/** Proposal v1: research only, deliberately absent from the package exports. */
export interface Identity {
  window: string
  host: string
  session: string
  source: string | null
  target: string | null
}
export type Observation = Identity &
  (
    | { type: 'began'; progress: null }
    | { type: 'interaction-ended'; cancelled: boolean }
    | {
        type: 'terminal'
        outcome: 'committed' | 'cancelled' | 'interrupted'
        reason?: string
      }
  )
export function session(
  identity: Identity,
  listener: ((event: Observation) => void) | undefined,
) {
  let ended = false,
    interactionEnded = false
  // Diagnostic subscribers must not throw into UIKit callbacks.
  const emit = (event: Observation) => {
    try {
      listener?.(event)
    } catch {}
  }
  const finish = (
    outcome: 'committed' | 'cancelled' | 'interrupted',
    reason?: string,
  ) => {
    if (ended) return
    ended = true
    emit({ ...identity, type: 'terminal', outcome, reason })
    listener = undefined
  }
  emit({ ...identity, type: 'began', progress: null })
  return {
    interaction(cancelled: boolean) {
      if (ended || interactionEnded) return
      interactionEnded = true
      emit({ ...identity, type: 'interaction-ended', cancelled })
    },
    complete(cancelled: boolean) {
      finish(cancelled ? 'cancelled' : 'committed')
    },
    invalidate(reason: string) {
      finish('interrupted', reason)
    },
    get ended() {
      return ended
    },
  }
}

let nextSubscription = 0
/** Identity is local to this observer runtime, including reconnects to the same host. */
export function sessionIds(host: string) {
  const subscription = ++nextSubscription
  let sequence = 0
  return () => `${host}:${subscription}:${++sequence}`
}
