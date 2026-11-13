# Navigation diagnostics

See [native capabilities and container choices](./capabilities) for ownership, platform boundaries and the rc.2/rc.3 distinction.

[Open the visual report viewer](./diagnostics-viewer) to import exported JSON, compare stacks and inspect correlated timelines without connecting to an app.

Enable a bounded timeline and a read-only comparison of the router's logical history with its native Frames:

```ts
const router = createRouter({
  routes,
  diagnostics: __DEV__ ? { maxEvents: 500 } : false,
})

const inspector = router.diagnostics
inspector?.snapshot()
inspector?.events
inspector?.export() // versioned JSON string
```

`diagnostics` defaults to `false`. `true` uses a capacity of 500 events; `maxEvents` must be an integer from 1 to 10,000. A disabled collector is `undefined`: it does not read a clock, inspect native windows, register diagnostic native listeners or retain an event buffer. Collection uses the router's existing lifecycle events.

## Reading the timeline

Events have a monotonically increasing `id`, an opaque `routerId`, elapsed `time` in milliseconds, `phase` and `status`. Spans have matching `spanId` values on `start`/`end`; their end carries `duration` and `outcome`. Navigation-related spans share a `navigationId`. A redirect ends with `redirected`, and the new request has a `parentNavigationId`. Interleaved requests must be correlated by IDs rather than assumed to be nested.

| Phase          | What it observes                                                                                    |
| -------------- | --------------------------------------------------------------------------------------------------- |
| `navigation`   | A resolved router request through completion, rejection or failure. Root back is `noop`.            |
| `queue`        | Waiting for already committed native operations.                                                    |
| `guard`        | Each guard invocation; `detail` identifies `leave`, `beforeEach`, `beforeEnter` or `beforeResolve`. |
| `load`         | Component resolution, including a `cached` detail for an already loaded record.                     |
| `mount`        | Synchronous `$navigateTo`/`$showModal` work, including Vue setup and native view creation.          |
| `transition`   | The commit through the Frame/modal completion signal, including its mounting work.                  |
| `native`       | Frame completion, externally initiated `pop`, or another native synchronization.                    |
| `page`, `host` | Page linking/unlinking and host attachment/disposal.                                                |
| `hmr`          | Reload requested, deferred while covered, applied, or relinked to a replacement Page.               |
| `result`       | Settlement of an entry's result, without its value.                                                 |
| `issue`        | An observed invariant violation.                                                                    |

These are router request-to-completion measurements. They exclude work before the resolved request reaches the router, such as OS input delivery or waiting for initial readiness. `transition` overlaps `mount`; do not add their durations together. Native completion does not establish when the first pixels were displayed, measure FPS or replace a native profiler. Subscriber work can affect measured durations.

