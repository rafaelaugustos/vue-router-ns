// No runtime dependency on the collector, native hosts or application code.
import type { DiagnosticEvent, DiagnosticsExport } from '../../src/diagnostics.js'
import type {
  DiagnosticRecord,
  DiagnosticsRecording,
  DiagnosticObservation,
} from '../../src/diagnostic-recording.js'
import { compareStack } from './model.js'
import {
  boolean,
  choice,
  fail,
  identity,
  list,
  number,
  object,
  optional,
  parseEvent,
  parseJSON,
  parseReport,
  parseSnapshot,
  unique,
} from './schema.js'

export type ImportedRecording = DiagnosticsRecording & { readonly actualBytes: number }
export type ImportedReport = DiagnosticsExport | ImportedRecording
export type Checkpoint = Extract<DiagnosticRecord, { kind: 'checkpoint' }>
export type Gap =
  | 'missing-prefix'
  | 'missing-records'
  | 'metadata-mismatch'
  | 'ambiguous-order'
  | 'invalid-link'
  | 'unobserved'
  | 'oversized'
  | 'inspection-failed'
  | 'cleared'
export interface ReplayStep {
  sequence?: number
  time?: number
  checkpoint?: Checkpoint
  event?: DiagnosticEvent
  gap?: Gap
}
export interface Replay {
  ambiguous: boolean
  steps: ReplayStep[]
  eventSteps: Map<number, number>
  windows: string[]
  comparable: number
  divergence?: { step: number; previous?: number }
}

const boundaries = [
  'initial',
  'event',
  'reconcile-before',
  'reconcile-after',
  'clear',
  'stop',
  'manual',
] as const
const nullableBoolean = (value: unknown, path: string) =>
  value === null ? null : boolean(value, path)
function tabIndex(value: unknown, path: string): number {
  return value === -1 ? -1 : number(value, path, true)
}
function observation(value: unknown, path: string): DiagnosticObservation {
  const obj = object(value, path)
  if (obj.inputFocused !== null) fail(`${path}.inputFocused`, 'null (not observed)')
  const tab = obj.tab === null ? null : object(obj.tab, `${path}.tab`)
  return {
    stackId: identity(obj.stackId, `${path}.stackId`),
    closed: boolean(obj.closed, `${path}.closed`),
    selected: nullableBoolean(obj.selected, `${path}.selected`),
    routerFocused: nullableBoolean(obj.routerFocused, `${path}.routerFocused`),
    hostVisible:
      obj.hostVisible === null
        ? null
        : list(obj.hostVisible, `${path}.hostVisible`).map((id, i) =>
            id === null ? null : identity(id, `${path}.hostVisible[${i}]`),
          ),
    tab: tab && {
      id: identity(tab.id, `${path}.tab.id`),
      index: number(tab.index, `${path}.tab.index`, true),
      selectedIndex: tabIndex(tab.selectedIndex, `${path}.tab.selectedIndex`),
    },
    inputFocused: null,
  }
}

