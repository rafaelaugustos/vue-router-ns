// Type-only dependency: the browser bundle never imports the native collector.
import type {
  DiagnosticEvent,
  DiagnosticHost,
  DiagnosticSnapshot,
  DiagnosticStack,
  DiagnosticsExport,
} from '../../src/diagnostics.js'

export const phases = [
  'navigation',
  'queue',
  'guard',
  'load',
  'mount',
  'transition',
  'native',
  'page',
  'hmr',
  'host',
  'result',
  'issue',
] as const
export const outcomes = [
  'success',
  'aborted',
  'cancelled',
  'duplicated',
  'redirected',
  'noop',
  'error',
] as const
const codes = [
  'stack-mismatch',
  'unknown-native-page',
  'disposed-native-entry',
  'orphaned-host',
  'duplicate-result',
  'inspection-failed',
] as const
export const MAX_BYTES = 10 * 1024 * 1024
export const MAX_REPORTS = 8

type ObjectValue = Record<string, unknown>
function fail(path: string, expected: string): never {
  // Never reflect arbitrary imported values in errors.
  throw new Error(`${path}: expected ${expected}`)
}
function object(value: unknown, path: string): ObjectValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path, 'an object')
  return value as ObjectValue
}
function list(value: unknown, path: string, max = 10_000): unknown[] {
  if (!Array.isArray(value) || value.length > max)
    fail(path, `an array with at most ${max} items`)
  return value
}
function string(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length > 4096)
    fail(path, 'a string of at most 4096 characters')
  return value
}
function identity(value: unknown, path: string): string {
  const result = string(value, path)
  if (!result) fail(path, 'a non-empty identity')
  return result
}
function number(value: unknown, path: string, integer = false): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > Number.MAX_SAFE_INTEGER ||
    (integer && !Number.isSafeInteger(value))
  )
    fail(
      path,
      integer
        ? 'a non-negative safe integer'
        : 'a finite non-negative number within the safe range',
    )
  return value
}
function boolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') fail(path, 'a boolean')
  return value
}
function choice<const T extends readonly string[]>(
  value: unknown,
  path: string,
  values: T,
): T[number] {
  if (typeof value !== 'string' || !values.includes(value)) fail(path, values.join(' | '))
  return value as T[number]
}
function optional<T>(
  obj: ObjectValue,
  key: string,
  path: string,
  parse: (value: unknown, path: string) => T,
): T | undefined {
  return obj[key] === undefined ? undefined : parse(obj[key], `${path}.${key}`)
}
function unique(values: readonly string[], path: string) {
  if (new Set(values).size !== values.length) fail(path, 'unique identities')
}

