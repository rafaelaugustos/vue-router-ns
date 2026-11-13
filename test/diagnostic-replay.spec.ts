import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  eventsOf,
  importReport,
  replay,
  type ImportedRecording,
} from '../tools/diagnostics-viewer/recording.js'
import { compareStack, parseReport, timeline } from '../tools/diagnostics-viewer/model.js'
import { mount, page, settle } from './helpers.js'

const nativeText = (name: string) =>
  readFileSync(
    new URL(`./evidence/diagnostic-recording-stage1/${name}.json`, import.meta.url),
    'utf8',
  )
const capture = (name = 'recovery') => importReport(nativeText(name)) as ImportedRecording
const raw = () => JSON.parse(nativeText('success'))
const encode = (report: any) => {
  report.retainedBytes = Buffer.byteLength(JSON.stringify(report.records))
  return JSON.stringify(report)
}

describe('offline diagnostic replay', () => {
  it('imports every committed native v2 capture and preserves v1 behavior', () => {
    for (const name of [
      'success',
      'blocked',
      'cancelled',
      'recovery',
      'truncate',
      'clear',
      'stop',
    ]) {
      const report = capture(name),
        model = replay(report)
      expect(report.actualBytes).toBe(report.retainedBytes)
      expect(model.steps.some((s) => s.checkpoint)).toBe(true)
      expect(
        model.steps.some(
          (s) => s.gap === 'ambiguous-order' || s.gap === 'metadata-mismatch',
        ),
      ).toBe(false)
      const original = JSON.parse(nativeText(name))
      expect(JSON.parse(JSON.stringify(report.records))).toEqual(original.records)
    }
    expect(importReport(nativeText('v1'))).toEqual(parseReport(nativeText('v1')))
    expect(importReport(nativeText('v1')).version).toBe(1)
  })

  it('finds the first retained settled mismatch, preserves native order and bounds uncertainty before recovery', () => {
    const report = capture(),
      model = replay(report)
    const first = model.steps[model.divergence!.step]!.checkpoint!
    expect(first.boundary).not.toBe('reconcile-before')
    expect(first.snapshot.issues.map((issue) => issue.code)).toContain(
      'unknown-native-page',
    )
    expect(
      first.snapshot.stacks.flatMap((s) => s.native.flatMap((h) => h.entries)),
    ).toContain(null)
    expect(model.divergence!.previous).toBeDefined()
    const previous = model.steps[model.divergence!.previous!]!.checkpoint!
    expect(previous.time).toBeLessThanOrEqual(first.time)
    expect(previous.snapshot.stacks.flatMap(compareStack).some((r) => r.differs)).toBe(
      false,
    )
    expect(model.steps.at(-1)!.checkpoint!.snapshot.issues).toEqual([])
    expect(model.steps[0]!.gap).toBe('missing-prefix')
  })

  it('never interprets a pre-reconciliation or busy mismatch as a settled divergence', () => {
    const report = capture()
    const bad = replay(report).steps.find(
      (s) => s.checkpoint?.snapshot.issues.length,
    )!.checkpoint!
    for (const mode of ['before', 'busy']) {
      const record = structuredClone(bad)
      Object.assign(record, {
        sequence: 1,
        epoch: 0,
        eventId: undefined,
        boundary: mode === 'before' ? 'reconcile-before' : 'manual',
      })
      if (mode === 'busy')
        for (const stack of record.snapshot.stacks) Object.assign(stack, { busy: true })
      const model = replay({
        ...report,
        actualBytes: undefined,
        epoch: 0,
        droppedRecords: 0,
        clearedRecords: 0,
        records: [record],
      })
      expect(model.divergence).toBeUndefined()
      expect(model.steps[0]!.checkpoint).toBeDefined()
    }
  })

  it('selects exact event-linked observations, keeping overlapping cancellation and modal identities distinct', () => {
    const report = capture(),
      model = replay(report)
    const events = eventsOf(report)
    for (const [id, index] of model.eventSteps) {
      const step = model.steps[index]!
      expect(step.event!.id).toBe(id)
      if (step.checkpoint) expect(step.checkpoint.eventId).toBe(id)
    }
    const nav = events.filter((e) => e.phase === 'navigation' && e.status === 'end')
    expect(nav.map((e) => e.outcome)).toEqual(
      expect.arrayContaining(['success', 'aborted', 'cancelled']),
    )
    const cancelled = nav.find((e) => e.outcome === 'cancelled')!
    const cancelledStep = model.steps[model.eventSteps.get(cancelled.id)!]!
    expect(cancelledStep.event!.navigationId).toBe(cancelled.navigationId)
    const modal = model.steps.find((s) =>
      s.checkpoint?.snapshot.stacks.some(
        (stack) => stack.modal && stack.logical.some((e) => e.awaitingResult),
      ),
    )!
    const id = modal.checkpoint!.snapshot.stacks.find((s) => s.modal)!.id
    expect(model.steps.at(-1)!.checkpoint!.snapshot.stacks.some((s) => s.id === id)).toBe(
      false,
    )
  })

  it('retains redirect parent correlation from a collector-generated recording without executing it', async () => {
    const { router, app } = await mount(
      [
        { path: '/', component: page('Home') },
        { path: '/redirect', component: page('Redirect'), beforeEnter: () => '/target' },
        { path: '/target', component: page('Target') },
      ],
      { diagnostics: { recording: true } },
    )
    await router.push('/redirect')
    await settle()
    const text = JSON.stringify(router.diagnostics!.recording())
    const report = importReport(text) as ImportedRecording
    const nav = timeline({ events: eventsOf(report) }).filter(
      (r) => r.event.phase === 'navigation',
    )
    const redirected = nav.find((r) => r.event.outcome === 'redirected')!
    const child = nav.find(
      (r) => r.event.parentNavigationId === redirected.event.navigationId,
    )!
    expect(child.event.outcome).toBe('success')
    expect(replay(report).eventSteps.has(child.event.id)).toBe(true)
    expect(JSON.stringify(router.diagnostics!.recording())).toBe(text)
    app.unmount()
  })

  it('keeps clear and missing records visible, never carrying the last state into a gap', () => {
    const cleared = replay(capture('clear'))
    expect(cleared.steps.map((s) => s.gap)).toEqual([
      'missing-prefix',
      'cleared',
      undefined,
    ])
    expect(cleared.steps[1]!.checkpoint).toBeUndefined()
    expect(cleared.steps[2]!.checkpoint!.boundary).toBe('clear')
    const report = raw()
    report.records.splice(10, 3)
    const model = replay(importReport(encode(report)) as ImportedRecording)
    expect(model.steps.some((s) => s.gap === 'missing-records')).toBe(true)
    expect(model.steps.some((s) => s.gap === 'metadata-mismatch')).toBe(true)
    expect(model.steps.filter((s) => s.gap).every((s) => !s.checkpoint)).toBe(true)
    expect(model.steps.at(-1)!.checkpoint).toBeDefined()
  })

  it.each(['sequence', 'clock', 'event-identity', 'epoch'] as const)(
    'disables stack replay for ambiguous %s without sorting or joining identities',
    (mode) => {
      const report = raw()
      if (mode === 'sequence') report.records[3].sequence = report.records[2].sequence
      if (mode === 'clock') report.records[3].time = 0
      if (mode === 'epoch') report.records[3].epoch++
      if (mode === 'event-identity') {
        const events = report.records.filter((r: any) => r.kind === 'event')
        events[1].event.id = events[0].event.id
      }
      const model = replay(importReport(encode(report)) as ImportedRecording)
      expect(model.steps.every((s) => !s.checkpoint)).toBe(true)
      expect(model.steps.some((s) => s.gap === 'ambiguous-order')).toBe(true)
      expect(model.divergence).toBeUndefined()
    },
  )

  it('does not guess state from a nearby checkpoint when an explicit event link is corrupted', () => {
    const report = raw()
    const record = report.records.find(
      (r: any) => r.kind === 'checkpoint' && r.boundary === 'event',
    )
    const eventId = record.eventId
    record.eventId = report.records.filter((r: any) => r.kind === 'event').at(-1).event.id
    const model = replay(importReport(encode(report)) as ImportedRecording)
    expect(model.steps[model.eventSteps.get(eventId)!]!.checkpoint).toBeUndefined()
    expect(model.steps.some((s) => s.gap === 'invalid-link')).toBe(true)
  })

  it('whitelists fields, rejects malformed data and never reflects imported payloads in errors', () => {
    const report = raw()
    report.privatePayload = 'private-secret'
    report.records[0].privatePayload = 'private-secret'
    expect(JSON.stringify(importReport(encode(report)))).not.toContain('private-secret')
    for (const mutate of [
      (r: any) => {
        r.version = 3
      },
      (r: any) => {
        r.clock = 'private-secret'
      },
      (r: any) => {
        r.limits.maxRecords = 10001
      },
      (r: any) => {
        r.limits.maxBytes = 1000
      },
      (r: any) => {
        r.records[0].sequence = -1
      },
      (r: any) => {
        r.records[0].snapshot.routerId = 'private-secret'
      },
      (r: any) => {
        r.records.find((x: any) => x.observations?.length).observations[0].inputFocused =
          true
      },
      (r: any) => {
        r.records.find((x: any) => x.observations?.length).observations = []
      },
    ]) {
      const value = raw()
      mutate(value)
      expect(() => importReport(encode(value))).toThrow()
      try {
        importReport(encode(value))
      } catch (error) {
        expect(String(error)).not.toContain('private-secret')
      }
    }
    expect(() => importReport('{broken')).toThrow('Invalid JSON')
  })

  it('retains no-checkpoint reports as unknown and treats independent files separately', () => {
    const report = capture('success')
    const event = report.records.find((r) => r.kind === 'event')!
    const model = replay({ ...report, actualBytes: undefined, records: [event] })
    expect(model.steps.every((s) => !s.checkpoint)).toBe(true)
    expect(
      model.steps[model.eventSteps.get(event.kind === 'event' ? event.event.id : -1)!]!
        .gap,
    ).toBe('unobserved')
    const a = replay(capture('success')),
      b = replay(capture('recovery'))
    expect(a.divergence).toBeUndefined()
    expect(b.divergence).toBeDefined()
    expect(a.steps).not.toBe(b.steps)
  })

  it('marks dangling event links and checkpoint clocks as unknown without losing later independent observations', () => {
    for (const damage of ['link', 'clock']) {
      const report = raw()
      const checkpoint = report.records.find(
        (r: any) => r.kind === 'checkpoint' && r.boundary === 'event',
      )
      if (damage === 'link') checkpoint.eventId = 999999
      else checkpoint.snapshot.time++
      const model = replay(importReport(encode(report)) as ImportedRecording)
      expect(
        model.steps.find((s) => s.sequence === checkpoint.sequence)?.checkpoint,
      ).toBeUndefined()
      expect(model.steps.at(-1)!.checkpoint).toBeDefined()
    }
  })

  it('enforces count and actual UTF-8 byte budgets and exposes inaccurate retained-byte metadata', () => {
    const overCount = raw()
    overCount.limits.maxRecords = 1
    expect(() => importReport(encode(overCount))).toThrow('at most 1')
    const overBytes = raw()
    overBytes.limits.maxBytes = 1024
    expect(() => importReport(encode(overBytes))).toThrow('byte budget')
    const metadata = raw()
    metadata.retainedBytes--
    const model = replay(importReport(JSON.stringify(metadata)) as ImportedRecording)
    expect(model.steps[0]!.gap).toBe('metadata-mismatch')
    expect(model.steps.at(-1)!.checkpoint).toBeDefined()
  })
})
