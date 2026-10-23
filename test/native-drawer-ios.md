# iOS drawer validation — #117

2026-10-23. NativeScript Core 9.1.3, iOS runtime 9.1.0 and NativeScript-Vue 3.1.2. The iOS host is library-local: UIKit views, a pan recognizer, scrim tap and native transform/opacity animation. No navigation engine, web renderer, dependency or Core patch was added.

## Ownership and direction

The default content and pane remain mounted. Layout changes remeasure those views; opening and closing only change the pane transform and scrim. Embedded top-level Frame/TabView controllers are attached to the owning UIKit controller, with only attachments made by this host removed during disposal. UIKit keeps its navigation delegate, interactive-pop recognizer and page history.

The recognizer accepts closed-state touches only within 24 points of the start edge. On a pushed page it yields to UIKit Back, including the router's existing active-guard policy. It never converts a drawer gesture into a route push/pop. Ordinary text-field and button touches outside that edge are excluded before pan recognition begins.

The `direction` component prop controls the iOS container's semantic direction; UIKit inherits it through the native view tree. It does not write NativeScript's inherited CSS `direction` to every nested navigation view. During acceptance, doing the latter reproduced a UIKit `UIGestureGraphEdge` assertion (`targetNode`) with native Back enabled, including a control using the old content-only iOS render. Keeping direction on the container removes that failure from this component. Generic inherited-CSS compositions remain tracked in [#139](https://github.com/rafaelaugustos/vue-router-ns/issues/139).

## Automated acceptance

| Device                          | Runtime     | Result                                                                 |
| ------------------------------- | ----------- | ---------------------------------------------------------------------- |
| iPhone 16 simulator             | iOS 18.6    | Both XCTest cases pass; native state contracts pass.                   |
| iPad Pro 11-inch (M4) simulator | iPadOS 18.6 | Both XCTest cases pass; native state and Reduce Motion contracts pass. |

The fixture and reproducible commands are in [`scripts/native/drawer-ios`](../scripts/native/drawer-ios/README.md). XCTest uses real input; the file bridge calls the public component/router API and reads native state. The release/weekly gate includes an independent iPhone/iPad lane; the fast PR check stays lightweight.

| Scenario                 | Evidence                                                                                                                                                                                      |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Methods, binding, events | Initial closed state; open/close/toggle; model changes; repeated open does not duplicate events; rapid open/close/open settles correctly.                                                     |
| Initial open and cleanup | Remount with `open=true`; one host pan recognizer and one child controller after remount.                                                                                                     |
| Geometry and retention   | Width change and RTL preserve the content object; pane width and start-edge coordinates are inspected directly.                                                                               |
| Navigation               | Successful and duplicate destinations close; guarded selection stays open; unit coverage also checks a rejected component load.                                                               |
| Accessibility state      | Covered content is hidden from traversal, pane is modal for accessibility, closed pane is hidden; direct native Escape dispatch closes.                                                       |
| Reduce Motion            | All 18 bridge commands pass on iPad with the actual OS preference enabled; opening is already settled when the command returns. Preference restored afterward.                                |
| Native input             | Keyboard entry/dismissal, reversing and completed opening gestures, scrim dismissal, guarded/native Back, tab selection with retained draft, modal result/layering, RTL opening and rotation. |

The Android regression passed all 13 scenarios on the dedicated API 36 emulator: native Back, guards, independent stacks, RTL, rotation, dialog/sheet precedence, process restoration, keyboard activation and OS deep links. Its existing CI lane is retained.

The unit suite passes with 598 tests and 10 skips. Package/demo type checks, package build, documentation build, formatting and the UI-driver shell checks pass.

## Manual boundaries

Accessibility flags and direct Escape dispatch are not a spoken VoiceOver test. Audible focus movement/restoration, two-finger Escape and physical-device assistive-technology traversal still need a manual pass. The implementation captures the current VoiceOver target, requests pane focus after settling, and restores an attached target on close without stealing focus from a presented modal.

Remount/disposal is automated; a live script-HMR edit and hardware memory profiling were not performed. Reversing a real touch path is covered; arbitrary OS interruptions during a drag are handled by the recognizer cancellation branch but are not all synthesized by this suite.

The [recorded iPhone walkthrough](../docs/public/media/ios-drawer.mp4) shows the actual native fixture: menu gestures, navigation, retained draft/stacks, guards and a modal result. It is also embedded in both documentation languages and linked in the PR.
