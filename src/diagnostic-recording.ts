import type { DiagnosticEvent, DiagnosticSnapshot } from './diagnostics.js'

/** Experimental, opt-in recording. Both limits apply independently of maxEvents. */
export interface DiagnosticRecordingOptions {
  /** Retained records, 1–10,000. Default 500. */
  maxRecords?: number
  /** UTF-8 bytes of the serialized records array, 1 KiB–8 MiB. Default 1 MiB. */
  maxBytes?: number
}

export type DiagnosticBoundary =
  | 'initial'
  | 'event'
  | 'reconcile-before'
  | 'reconcile-after'
  | 'clear'
  | 'stop'
  | 'manual'

export interface DiagnosticObservation {
  readonly stackId: string
  readonly closed: boolean
  /** Selected membership, when the router or native tab container exposes it. */
  readonly selected: boolean | null
  /** Routing destination, NOT OS window, keyboard or accessibility focus. */
  readonly routerFocused: boolean | null
  /** Host-local visible pages; does not claim screen visibility through overlays. */
  readonly hostVisible: readonly (string | null)[] | null
  readonly tab: {
    readonly id: string
    readonly index: number
    readonly selectedIndex: number
  } | null
  /** OS input focus is not observed by this contract. */
  readonly inputFocused: null
}

interface RecordIdentity {
  readonly sequence: number
  readonly epoch: number
  readonly time: number
}

export type DiagnosticRecord = RecordIdentity &
  (
    | { readonly kind: 'event'; readonly event: DiagnosticEvent }
    | {
        readonly kind: 'checkpoint'
        readonly boundary: DiagnosticBoundary
        readonly eventId?: number
        readonly snapshot: DiagnosticSnapshot
        readonly observations: readonly DiagnosticObservation[]
      }
    | {
        readonly kind: 'gap'
        readonly reason: 'oversized' | 'inspection-failed' | 'cleared'
        readonly boundary?: DiagnosticBoundary
        readonly eventId?: number
      }
  )

/** Independent checkpoints, never reconstructed from operation names or live objects. */
export interface DiagnosticsRecording {
  readonly version: 2
  readonly captureId: string
  readonly routerId: string
  readonly clock: 'monotonic'
  readonly startedAt: number
  readonly stopped: boolean
  readonly epoch: number
  /** Prefix records evicted by either limit, including previous epochs. */
  readonly droppedRecords: number
  /** Retained records deliberately discarded by clear(), including previous epochs. */
  readonly clearedRecords: number
  readonly limits: Readonly<Required<DiagnosticRecordingOptions>>
  readonly retainedBytes: number
  /** Collector work only; excludes listeners, export and application/rendering time. */
  readonly overhead: {
    readonly samples: number
    readonly totalMs: number
    readonly maxMs: number
  }
  readonly records: readonly DiagnosticRecord[]
}

type Input = DiagnosticRecord extends infer R
  ? R extends DiagnosticRecord
    ? Omit<R, 'sequence' | 'epoch'>
    : never
  : never

/** Internal plain-data buffer. No native imports, timers, subscriptions or replay. */
export function createRecording(
  options: DiagnosticRecordingOptions,
  identity: { routerId: string; startedAt: number },
  clock: () => number,
) {
  const limits = Object.freeze({
    maxRecords: options.maxRecords ?? 500,
    maxBytes: options.maxBytes ?? 1024 * 1024,
  })
  if (
    !Number.isInteger(limits.maxRecords) ||
    limits.maxRecords < 1 ||
    limits.maxRecords > 10_000
  )
    throw new Error('diagnostics.recording.maxRecords must be an integer from 1 to 10000')
  if (
    !Number.isInteger(limits.maxBytes) ||
    limits.maxBytes < 1024 ||
    limits.maxBytes > 8 * 1024 * 1024
  )
    throw new Error(
      'diagnostics.recording.maxBytes must be an integer from 1024 to 8388608',
    )
  const captureId = `${identity.startedAt.toString(36)}-${identity.routerId}-${Math.random().toString(36).slice(2)}`
  const records: { record: DiagnosticRecord; bytes: number }[] = []
  let sequence = 0,
    epoch = 0,
    droppedRecords = 0,
    clearedRecords = 0,
    retainedBytes = 2
  let samples = 0,
    totalMs = 0,
    maxMs = 0

  function append(input: Input) {
    let record = Object.freeze({
      ...input,
      sequence: ++sequence,
      epoch,
    }) as DiagnosticRecord
    let bytes = utf8Bytes(JSON.stringify(record))
    if (bytes + 2 > limits.maxBytes) {
      record = Object.freeze({
        kind: 'gap',
        reason: 'oversized',
        sequence,
        epoch,
        time: input.time,
        boundary: input.kind === 'checkpoint' ? input.boundary : undefined,
        eventId: input.kind === 'event' ? input.event.id : input.eventId,
      })
      bytes = utf8Bytes(JSON.stringify(record))
    }
    while (
      records.length &&
      (records.length >= limits.maxRecords || retainedBytes + bytes + 1 > limits.maxBytes)
    ) {
      const removed = records.shift()!
      retainedBytes -= removed.bytes + (records.length ? 1 : 0)
      droppedRecords++
    }
    retainedBytes += bytes + (records.length ? 1 : 0)
    records.push({ record, bytes })
  }

  return {
    append,
    measure(work: () => void) {
      const start = clock()
      try {
        work()
      } finally {
        const elapsed = Math.max(0, clock() - start)
        samples++
        totalMs += elapsed
        maxMs = Math.max(maxMs, elapsed)
      }
    },
    clear(time: number) {
      clearedRecords += records.length
      records.length = 0
      retainedBytes = 2
      epoch++
      append({ kind: 'gap', reason: 'cleared', time })
    },
    read(stopped: boolean): DiagnosticsRecording {
      return Object.freeze({
        version: 2,
        captureId,
        ...identity,
        clock: 'monotonic',
        stopped,
        epoch,
        droppedRecords,
        clearedRecords,
        limits,
        retainedBytes,
        overhead: Object.freeze({ samples, totalMs, maxMs }),
        records: Object.freeze(records.map(({ record }) => record)),
      })
    },
  }
}

/** NativeScript does not require a global TextEncoder. JSON escapes lone surrogates. */
function utf8Bytes(text: string): number {
  let size = 0
  for (const char of text) {
    const code = char.codePointAt(0)!
    size += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4
  }
  return size
}
