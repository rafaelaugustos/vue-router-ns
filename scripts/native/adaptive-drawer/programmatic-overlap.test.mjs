import assert from 'node:assert/strict'
import test from 'node:test'
import { assertProgrammaticOverlap } from './programmatic-overlap.mjs'

function sample(operation = 'push-overlap', landscape = true) {
  const window = landscape ? { width: 834, height: 1210 } : { width: 1210, height: 834 }
  const report = {
    operation,
    landscape,
    window,
    navigationProfile: 'core-slide-1500',
    reduceMotion: false,
    finished: true,
    before: {
      frames: [
        { name: 'home', pageControllers: operation.startsWith('push') ? [11] : [11, 12] },
      ],
    },
    after: {
      frames: [
        { name: 'home', pageControllers: operation.startsWith('push') ? [11, 12] : [11] },
      ],
    },
    events: [
      { kind: 'armed', at: 0, wallTime: 1000 },
      {
        kind: 'navigation-observed',
        at: 30,
        wallTime: 1030,
        coordinator: 42,
        from: operation.startsWith('push') ? 11 : 12,
        to: operation.startsWith('push') ? 12 : 11,
        fromKey: null,
        toKey: null,
        interactive: false,
        duration: 1.5,
        observedFrom: 'rotation-callback',
      },
      {
        kind: 'rotation-began',
        at: 40,
        wallTime: 1040,
        width: window.height,
        height: window.width,
        navigationActive: true,
        navigationCompletionPending: true,
        navigationCoordinator: 42,
        currentCoordinator: 42,
        rotationCoordinator: 51,
      },
      { kind: 'rotation-ended', at: 500, wallTime: 1500, rotationCoordinator: 51 },
      {
        kind: 'navigation-ended',
        at: 1530,
        wallTime: 2530,
        coordinator: 42,
        cancelled: false,
      },
    ],
  }
  const driver = { requestPhase: 'admission', requestedAt: 1020 }
  return { report, driver, name: `${operation}-${landscape ? 'landscape' : 'portrait'}` }
}
const check = ({ name, report, driver }) =>
  assertProgrammaticOverlap(name, report, driver)
for (const operation of ['push-overlap', 'back-overlap']) {
  for (const landscape of [true, false]) {
    test(`proves native ${operation} overlap toward ${landscape ? 'landscape' : 'portrait'}`, () => {
      assert.equal(check(sample(operation, landscape)).overlapBeforeCompletionMs, 1490)
    })
  }
}
test('retains a temporary orientation reversal and final target rotation', () => {
  const value = sample()
  value.report.events.push(
    {
      kind: 'rotation-began',
      at: 510,
      wallTime: 1510,
      ...value.report.window,
      navigationActive: true,
      navigationCompletionPending: true,
      navigationCoordinator: 42,
      currentCoordinator: 42,
      rotationCoordinator: 52,
    },
    { kind: 'rotation-ended', at: 1000, wallTime: 2000, rotationCoordinator: 52 },
    {
      kind: 'rotation-began',
      at: 1550,
      wallTime: 2550,
      width: 1210,
      height: 834,
      navigationActive: false,
      navigationCompletionPending: false,
      navigationCoordinator: null,
      currentCoordinator: null,
      rotationCoordinator: 53,
    },
    { kind: 'rotation-ended', at: 2050, wallTime: 3050, rotationCoordinator: 53 },
  )
  value.report.events.sort((a, b) => a.at - b.at)
  assert.deepEqual(
    check(value).rotations.map((event) => event.target),
    [true, false, true],
  )
})
test('rejects a snapshot between the temporary return and final target rotation', () => {
  const value = sample()
  value.report.events.push(
    {
      kind: 'rotation-began',
      at: 510,
      wallTime: 1510,
      ...value.report.window,
      navigationActive: true,
      navigationCompletionPending: true,
      navigationCoordinator: 42,
      currentCoordinator: 42,
      rotationCoordinator: 52,
    },
    { kind: 'rotation-ended', at: 1600, wallTime: 2600, rotationCoordinator: 52 },
  )
  value.report.events.sort((a, b) => a.at - b.at)
  assert.throws(() => check(value), /final rotation must reach the target/)
})
for (const [reason, mutate] of [
  [
    'request timing without native overlap',
    (v) => {
      const r = v.report.events[2]
      r.at = 1540
      r.navigationActive = false
      r.navigationCompletionPending = false
      v.report.events[3].at = 2000
    },
  ],
  [
    'pending completion with a different coordinator',
    (v) => {
      v.report.events[2].currentCoordinator = 99
    },
  ],
  [
    'rotation coordinator mistaken for navigation',
    (v) => {
      v.report.events[2].navigationCoordinator =
        v.report.events[2].currentCoordinator =
        v.report.events[1].coordinator =
        v.report.events[4].coordinator =
          51
    },
  ],
  [
    'resize instead of the target orientation',
    (v) => {
      v.report.events[2].width = 1043
      v.report.events[2].height = 719
    },
  ],
  [
    'unfinished rotation',
    (v) => {
      v.report.events.splice(3, 1)
    },
  ],
  [
    'duplicate navigation completion',
    (v) => {
      v.report.events.push({ ...v.report.events[4] })
    },
  ],
  [
    'wrong native destination',
    (v) => {
      v.report.events[1].to = 77
    },
  ],
  [
    'another transition profile',
    (v) => {
      v.report.navigationProfile = 'platform-default'
    },
  ],
  [
    'Reduce Motion substitute',
    (v) => {
      v.report.reduceMotion = true
    },
  ],
]) {
  test(`rejects ${reason}`, () => {
    const value = sample()
    mutate(value)
    assert.throws(() => check(value))
  })
}
