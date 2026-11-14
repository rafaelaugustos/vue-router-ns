# Native cross-window iPad drop — #181 stage 2

Validated from PR204 merge `8c4aeb0` plus this implementation. The
[source hashes](./evidence/window-drop-stage2/sources.json) identify the helper,
shared policy/bridge, fixture, driver and recording. The package runtime and the
stage 1 drag/drop policy/bridge are unchanged.

The [window recipe](../examples/drag-drop/windows.md) attaches a drop view to the
explicit receiving router/account/window/Frame registration. The Library and Inbox
are separate native scenes, each with its own NativeScript-Vue app and router.
Both intentionally name their Frame `main`. Source session metadata supplies
provenance for assertions; it does not select or authorize the receiver.

## Native evidence

Dedicated iPad Pro 13-inch M4 simulator, iOS 18.6, Core 9.1.4,
NativeScript-Vue 3.1.3 and iOS runtime 9.1.0, without dependency patches. See the
[environment](./evidence/window-drop-stage2/environment.json),
[19 native reports](./evidence/window-drop-stage2/ios18.json) and
[reproduction steps](../scripts/native/window-drop/README.md).

A separate app button requests Inbox with public UIKit standard placement and the
actual requesting Library scene. XCTest asserts that the two native window
rectangles are visible and disjoint before each cross-window drag. UIKit chooses
the split ratio. This is native Split View, not two fake panes in one window.

| Action                          | Verified result                                                                                                                                                                                                |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Valid native drag A → B         | Async provider data opens `/documents/7` only in B through its normal guard.                                                                                                                                   |
| Captured-request replay         | App replay control gets `repeat`, with no additional navigation.                                                                                                                                               |
| New native drag                 | Fresh delivery id, ordinary duplicated-navigation failure, unchanged histories.                                                                                                                                |
| Target guard refusal            | Data transfers, but the guard keeps Inbox at its root and Library unchanged.                                                                                                                                   |
| Account changes during loading  | Target scope changes while the provider is pending; `owner-changed`, no navigation.                                                                                                                            |
| Document removed during loading | A controlled content-permission flag is revoked while loading; the route still exists, but `unauthorized` prevents navigation.                                                                                 |
| Cancel in Library               | Native cancellation loads no provider and preserves both windows.                                                                                                                                              |
| Ordinary native button          | The descriptive accessibility-tree button is tapped and opens B through the same policy with source `internal`.                                                                                                |
| Close B during loading          | The actual receiving native window closes, its registration/policy disposes, and the request returns `disposed`. No fallback navigation or replacement window appears after waiting beyond the provider delay. |
| Cleanup                         | Only Library remains, with its exact original Page and draft; interactions are removed.                                                                                                                        |

Six real gestures cross windows and one cancels in the source. Native interactions
own the drag preview, session delegates and asynchronous provider delivery. No
fixture command directly invokes these delegates. Fourteen explicit JavaScript
collections run between callbacks, retaining the stage 1 session-identity check.

Every report compares native/logical histories and records distinct source/target
window and scene ids. Only B's document guard runs; A's document guard count stays
zero. While both windows are live, their exact root Pages and independent drafts
remain intact. The closed target's final snapshot is explicitly captured **before
closure**. It is not evidence that a destroyed Page remains mounted.

[Actual native video](../docs/public/media/drag-drop-windows.mp4) shows the real
window creation, drag previews, navigation, rejections, command and target closure.
The 92.49-second export preserves all 2,784 source frames and their relative
timestamps while scaling to 1032 × 1376, with no cuts or speed changes. The last
decoded frame shows `PASS prepare-clear`. See
[video metadata](./evidence/window-drop-stage2/video.json). Original recording,
XCTest results and logs remain in ignored `scripts/native/out/windowdrop181-first/`.

## Validation and scope

- **912 tests pass**, with 10 existing skips. Three new multi-owner cases extend
  the policy suite to 23 cases: identical Frame/delivery names in independent
  routers, wrong-window rejection, closure without fallback, and content permission
  revoked after asynchronous delivery. The final stricter wrong-window assertion
  also passes in the focused suite.
- Runtime/fixture typechecks, package/iOS builds, driver syntax and formatting pass.
  No packaged runtime changed; previous packed-consumer checks are not rerun or
  claimed for this stage.
- Four-locale guide parity/build and browser checks cover the new anchor, language
  links, narrow layout, search, video playback and reduced motion. The general
  documentation browser suite also passes.

This stage covers existing windows in the **same process/application**, on one
simulator configuration. The creation button is setup, not creating a window by
dragging. Placement is an OS preference, not a fixed layout API. Physical iPad,
Stage Manager, external-app/cross-process transfers, sidebar targets, Android,
VoiceOver speech and creating a new window by dragging remain outside the claim.
The button is inspected through the native accessibility tree and tapped; stage 1
separately records a keyboard alternative. Neither is a screen-reader session.

Account/content changes are controlled fixture policy changes, not an identity
provider or a live backend. Normal guards still own authentication and must
reauthorize through asynchronous work. This stage does not compose a login UI.
Closing the receiver invalidates provider waits before navigation starts; it does
not cancel already-running guards or roll back committed navigation. Its close
case concerns the visible receiver after a real drop, not arbitrary background
scene destruction or a full multi-window lifecycle matrix.

#181 remains open for the remaining platform and accessibility work.
