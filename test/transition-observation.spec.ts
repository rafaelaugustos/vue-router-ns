import { describe, expect, it } from 'vitest'
import {
  session,
  sessionIds,
  type Observation,
} from '../research/transition-observation/session'
const identity = {
  window: 'w',
  host: 'h',
  session: 's',
  source: 'entry-a',
  target: 'entry-b',
}
describe('research observation session', () => {
  it.each(['source-replaced', 'target-replaced', 'host-unloaded-or-unsubscribed'])(
    'ignores late UIKit callbacks after %s',
    (reason) => {
      const events: Observation[] = []
      const s = session(identity, (e) => events.push(e))
      s.invalidate(reason)
      s.interaction(false)
      s.complete(false)
      s.invalidate(reason)
      expect(events).toEqual([
        { ...identity, type: 'began', progress: null },
        { ...identity, type: 'terminal', outcome: 'interrupted', reason },
      ])
    },
  )
  it.each([true, false])(
    'settles once for cancelled=%s without treating interaction-end as completion',
    (cancelled) => {
      const events: Observation[] = []
      const s = session(identity, (e) => events.push(e))
      s.interaction(cancelled)
      s.interaction(cancelled)
      expect(s.ended).toBe(false)
      s.complete(cancelled)
      s.complete(!cancelled)
      expect(events.map((e) => e.type)).toEqual([
        'began',
        'interaction-ended',
        'terminal',
      ])
      expect(events[2]).toMatchObject({ outcome: cancelled ? 'cancelled' : 'committed' })
    },
  )
  it('isolates a diagnostic subscriber failure from native navigation', () => {
    const s = session(identity, () => {
      throw Error('subscriber')
    })
    expect(() => {
      s.interaction(false)
      s.complete(false)
    }).not.toThrow()
    expect(s.ended).toBe(true)
  })
})

it('does not reuse session identities when reconnecting to the same host', () => {
  const first = sessionIds('same-host')
  const reconnected = sessionIds('same-host')
  const ids = [first(), first(), reconnected(), reconnected()]
  expect(new Set(ids).size).toBe(4)
})
