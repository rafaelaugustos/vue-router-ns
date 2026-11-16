# Native matrix recovery — 2026-11-16

The [scheduled run](https://github.com/rafaelaugustos/vue-router-ns/actions/runs/43876092862) at `8947014` exposed several independent failures. Passing the earlier focused rotation workflow did not establish that the full matrix was healthy.

| Job                                                       | Evidence                                                                                                                                                       | Change                                                                                                                                                                                                       |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| UIKit iPad, `133329842201`                                | UIKit navigation passed; all 34 incoming-destination reports passed. Spotlight was explicitly skipped. The 25-minute job limit expired during artifact upload. | Give the iPad 35 minutes for its two builds and suites; retain 25 minutes for iPhone. Add a `uikit-split` dispatch scope.                                                                                    |
| Predictive Android 35/36, `133329843646` / `133329843587` | A read-only SystemUI dump exited 255 with partial output. At the same time, logcat recorded ADB disconnecting and reconnecting.                                | Permit one bounded diagnostic reread after verifying device boot identity and SystemUI/app PIDs. Preserve failure and recovery receipts.                                                                     |
| Rotation iOS 26.2, `133329843056`                         | Programmatic overlap passed. The default profile failed because `cancel-portrait` actually committed its navigation.                                           | Shorten only that inset cancellation input from 12% to 4% of the recognizer width, and reduce its stationary hold from 0.3s to 0.1s. Require the original native cancellation and request-timing assertions. |
| UIKit iPhone, direction iPad, rotation iOS 18.6           | GitHub reported that the jobs could not acquire a hosted runner after multiple attempts.                                                                       | No acceptance claim for these cancelled jobs. Runner availability is separate from the code changes.                                                                                                         |

The cause of the ADB transport disconnect itself is not established. The Android change handles an interrupted diagnostic; it does not claim to fix an emulator or application crash. A reboot, SystemUI restart, fixture restart/death, timeout, unrelated command failure or second failed read still fails the test. The total read/recovery deadline is 15 seconds. No gesture, app launch or Activity command is replayed.

## Validation

Executable revision: `9ba1c7c606a0430beb213a02c6254621761ab717`.

- 995 unit tests passed, 10 skipped; 43 native harness tests passed, including 15 diagnostic recovery controls. Package build and typecheck passed.
- Checked all 160 event/scope/job combinations for the workflow selectors, including PR skips, scheduled runs, `direction` and `uikit-split`.
- Local iOS 26.2 and 18.6: four XCTest methods passed per OS, followed by the existing native report assertions. All eight recorded native source hashes match the executable revision. On 26.2 both cancel gestures ended with native cancellation and both commit gestures completed. On 18.6 the two inset gestures remain explicitly **not reproduced**.
- Local Android 36 arm64 with released Core 9.1.4: all 15 legacy-mode reports passed. Two controlled real ADB interruptions produced exit 255 and recovered with the same boot/SystemUI/app identities. The fixture report remained byte-for-byte unchanged. This local check is not acceptance of the experimental Core predictive-back candidate.
- A longer, slower cancellation drag was tested and rejected: it still committed. The shorter inset input passed three local trials before/finalizing its scope; acceptance was never changed to allow a commit in that case.

Hosted validation is in progress: [predictive Android 34/35/36](https://github.com/rafaelaugustos/vue-router-ns/actions/runs/43886726293), [UIKit iPad/iPhone](https://github.com/rafaelaugustos/vue-router-ns/actions/runs/43886738405), and [rotation 18.6/26.2](https://github.com/rafaelaugustos/vue-router-ns/actions/runs/43887187146). The Android/UIKit runs use `b2af1f2`; their executable sources are unchanged in `9ba1c7c`. The rotation run uses `9ba1c7c`. Pending hosted jobs are not passing evidence.

The Android workflow now includes `verify-system-ui-recovery.mjs` after its positive legacy controls. It disconnects only the selected emulator's ADB transport during the dump and requires a real partial-read failure, identity verification and an unchanged fixture report. It cannot pass if no interruption occurred.

## Recordings and receipts

- [iOS 26.2 application recording](../docs/public/media/native-cancellation-recovery.mp4): complete default-profile run, including commit/cancel, both orientations, retained stacks and modal control. All 2,621 frames, presentation timestamps and the 56.695-second duration are preserved; only size/encoding changed.
- [Android application recording](../docs/public/media/native-adb-read-recovery.mp4): the actual fixture stays on `/detail` during the first deliberate ADB interruption and recovery. The screen is intentionally unchanged; the corresponding `fault.zip` receipts establish the diagnostic failure and process/state checks.
- [Validation and archived raw JSON](evidence/native-matrix-recovery/validation.json), [video provenance](evidence/native-matrix-recovery/video.json), `final26.zip`, `final18.zip`, `local-legacy.zip`, `fault.zip` and `committed-probe.zip` in the same directory.

Visual rotation remains deferred until native gesture navigation ends. This work does not establish gesture/rotation overlap or close #167. The full scheduled matrix still needs a subsequent successful run; focused checks do not replace it.