/** Strict v1 shape, with a whitelist copy. Additional fields never reach the UI. */
export function parseReport(text: string): DiagnosticsExport {
  if (new TextEncoder().encode(text).length > MAX_BYTES)
    throw new Error('Report exceeds the 10 MiB limit')
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error('Invalid JSON')
  }
  const root = object(value, 'report')
  if (root.version !== 1)
    throw new Error('Unsupported diagnostics version; expected version 1')
  const routerId = identity(root.routerId, 'report.routerId')
  if (root.clock !== 'monotonic') fail('report.clock', 'monotonic')
  const startedAt = number(root.startedAt, 'report.startedAt')
  if (Number.isNaN(new Date(startedAt).getTime()))
    fail('report.startedAt', 'a valid wall-clock origin')
  const events = list(root.events, 'report.events').map(
    (value, index): DiagnosticEvent => {
      const path = `events[${index}]`,
        obj = object(value, path)
      if (obj.routerId !== routerId)
        fail(`${path}.routerId`, 'the report router identity')
      const event: DiagnosticEvent = {
        id: number(obj.id, `${path}.id`, true),
        routerId,
        time: number(obj.time, `${path}.time`),
        phase: choice(obj.phase, `${path}.phase`, phases),
        status: choice(obj.status, `${path}.status`, ['start', 'end', 'event']),
        spanId: optional(obj, 'spanId', path, (v, p) => number(v, p, true)),
        navigationId: optional(obj, 'navigationId', path, (v, p) => number(v, p, true)),
        parentNavigationId: optional(obj, 'parentNavigationId', path, (v, p) =>
          number(v, p, true),
        ),
        operation: optional(obj, 'operation', path, (v, p) =>
          choice(v, p, ['push', 'replace', 'back']),
        ),
        stackId: optional(obj, 'stackId', path, identity),
        windowId: optional(obj, 'windowId', path, identity),
        entryId: optional(obj, 'entryId', path, identity),
        route: optional(obj, 'route', path, string),
        detail: optional(obj, 'detail', path, string),
        duration: optional(obj, 'duration', path, number),
        outcome: optional(obj, 'outcome', path, (v, p) => choice(v, p, outcomes)),
        code: optional(obj, 'code', path, (v, p) => choice(v, p, codes)),
      }
      if (event.status !== 'event' && event.spanId === undefined)
        fail(`${path}.spanId`, 'an integer for a span boundary')
      return event
    },
  )
  unique(
    events.map((event) => String(event.id)),
    'events.id',
  )
  const snap = object(root.snapshot, 'snapshot')
  if (snap.routerId !== routerId) fail('snapshot.routerId', 'the report router identity')
  const stacks = list(snap.stacks, 'snapshot.stacks', 1000).map(
    (value, index): DiagnosticStack => {
      const path = `stacks[${index}]`,
        obj = object(value, path)
      const logical = list(obj.logical, `${path}.logical`).map((value, index) => {
        const p = `${path}.logical[${index}]`,
          entry = object(value, p)
        return {
          id: identity(entry.id, `${p}.id`),
          route: string(entry.route, `${p}.route`),
          active: boolean(entry.active, `${p}.active`),
          awaitingResult: boolean(entry.awaitingResult, `${p}.awaitingResult`),
        }
      })
      unique(
        logical.map((entry) => entry.id),
        `${path}.logical.id`,
      )
      const native = list(obj.native, `${path}.native`, 1000).map(
        (value, index): DiagnosticHost => {
          const p = `${path}.native[${index}]`,
            host = object(value, p)
          return {
            id: identity(host.id, `${p}.id`),
            role: choice(host.role, `${p}.role`, ['main', 'list', 'detail']),
            windowId: optional(host, 'windowId', p, identity),
            loaded: boolean(host.loaded, `${p}.loaded`),
            entries: list(host.entries, `${p}.entries`).map((entry, i) =>
              entry === null ? null : identity(entry, `${p}.entries[${i}]`),
            ),
          }
        },
      )
      unique(
        native.map((host) => host.id),
        `${path}.native.id`,
      )
      return {
        id: identity(obj.id, `${path}.id`),
        name: string(obj.name, `${path}.name`),
        modal: boolean(obj.modal, `${path}.modal`),
        busy: boolean(obj.busy, `${path}.busy`),
        logical,
        native,
      }
    },
  )
  unique(
    stacks.map((stack) => stack.id),
    'snapshot.stacks.id',
  )
  const snapshot: DiagnosticSnapshot = {
    routerId,
    time: number(snap.time, 'snapshot.time'),
    stopped: boolean(snap.stopped, 'snapshot.stopped'),
    stacks,
    issues: list(snap.issues, 'snapshot.issues').map((value, index) => {
      const path = `issues[${index}]`,
        issue = object(value, path)
      return {
        code: choice(issue.code, `${path}.code`, codes),
        stackId: optional(issue, 'stackId', path, identity),
        hostId: optional(issue, 'hostId', path, identity),
      }
    }),
  }
  if (events.some((event) => event.time > snapshot.time))
    fail('snapshot.time', 'a capture time at or after every retained event')
  return {
    version: 1,
    routerId,
    clock: 'monotonic',
    startedAt,
    droppedEvents: number(root.droppedEvents, 'report.droppedEvents', true),
    events,
    snapshot,
  }
}

export interface TimelineRow {
  key: number
  event: DiagnosticEvent
  start: number
  end?: number
  duration?: number
  completeness: 'complete' | 'missing-start' | 'missing-end' | 'ambiguous' | 'event'
}

/** Correlate by span identity, never adjacency/nesting or summed phase durations. */
export function timeline(report: DiagnosticsExport): TimelineRow[] {
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
