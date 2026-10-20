import { describe, expect, it } from 'vitest'
// Native acceptance tooling is ordinary Node code, independent of Core shims.
// @ts-expect-error standalone .mjs tooling
import { validate } from '../scripts/native/contracts/validate.mjs'

const baseline = {
  platform: 'android',
  sdk: '36',
  model: 'fixture',
  medianMs: 250,
  p95Ms: 300,
  tolerance: 1.5,
  jitterMs: 100,
  livePages: 0,
  nativeRetained: 0,
}
function evidence() {
  const reports = [
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
  ].map((command, index) => ({
    version: 1,
    sequence: index + 1,
    command,
    ok: true,
    fault: false,
    pid: index < 8 ? 123 : 456,
    platform: 'android',
    sdk: '36',
    model: 'fixture',
    samples: [] as {
      batch: number
      durations: number[]
      livePages: number
      nativeRetained: number
    }[],
  }))
  reports.at(-1)!.samples = Array.from({ length: 4 }, (_, batch) => ({
    batch,
    durations: Array(10).fill(250),
    livePages: 0,
    nativeRetained: 0,
  }))
  return reports
}
describe('native acceptance evidence', () => {
  it('accepts repeated measurements and a genuine new PID', () => {
    expect(validate(evidence(), baseline)).toMatchObject({
      samples: 40,
      oldPid: 123,
      newPid: 456,
    })
  })
  it('rejects missing scenarios, a reused PID and an unknown device', () => {
    expect(() => validate(evidence().slice(1), baseline)).toThrow('suite')
    const reports = evidence()
    reports.find((r) => r.command === 'restore-check')!.pid = 123
    expect(() => validate(reports, baseline)).toThrow('PID')
    expect(() => validate(evidence(), { ...baseline, sdk: '35' })).toThrow('sdk')
    expect(() => validate(evidence(), undefined)).toThrow('baseline')
  })
  it('rejects missing, invalid, slow or retaining samples', () => {
    for (const mutation of [
      (r: ReturnType<typeof evidence>) => r.at(-1)!.samples.pop(),
      (r: ReturnType<typeof evidence>) => {
        r.at(-1)!.samples[0]!.durations[0] = NaN
      },
      (r: ReturnType<typeof evidence>) => {
        r.at(-1)!.samples[0]!.durations = Array(10).fill(2000)
      },
      (r: ReturnType<typeof evidence>) => {
        r.at(-1)!.samples[0]!.livePages = 1
      },
      (r: ReturnType<typeof evidence>) => {
        r.at(-1)!.samples[0]!.nativeRetained = 1
      },
    ]) {
      const reports = evidence()
      mutation(reports)
      expect(() => validate(reports, baseline)).toThrow()
    }
  })
  it('requires the specific former HMR failure in a fault build', () => {
    const report = {
      ...evidence()[1],
      fault: true,
      ok: false,
      error: 'Timed out: native Page replacement after covered HMR',
    }
    expect(validate([report], undefined, true)).toHaveProperty('negativeControl')
    expect(() => validate([{ ...report, fault: false }], undefined, true)).toThrow(
      'build',
    )
    expect(() =>
      validate([{ ...report, error: 'startup crashed' }], undefined, true),
    ).toThrow()
    expect(() => validate([{ ...report, ok: true }], undefined, true)).toThrow(
      'must fail',
    )
  })
})
