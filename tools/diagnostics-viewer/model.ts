// Type-only dependency: the browser bundle never imports the native collector.
import type {
  DiagnosticEvent,
  DiagnosticStack,
  DiagnosticsExport,
} from '../../src/diagnostics.js'
export { phases, outcomes, MAX_BYTES, MAX_REPORTS, parseReport } from './schema.js'

export interface TimelineRow {
  key: number
  event: DiagnosticEvent
  start: number
  end?: number
  duration?: number
  completeness: 'complete' | 'missing-start' | 'missing-end' | 'ambiguous' | 'event'
}

/** Correlate by span identity, never adjacency/nesting or summed phase durations. */
export function timeline(report: Pick<DiagnosticsExport, 'events'>): TimelineRow[] {
  const groups = new Map<number, DiagnosticEvent[]>()
  const rows: TimelineRow[] = []
  for (const event of report.events) {
    if (event.status === 'event' || event.spanId === undefined) {
      rows.push({ key: event.id, event, start: event.time, completeness: 'event' })
    } else {
      const group = groups.get(event.spanId) ?? []
      group.push(event)
      groups.set(event.spanId, group)
    }
  }
  for (const group of groups.values()) {
    const starts = group.filter((event) => event.status === 'start')
    const ends = group.filter((event) => event.status === 'end')
    const start = starts[0],
      end = ends[0]
    const mismatch =
      start &&
      end &&
      (start.phase !== end.phase ||
        start.navigationId !== end.navigationId ||
        start.parentNavigationId !== end.parentNavigationId ||
        start.operation !== end.operation ||
        start.stackId !== end.stackId ||
        start.windowId !== end.windowId ||
        start.time > end.time)
    if (starts.length > 1 || ends.length > 1 || mismatch) {
      for (const event of group)
        rows.push({ key: event.id, event, start: event.time, completeness: 'ambiguous' })
    } else if (start && end) {
      rows.push({
        key: start.id,
        event: end,
        start: start.time,
        end: end.time,
        duration: end.duration,
        completeness: 'complete',
      })
    } else if (end) {
      // Keep the reported duration, but don't invent a missing start position.
      rows.push({
        key: end.id,
        event: end,
        start: end.time,
        duration: end.duration,
        completeness: 'missing-start',
      })
    } else if (start) {
      rows.push({
        key: start.id,
        event: start,
        start: start.time,
        completeness: 'missing-end',
      })
    }
  }
  return rows.sort((a, b) => a.start - b.start || a.key - b.key)
}

export function compareStack(stack: DiagnosticStack) {
  const native = stack.native.flatMap((host) => host.entries.map((id) => ({ id, host })))
  return Array.from(
    { length: Math.max(stack.logical.length, native.length) },
    (_, index) => ({
      index,
      logical: stack.logical[index],
      native: native[index],
      differs:
        !stack.busy &&
        (stack.logical[index]?.id !== native[index]?.id || native[index]?.id === null),
    }),
  )
}

export interface TimelineFilter {
  phase?: string
  outcome?: string
  navigation?: string
  window?: string
}
export function filterTimeline(rows: readonly TimelineRow[], filter: TimelineFilter) {
  return rows.filter(
    ({ event }) =>
      (!filter.phase || event.phase === filter.phase) &&
      (!filter.outcome || event.outcome === filter.outcome) &&
      (!filter.navigation || String(event.navigationId) === filter.navigation) &&
      (!filter.window || (event.windowId ?? '(unknown)') === filter.window),
  )
}

export function windowIds(report: DiagnosticsExport) {
  return [
    ...new Set([
      ...report.snapshot.stacks.flatMap((stack) =>
        stack.native.map((host) => host.windowId ?? '(unknown)'),
      ),
      ...report.events.map((event) => event.windowId ?? '(unknown)'),
    ]),
  ].sort()
}
