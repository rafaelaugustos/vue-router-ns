import assert from 'node:assert/strict'

// Requests may race at admission. Only the native context at the target
// viewWillTransition callback can prove that the two transitions overlap.
export function assertProgrammaticOverlap(name, report, driver) {
  assert.match(report.operation, /^(push|back)-overlap$/)
  assert.equal(name, `${report.operation}-${report.landscape ? 'landscape' : 'portrait'}`)
  assert.equal(report.navigationProfile, 'core-slide-1500')
  assert.equal(report.reduceMotion, false, `${name}: animated acceptance required`)
  assert.equal(driver.requestPhase, 'admission')
  assert(report.finished && !report.error, `${name}: unfinished native case`)
  const events = report.events
  const one = (kind) => {
    const found = events.filter((event) => event.kind === kind)
    assert.equal(found.length, 1, `${name}: exactly one ${kind}`)
    return found[0]
  }
  const armed = one('armed')
  const start = one('navigation-observed')
  const end = one('navigation-ended')
  assert.equal(start.interactive, false)
  assert(Math.abs(start.duration - 1.5) < 0.001, `${name}: Core slide duration`)
  assert(Number.isInteger(start.coordinator) && start.coordinator > 0)
  assert.equal(end.coordinator, start.coordinator)
  assert.equal(end.cancelled, false)
  assert(driver.requestedAt >= armed.wallTime && driver.requestedAt < end.wallTime)
  const before = report.before.frames.find((frame) => frame.name === 'home')
  const after = report.after.frames.find((frame) => frame.name === 'home')
  assert.equal(start.from, before.pageControllers.at(-1))
  assert.equal(start.to, after.pageControllers.at(-1))
  assert.notEqual(start.from, start.to)
  if (start.fromKey !== null) assert.equal(start.fromKey, start.from)
  if (start.toKey !== null) assert.equal(start.toKey, start.to)

  const rotations = events.filter((event) => event.kind === 'rotation-began')
  const completions = events.filter((event) => event.kind === 'rotation-ended')
  assert(rotations.length > 0)
  assert.equal(
    new Set(rotations.map((event) => event.rotationCoordinator)).size,
    rotations.length,
  )
  assert.equal(
    completions.length,
    rotations.length,
    `${name}: every rotation must finish`,
  )
  for (const rotation of rotations) {
    assert(
      Number.isInteger(rotation.rotationCoordinator) && rotation.rotationCoordinator > 0,
    )
    const completed = completions.filter(
      (event) => event.rotationCoordinator === rotation.rotationCoordinator,
    )
    assert.equal(completed.length, 1)
    assert(completed[0].at >= rotation.at)
  }
  assert(report.window.width > 0 && report.window.height > 0)
  assert.equal(report.window.width < report.window.height, report.landscape)
  const matchesTarget = (rotation) =>
    rotation.width === report.window.height && rotation.height === report.window.width
  const target = rotations.find(
    (rotation) =>
      matchesTarget(rotation) &&
      rotation.navigationActive === true &&
      rotation.navigationCompletionPending === true &&
      rotation.navigationCoordinator === start.coordinator &&
      rotation.currentCoordinator === start.coordinator &&
      rotation.rotationCoordinator !== start.coordinator &&
      rotation.at >= start.at &&
      rotation.at < end.at,
  )
  assert(
    target,
    `${name}: target rotation must overlap the current native navigation coordinator`,
  )
  assert(matchesTarget(rotations.at(-1)), `${name}: final rotation must reach the target`)
  return {
    navigationCoordinator: start.coordinator,
    rotationCoordinator: target.rotationCoordinator,
    observedFrom: start.observedFrom,
    overlapBeforeCompletionMs: end.at - target.at,
    rotations: rotations.map((rotation) => ({
      width: rotation.width,
      height: rotation.height,
      target: matchesTarget(rotation),
      duringNavigation: rotation.navigationActive,
      afterNavigationObservedMs: rotation.at - start.at,
      rotationCoordinator: rotation.rotationCoordinator,
    })),
  }
}
