# iPad rotation requested during navigation — #167

## Scope and method

The opt-in adaptive drawer fixture uses published NativeScript Core 9.1.3, NativeScript-Vue 3.1.2 and iOS runtime 9.1.0. It keeps two warm named stacks with different draft values. No production router API, navigation delegate or gesture rule is changed. The observer is an additional empty child controller in the fixture, not a replacement for any existing controller.

The simulator-only XCTest companion reads a file signal from an actual UIKit navigation coordinator, then requests device orientation without an intervening app query. This avoids XCTest silently waiting for the navigation to finish before requesting rotation. For a swipe, a background reader signals the main-thread orientation action while XCTest synthesizes the pointer drag. The test rejects orientation requests made after native navigation completion.

A rotation request during navigation and overlapping native transitions are reported separately. The observer records the real `viewWillTransition` callback, whether navigation completion is still pending, and whether the same navigation coordinator is still current. It never accesses a completed coordinator's invalidated context. `rotation-summary.json` distinguishes overlap, deferred rotation, unconfirmed overlap, settled controls and gestures that were not reproduced. A pending completion callback without the same current coordinator is classified as unconfirmed, never silently counted as overlap or deferral. Fixed waits are only bounded settlement/timeouts, never proof of overlap.

## Native evidence

Dedicated iPad Pro 11-inch M4 simulators, iPadOS 18.6 and 26.0. Ten scenarios are attempted per OS: push and programmatic Back in both rotation directions; intended commit/cancel swipes in both directions; a settled control; and a pending-modal control.

- iPadOS 18.6: all four programmatic cases requested orientation while navigation was active; UIKit deferred the visual rotation until after navigation completion. Portrait-to-landscape swipes also deferred rotation: the long swipe committed, the short swipe cancelled.
- iPadOS 26.0: the final current-coordinator check also observed deferred rotation in all exercised active cases; programmatic navigation and both portrait-to-landscape swipe attempts retained coherent state. Both swipe attempts were cancelled by UIKit, including the long intended-commit drag. Gesture intent is not substituted for UIKit's actual result.
- On both OS versions, the two landscape-to-portrait swipe cases did not begin interactive navigation from the permanent content edge. The recognizer was enabled and its native view geometry was recorded. These are **not reproduced**, not passing rotation-during-gesture cases. [Issue #168](https://github.com/rafaelaugustos/vue-router-ns/issues/168) tracks input/containment isolation and the missing coverage.

Eight rotation cases are exercised and two gesture cases remain unproven on each OS. The pending modal remains pending across rotation and resolves once on an explicit Back. The original 38 adaptive bridge contracts also pass on iPadOS 18.6 with the expanded fixture.

### Final-run event ordering

Measured milliseconds from the final runs, not timing guarantees. “Request after start” is positive and precedes native completion in every row. “Rotation after completion” is positive; no same-coordinator overlap was observed. Scenario suffixes name the target orientation.

| iPadOS | Scenario              | Request after native start (ms) | Rotation after native completion (ms) | Native outcome |
| ------ | --------------------- | ------------------------------- | ------------------------------------- | -------------- |
| 18.6   | push-device-landscape | 4.9                             | 37                                    | committed      |
| 18.6   | back-device-portrait  | 2.1                             | 36                                    | committed      |
| 18.6   | push-device-portrait  | 4.0                             | 33                                    | committed      |
| 18.6   | back-device-landscape | 2.2                             | 28                                    | committed      |
| 18.6   | commit-landscape      | 5.2                             | 30                                    | committed      |
| 18.6   | cancel-landscape      | 5.0                             | 33                                    | cancelled      |
| 26.0   | push-device-landscape | 6.4                             | 100                                   | committed      |
| 26.0   | back-device-portrait  | 7.6                             | 73                                    | committed      |
| 26.0   | push-device-portrait  | 3.2                             | 40                                    | committed      |
| 26.0   | back-device-landscape | 6.0                             | 65                                    | committed      |
| 26.0   | commit-landscape      | 2.4                             | 22                                    | cancelled      |
| 26.0   | cancel-landscape      | 7.1                             | 19                                    | cancelled      |

## State assertions

For every exercised case, the driver checks surviving Frame/Page/native-view/Vue identities; matching native-controller and Frame page lists; retained logical entry IDs; agreement between native and logical histories; unchanged inactive stack and draft values; selected stack; drawer mode and actual content/pane bounds; accessibility visibility flags; and no busy stack or diagnostic issue after settlement. A committed pop disposes its Vue page exactly once; cancellation keeps it alive. Push/Back promises settle once. Follow-up push, rejecting guard, successful Back and drawer open/close remain usable, and a later snapshot rejects late history changes.

The missing-gesture cases independently assert unchanged Frames, pages, Vue instances, drafts and histories. They do not issue a substitute programmatic pop and count it as a gesture. A normal Back is used only afterwards to clean up the attempted case.

## Reproduction and boundaries

See [the native driver instructions](../scripts/native/adaptive-drawer/README.md#rotation-during-active-navigation). Reports, XCTest attachments and optional real simulator video are saved in the chosen output directory. The full iPad native lane runs the probe; the fast PR gate gains no simulator job.

These results do not guarantee that all iPadOS versions run rotation and navigation animations simultaneously, or that a swipe survives rotation with its original intended outcome. Physical iPads, Stage Manager/freeform windows and spoken VoiceOver are not validated here. Reduce Motion is covered separately by the existing adaptive lane and is not substituted for the animated timing checks. The inherited CSS-direction crash in #139 is outside this probe; it uses the supported RouterDrawer direction property and no unpublished Core patch.