/** Reject invalid shapes/budgets; preserve observable gaps in damaged but readable streams. */
export function importReport(text: string): ImportedReport {
  const root = object(parseJSON(text), 'report')
  if (root.version === 1) return parseReport(text)
  if (root.version !== 2)
    throw new Error('Unsupported diagnostics version; expected version 1 or 2')
  const routerId = identity(root.routerId, 'report.routerId')
  if (root.clock !== 'monotonic') fail('report.clock', 'monotonic')
  const startedAt = number(root.startedAt, 'report.startedAt')
  if (Number.isNaN(new Date(startedAt).getTime()))
    fail('report.startedAt', 'a valid wall-clock origin')
  const limit = object(root.limits, 'report.limits')
  const maxRecords = number(limit.maxRecords, 'limits.maxRecords', true)
  const maxBytes = number(limit.maxBytes, 'limits.maxBytes', true)
  if (maxRecords < 1 || maxRecords > 10_000) fail('limits.maxRecords', '1–10000')
  if (maxBytes < 1024 || maxBytes > 8 * 1024 * 1024)
    fail('limits.maxBytes', '1024–8388608')
  const rawRecords = list(root.records, 'records', maxRecords)
  const actualBytes = new TextEncoder().encode(JSON.stringify(rawRecords)).length
  if (actualBytes > maxBytes) fail('records', 'serialized data within the byte budget')
  const retainedBytes = number(root.retainedBytes, 'report.retainedBytes', true)
  if (retainedBytes < 2 || retainedBytes > maxBytes)
    fail('report.retainedBytes', 'a count within the byte budget')
  const records = rawRecords.map((value, i): DiagnosticRecord => {
    const path = `records[${i}]`,
      obj = object(value, path)
    const sequence = number(obj.sequence, `${path}.sequence`, true)
    if (sequence < 1) fail(`${path}.sequence`, 'a positive sequence')
    const base = {
      sequence,
      epoch: number(obj.epoch, `${path}.epoch`, true),
      time: number(obj.time, `${path}.time`),
    }
    const kind = choice(obj.kind, `${path}.kind`, ['event', 'checkpoint', 'gap'])
    if (kind === 'event')
      return { ...base, kind, event: parseEvent(obj.event, routerId, `${path}.event`) }
    const eventId = optional(obj, 'eventId', path, (v, p) => number(v, p, true))
    if (kind === 'gap')
      return {
        ...base,
        kind,
        eventId,
        boundary: optional(obj, 'boundary', path, (v, p) => choice(v, p, boundaries)),
        reason: choice(obj.reason, `${path}.reason`, [
          'oversized',
          'inspection-failed',
          'cleared',
        ]),
      }
    const snapshot = parseSnapshot(obj.snapshot, routerId)
    const observations = list(obj.observations, `${path}.observations`, 1000).map(
      (v, n) => observation(v, `${path}.observations[${n}]`),
    )
    unique(
      observations.map((o) => o.stackId),
      `${path}.observations.stackId`,
    )
    if (
      observations.length !== snapshot.stacks.length ||
      observations.some((o) => !snapshot.stacks.some((s) => s.id === o.stackId))
    )
      fail(`${path}.observations`, 'one observation per snapshot stack')
    return {
      ...base,
      kind,
      eventId,
      boundary: choice(obj.boundary, `${path}.boundary`, boundaries),
      snapshot,
      observations,
    }
  })
  const overhead = object(root.overhead, 'report.overhead')
  return {
    version: 2,
    captureId: identity(root.captureId, 'report.captureId'),
    routerId,
    clock: 'monotonic',
    startedAt,
    stopped: boolean(root.stopped, 'report.stopped'),
    epoch: number(root.epoch, 'report.epoch', true),
    droppedRecords: number(root.droppedRecords, 'report.droppedRecords', true),
    clearedRecords: number(root.clearedRecords, 'report.clearedRecords', true),
    limits: { maxRecords, maxBytes },
    retainedBytes,
    actualBytes,
    overhead: {
      samples: number(overhead.samples, 'overhead.samples', true),
      totalMs: number(overhead.totalMs, 'overhead.totalMs'),
      maxMs: number(overhead.maxMs, 'overhead.maxMs'),
    },
    records,
  }
}

export const eventsOf = (
  report: DiagnosticsExport | DiagnosticsRecording,
): readonly DiagnosticEvent[] =>
  report.version === 1
    ? report.events
    : report.records.flatMap((r) => (r.kind === 'event' ? [r.event] : []))

