# Adaptive RouterDrawer validation — #134

2026-10-23. NativeScript Core 9.1.3, NativeScript-Vue 3.1.2, iOS runtime 9.1.0 and Android runtime 9.1.1.

## Architecture and public contract

`presentation="overlay|permanent|auto"` keeps one host and the same content/pane children. `auto` resolves against the container's available width, with an opt-in 840-DIP default breakpoint. No Frame/Page reparenting, route migration, navigation delegate replacement or stack restoration is used to change mode.

On Android the existing AndroidX DrawerLayout converts the pane's layout parameters between a start-edge drawer and an ordinary content child. Before conversion, it closes at the endpoint and locks there, cancelling the pending ViewDragHelper settle. A permanent pane therefore has no modal scrim/interception, accessibility isolation or system-Back claim. On iOS, the existing UIKit host lays out both children beside each other, cancels animations and disables its drawer pan recognizer. Controller containment remains unchanged.

`isOpen`/`v-model:open` describe overlay openness. Permanent visibility always has `isOpen=false`; returning to overlay starts closed. A settled overlay closes once when entering permanent presentation. Interrupted opening has no late `opened` callback. `presentationChange` reports resolved changes separately from open/close events. Mode changes do not run guards or settle pending navigation results.

The shared geometry uses the existing optional WindowManager observer, including window-local offsets and RTL. Permanent vertical panes exclude the separating/occluding feature; horizontal hinges put both panes beside each other in the larger usable segment. Overlay keeps its existing full-container behavior. Fold geometry does not override the auto breakpoint.

## Native evidence

Reproduction: [`scripts/native/adaptive-drawer`](../scripts/native/adaptive-drawer/README.md). Generated reports are retained under `scripts/native/out` and uploaded by the full CI workflows.

| Environment                         | Evidence                                                                                                                                         |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| iPhone 16, iOS 18.6                 | 38 bridge commands; all three XCTest gesture/input/rotation cases pass.                                                                          |
| iPad Pro 11-inch M4, iPadOS 18.6    | 38 bridge commands, repeated with UIKit Reduce Motion enabled; all three XCTest cases pass, including actual portrait/landscape auto adaptation. |
| Android API 36 phone emulator       | 38 bridge commands; UIAutomator plus real input verifies both regions, draft/stack retention, RTL and system Back.                               |
| Pixel Fold profile, API 36 emulator | 38 bridge commands; six hinge/posture checkpoints with the actual WindowManager provider pass.                                                   |

The bridge warms two independent named stacks, pushes a detail page in each, changes modes repeatedly beneath a pending route modal, resolves that result, switches RTL, interrupts an opening animation, resizes the actual parent container and exercises a refusing guard. It compares native Frame and Page identity, Vue state object identity, logical/native entry IDs, drafts and diagnostics issues. Modal coverage naturally changes `active`; identity comparisons deliberately retain all other logical fields. Retention additionally requires live Vue instances and Pages still resident in their real Frames; an intentional final Back is a negative control that must invalidate both page retention and entry equality.

Native input tests prove that the persistent pane does not intercept content touches. They type into a real TextField, switch tabs/modes, check the retained text, navigate through menu buttons, open/return a native modal and inspect accessibility reachability. The Android Back key returns from the detail page while the persistent pane stays visible.

The hinge driver reads native FoldingFeature bounds delivered by AndroidX, compares both layout rectangles against the occluding strip, and verifies unchanged identities/history at every checkpoint. Coverage includes open and half-open postures, RTL, a horizontal hinge below a modal, and unsubscribing/re-enabling fold awareness. The display feature is configured in the emulator's platform provider, not injected into the library.

## Automated checks and release gate

- 607 unit tests pass, 10 skipped. New tests cover geometry/breakpoints, fold exclusion, mode events, initial model normalization, modal results and observer disposal.
- Package and demo type checks, package build, documentation build, formatting and UI-driver shell checks pass.
- The full iOS drawer lane now includes adaptive contracts/input and Reduce Motion; the existing Android foldable lane includes adaptive contracts, real input and hinge checks. The fast PR gate remains unchanged.
- The [24-second iPad recording](../docs/public/media/adaptive-drawer.mp4) shows the actual fixture: typed draft, persistent/overlay presentations, retained tabs, RTL and a modal result. Both documentation languages embed it.

## Manual boundaries

Accessibility flags and XCTest/UIAutomator reachability are automated evidence, not a spoken VoiceOver/TalkBack certification. Audible focus announcements, switch-control/hardware-keyboard traversal and the physical two-finger Escape gesture still need a manual pass. The existing overlay Escape behavior is retained; permanent mode does not consume it.

Real parent-container resizing and rotation are tested; Stage Manager, freeform desktop windows and physical foldable hardware were not exercised. Safe-area and keyboard layouts are covered on the listed simulator configurations, not every device/inset combination. Observer disposal is unit-tested and fold subscriptions are toggled on-device; live script HMR and long-running native memory profiling remain manual. These boundaries should remain visible when reviewing #134 rather than being inferred from green automated checks.
