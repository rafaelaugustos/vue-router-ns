# Published Core content Back with adaptive rotation — #168

Published Core 9.1.4 includes [NativeScript #11590](https://github.com/NativeScript/NativeScript/pull/11590),
which preserves default Frame content Back. This stage validates that correction
with the current router and adaptive drawer in **maximized iPad windows**,
including actual committed and cancelled landscape-to-portrait Back. It adds strict regression expectations;
router runtime code, delegates and gesture policy are unchanged.

## Native outcome and input phase

The initial iPadOS 26.0 run, using the development multi-scene resources, started every gesture and passed the existing identity
assertions, but all four gesture attempts cancelled. The long permanent-content
drag was still cancelled when a diagnostic observer delayed rotation until 60%
progress. Neither observation meets the requirement for an actual committed pop.
Those reports remain diagnostic evidence.

The final permanent-content controls use two native lifecycle signals:

- **Cancellation:** request rotation after an interactive navigation coordinator
  appears, while the pointer remains down. Require the actual interaction and
  navigation completion callbacks to report cancellation, with the page retained.
- **Commit:** release the long drag, observe UIKit's `interaction-ended` decision,
  then request rotation before `navigation-ended`. Require an actual committed
  interaction and completed pop, with the popped Vue page disposed exactly once.

The committed control therefore covers rotation during the remaining animation
of a gesture-initiated Back, not a promise that an unfinished finger gesture will
survive rotation and commit. The driver records the input phase and timestamps.
No fixed delay is used as proof of an active transition. The existing observer
and router remain unchanged; XCTest supplies real input and reads simulator files
without an intervening app-idle query.

All active scenarios still require a rotation request between native navigation
start and completion. The separate same-coordinator check classifies actual
visual overlap, deferral and unconfirmed overlap. A long portrait-to-landscape
drag continues to record UIKit's actual result rather than assume it committed.

## Acceptance matrix and provenance

The final local runs use test revision `fb4b93fe7535e72fda39339177a54494ffc6f84e`,
Xcode 27.2 / 27B52 and Node 20.19.4 on iPad Pro 11-inch M4 simulators.
All listed test/fixture hashes match that revision; the working-tree differences
were the report, documentation and evidence being assembled. See
[acceptance.json](./evidence/published-content-back-168/acceptance.json) for exact
packages, devices, source/dist/Core hashes, geometry, timing and archive hashes.

| iPadOS        | XCTest methods | Scenarios exercised | Missing inset gestures | Visual classification            |
| ------------- | -------------- | ------------------- | ---------------------- | -------------------------------- |
| 18.6 / 22G86  | 4 passed       | 8                   | 2, known boundary      | 6 deferred, 2 settled            |
| 26.0 / 23A343 | 4 passed       | 10                  | 0                      | 1 overlap, 7 deferred, 2 settled |
| 26.2 / 23C54  | 4 passed       | 10                  | 0                      | 1 overlap, 7 deferred, 2 settled |
| 27.0 / 24A434 | 4 passed       | 10                  | 0                      | 8 deferred, 2 settled            |

This is **38 exercised scenarios plus two explicitly missing gestures**, not 40
passing interactive cases. Each 26+ run includes an actual committed and an
actual cancelled inset Back. In those six cases, UIKit deferred visual rotation
until after navigation ended, despite receiving the orientation request during
navigation. For example, on 26.2 the commit request came 3.934 ms after the
interaction decision and 420.066 ms before navigation ended; cancellation was
requested 599.016 ms before the interaction decision and 1027.016 ms before
navigation ended. These are measured ordering examples, not timing constants.

The focused hosted iPadOS 26.2 validation is running at
[43842630376](https://github.com/rafaelaugustos/vue-router-ns/actions/runs/43842630376).
Its result will be recorded before this PR is described as merge-ready. A
preceding run, [43840048613](https://github.com/rafaelaugustos/vue-router-ns/actions/runs/43840048613),
was cancelled after stalling before XCTest; its artifact contains provenance only
and counts as no native coverage. The driver now reuses the already-resolved app
container, bounds simulator commands and recording shutdown, and logs preparation
milestones. These host-process changes do not alter gestures or native assertions.

Each run uses Core 9.1.4, NativeScript-Vue 3.1.3 and iOS runtime 9.1.0. The fixture
aliases the current checkout's built `dist`; this is not npm registry-consumer or
release-artifact acceptance. The provenance includes the source revision/dirty
state, test-source hashes, all built router files, installed Core files, tool
versions and the XCTest summary. Core source is compared with the official npm
9.1.4 tarball: all 1,362 files must match, excluding package installation metadata.

The default-resource acceptance uses the published blank TypeScript template's
App_Resources: one scene, `UIRequiresFullScreen=true`, and all iPad orientations. Earlier local
runs used copied development resources with multi-scene support enabled and
UIRequiresFullScreen disabled. Those runs passed the same outcomes but are
retained separately; they do not certify Stage Manager or multiple-window use.
The Info.plist configurations are retained with the local evidence. Earlier runs
at `5d7e9cc` are indexed separately in
[local-validation.json](./evidence/published-content-back-168/local-validation.json)
and do not add to the final acceptance counts.

## iPadOS 26.2 window precondition and negative controls

The first [hosted run](https://github.com/rafaelaugustos/vue-router-ns/actions/runs/43833636394)
failed the strict gate: both inset gestures produced no interactive coordinator.
The same behavior reproduced locally, so it was not classified as a CI-only
failure. The app was in a reduced window, even though its Info.plist requested
full screen. Apple's [UIRequiresFullScreen documentation](https://developer.apple.com/documentation/bundleresources/information-property-list/uirequiresfullscreen)
explains that this compatibility setting may scale an iPad scene rather than
present it full screen. The app's virtual coordinates and XCTest's displayed
window bounds differed.

The investigation retained these controls in
[window-diagnostics.zip](./evidence/published-content-back-168/window-diagnostics.zip):

- Ten plain UIKit controls on 26.2 matched their expected outcomes. The isolated
  Core fixture stopped at its full-width geometry assertion **before** a gesture;
  it is not counted as a Core Back pass or failure.
- Converting coordinates, mapping the displayed window, changing only
  `UIRequiresFullScreen`, and directing screen-coordinate input through
  SpringBoard did not establish supported reduced-window input. Some probes
  also lost the portrait gesture. Those changes were reverted.
- Keeping the original observer/input and maximizing the app with the system's
  normal **Window Controls → Zoom** action produced all ten passing scenarios.
  The first successful control changed the portrait window from
  `(41, 58, 754, 1095)` to `(0, 0, 834, 1210)` before navigation testing.

The final suite establishes that full-window precondition before its first case
and verifies it before every gesture. `window-setup.json` records the initial and
final geometry and whether Zoom was needed. It does not change navigation or
gesture delegates, inject a pop, alter system multitasking preferences, retry a
failed gesture, or accept missing 26+ gestures. A reduced-window run is **not**
certified by a subsequent maximized-window pass. The remaining reduced-window
input cause is unproven and remains outside this acceptance; keep an explicit
native Back action there. This evidence does not establish a router defect.

## Assertions and regression policy

Each complete run has four XCTest methods covering ten scenarios: four
programmatic push/Back cases, four gestures and two settled/modal controls. The
host checks retained Frame/Page/native-view/Vue identities and drafts, matching
logical/native entry IDs, controller membership, inactive stack state, disposal
counts, promise settlement, drawer geometry/accessibility flags and no stuck
busy state. Follow-up navigation, a rejecting guard, drawer opening/closing and
exactly-once modal-result settlement must still work. Late history changes fail.

On iPadOS 26+, within the required maximized window, the permanent-content cases now require **both actual outcomes**
and the documented input phases. A missing gesture fails. Only the two inset
content-edge cases on iPadOS 18.6 may remain `gesture-not-reproduced`; their
histories and identities must stay unchanged. They never count as passing
interactive-rotation coverage. Keep an explicit native Back action available.

Eleven retained acceptance controls exercise the real reports and reject an actual
cancel presented as commit, a missing supported gesture, a noninteractive pop,
a late orientation request and an incorrect input phase. The initial and 60%
progress probes both fail the new committed-outcome gate as intended.

The full [Native iOS drawer workflow](../.github/workflows/native-drawer-ios.yml)
now requires an iPadOS 26.2 job in addition to its existing iOS 18.6 rows. Manual
`scope=content-back` runs only that new job. It is not a complete native matrix;
ordinary pull-request device-job policy is unchanged. See the
[driver instructions](../scripts/native/adaptive-drawer/README.md#rotation-during-active-navigation).

## Recording and disposition

[Watch the actual iPadOS 26.2 simulator recording](../docs/public/media/published-content-back-168.mp4).
It shows the maximized fixture navigating and rotating through push/Back,
committed/cancelled gestures, the retained draft and modal control. The full
46.501667-second recording contains 2,223 frames; all presentation timestamps
and the final frame duration match the original. It was resized to 720 × 1044
and encoded as H.264 without cuts or retiming. Simulator orientation is retained.
[Video provenance](./evidence/published-content-back-168/video.json) records the
source run and SHA-256 hashes. The native event reports establish the exact
outcomes and timing; the video alone is not a timing oracle.

This stage addresses #168's default-Frame permanent-content Back gap in the
original full-window scenario
with published Core. The [Core 9.1.3 investigation](./native-back-content-edge.md)
and [original rotation report](./native-drawer-rotation.md) remain historical.
Broader #167 acceptance is separate, including its other scenarios and limits.
Physical devices, Stage Manager, external displays, arbitrary custom hosts and
custom transition animators are outside this acceptance. No experimental API is
promoted and no release is authorized.
