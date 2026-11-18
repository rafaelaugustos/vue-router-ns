import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const gestures = [
  'cancel-landscape',
  'cancel-portrait',
  'commit-landscape',
  'commit-portrait',
]
const isCurrent = (event, coordinator) =>
  event.navigationActive === true &&
  event.navigationCompletionPending === true &&
  event.navigationCoordinator === coordinator &&
  event.currentCoordinator === coordinator

// Device orientation can arrive during a real gesture while UIKit defers the
// window rotation. Keep receipt, pointer interaction and visual rotation distinct.
export function assertGestureRotation(name, report, driver) {
  assert(
    gestures.includes(name),
    'Expected one of the four gesture intentions/directions',
  )
  assert.equal(report.operation, 'gesture-device')
  assert.equal(name.endsWith('landscape'), report.landscape)
  assert.equal(report.navigationProfile, 'platform-default')
  assert.equal(report.reduceMotion, false)
  assert(report.finished && !report.error && !report.notReproduced)
  assert.equal(driver.gestureIntent, name.split('-')[0])
  assert.equal(driver.rotationRequestPhase, 'interactive')
  assert.equal(driver.rotationSignal, 'navigation-observed')
  assert.equal(driver.navigationObservedBeforeRequest, true)
  assert.equal(driver.interactionEndedBeforeRequest, false)
  const events = report.events
  for (let i = 1; i < events.length; i++) assert(events[i].at >= events[i - 1].at)
  const one = (kind) => {
    const found = events.filter((event) => event.kind === kind)
    assert.equal(found.length, 1, `${name}: exactly one ${kind}`)
    return found[0]
  }
  const armed = one('armed')
  const start = one('navigation-observed')
  const decision = one('interaction-ended')
  const end = one('navigation-ended')
  assert(start.at >= armed.at && decision.at >= start.at && end.at >= decision.at)
  assert.equal(start.interactive, true, `${name}: actual native interactive navigation`)
  assert(start.duration > 0 && Number.isFinite(start.duration))
  assert(Number.isInteger(start.coordinator) && start.coordinator > 0)
  assert.equal(decision.coordinator, start.coordinator)
  assert.equal(end.coordinator, start.coordinator)
  assert.equal(typeof decision.cancelled, 'boolean')
  assert.equal(end.cancelled, decision.cancelled, `${name}: native outcome must agree`)
  assert(driver.requestedAt >= start.wallTime && driver.requestedAt < decision.wallTime)
  const before = report.before.frames.find((frame) => frame.name === 'home')
  assert.equal(start.from, before.pageControllers.at(-1))
  assert.equal(start.to, before.pageControllers.at(-2))
  assert.notEqual(start.from, start.to)
  if (start.fromKey !== null) assert.equal(start.fromKey, start.from)
  if (start.toKey !== null) assert.equal(start.toKey, start.to)

  const targetOrientation = report.landscape ? 3 : 1 // XCUIDevice landscapeLeft / portrait
  const received = events.find(
    (event) =>
      event.kind === 'device-orientation' &&
      event.deviceOrientation === targetOrientation &&
      event.wallTime >= driver.requestedAt &&
      event.at >= start.at &&
      event.at < decision.at &&
      isCurrent(event, start.coordinator) &&
      event.currentlyInteractive === true &&
      Number.isFinite(event.percent) &&
      event.percent >= 0 &&
      event.percent < 1 &&
      event.gestures.some(
        (gesture) =>
          gesture.enabled === true && (gesture.state === 1 || gesture.state === 2),
      ),
  )
  assert(
    received,
    `${name}: device orientation must reach the app during native pointer interaction`,
  )
  const activeRecognizers = received.gestures.filter(
    (gesture) => gesture.enabled && (gesture.state === 1 || gesture.state === 2),
  )
  assert(
    activeRecognizers.every((gesture) => Number.isInteger(gesture.id) && gesture.id > 0),
  )

  assert(report.window.width > 0 && report.window.height > 0)
  assert.equal(report.window.width < report.window.height, report.landscape)
  const targetSize = (rotation) =>
    rotation.width === report.window.height && rotation.height === report.window.width
  const rotations = events.filter((event) => event.kind === 'rotation-began')
  const completions = events.filter((event) => event.kind === 'rotation-ended')
  assert(rotations.length > 0)
  assert.equal(
    new Set(rotations.map((event) => event.rotationCoordinator)).size,
    rotations.length,
  )
  assert.equal(rotations.length, completions.length)
  for (const rotation of rotations) {
    assert(
      Number.isInteger(rotation.rotationCoordinator) && rotation.rotationCoordinator > 0,
    )
    const finished = completions.filter(
      (event) => event.rotationCoordinator === rotation.rotationCoordinator,
    )
    assert.equal(finished.length, 1)
    assert(finished[0].at >= rotation.at)
  }
  assert(
    targetSize(rotations.at(-1)),
    `${name}: final rotation must reach target dimensions`,
  )
  const targets = rotations.filter(targetSize)
  const overlaps = targets.filter(
    (rotation) =>
      rotation.at >= start.at &&
      rotation.at < end.at &&
      isCurrent(rotation, start.coordinator) &&
      rotation.rotationCoordinator !== start.coordinator,
  )
  const interactive = overlaps.find(
    (rotation) => rotation.currentlyInteractive === true && rotation.at < decision.at,
  )
  const completion = overlaps.find(
    (rotation) => rotation.currentlyInteractive === false && rotation.at >= decision.at,
  )
  const overlap = interactive ?? completion
  // Pending completion, a different context or a rotation arriving before
  // observation cannot prove overlap. Do not turn these cases into deferral.
  const deferred = rotations.every(
    (rotation) =>
      rotation.at >= end.at &&
      rotation.navigationCompletionPending === false &&
      rotation.navigationActive === false,
  )
  const result = interactive
    ? 'interactive-overlap'
    : completion
      ? 'completion-overlap'
      : deferred
        ? 'rotation-deferred'
        : 'overlap-unconfirmed'
  return {
    result,
    visualOverlap: Boolean(overlap),
    intent: driver.gestureIntent,
    outcome: end.cancelled ? 'cancelled' : 'committed',
    navigationCoordinator: start.coordinator,
    receivedDuringInteraction: true,
    receivedProgress: received.percent,
    receivedBeforeInteractionEndMs: decision.at - received.at,
    activeRecognizers,
    firstTargetAfterNavigationEndMs: targets[0].at - end.at,
    ...(overlap ? { rotationCoordinator: overlap.rotationCoordinator } : {}),
    rotations: rotations.map((rotation) => ({
      width: rotation.width,
      height: rotation.height,
      target: targetSize(rotation),
      rotationCoordinator: rotation.rotationCoordinator,
      navigationCoordinator: rotation.navigationCoordinator,
      currentCoordinator: rotation.currentCoordinator,
      currentlyInteractive: rotation.currentlyInteractive,
      afterNavigationEndMs: rotation.at - end.at,
    })),
  }
}

