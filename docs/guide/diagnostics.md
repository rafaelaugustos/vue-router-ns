# Navigation diagnostics

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

Each host reports its role (`main`, `list`, `detail`), loaded state, optional window ID and native entry IDs. Unknown native pages have `null` IDs. Split-view placeholders are omitted. A window ID is available once the Frame belongs to a NativeWindow; older cores can omit it. IDs are process-local diagnostic identities, not restoration keys, native handles or a multi-window navigation API. Separate router collectors remain independent; window ownership/routing is tracked in #46.

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

The package supplies a standalone JSON format and the native demo's inspector rather than depending on a private NativeScript-Vue devtools extension. You can inspect the collector through an application-owned reference in Chrome DevTools or build a viewer from the public data. No process-global inspector or network transport is installed automatically.

`toJSON()` returns `{ version: 1, routerId, clock: 'monotonic', startedAt, droppedEvents, events, snapshot }`. The oldest events are discarded at capacity; a retained span end may have lost its start. `clear()` empties the buffer and drop counter while preserving IDs and the clock origin.

`stop()` releases live snapshot sources and subscriptions, freezes the last snapshot and retains only the bounded plain-data report. It is permanent for that collector and does not stop navigation. App unmount stops it automatically; Vue invokes this hook before disposing root components, so that final snapshot may still describe the last live stack. Explicitly unsubscribe page-owned listeners when their page unmounts.

## Privacy and native demo

Routes are represented by their matched **pattern**, such as `/messages/:id(\\d+)`. Resolved params/path values, query, hash, metadata, props, results, native objects, exception messages and stacks are never exported. Route patterns and stack names are application-defined identifiers: keep user data out of those definitions. The collector has no option that copies arbitrary route/page data.

In the debug demo, open **Settings → Navigation diagnostics**. Compare a 350 ms guard with 80 ms synchronous page setup, insert an unmanaged native Page to observe a mismatch and recovery, and copy a redacted JSON report. Native checks are recorded separately from the shim tests; timing examples are diagnostic fixtures, not performance guarantees.
