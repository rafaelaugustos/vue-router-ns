# Explicit route data preparation — #179, stage 2

Based on merged stage-1 commit `145c9bd20634ca0ed78b8573e7501c498af0449b`.
This stage adds experimental data preparation alongside the separate code API.

## Contract

`router.preloadData(to, loader)` and page-owned `useRouteDataPreload()` prepare one
definition declared in the resolved route. `defineRouteLoader(load, { preload })`
explicitly opts it in with a stable session/permission-scope object and a
synchronous, side-effect-free authorization predicate. Missing scope or denied
permission cancels preparation without invoking the loader. Code imports,
navigation guards, history, native construction and unrelated loaders are not
part of data preparation. Actual navigation retains every normal guard.

Matching includes the loader, matched records, session identity and full target
and origin routes. Consumers have independent interests; an authorized new entry
can acquire pending or ready work without delaying native presentation. States
remain per-entry and the handle never exposes the payload. Prepared values are
shared shallow references, so consumers must treat them as immutable. Normal
loads already running before preparation are not retroactively pooled; existing
app caches remain responsible for their own request coalescing.

Data has its own defaults: two executing speculative loaders, sixteen jobs and
a thirty-second TTL from first request. Ready jobs use LRU eviction; navigation
can promote its queued destination. These bounds count work/results, not bytes
or application caches. Cancellation releases the shared request context only
after its last pending consumer; executing work occupies a speculative slot until
its promise actually settles. An HTTP adapter may use the existing cancellation
callback to abort owned transport or release its own cache subscription.

Scope/permission checks precede execution, reuse and publication. Clearing on
account changes gives prompt cancellation; identity checks also reject late
responses without explicit clearing. Route/HMR changes invalidate preparation.
Expiry/errors allow a normal fallback. Account or explicit invalidation cancels
joined pending publication without an implicit protected retry. Explicit reload
starts ordinary work and cannot be cancelled by an old attempt's late callback.
Already consumed entry values and app caches remain application-owned; clearing
preparation does not erase those values or retire account pages automatically.

## Native acceptance

Published Core **9.1.4**, NativeScript-Vue **3.1.3**, iOS runtime **9.1.0**;
Apple-silicon Mac, Xcode **27.0 (27A266a)**, dedicated **iPad Pro 13-inch (M4)**
simulator running **iOS 18.6**. Final XCTest passed in **47.879 seconds**.
All **twelve application reports** and independent HTTP assertions passed with
no Vue/reconciliation errors. [Native evidence](./evidence/route-preload-stage2/ios18.json).

| Point in real touch sequence                    | Page | Controller | Vue app | Frame | Guard | HTTP |
| ----------------------------------------------- | ---: | ---------: | ------: | ----: | ----: | ---: |
| Data ready before release                       |    0 |          0 |       0 |     0 |     0 |    1 |
| Cold or prepared destination committed          |    1 |          1 |       2 |     0 |     1 |    1 |
| Abandoned drag after HTTP completes             |    0 |          0 |       0 |     0 |     0 |    1 |
| Speculative permission denied                   |    0 |          0 |       0 |     0 |     0 |    0 |
| Prepared data, navigation guard refuses         |    0 |          0 |       0 |     0 |     1 |    1 |
| Account A response arrives after switching to B |    0 |          0 |       0 |     0 |     0 |    1 |
| Owner disposed while HTTP is pending            |    0 |          0 |       0 |     0 |     0 |    1 |

Deltas start at touch-down. Prepared/abandoned/refused work retains the exact
source Page and history. The cold path presents while data is still pending.
The server records exactly seven requests: cold, prepared, abandoned, blocked,
account A, account B and disposal. Denial adds no request; release to a prepared
destination does not duplicate it. All seven requests complete, deliberately
proving that release/publication cancellation works even without transport abort.
The account-change sequence rejects A's late response, then opens a page with
only B's independently prepared result. Disposal invalidates the helper and
empties history.

The server intentionally delays each real HTTP response by **900 ms**. In the
final run, the cold Page presented in **17 ms** and received data in **952 ms**;
the prepared Page presented with data in **14 ms** after release. This demonstrates
moving a controlled wait before release, **not a network or device benchmark**.

[Actual simulator recording](../docs/public/media/route-data-preload.mp4):
**48.5 seconds**, original speed, H.264, **1032 × 1376**, including launch and the
full touch sequence. No interaction was composited. Four-locale guides embed the
recording with localized captions, English fixture labels and the timing limit.
The [repeatable driver](../scripts/native/preload/README.md#explicit-data-preparation--stage-2)
preserves raw video, XCTest results/log, application reports and server evidence.

The fixture instruments public Page/Frame construction, controllers exposed by
those objects and NativeScript-Vue app construction. It retains Page references
for identity checks. This does not measure all OS allocations, garbage collection,
physical-device performance, Android native touch or screen-reader behavior.

## Other verification

**772 tests passed**, ten existing skips, across **63 files**, with no type errors.
Twenty new runtime cases and one typed API case cover explicit permission,
matching, independent consumers/entries, account isolation, errors/fallback,
TTL/LRU/concurrency, route/HMR changes, disposal and ordinary reload. Existing
normal data and code-preparation suites still pass.

A focused negative control restores the incorrect shared cancellation callback:
the reload regression fails because an old invalidated attempt cancels the new
ordinary attempt. Capturing cancellation per attempt makes that case pass; no
old data can overwrite the new result. The control is recorded separately from
passing acceptance in the [evidence](./evidence/route-preload-stage2/regression.json).

Root and native-fixture typechecks, library/native builds, package dry run,
formatting and native helper checks passed. Documentation parity covers **49
pages × four languages**. Build/browser evidence is retained in the
[documentation report](./evidence/route-preload-stage2/documentation.json).
No native-speaker translation review or hosted native success is claimed.