Timing uses a monotonic clock (`performance.now`, with Android/iOS uptime fallbacks), independent of changes to the wall clock. Exports include a wall-clock `startedAt` for approximate correlation with platform logs. Use [NativeScript debugging and native profiling tools](https://docs.nativescript.org/guide/debugging) to investigate rendering, CPU use and retained native objects.

## Comparing native and logical history

`snapshot()` returns frozen, detached data. Every stack has a stable ID, its developer-supplied `name`, modal/busy state, logical entries and native hosts. Entries include their route pattern, lifecycle `active` state and `awaitingResult`. `active` means uncovered within that stack; it does not prove that its tab/window is currently focused.

Each host reports its role (`main`, `list`, `detail`), loaded state, optional window ID and native entry IDs. Unknown native pages have `null` IDs. Split-view placeholders are omitted. A window ID is available once the Frame belongs to a NativeWindow; older cores can omit it. IDs are process-local diagnostic identities, not restoration keys, native handles or a multi-window navigation API. Separate router collectors remain independent; see [window ownership and reconstruction](./windows) for the implemented routing model.

The snapshot's `issues` detects ordered stack mismatches, unknown native pages, disposed entries still present natively, and missing/closed hosts. Comparisons wait while its latest request or native operation is in flight. The timeline records new issues seen during synchronization; an explicit snapshot can also detect a change before a native event arrives. The collector observes these conditions and does not repair history. `duplicate-result` detects repeated result-settlement signals. Inspection failures report a code without copying the underlying error.

## Subscribing and exporting

```ts
const stopListening = inspector?.subscribe((event) => {
  // Feed an app-owned viewer/logger. Keep this callback quick.
  consume(event)
})

const json = inspector?.export()
const data = inspector?.toJSON()
stopListening?.()
```

The package supplies a standalone JSON format and the native demo's inspector. The optional [report viewer](./diagnostics-viewer) reads those exports without a private NativeScript-Vue devtools extension. You can also inspect the collector through an application-owned reference in Chrome DevTools. No process-global inspector or network transport is installed automatically.

`toJSON()` returns `{ version: 1, routerId, clock: 'monotonic', startedAt, droppedEvents, events, snapshot }`. The oldest events are discarded at capacity; a retained span end may have lost its start. `clear()` empties the buffer and drop counter while preserving IDs and the clock origin.

`stop()` releases live snapshot sources and subscriptions, freezes the last snapshot and retains only the bounded plain-data report. It is permanent for that collector and does not stop navigation. App unmount stops it automatically; Vue invokes this hook before disposing root components, so that final snapshot may still describe the last live stack. Explicitly unsubscribe page-owned listeners when their page unmounts.

## Privacy and native demo

Routes are represented by their matched **pattern**, such as `/messages/:id(\\d+)`. Resolved params/path values, query, hash, metadata, props, results, native objects, exception messages and stacks are never exported. Route patterns and stack names are application-defined identifiers: keep user data out of those definitions. The collector has no option that copies arbitrary route/page data.

In the debug demo, open **Settings → Navigation diagnostics**. Compare a 350 ms guard with 80 ms synchronous page setup, insert an unmanaged native Page to observe a mismatch and recovery, and copy a redacted JSON report. Native checks are recorded separately from the shim tests; timing examples are diagnostic fixtures, not performance guarantees.

## Experimental recording contract

Opt in separately to preserve intermediate native and logical observations:

```ts
const router = createRouter({
  routes,
  diagnostics: {
    maxEvents: 500,
    recording: { maxRecords: 500, maxBytes: 1024 * 1024 },
  },
})
const inspector = router.diagnostics!
inspector.checkpoint() // e.g. after an app-owned tab selection
const capture = inspector.recording() // readonly v2 object; no live sampling
const recordingJSON = JSON.stringify(capture)
const legacyJSON = inspector.export() // unchanged v1, for the current viewer
```

The [viewer](./diagnostics-viewer#replay-v2-observations) imports v1 and v2, validates recordings and provides synchronized offline replay and observed-divergence analysis. Reading a recording never runs guards, requests data, navigates the app or restores native objects.

`recording: true` uses the defaults above. `maxRecords` accepts 1–10,000 and `maxBytes` accepts 1,024–8,388,608. Both limits apply to the separate v2 buffer; `maxEvents` continues to bound v1. `retainedBytes` counts the compact UTF-8 serialization of the records array, including brackets and commas. The small report envelope, pretty-print whitespace, exported copies and temporary snapshot allocations are outside that byte budget. This is a retention limit, not a heap limit.

The v2 envelope includes `captureId`, `routerId`, `clock`, `startedAt`, `stopped`, `epoch`, `limits`, `retainedBytes`, `droppedRecords`, `clearedRecords`, `overhead` and `records`. Each record has an increasing `sequence`, its `epoch` and monotonic `time`. Event records preserve v1 correlation IDs. Checkpoints hold a complete `snapshot`, `observations`, a `boundary` and optional triggering `eventId`. They are independent: evicting an older checkpoint does not invalidate a later one.

The collector observes initialization, events, native reconciliation before and after logical updates, explicit checkpoints, clearing and stopping. Native history comes from host page observations, not operation names. Only checkpoint instants are observed: there is no continuous recording or interpolation between them. External tab changes are observed at the next boundary; call `checkpoint()` after selection when that instant matters. No polling or native listeners are added.

`active` remains an entry lifecycle flag. `hostVisible` describes host-local visible pages, not occlusion by another modal/window. `selected` and `tab` record membership and native selected index when available. `routerFocused` identifies the router's destination stack; `inputFocused` is always unknown. Null observations must remain unknown. Stable entry/stack/host/window/tab IDs are meaningful within their capture; independent captures must not be joined by matching local IDs.

Prefix eviction increments `droppedRecords`. Clearing advances `epoch`, counts discarded records in `clearedRecords`, emits a cleared gap and observes a fresh checkpoint. Sequence numbers and identities do not reset. Oversized records become an oversized gap; inspection failures become an inspection-failed gap without exception data or a partial state. A tiny buffer may retain only a gap or an event: that does not mean an empty stack. A retained span may lack one endpoint. Stopping freezes the recording; navigation can continue.

Do not diagnose a settled divergence from a busy checkpoint or the boundary before reconciliation. A later comparable checkpoint can show the first **retained observation** of disagreement, never its exact cause or onset; missing records widen that uncertainty. The same redaction policy applies as to v1. `overhead` measures synchronous v2 collector work, excluding listeners, export and rendering. Recording adds inspection/serialization cost and can affect navigation timings; it is not an FPS measurement.

<Clip name="diagnostic-recording" :width="480" aspect="3 / 4" caption="Actual iOS 18.6 capture: success, guard refusal, cancellation, modal lifetime, intentional native divergence and recovery, retention limits, clear and stop. English fixture labels; no synthetic replay." />

Ten native checks passed. The recorded collector work and file sizes are fixture measurements, not device-performance guarantees. See the [validation report](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-diagnostic-recording-stage1.md) and [repeatable driver](https://github.com/rafaelaugustos/vue-router-ns/blob/main/scripts/native/recording/README.md).
