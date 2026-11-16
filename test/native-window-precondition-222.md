# Restore the iPad window before each rotation scenario

The hosted content-Back check merged in PR #222 failed because it established a
full-size window only once. iPadOS 26.2 restored a reduced compatibility window
after rotation. Both gesture methods correctly rejected the resulting
`(40, 58, 754, 1095)` window instead of sending input intended for the full
`(0, 0, 834, 1210)` application frame.

[Failed run 43842630376](https://github.com/rafaelaugustos/vue-router-ns/actions/runs/43842630376)
recorded two passed and two failed XCTest methods. The native Back gestures did
not run in the failing methods. Compilation/runner startup also consumed about
210 seconds of the old 240-second process deadline, which interrupted result
finalization. The assertion failures are independent of that timeout.

## Correction

`prepareWindow` now runs for each of the ten cases, after its initial orientation
and fixture preparation and before the native navigation observer is armed. It
waits for usable accessibility geometry, uses the system's ordinary Zoom control
if a reduced window is present, and requires full-size bounds before proceeding.
This is setup, not a retry of failed native input.

The iPadOS 18.6 regression check exposed transient accessibility geometry from the
preceding orientation, including a negative origin. Geometry readiness and Zoom
completion therefore have five-second deadlines based on observed bounds. An
18.6 window must become full size; it never attempts the newer window controls.

`window-setup.json` now contains ten named checks. The host requires exactly one
per scenario, full-size final bounds and setup timestamps preceding the native
observer. Native commit/cancel outcomes, phase ordering, object/history identity,
drafts, disposal and follow-up navigation assertions are unchanged. The process
budget is six minutes, including compilation/runner startup; the hosted step is
bounded at twelve minutes including app preparation and evidence collection.

An intermediate hosted run passed all four XCTest methods and all ten window
checks, then failed the final layout assertion. In `commit-landscape`, UIKit
reported a landscape transition followed by a portrait transition while the long
drag was still active. Its final layout was correctly rejected as `overlay`.
[Run 43848778441](https://github.com/rafaelaugustos/vue-router-ns/actions/runs/43848778441)
is retained as diagnostic evidence, not accepted coverage.

Both commit controls now use the existing permanent-content sequence: wait for
UIKit's interaction decision, then request rotation before native navigation
completion. The cancellation controls still request rotation with the pointer
down. There is no second rotation request, gesture retry or relaxation of the
final layout/identity/history checks.

## Validation

Tested native driver revision: `9352e4c711ca3fb789108099f9813b99e6d8126e`.
Every recorded fixture/test source hash was compared against that revision.
Both final local runs use that committed driver; unrelated documentation and
evidence changes were still uncommitted.

| Run                             | XCTest methods | Scenarios exercised                | Window checks | Actual Zoom actions        |
| ------------------------------- | -------------- | ---------------------------------- | ------------- | -------------------------- |
| Local iPadOS 18.6 / 22G86       | 4 passed       | 8 + 2 known missing inset gestures | 10            | 0                          |
| Fresh local iPadOS 26.2 / 23C54 | 4 passed       | 10                                 | 10            | 1 after the first rotation |

Both local runs use iPad Pro 11-inch M4 simulators, Xcode 27.2 / 27B52 and Node
20.19.4. On the fresh 26.2 run, the first case began full size; the next case
observed `(84, 58, 1043, 719)` and restored `(0, 0, 1210, 834)` before arming
programmatic Back. All later gestures retained the strict full-window and actual
commit/cancel requirements. Every setup timestamp preceded its native observer.

[Validation and archive hashes](./evidence/window-precondition-222/validation.json)
include the original hosted failure and the initial 18.6 stale-geometry diagnostic,
plus the intermediate hosted double-rotation failure, separately from accepted
runs. Core source matches the official 9.1.4 package's
1,362-file digest retained by PR #222.

[Hosted run 43850712221](https://github.com/rafaelaugustos/vue-router-ns/actions/runs/43850712221)
**passed**, including the final host assertions: four XCTest methods, all ten
scenarios and all ten window checks. It reproduced the reduced window after the
first rotation and used Zoom before the next case. Both commit controls completed
native Back, and both cancellation controls cancelled it. The committed requests
followed the interaction decision and preceded navigation completion; cancelled
requests preceded the interaction decision.

The hosted run used iPadOS 26.2 / 23C54, Xcode 26.6 / 17F113 and Node 22.23.4.
Its recorded source hashes match `9352e4c`, and its Core digest matches the local
and official-package baseline. The compact archive and original artifact ID/hash
are retained in `validation.json`. This was the focused `content-back` job; the
separate drawer matrix was intentionally skipped.

The local fixture reuses the unchanged application build from PR #222. Its
fixture/observer source hashes match the follow-up checkout. The XCTest driver
is rebuilt for each run. Published Core 9.1.4, NativeScript-Vue 3.1.3 and iOS
runtime 9.1.0 remain unchanged. The demo uses the checkout's built router `dist`;
this is not a registry-consumer acceptance or a release.

[Watch the real simulator recording](../docs/public/media/window-precondition-222.mp4).
The complete 63.47-second recording shows the reduced window after rotation,
the system Zoom action, and subsequent native push/Back, gesture and modal cases.
All 2,979 frames, presentation timestamps and final-frame duration are preserved;
only size and H.264 encoding changed. See
[video provenance](./evidence/window-precondition-222/video.json).

The earlier [content-Back acceptance](./native-published-content-back-168.md)
retains its original evidence and now records the hosted failure explicitly.
The iPadOS 18.6 inset-gesture boundary, reduced-window/Stage Manager exclusions
and #167's separate requirement for actual visual rotation overlap remain.
