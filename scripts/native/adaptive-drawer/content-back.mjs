import assert from 'node:assert/strict'

// Supplement the full rotation identity/history checks with #168's native
// outcome and timing requirements. A drag's intended length is not its outcome.
export function assertContentBack(name, report, driver) {
  assert.match(report.systemVersion, /^\d+(\.\d+)*$/)
  const major = Number(report.systemVersion.split('.')[0])
  const inset = name === 'commit-portrait' || name === 'cancel-portrait'
  if (report.notReproduced) {
    assert.equal(report.systemVersion, '18.6', `${name}: missing supported gesture`)
    assert(inset && report.operation.startsWith('gesture') && !report.landscape)
    return
  }
  if (!inset || major < 26) return
  assert.equal(report.before.mode, 'permanent', name)
  assert.equal(report.after.mode, 'overlay', name)
  const events = report.events
  const start = events.find((event) => event.kind === 'navigation-observed')
  const end = events.find((event) => event.kind === 'navigation-ended')
  const interactions = events.filter((event) => event.kind === 'interaction-ended')
  assert.equal(start?.interactive, true, `${name}: native interactive Back required`)
  assert.equal(interactions.length, 1, `${name}: one native interaction decision`)
  const cancelled = name === 'cancel-portrait'
  assert.equal(end?.cancelled, cancelled, `${name}: actual native outcome`)
  assert.equal(interactions[0].cancelled, cancelled, `${name}: interaction outcome`)
  assert(
    driver.requestedAt >= start.wallTime && driver.requestedAt < end.wallTime,
    `${name}: rotation must be requested before native navigation completes`,
  )
  assert.equal(driver.interactionEndedBeforeRequest, !cancelled, `${name}: input phase`)
  if (cancelled) {
    assert(
      driver.requestedAt < interactions[0].wallTime,
      `${name}: cancellation control rotates during pointer interaction`,
    )
  } else {
    assert(
      driver.requestedAt >= interactions[0].wallTime,
      `${name}: committed control rotates during the remaining native animation`,
    )
  }
}
