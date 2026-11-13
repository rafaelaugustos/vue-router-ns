# Visual diagnostics viewer

[Open the report viewer](/diagnostics-viewer/index.html). Import a JSON report from `router.diagnostics.export()` to compare logical and native history, inspect navigation spans and follow redirects. It works without connecting to an application.

<Clip name="diagnostic-replay" :width="780" aspect="1440 / 1100" caption="Actual offline viewer using native iOS 18.6 captures: observed divergence and recovery, guard/cancellation selection, modal lifetime, play/pause, clear/truncated gaps and v1 compatibility. Damaged-order files are explicitly synthetic; this is not a new native run." />

## Collect and open a report

Enable the existing opt-in collector in the application:

```ts
const router = createRouter({
  routes,
  diagnostics: __DEV__ ? { maxEvents: 1000 } : false,
})

// Use the application's own file/debug sharing mechanism to save this as JSON.
const report = router.diagnostics?.export()
```

Open the viewer and choose **Open JSON reports**. Up to eight independent files are retained, each at most 10 MiB. V1 accepts up to 10,000 events; v2 also enforces its declared record/byte budgets, capped at 10,000 records and 8 MiB of compact record data. Invalid JSON, unsupported versions and malformed fields produce a file-specific error without replacing opened reports. Unknown extra fields are discarded rather than displayed as arbitrary payloads.

**Explore example reports** replaces the open files with three explicitly synthetic teaching reports: a navigation investigation, a truncated buffer and an independent window. The 350 ms guard and 80 ms mount illustrate the timeline; they are not a performance threshold or benchmark.

## Replay v2 observations

