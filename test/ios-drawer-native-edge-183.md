# iPad rotation gesture origin — #183 / PR #215

The [first split drawer run](https://github.com/rafaelaugustos/vue-router-ns/actions/runs/43763592731)
finished within its job deadline but failed to start the intended interactive
Back gesture. Its XCTest log records a start at `(80.1, 388.4)`, derived from
the accessibility frame of a text field immediately after a push and orientation
changes. The [original report and complete evidence](./ios-drawer-budget-183.md)
remain intact.

## Correction

`RotationUITests` now obtains the gesture origin from the existing fixture's
`gesture-recognizer` event. UIKit supplies the navigation recognizer's view
origin and size in screen coordinates. The driver starts two points inside that
view's left edge, at its vertical midpoint, and converts the point into the
application's coordinate space. The drag distance uses the same intended
commit/cancel fractions, applied to the recognizer's width.

The driver waits for the recognizer event within the existing five-second
arming deadline and checks that it is enabled, has positive dimensions and
provides a start point inside the application. Each gesture's driver JSON now
retains its native geometry and input coordinates alongside the orientation
request timestamp. No accessibility query occurs between observing active
native navigation and requesting rotation.

Only the Swift test driver changes. Package runtime, app fixture, observer,
JavaScript acceptance checks, gesture velocity/hold durations, case count and
timeouts are unchanged. The existing classification of unobserved gestures
from the permanent sidebar layout is also unchanged.

## Local reproduction and validation

Three executions used the same app binary on a dedicated iPad Pro 11-inch M4
simulator with iOS 18.6 / 22G86, built with Xcode 27.2:

| Execution                           | XCTest             | Result                                             |
| ----------------------------------- | ------------------ | -------------------------------------------------- |
| Original driver                     | 4 passed           | Full runner completed locally                      |
| Replay of the first failing CI drag | 1 passed, 3 failed | Missing native coordinator, then observer failures |
| Corrected native-edge driver        | 4 passed           | Full runner and follow-up checks completed         |

The unmodified local run started the portrait gesture at `x=2`; the native
recognizer reported an edge at `x=0`. The isolated negative control substituted
the exact first CI drag: start `(80.1, 388.4)`, horizontal displacement `613.1`.
It reproduced the first failure and its cascade while the recognizer remained
enabled at `x=0`. This is a controlled coordinate replay, not a claim that the
original timing failure reproduced spontaneously on the local Xcode version.

The corrected driver started at `(2, 655)` in portrait and `(282, 467)` with
the permanent sidebar. Its completed ten-report matrix exercised eight cases;
the two gestures starting from the permanent sidebar were explicitly classified
as **not reproduced**, as permitted by the pre-existing checks. They are not
counted as successful interactive transitions. The portrait gestures exercised
both a committed and a cancelled interactive Back, with the orientation request
timestamp inside the native navigation interval. UIKit deferred the visible
rotation until navigation completed.

The unchanged JavaScript validation completed its identity, history, disposal,
geometry, inactive-stack and modal-result checks, then verified a refusing
guard, subsequent navigation, drawer open/close and absence of late history
changes. All 13 observer/command-log helper tests also passed.

[Local provenance](./evidence/ios-drawer-native-edge-183/local-provenance.json),
[the exact replay patch](./evidence/ios-drawer-native-edge-183/replayed-ci-gesture.patch)
and [archive inventories](./evidence/ios-drawer-native-edge-183/local-artifacts.json)
retain the source hashes, three complete local result archives, XCTest logs,
reports and recordings, including the deliberate failure.

## Hosted validation

The [four-job validation](https://github.com/rafaelaugustos/vue-router-ns/actions/runs/43768273343)
passed on `9f8f0e2236fbe430b6d57496c13d46020ba6a983`, on its first attempt:

| Device         | Suite    | Duration | Result |
| -------------- | -------- | -------- | ------ |
| iPhone 16      | drawer   | 10m26s   | Passed |
| iPhone 16      | adaptive | 12m30s   | Passed |
| iPad Pro 11 M4 | drawer   | 11m14s   | Passed |
| iPad Pro 11 M4 | adaptive | 11m47s   | Passed |

Each basic job completed 18 ordinary and 18 Reduce Motion commands plus native
UI tests. Each adaptive job completed 38 ordinary and 38 Reduce Motion commands
plus native UI tests, retaining the intentional-pop negative control. The iPad
rotation step completed in 137 seconds, inside its unchanged 240-second command
deadline. All four jobs stayed inside their unchanged 20-minute job limits.

All four rotation XCTest methods passed. The unchanged runner validated all ten
reports and completed the follow-up guard/modal/navigation checks. Its outcome
matches the local correction: **eight exercised cases and two explicitly
unreproduced permanent-sidebar gestures**. Both portrait interactive gestures
were observed, one committed and one cancelled, and both orientation requests
occurred during their native transitions. Visible rotation was deferred until
navigation ended; this does not claim simultaneous visible animations.

[Hosted validation](./evidence/ios-drawer-native-edge-183/hosted-validation.json),
[job records](./evidence/ios-drawer-native-edge-183/jobs.json) and
[artifact inventories](./evidence/ios-drawer-native-edge-183/artifacts.json)
retain all four original archives, logs, reports and hashes. No retry or raised
timeout was used to obtain this result.

The ordinary [PR CI](https://github.com/rafaelaugustos/vue-router-ns/actions/runs/43768263185)
also passed on that commit; its separate native aggregate skips device jobs.

## Video

[Actual hosted simulator recording](../docs/public/media/ios-drawer-native-edge-evidence.mp4)
shows the application executing programmatic navigation, the interactive Back
attempts, orientation changes and modal controls. The complete **97.65-second,
985-frame** recording is retained byte for byte, without cuts or overlays.
[Video provenance](./evidence/ios-drawer-native-edge-183/video.json) identifies
the original artifact member and SHA-256. The timestamps and native transition
reports provide the precise timing evidence that the video alone cannot prove.

The physical iPad's earlier three passing UI tests remain additional coverage
on the preceding source. They do not run this simulator-only transition matrix.
The other Android, foldable and window failures tracked by #183 remain separate
stages; this PR does not establish full-matrix acceptance or authorize a release.
