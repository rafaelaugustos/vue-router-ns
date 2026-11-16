import assert from 'node:assert/strict'
import test from 'node:test'
import { assertGestureRotation, requireGestureOverlaps } from './gesture-overlap.mjs'

function sample(landscape = true, intent = 'commit', cancelled = false) {
  const name = `${intent}-${landscape ? 'landscape' : 'portrait'}`
  const current = {
    navigationActive: true,
    navigationCompletionPending: true,
    navigationCoordinator: 11,
    currentCoordinator: 11,
    currentlyInteractive: true,
    percent: 0.2,
    gestures: [{ kind: 'edge', id: 7, state: 2, enabled: true }],
  }
  const event = (kind, at, data = {}) => ({ kind, at, wallTime: 1000 + at, ...data })
  const report = {
    operation: 'gesture-device',
    landscape,
    navigationProfile: 'platform-default',
    reduceMotion: false,
    finished: true,
    window: landscape ? { width: 834, height: 1210 } : { width: 1210, height: 834 },
    before: { frames: [{ name: 'home', pageControllers: [4, 5] }] },
    events: [
      event('armed', 0),
      event('navigation-observed', 10, {
        ...current,
        interactive: true,
        duration: 0.35,
        coordinator: 11,
        from: 5,
        to: 4,
        fromKey: null,
        toKey: null,
      }),
      event('device-orientation', 30, {
        ...current,
        deviceOrientation: landscape ? 3 : 1,
      }),
      event('rotation-began', 40, {
        ...current,
        rotationCoordinator: 12,
        width: landscape ? 1210 : 834,
        height: landscape ? 834 : 1210,
      }),
      event('interaction-ended', 50, { coordinator: 11, cancelled }),
      event('navigation-ended', 100, { coordinator: 11, cancelled }),
      event('rotation-ended', 120, { rotationCoordinator: 12 }),
    ],
  }
  const driver = {
    gestureIntent: intent,
    rotationRequestPhase: 'interactive',
    rotationSignal: 'navigation-observed',
    navigationObservedBeforeRequest: true,
    interactionEndedBeforeRequest: false,
    requestedAt: 1020,
  }
  return { name, report, driver }
}
const check = ({ name, report, driver }) => assertGestureRotation(name, report, driver)
const find = (data, kind) => data.report.events.find((event) => event.kind === kind)
const order = (data) => data.report.events.sort((a, b) => a.at - b.at)

for (const landscape of [true, false])
  for (const intent of ['commit', 'cancel'])
    test(`proves interactive overlap: ${intent}, target landscape=${landscape}`, () => {
      const data = sample(landscape, intent, intent === 'cancel')
      assert.equal(check(data).result, 'interactive-overlap')
      assert.equal(check(data).outcome, intent === 'cancel' ? 'cancelled' : 'committed')
    })

test('records UIKit cancellation even when the drag intended to commit', () => {
  assert.equal(check(sample(true, 'commit', true)).outcome, 'cancelled')
})

test('distinguishes completion animation from pointer-interaction overlap', () => {
  const data = sample()
  Object.assign(find(data, 'rotation-began'), {
    at: 60,
    wallTime: 1060,
    currentlyInteractive: false,
  })
  order(data)
  assert.equal(check(data).result, 'completion-overlap')
})

test('device orientation during input is not proof of visual overlap', () => {
  const data = sample()
  Object.assign(find(data, 'rotation-began'), {
    at: 110,
    wallTime: 1110,
    navigationActive: false,
    navigationCompletionPending: false,
    navigationCoordinator: null,
    currentCoordinator: null,
    currentlyInteractive: null,
  })
  order(data)
  const proof = check(data)
  assert.equal(proof.result, 'rotation-deferred')
  assert.equal(proof.visualOverlap, false)
  assert.equal(proof.receivedDuringInteraction, true)
  assert.equal(proof.firstTargetAfterNavigationEndMs, 10)
})

for (const [description, mutation] of [
  [
    'pending completion with no current navigation',
    { navigationActive: false, currentCoordinator: null },
  ],
  ['a different current coordinator', { currentCoordinator: 99 }],
  ['the rotation coordinator mistaken for navigation', { rotationCoordinator: 11 }],
  ['unknown interaction phase', { currentlyInteractive: null }],
])
  test(`does not certify ${description}`, () => {
    const data = sample()
    Object.assign(find(data, 'rotation-began'), mutation)
    if (mutation.rotationCoordinator)
      find(data, 'rotation-ended').rotationCoordinator = mutation.rotationCoordinator
    assert.equal(check(data).result, 'overlap-unconfirmed')
    assert.equal(check(data).visualOverlap, false)
  })

for (const [description, mutate] of [
  [
    'orientation received after pointer interaction',
    (data) => {
      Object.assign(find(data, 'device-orientation'), {
        at: 60,
        wallTime: 1060,
        currentlyInteractive: false,
      })
      order(data)
    },
  ],
  [
    'orientation never received by the app',
    (data) => {
      data.report.events = data.report.events.filter(
        (event) => event.kind !== 'device-orientation',
      )
    },
  ],
  [
    'no active native recognizer',
    (data) => {
      find(data, 'device-orientation').gestures[0].state = 0
    },
  ],
  [
    'completion-only request',
    (data) => {
      data.driver.interactionEndedBeforeRequest = true
    },
  ],
  [
    'mismatched native outcome',
    (data) => {
      find(data, 'navigation-ended').cancelled = true
    },
  ],
  [
    'duplicate native completion',
    (data) => {
      data.report.events.push({ ...find(data, 'navigation-ended'), at: 130 })
    },
  ],
  [
    'window resize instead of target rotation',
    (data) => {
      find(data, 'rotation-began').width = 1000
    },
  ],
  [
    'unfinished rotation',
    (data) => {
      data.report.events.pop()
    },
  ],
  [
    'wrong native destination',
    (data) => {
      find(data, 'navigation-observed').to = 99
    },
  ],
  [
    'Reduce Motion',
    (data) => {
      data.report.reduceMotion = true
    },
  ],
  [
    'custom transition profile',
    (data) => {
      data.report.navigationProfile = 'core-slide-1500'
    },
  ],
])
  test(`rejects ${description}`, () => {
    const data = sample()
    mutate(data)
    assert.throws(() => check(data))
  })

test('strict coverage audit rejects deferred and missing cases', () => {
  const summary = [
    'cancel-landscape',
    'cancel-portrait',
    'commit-landscape',
    'commit-portrait',
  ].map((name) => ({
    case: name,
    result: 'interactive-overlap',
    gestureEvidence: { visualOverlap: true },
  }))
  assert.doesNotThrow(() => requireGestureOverlaps(summary))
  summary[0] = {
    case: summary[0].case,
    result: 'rotation-deferred',
    gestureEvidence: { visualOverlap: false },
  }
  summary[1] = { case: summary[1].case, result: 'gesture-not-reproduced' }
  assert.throws(() => requireGestureOverlaps(summary), /Actual gesture overlap missing/)
  assert.throws(() => requireGestureOverlaps(summary.slice(1)))
})