/** Stored order is evidence. Never sort a damaged stream or carry state across a gap. */
export function replay(report: DiagnosticsRecording & { actualBytes?: number }): Replay {
  const { records } = report
  const steps: ReplayStep[] = [],
    eventSteps = new Map<number, number>()
  const eventCounts = new Map<number, number>()
  for (const event of eventsOf(report))
    eventCounts.set(event.id, (eventCounts.get(event.id) ?? 0) + 1)
  const ambiguous = records.some(
    (r, i) =>
      r.epoch !== report.epoch ||
      (i > 0 &&
        (r.sequence <= records[i - 1]!.sequence || r.time < records[i - 1]!.time)) ||
      (r.kind === 'event' &&
        (r.event.time !== r.time || eventCounts.get(r.event.id)! > 1)),
  )
  const add = (step: ReplayStep) => {
    if (step.event && eventCounts.get(step.event.id) === 1)
      eventSteps.set(step.event.id, steps.length)
    steps.push(step)
  }
  if (report.droppedRecords || report.clearedRecords || (records[0]?.sequence ?? 1) > 1)
    add({ gap: 'missing-prefix' })
  if (
    (report.actualBytes !== undefined && report.actualBytes !== report.retainedBytes) ||
    (records.at(-1)?.sequence ?? 0) !==
      report.droppedRecords + report.clearedRecords + records.length
  )
    add({ gap: 'metadata-mismatch' })
  for (let i = 0; i < records.length; i++) {
    const record = records[i]!,
      previous = records[i - 1],
      next = records[i + 1]
    if (!ambiguous && previous && record.sequence > previous.sequence + 1)
      add({ gap: 'missing-records' })
    const base = { sequence: record.sequence, time: record.time }
    if (ambiguous) {
      add({
        ...base,
        gap: 'ambiguous-order',
        event: record.kind === 'event' ? record.event : undefined,
      })
    } else if (record.kind === 'gap') {
      add({ ...base, gap: record.reason })
    } else if (record.kind === 'event') {
      // Pair only the adjacent, explicitly linked checkpoint. No nearest-time guesses.
      const paired =
        next?.kind === 'checkpoint' &&
        next.boundary === 'event' &&
        next.eventId === record.event.id &&
        next.sequence === record.sequence + 1
      if (!paired) add({ ...base, event: record.event, gap: 'unobserved' })
    } else {
      const linked =
        previous?.kind === 'event' &&
        record.boundary === 'event' &&
        record.eventId === previous.event.id &&
        record.sequence === previous.sequence + 1
      const missingLink =
        record.eventId !== undefined &&
        !eventCounts.has(record.eventId) &&
        ((!previous && record.sequence > 1) ||
          (previous && record.sequence > previous.sequence + 1) ||
          (previous?.kind === 'gap' && previous.eventId === record.eventId))
      const invalidLink =
        record.boundary === 'event'
          ? record.eventId === undefined || (!linked && !missingLink)
          : record.eventId !== undefined
      const valid =
        record.snapshot.time === record.time &&
        !record.snapshot.issues.some((issue) => issue.code === 'inspection-failed') &&
        !invalidLink
      add({
        ...base,
        checkpoint: valid ? record : undefined,
        gap: valid ? undefined : invalidLink ? 'invalid-link' : 'unobserved',
        event: linked ? previous.event : undefined,
      })
    }
  }
  if (!steps.length) add({ gap: 'unobserved' })
  let comparable = 0,
    divergence: Replay['divergence']
  const healthy = new Map<string, number>()
  steps.forEach((step, index) => {
    const checkpoint = step.checkpoint
    if (!checkpoint || checkpoint.boundary === 'reconcile-before') return
    const ready = checkpoint.snapshot.stacks.filter((stack) => !stack.busy)
    if (ready.length) comparable++
    const bad = ready.filter(
      (stack) =>
        compareStack(stack).some((row) => row.differs) ||
        checkpoint.snapshot.issues.some(
          (issue) =>
            issue.stackId === stack.id &&
            [
              'stack-mismatch',
              'unknown-native-page',
              'disposed-native-entry',
              'orphaned-host',
            ].includes(issue.code),
        ),
    )
    if (!divergence && bad.length) {
      const prior = bad.map((stack) => healthy.get(stack.id))
      divergence = {
        step: index,
        previous: prior.every((p) => p !== undefined)
          ? Math.min(...(prior as number[]))
          : undefined,
      }
    }
    for (const stack of ready) if (!bad.includes(stack)) healthy.set(stack.id, index)
  })
  const windows = [
    ...new Set(
      records.flatMap((r) =>
        r.kind === 'event'
          ? [r.event.windowId ?? '(unknown)']
          : r.kind === 'checkpoint'
            ? r.snapshot.stacks.flatMap((s) =>
                s.native.map((h) => h.windowId ?? '(unknown)'),
              )
            : [],
      ),
    ),
  ].sort()
  return { steps, eventSteps, windows, comparable, divergence, ambiguous }
}
