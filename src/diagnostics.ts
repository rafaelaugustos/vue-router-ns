import type { Frame, Page, View } from '@nativescript/core'
import type { Entry, Stack } from './stack.js'
import type { NavigationType, RouteLocation } from './types.js'

export interface DiagnosticsOptions {
  /** Number of events retained, from 1 to 10,000. Defaults to 500. */
  maxEvents?: number
}

export type DiagnosticPhase =
  | 'navigation'
  | 'queue'
  | 'guard'
  | 'load'
  | 'mount'
  | 'transition'
  | 'native'
  | 'page'
  | 'hmr'
  | 'host'
  | 'result'
  | 'issue'

export type DiagnosticOutcome =
  'success' | 'aborted' | 'cancelled' | 'duplicated' | 'redirected' | 'noop' | 'error'

export type DiagnosticIssueCode =
  | 'stack-mismatch'
  | 'unknown-native-page'
  | 'disposed-native-entry'
  | 'orphaned-host'
  | 'duplicate-result'
  | 'inspection-failed'

/** Route values, native handles, error messages, props and results are never copied. */
export interface DiagnosticEvent {
  readonly id: number
  readonly routerId: string
  /** Milliseconds from the collector's monotonic clock origin. */
  readonly time: number
  readonly phase: DiagnosticPhase
  readonly status: 'start' | 'end' | 'event'
  readonly spanId?: number
  readonly navigationId?: number
  readonly parentNavigationId?: number
  readonly operation?: NavigationType
  readonly stackId?: string
  readonly windowId?: string
  readonly entryId?: string
  /** Matched route pattern, never the resolved path. */
  readonly route?: string
  readonly detail?: string
  readonly duration?: number
  readonly outcome?: DiagnosticOutcome
  readonly code?: DiagnosticIssueCode
}

export interface DiagnosticIssue {
  readonly code: DiagnosticIssueCode
  readonly stackId?: string
  readonly hostId?: string
}

export interface DiagnosticEntry {
  readonly id: string
  readonly route: string
  readonly active: boolean
  readonly awaitingResult: boolean
}

export interface DiagnosticHost {
  readonly id: string
  readonly role: 'main' | 'list' | 'detail'
  readonly windowId?: string
  readonly loaded: boolean
  /** Unowned native pages have null IDs. Split placeholders are excluded. */
  readonly entries: readonly (string | null)[]
}

export interface DiagnosticStack {
  readonly id: string
  readonly name: string
  readonly modal: boolean
  readonly busy: boolean
  readonly logical: readonly DiagnosticEntry[]
  readonly native: readonly DiagnosticHost[]
}

export interface DiagnosticSnapshot {
  readonly routerId: string
  readonly time: number
  readonly stopped: boolean
  readonly stacks: readonly DiagnosticStack[]
  readonly issues: readonly DiagnosticIssue[]
}

export interface DiagnosticsExport {
  readonly version: 1
  readonly routerId: string
  readonly clock: 'monotonic'
  /** Wall-clock origin for correlation with native profiling tools. */
  readonly startedAt: number
  readonly droppedEvents: number
  readonly events: readonly DiagnosticEvent[]
  readonly snapshot: DiagnosticSnapshot
}

export interface RouterDiagnostics {
  readonly routerId: string
  readonly stopped: boolean
  readonly droppedEvents: number
  readonly events: readonly DiagnosticEvent[]
  /** Detached, frozen data. Reading a snapshot does not emit more events. */
  snapshot(): DiagnosticSnapshot
  /** Listener exceptions cannot affect navigation. Returns an unsubscribe function. */
  subscribe(listener: (event: DiagnosticEvent) => void): () => void
  toJSON(): DiagnosticsExport
  export(): string
  /** Clears retained events without changing identities or stopping collection. */
  clear(): void
  /** Releases live sources and subscriptions; retains only the bounded plain-data report. */
  stop(): void
}

export interface DiagnosticSource {
  stack: Stack
  hosts: { frame: Frame | null; role: DiagnosticHost['role']; placeholder?: Page }[]
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] }

type Context = Partial<
  Mutable<
    Pick<
      DiagnosticEvent,
      | 'navigationId'
      | 'parentNavigationId'
      | 'operation'
      | 'stackId'
      | 'windowId'
      | 'entryId'
      | 'route'
      | 'detail'
      | 'code'
    >
  >
>

export interface DiagnosticSpan {
  end(outcome?: DiagnosticOutcome): void
}

export interface NavigationTrace {
  readonly id: number
  route(to: RouteLocation): void
  span(phase: DiagnosticPhase, detail?: string): DiagnosticSpan
  end(outcome?: DiagnosticOutcome): void
}

