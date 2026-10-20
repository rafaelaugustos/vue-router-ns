import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

export function validate(reports, baseline, negative = false, environment) {
  assert(Array.isArray(reports) && reports.length > 0, 'Native reports are required')
  for (const report of reports) {
    assert.equal(report.version, 1, 'Unsupported report version')
    assert(Number.isInteger(report.pid) && report.pid > 0, 'Native PID required')
    assert(Number.isInteger(report.sequence) && report.sequence > 0, 'Sequence required')
    assert.equal(report.fault, negative, 'Wrong fixture build')
  }
  if (negative) {
    const hmr = reports.find((report) => report.command === 'hmr')
    assert(hmr && !hmr.ok, 'Former HMR regression must fail')
    assert.match(hmr.error, /covered HMR|native Page replacement/)
    return { negativeControl: 'covered HMR regression detected', pid: hmr.pid }
  }
  for (const name of [
    'suite',
    'hmr',
    'cancel-check',
    'commit-check',
    'guard-check',
    'modal-check',
    'modal-result-check',
    'restore-setup',
    'restore-check',
    'measure',
  ])
    assert(
      reports.some((r) => r.command === name && r.ok),
      `Missing native scenario: ${name}`,
    )
  assert(
    reports.every((r) => r.ok),
    'A native scenario failed',
  )
  const before = reports.find((r) => r.command === 'restore-setup')
  const after = reports.find((r) => r.command === 'restore-check')
  assert.notEqual(before.pid, after.pid, 'Process-death test reused its PID')
  const measured = reports.find((r) => r.command === 'measure')
  assert(baseline, 'No reviewed baseline for this runner/device/version')
  assert(environment?.host && baseline.host, 'Host metadata and baseline are required')
  for (const key of ['platform', 'arch'])
    assert.equal(
      environment.host[key],
      baseline.host[key],
      `Baseline host ${key} mismatch`,
    )
  if (baseline.simulatorType)
    assert.equal(
      environment.device?.simulator?.deviceTypeIdentifier,
      baseline.simulatorType,
      'Baseline simulator mismatch',
    )
  if (baseline.display)
    for (const key of ['size', 'density'])
      assert.equal(
        environment.device?.[key],
        baseline.display[key],
        `Baseline display ${key} mismatch`,
      )
  for (const key of ['platform', 'sdk', 'model'])
    assert.equal(measured[key], baseline[key], `Baseline ${key} mismatch`)
  assert.equal(measured.samples.length, 4, 'Four measured batches required')
  const durations = []
  for (const [index, sample] of measured.samples.entries()) {
    assert.equal(sample.batch, index, 'Missing or duplicated batch')
    assert.equal(sample.durations.length, 10, 'Ten push/pop pairs per batch required')
    assert(
      sample.durations.every((n) => Number.isFinite(n) && n > 0),
      'Invalid timing',
    )
    durations.push(...sample.durations)
    assert.equal(sample.collections?.length, 3, 'Three fixed collection rounds required')
    for (const [round, collection] of sample.collections.entries()) {
      assert.equal(collection.round, round, 'Collection order')
      for (const key of ['livePages', 'nativeRetained'])
        assert(
          Number.isInteger(collection[key]) && collection[key] >= 0,
          `Missing collected ${key}`,
        )
    }
    for (const key of ['livePages', 'nativeRetained']) {
      assert(Number.isInteger(sample[key]) && sample[key] >= 0, `Missing ${key}`)
      assert.equal(
        sample[key],
        sample.collections.at(-1)[key],
        `Final ${key} must match the last collection`,
      )
      assert(sample[key] <= baseline[key], `Batch ${index}: ${key} exceeds baseline`)
    }
  }
  durations.sort((a, b) => a - b)
  const median = durations[Math.floor(durations.length / 2)]
  const p95 = durations[Math.ceil(durations.length * 0.95) - 1]
  // Noise allowance is explicit; changing either the measurement or tolerance
  // requires review alongside the device/version evidence.
  const medianLimit = baseline.medianMs * baseline.tolerance + baseline.jitterMs
  const p95Limit = baseline.p95Ms * baseline.tolerance + baseline.jitterMs
  assert(median <= medianLimit, `Median ${median}ms exceeds ${medianLimit}ms`)
  assert(p95 <= p95Limit, `p95 ${p95}ms exceeds ${p95Limit}ms`)
  return {
    platform: measured.platform,
    sdk: measured.sdk,
    model: measured.model,
    samples: durations.length,
    median,
    p95,
    medianLimit,
    p95Limit,
    oldPid: before.pid,
    newPid: after.pid,
    retention: measured.samples.map(({ livePages, nativeRetained }) => ({
      livePages,
      nativeRetained,
    })),
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [file, profile, output] = process.argv.slice(2)
  const reports = JSON.parse(await readFile(file, 'utf8'))
  const baselines = JSON.parse(
    await readFile(new URL('./baselines.json', import.meta.url), 'utf8'),
  )
  const negative = process.env.EXPECT_HMR_FAILURE === '1'
  const environment = negative
    ? undefined
    : JSON.parse(
        await readFile(new URL('./environment.json', pathToFileURL(file)), 'utf8'),
      )
  const result = validate(reports, baselines.profiles[profile], negative, environment)
  if (output) await writeFile(output, JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result, null, 2))
}
