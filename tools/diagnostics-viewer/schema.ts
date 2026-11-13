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
export function fail(path: string, expected: string): never {
  // Never reflect arbitrary imported values in errors.
  throw new Error(`${path}: expected ${expected}`)
}
export function object(value: unknown, path: string): ObjectValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path, 'an object')
  return value as ObjectValue
}
export function list(value: unknown, path: string, max = 10_000): unknown[] {
  if (!Array.isArray(value) || value.length > max)
    fail(path, `an array with at most ${max} items`)
  return value
}
export function string(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length > 4096)
    fail(path, 'a string of at most 4096 characters')
  return value
}
export function identity(value: unknown, path: string): string {
  const result = string(value, path)
  if (!result) fail(path, 'a non-empty identity')
  return result
}
export function number(value: unknown, path: string, integer = false): number {
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
export function boolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') fail(path, 'a boolean')
  return value
}
export function choice<const T extends readonly string[]>(
  value: unknown,
  path: string,
  values: T,
): T[number] {
  if (typeof value !== 'string' || !values.includes(value)) fail(path, values.join(' | '))
  return value as T[number]
}
export function optional<T>(
  obj: ObjectValue,
  key: string,
  path: string,
  parse: (value: unknown, path: string) => T,
): T | undefined {
  return obj[key] === undefined ? undefined : parse(obj[key], `${path}.${key}`)
}
export function unique(values: readonly string[], path: string) {
  if (new Set(values).size !== values.length) fail(path, 'unique identities')
}

/** Strict v1 shape, with a whitelist copy. Additional fields never reach the UI. */
export function parseReport(text: string): DiagnosticsExport {
  const value = parseJSON(text)
  const root = object(value, 'report')
  if (root.version !== 1)
    throw new Error('Unsupported diagnostics version; expected version 1')
  const routerId = identity(root.routerId, 'report.routerId')
  if (root.clock !== 'monotonic') fail('report.clock', 'monotonic')
  const startedAt = number(root.startedAt, 'report.startedAt')
  if (Number.isNaN(new Date(startedAt).getTime()))
    fail('report.startedAt', 'a valid wall-clock origin')
  const events = list(root.events, 'report.events').map((value, index) =>
    parseEvent(value, routerId, `events[${index}]`),
  )
  unique(
    events.map((event) => String(event.id)),
    'events.id',
  )
  const snapshot = parseSnapshot(root.snapshot, routerId)
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

export function parseEvent(
  value: unknown,
  routerId: string,
  path: string,
): DiagnosticEvent {
  const obj = object(value, path)
  if (obj.routerId !== routerId) fail(`${path}.routerId`, 'the report router identity')
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
}

export function parseSnapshot(value: unknown, routerId: string): DiagnosticSnapshot {
  const snap = object(value, 'snapshot')
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
  return snapshot
}

export function parseJSON(text: string): unknown {
  if (new TextEncoder().encode(text).length > MAX_BYTES)
    throw new Error('Report exceeds the 10 MiB limit')
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error('Invalid JSON')
  }
  return value
}