Enable the [experimental recording contract](./diagnostics#experimental-recording-contract) to retain intermediate states. Existing v1 files remain final-snapshot reports and have no replay controls.

```ts
const router = createRouter({
  routes,
  diagnostics: { recording: { maxRecords: 500, maxBytes: 1024 * 1024 } },
})
const recordingJSON = JSON.stringify(router.diagnostics!.recording())
// Save with the app's own file-sharing mechanism, then open it in the viewer.
```

**Recorded observations** adds play/pause, previous/next and a keyboard-accessible position slider. Playback advances one retained observation per second; it does not reproduce original timing. It never navigates an app, executes guards or requests data. Playback starts only when requested and pauses on import, capture/filter/language changes, clearing or hiding the tab.

Each position displays only its own recorded checkpoint. The native and logical stacks, issue codes, timestamp and visibility/selection details update together. In **Timeline**, selecting a row pauses playback and selects its explicitly linked checkpoint; a paired span row selects its end event. Redirect parent links retain request filtering, and overlapping requests stay separate. The full retained timeline remains visible: later events are not evidence of the selected state's future. Filters do not redefine playback order or the first-divergence analysis.

An event without a retained linked checkpoint shows an observation gap. The viewer never chooses a nearby snapshot, carries old state through a gap, interpolates state or reconstructs it from operation names. Evicted prefixes, clear epochs, oversized/failed inspections, missing interior records and inconsistent retention metadata remain visible. Duplicate identities, reversed sequences or clocks, and mixed epochs disable stack replay for the affected file. Invalid shapes and exceeded budgets reject the file without replacing existing captures. A later independent valid checkpoint can still be inspected after a missing-record gap.

**First observed divergence** jumps to the first retained comparable mismatch. Busy stacks and observations before reconciliation defer comparison. The preceding comparable observation, when available, bounds an uncertainty interval; neither an exact onset nor a cause is claimed. The result covers the whole file, even when filters hide some stacks. Absence of observed divergence does not certify missing history.

Expand **Visibility, selection and focus** to distinguish entry activity from host-local visibility, selected tab/index and the router's destination stack. OS input focus and unavailable observations stay unknown. Separate imported files are never merged, even when their capture or local IDs match. A gap is not an empty stack.

The video uses real iOS 18.6 recordings from the preceding capture stage; deliberately damaged files are named **SYNTHETIC**. This stage validates the offline browser tool, not a new native run or a performance benchmark. See the [validation report](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/diagnostic-replay-stage2.md).

## Compare the snapshot

The sidebar selects a capture. Files remain independent even when their router, stack or window IDs happen to match: IDs are local to a process/collector, and separately exported files are not one continuous recording.

**Stack comparison** displays each stack's logical entries beside its ordered native entries, with host role, window ID and loaded state. `null` is an unmanaged native page. The viewer highlights differing positions and separately lists the collector's snapshot issue codes. A busy stack defers comparison rather than declaring an in-flight transition corrupt. Large stack collections and histories are paginated.

An **active** entry is uncovered in its stack. That does not prove that its tab/window has focus. The window filter uses recorded host/event window IDs; an omitted ID is shown as unknown. A stack with hosts in multiple windows retains those host labels rather than being assigned a guessed owner. Snapshot issues and summary metrics always describe the entire selected capture, even when the window filter narrows the displayed stacks or timeline.

This is a point-in-time report, not persisted navigation state. The viewer cannot edit the native stack or restore the application.

## Read the timeline

**Timeline** pairs start/end events by span ID within the selected capture, correlates requests by navigation ID, and links redirected requests to their parent. Filter by phase, outcome, request or window; select a row to see the recorded identifiers and fields. Overlapping requests remain separate rows. Large timelines display 100 rows per page; filters and page navigation cover the full retained buffer.

| Observation             | How to interpret it                                                                                                  |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Long guard              | Filter `guard`. Its duration measures that guard invocation; `detail` identifies the guard category.                 |
| Large synchronous mount | Filter `mount`. This includes Vue setup **and** native view creation; it does not isolate setup cost.                |
| Rejected navigation     | Filter `aborted` or `cancelled`; inspect the navigation ID and related guard rows.                                   |
| Redirect                | `redirected` ends the original request; the child row's parent link selects that original navigation ID.             |
| Missing start           | An end's duration is shown as **reported**, with a point at the recorded end. No missing start position is invented. |
| Missing end             | A point marks the retained start; no duration or completion is inferred from the snapshot time.                      |
| Conflicting boundaries  | Duplicate or inconsistent span boundaries are labeled ambiguous and do not get a fabricated duration.                |

The timeline scale stays tied to the full retained event range when filters change. Phase durations overlap: `transition` includes mounting, and guard/queue work can interleave across requests. Do not add row durations or treat their sum as total navigation time. The longest guard/mount cards consider retained reported durations and do not reconstruct dropped events. An end-only span can still carry a reported duration; the truncation banner remains visible.

Buffer drops, missing boundaries and empty captures are explicit. `clear()` can also remove earlier events without increasing the drop count. The wall-clock origin is approximate context; timeline values use the collector's monotonic clock. These measurements do not establish FPS, first-pixel latency or native heap usage. Use a native profiler for those questions.

## Local and offline use

The viewer reads files in memory in the browser tab. It has no upload endpoint, live transport, analytics, browser storage or runtime connection. Reloading or choosing **Clear reports** removes the open captures. It is a separate standalone page from the documentation shell; the built HTML blocks network connections through Content Security Policy and contains its own script/styles.

Choose **Download offline viewer** to save that HTML. Open the downloaded file in a browser and import reports without a network connection. The toolbar supports English, Portuguese, Spanish and Simplified Chinese. If a managed browser forbids local-file scripting, serve the built directory on localhost instead.

To build or develop it from a repository checkout:

```sh
npm ci
npm run diagnostics:build
# Open docs/public/diagnostics-viewer/index.html in a browser.

npm run diagnostics:dev
npm run diagnostics:typecheck
```

`docs:build` also builds the viewer. Its source lives under `tools/diagnostics-viewer`, outside the published runtime's `src`/`dist`; no viewer listener or dependency is installed in a NativeScript app. Browser regression checks and their optional Playwright setup are documented in `scripts/diagnostics-viewer/README.md`.

The existing collector's [privacy rules](./diagnostics#privacy-and-native-demo) remain unchanged: it exports route patterns and application-defined names, not params, query, props, results or exception payloads. Keep personal data out of those names. Import validation cannot certify that a manually modified report's strings contain no sensitive data.