let routerSequence = 0
let windowSequence = 0
const windowIds = new WeakMap<object, string>()

/** Internal collector. Only instantiated when explicitly enabled. */
export function createDiagnostics(
  options: DiagnosticsOptions,
  source: () => DiagnosticSource[],
  findEntry: (page: Page) => Entry | undefined,
) {
  const maxEvents = options.maxEvents ?? 500
  if (!Number.isInteger(maxEvents) || maxEvents < 1 || maxEvents > 10_000)
    throw new Error('diagnostics.maxEvents must be an integer from 1 to 10000')
  const clock = monotonicClock()
  const origin = clock()
  const startedAt = Date.now()
  const routerId = `router-${++routerSequence}`
  const ids = new WeakMap<object, string>()
  const settledResults = new WeakSet<Entry>()
  const active = new WeakMap<Stack, number>()
  const listeners = new Set<(event: DiagnosticEvent) => void>()
  const events: DiagnosticEvent[] = []
  let sources: (() => DiagnosticSource[]) | undefined = source
  let lookup: typeof findEntry | undefined = findEntry
  let sequence = 0
  let objectSequence = 0
  let spanSequence = 0
  let navigationSequence = 0
  let droppedEvents = 0
  let stopped = false
  let reported = new Set<string>()
  let lastSnapshot: DiagnosticSnapshot | undefined

  const now = () => Math.max(0, clock() - origin)
  const entryId = (entry: Entry) => `${routerId}:entry-${entry.id}`
  const identity = (object: object, kind: string) => {
    let id = ids.get(object)
    if (!id) ids.set(object, (id = `${routerId}:${kind}-${++objectSequence}`))
    return id
  }
  const context = (stack: Stack, entry?: Entry): Context => ({
    stackId: identity(stack, 'stack'),
    windowId: windowId(stack.frame),
    ...(entry ? { entryId: entryId(entry), route: pattern(entry.route) } : {}),
  })

  function emit(
    phase: DiagnosticPhase,
    status: DiagnosticEvent['status'],
    data: Context & {
      spanId?: number
      duration?: number
      outcome?: DiagnosticOutcome
    } = {},
  ) {
    if (stopped) return
    const event: DiagnosticEvent = Object.freeze({
      ...data,
      id: ++sequence,
      routerId,
      time: now(),
      phase,
      status,
    })
    if (events.length === maxEvents) {
      events.shift()
      droppedEvents++
    }
    events.push(event)
    for (const listener of [...listeners]) {
      if (stopped) break
      try {
        listener(event)
      } catch {
        /* Diagnostics must not change navigation. */
      }
    }
  }

  function span(phase: DiagnosticPhase, data: Context): DiagnosticSpan {
    const spanId = ++spanSequence
    const start = now()
    let ended = false
    emit(phase, 'start', { ...data, spanId })
    return {
      end(outcome = 'success') {
        if (ended || stopped) return
        ended = true
        emit(phase, 'end', { ...data, spanId, duration: now() - start, outcome })
      },
    }
  }

  function snapshot(): DiagnosticSnapshot {
    if (stopped && lastSnapshot) return lastSnapshot
    const stacks: DiagnosticStack[] = []
    const issues: DiagnosticIssue[] = []
    try {
      for (const { stack, hosts } of sources?.() ?? []) {
        const id = identity(stack, 'stack')
        // The router's attempt token can outlive an aborted guard. Only the
        // latest live request owns input; older async guards may still unwind.
        const busy = !!stack.pending || active.has(stack)
        const native: DiagnosticHost[] = []
        const nativeEntries: (string | null)[] = []
        for (const { frame, role, placeholder } of hosts) {
          if (!frame) {
            if (!busy && stack.entries.value.length)
              issues.push({ code: 'orphaned-host', stackId: id })
            continue
          }
          const hostId = identity(frame, 'host')
          const pages = [
            ...frame.backStack.map((item) => item.resolvedPage),
            frame.currentPage,
          ].filter((page): page is Page => !!page && page !== placeholder)
          const entries = pages.map((page) => {
            const entry = lookup?.(page)
            if (!busy && !entry)
              issues.push({ code: 'unknown-native-page', stackId: id, hostId })
            if (!busy && entry?.disposed)
              issues.push({ code: 'disposed-native-entry', stackId: id, hostId })
            return entry ? entryId(entry) : null
          })
          nativeEntries.push(...entries)
          native.push({
            id: hostId,
            role,
            loaded: frame.isLoaded === true,
            windowId: windowId(frame),
            entries,
          })
          if (!busy && nativeWindow(frame)?.state === 'closed')
            issues.push({ code: 'orphaned-host', stackId: id, hostId })
        }
        const logical = stack.entries.value.map((entry) => ({
          id: entryId(entry),
          route: pattern(entry.route),
          active: entry.isActive(),
          awaitingResult: !!entry.settle,
        }))
        if (
          !busy &&
          (logical.length !== nativeEntries.length ||
            logical.some((entry, index) => entry.id !== nativeEntries[index]))
        )
          issues.push({ code: 'stack-mismatch', stackId: id })
        stacks.push({ id, name: stack.name, modal: !!stack.modal, busy, logical, native })
      }
    } catch {
      issues.push({ code: 'inspection-failed' })
    }
    return freeze({ routerId, time: now(), stopped, stacks, issues })
  }

  function audit() {
    if (stopped) return
    const next = new Set<string>()
    for (const issue of snapshot().issues) {
      const key = `${issue.stackId}:${issue.hostId}:${issue.code}`
      next.add(key)
      if (!reported.has(key))
        emit('issue', 'event', { stackId: issue.stackId, code: issue.code })
    }
    reported = next
  }

  const api: RouterDiagnostics = {
    routerId,
    get stopped() {
      return stopped
    },
    get droppedEvents() {
      return droppedEvents
    },
    get events() {
      return Object.freeze([...events])
    },
    snapshot,
    subscribe(listener) {
      if (!stopped) listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    toJSON() {
      return Object.freeze({
        version: 1,
        routerId,
        clock: 'monotonic',
        startedAt,
        droppedEvents,
        events: api.events,
        snapshot: snapshot(),
      })
    },
    export: () => JSON.stringify(api.toJSON(), null, 2),
    clear() {
      events.length = 0
      droppedEvents = 0
    },
    stop() {
      if (stopped) return
      const final = snapshot()
      stopped = true
      lastSnapshot = Object.freeze({ ...final, stopped: true })
      sources = undefined
      lookup = undefined
      listeners.clear()
      reported.clear()
    },
  }

  return {
    api,
    begin(
      stack: Stack,
      operation: NavigationType,
      to?: RouteLocation,
      parentNavigationId?: number,
    ): NavigationTrace {
      const data: Context = {
        ...context(stack),
        navigationId: ++navigationSequence,
        parentNavigationId,
        operation,
        route: to && pattern(to),
      }
      active.set(stack, data.navigationId!)
      const navigation = span('navigation', data)
      let ended = false
      return {
        id: data.navigationId!,
        route(to) {
          data.route = pattern(to)
        },
        span: (phase, detail) => span(phase, { ...data, detail }),
        end(outcome) {
          if (ended) return
          ended = true
          if (active.get(stack) === data.navigationId) active.delete(stack)
          navigation.end(outcome)
          audit()
        },
      }
    },
    event(phase: DiagnosticPhase, stack: Stack, detail: string, entry?: Entry) {
      if (stopped) return
      emit(phase, 'event', { ...context(stack, entry), detail })
    },
    result(entry: Entry) {
      if (stopped) return
      if (settledResults.has(entry))
        emit('issue', 'event', {
          ...context(entry.stack, entry),
          code: 'duplicate-result',
        })
      else {
        settledResults.add(entry)
        emit('result', 'event', context(entry.stack, entry))
      }
    },
    audit,
  }
}

function pattern(route: RouteLocation): string {
  return route.matched.at(-1)?.path ?? '(unmatched)'
}

function nativeWindow(view: View | null): { state?: string } | undefined {
  try {
    return (
      view as (View & { getNativeWindow?(): { state?: string } }) | null
    )?.getNativeWindow?.()
  } catch {
    return undefined
  }
}

function windowId(view: View | null): string | undefined {
  const window = nativeWindow(view)
  if (!window) return undefined
  let id = windowIds.get(window)
  if (!id) windowIds.set(window, (id = `window-${++windowSequence}`))
  return id
}

function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child)
    Object.freeze(value)
  }
  return value
}

declare const android: { os: { SystemClock: { uptimeMillis(): number } } }
declare const NSProcessInfo: { processInfo: { systemUptime: number } }

function monotonicClock(): () => number {
  const performance = (globalThis as { performance?: { now(): number } }).performance
  if (performance?.now) return () => performance.now()
  if (typeof android !== 'undefined') return () => android.os.SystemClock.uptimeMillis()
  if (typeof NSProcessInfo !== 'undefined')
    return () => NSProcessInfo.processInfo.systemUptime * 1000
  throw new Error('Router diagnostics requires a monotonic native clock')
}