export function requireGestureOverlaps(summary) {
  const cases = summary.filter((entry) => gestures.includes(entry.case))
  assert.deepEqual(cases.map((entry) => entry.case).sort(), gestures)
  const missing = cases.filter((entry) => !entry.gestureEvidence?.visualOverlap)
  assert.equal(
    missing.length,
    0,
    `Actual gesture overlap missing: ${missing.map((entry) => `${entry.case} (${entry.result})`).join(', ')}`,
  )
}

// This is a coverage audit, separate from the phase/deferral regression suite.
// Recompute every proof from raw events before evaluating the stricter claim.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const directory = process.argv[2]
  assert(directory, 'Usage: node gesture-overlap.mjs <gesture-evidence-directory>')
  const summary = JSON.parse(
    await readFile(join(directory, 'rotation-summary.json'), 'utf8'),
  )
  for (const entry of summary.filter((entry) => gestures.includes(entry.case))) {
    const report = JSON.parse(
      await readFile(join(directory, `${entry.case}.json`), 'utf8'),
    )
    if (report.notReproduced) {
      assert.equal(entry.result, 'gesture-not-reproduced')
      assert(!entry.gestureEvidence)
      continue
    }
    const driver = JSON.parse(
      await readFile(join(directory, `${entry.case}-driver.json`), 'utf8'),
    )
    assert.deepEqual(
      assertGestureRotation(entry.case, report, driver),
      entry.gestureEvidence,
    )
  }
  requireGestureOverlaps(summary)
  console.log('All four gesture scenarios prove actual native rotation overlap.')
}
