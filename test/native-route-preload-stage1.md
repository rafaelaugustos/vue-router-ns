# Code-only route preloading — #179, stage 1

Based on merged commit `38a66cdc381badca669c0c65612069754fc8bb56`.
This stage introduces experimental, opt-in preparation of a lazy route's code.
Issue #179 remains open for a separate speculative-safe data contract.

## Delivered behavior

`router.preload(to)` resolves a typed destination and declarative redirects, then
prepares only its leaf component. `useRoutePreload()` captures a preparation
function whose interests end on page/scope disposal. Each readonly handle has a
live state, a promise for its first ready/error/cancelled outcome and `cancel()`.
Consumers share code by record/factory while retaining independent cancellation.
No preparation runs guards, loaders, ancestor/layout factories or native/Vue
mounting. Normal navigation keeps its existing guard and promise semantics and
shares prepared/in-flight code, including when navigation started first.

The router-local pool defaults to two executing speculative factories, sixteen
pending/ready records and a thirty-second lifetime measured from first request.
Ready records use LRU eviction; a full pending pool rejects new interest. Actual
navigation can promote its queued destination past unrelated speculative work.
Route removal/replacement, generated route-table HMR, changed factory identity,
explicit clearing and owner/window disposal invalidate applicable preparation.
Late completion cannot repopulate an invalidated speculative job.

Cancellation releases interest; it cannot abort an executing JavaScript import,
undo module initialization or unload the module cache. Executing cancelled work
continues to occupy a speculative slot until it settles. These are job/reference
budgets, not byte limits. Ordinary authorized component caching remains separate.
Factories must contain code imports rather than protected data fetching; normal
route data still starts only after authorization. Sign-out/account transitions
can call `clearPreloads()`; no speculative-data API is introduced here.

## Native acceptance

Published Core **9.1.4**, NativeScript-Vue **3.1.3**, iOS runtime **9.1.0**;
Apple-silicon Mac, Xcode **27.0 (27A266a)**, dedicated **iPad Pro 13-inch (M4)**
simulator running **iOS 18.6**. XCTest passed in **32.935 seconds**, with all
**seven application reports** passing and no Vue/reconciliation errors.
See the [native evidence](./evidence/route-preload-stage1/ios18.json).

| Point in real touch sequence                   | Page | Controller | Vue app | Frame | Guard | Data |
| ---------------------------------------------- | ---: | ---------: | ------: | ----: | ----: | ---: |
| Prepared, before release                       |    0 |          0 |       0 |     0 |     0 |    0 |
| Committed destination, cold or prepared        |    1 |          1 |       2 |     0 |     1 |    1 |
| Abandoned drag, after executing import settles |    0 |          0 |       0 |     0 |     0 |    0 |
| Prepared code, refused navigation              |    0 |          0 |       0 |     0 |     1 |    0 |
| Owner disposed during import, after settlement |    0 |          0 |       0 |     0 |     0 |    0 |

All deltas are measured from touch-down. Both committed paths invoke the factory
once and preserve the original source Page in history. Preparation, abandonment
and refusal preserve the exact source Page/history; disposal empties history and
rejects preparation from the retired owner. The fixture counts public Page/Frame
construction, unique controllers exposed by those objects and NativeScript-Vue
`renderer.createApp` calls. That runtime creates two Vue apps per routed Page.

The factory deliberately waits **900 ms** before its dynamic import. Release-to-
navigation completion was **923 ms** cold and **12 ms** prepared in this run.
This demonstrates moving the controlled delay before release; it is **not an
import or device-performance benchmark**. The module cache may already be warm.

[Actual simulator recording](../docs/public/media/route-code-preload.mp4):
**33.47 seconds**, H.264, **1032 × 1376**, original speed, including launch and all
five interactions. No interaction was composited. Localized guides embed it with
captions explaining the controlled delay and English fixture labels.
The [repeatable fixture and driver](../scripts/native/preload/README.md) retain the
raw recording, XCTest bundle/log and seven JSON reports locally.

This is iOS simulator evidence. The fixture holds Page references for identity
checks and counts construction boundaries; it does not establish garbage
collection, all OS allocations, physical-device performance, Android native touch
acceptance or screen-reader behavior.

## Other verification

**751 tests passed**, ten existing skips, across **61 files**, with no type errors.
Twenty new runtime cases plus typed API assertions cover independent consumers,
normal navigation results, both sharing directions, queued promotion, budgets,
TTL/LRU, errors/fallback, route/HMR invalidation, page/window cleanup, synchronous
cancellation and invalidation across an await boundary. They also verify that
preparation never calls route guards/loaders or ancestor/layout factories.

Root and fixture typechecks, library/native builds, package dry run, formatting
and native helper checks passed. Four-locale documentation structural checks,
build and browser verification are recorded in the
[documentation evidence](./evidence/route-preload-stage1/documentation.json).
No native-speaker review or hosted native execution is claimed.
