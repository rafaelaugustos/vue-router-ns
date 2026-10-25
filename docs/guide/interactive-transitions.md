# Interactive transitions: ownership and limits

An interactive gesture is not just an animation with a progress value. The native host decides which controllers or pages participate, whether the gesture can start, when it commits, and when those pages can be disposed. The router must keep its history, guards and result promises consistent with that decision.

This rc.3 investigation does **not** add a uniform interactive-transition API. It documents the published baseline (NativeScript Core 9.1.3, NativeScript-Vue 3.1.2, iOS runtime 9.1.0 and Android runtime 9.1.1) and separates it from experimental upstream work.

<Clip name="interactive-transitions" aspect="402 / 874" caption="Actual iOS 26 simulator: reversed and committed gestures, zoom, guards and source removal." />

## Capability matrix

| Surface                                     | Owner and progress                                                                                  | Commit/cancel                                                         | Router integration and limits                                                                                                                                                          |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Programmatic `push` / `back`                | Core Frame or the selected native host owns the transition; `transition` selects its animation      | No public seek/reverse handle                                         | Guards run before router navigation. Await navigation completion; do not interpret a diagnostics duration as gesture progress.                                                         |
| iOS Frame edge Back                         | UIKit navigation controller owns the interactive transition                                         | UIKit decides from the real gesture                                   | Router reconciles committed native history. Active page leave guards hold the gesture before it starts. `useBackGesture()` is `null` on iOS.                                           |
| iOS 18+ `zoomFrom`                          | UIKit `preferredTransition`, when exposed by the runtime                                            | UIKit controls zoom and interactive dismissal                         | The router supplies a weak source view and a synchronous admission predicate. A missing/unloaded source returns `nil`. An explicit Frame default transition can override zoom.         |
| Core `SharedTransition` interactive dismiss | Core's iOS shared-transition implementation owns its recognizer/animator                            | A native pop; no router-owned reversible session                      | A leave guard cannot veto this dismissal. Do not use it for an unsaved-edit flow that depends on that guard. Shared elements on Android do not imply equivalent interactive dismissal. |
| Android 14+ predictive Back                 | AndroidX callback provides progress; the router's default preview presents the previous native Page | Cancel resets presentation; release runs router Back and guards       | `useBackGesture()` observes progress. It does not acquire ownership of the history or a native Fragment transaction. Root/modal-root and guarded-page behavior differ.                 |
| Experimental Android Core preview           | Proposed version-1 Frame `beginBackPreview` session                                                 | Presentation-only `update/cancel/finish/dispose`; `finish` never pops | Requires the pinned candidate below. Published Core falls back to the existing preview. Not an AndroidX FragmentManager predictive-pop implementation.                                 |
| UIKit split / custom hosts                  | Each host owns its controllers and lifecycle                                                        | Depends on that host                                                  | Frame evidence does not establish parity for split columns, multiple windows or third-party hosts.                                                                                     |

See [zoom/shared elements](./transitions), [Android Back](./android-back), [guards](./guards) and [native hosts](./native-hosts) for the supported APIs.

## Observation is not control

Android's progress callbacks can drive page-owned decorative UI. They do not authorize calling `popBackStack`, disposing a page or resolving a modal result. With `backPreview: false`, the app can animate its own content from `useBackGesture()`; it still delegates navigation to the router.

UIKit's transition coordinator exposes interaction/completion context. The investigation fixture samples it and attaches completion observers without replacing the navigation controller delegate or gesture recognizer. `percentComplete` is **not** a documented cross-platform, continuously sampled progress contract: Apple's description ties it to the transition into its noninteractive phase. A future observer needs an explicit availability model, not fabricated `0…1` values on every host.

The Android Frame implementation uses its own entry history and Fragment replacement; it does not establish a FragmentManager back stack. Adding `addToBackStack` solely to obtain AndroidX seeking would change replace, clear-history, modal and recreation contracts. That is upstream architecture work, not an animation-library adapter.

## Guard and lifecycle ordering

1. A page leave guard's active state must be known **before** native iOS dismissal starts. An asynchronous question cannot retroactively hold a gesture UIKit already owns. Use the guarded native Back button or router Back to ask the user.
2. Android suppresses the preview while a page leave guard is active. Global/asynchronous guards can still reject the navigation after release; the preview must restore presentation.
3. A cancelled gesture retains the entry, Page and pending result. A completed pop removes the entry and settles its result once. A cancellation must not be represented as a temporary pop followed by a second push.
4. New navigation, host unloading, changed top/target, and source removal invalidate assumptions made at gesture start. Completion callbacks must verify the original entry/session before mutating anything.
5. A native modal's dismissal and an inner Frame's pop are different operations. Popping the inner detail must not settle the modal result or alter the presenting stack.

SharedTransition's interactive-dismiss limitation remains explicit. Global guards are not a blanket promise to veto arbitrary native UIKit transitions.

## Decision and possible adapter boundary

Keep the existing APIs for rc.3. Do not introduce `router.transition.progress`, `seek()` or a universal `cancel()` method from this evidence.

A future **host capability** proposal should distinguish:

- **Observation:** optional progress, interaction-ended and native-completion notifications, each tagged with host/window, entry identity and a session ID. Unknown progress remains unavailable. Completion must distinguish commit, cancel and interruption.
- **Presentation control:** an optional, versioned session owned by a host. It may update/cancel/finish presentation, but never mutate router history. Admission is synchronous; guards/history/results remain router-owned.
- **Cleanup:** one terminal outcome; dispose listeners/temporary native views on host unload, entry replacement, cancellation or failed admission. A stale callback cannot pop a newer entry. Subscribe only while needed; avoid a permanent JS frame loop in the shipping router.
- **Fallback:** ordinary native navigation when a host/runtime cannot provide the contract, with no promise of visual parity. Reduce Motion suppresses optional transforms while preserving the same navigation/results.

An optional Jolt adapter could animate app-owned decoration or implement an explicitly supported presentation session. It must not take over UIKit's delegate, treat an Android preview as a Fragment seek, or become a runtime dependency. Adapter implementation is deferred until host capabilities and disposal are demonstrated.

## Evidence and upstream status

The opt-in iOS fixture and Android runner live in [`scripts/native/transitions`](https://github.com/rafaelaugustos/vue-router-ns/tree/main/scripts/native/transitions). The [validation report](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-interactive-transitions.md) identifies versions, scenarios and gaps. These are native simulator/emulator checks, not physical-device performance results.

The Core proposal [NativeScript #11558](https://github.com/NativeScript/NativeScript/pull/11558) was still open and unmerged when checked on 2026-10-24. Its pinned candidate is `fadb58f034e403933028f86746280375ea9811ff`; this work does not change the demo's published dependencies. Existing [candidate evidence](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-predictive-back.md) covers a separate API 34/35/36 matrix and a Frame recreation fix. It must not be described as shipped Core behavior.

Reduce Motion is read at navigation/gesture admission (`motion: 'system'`, `'reduced'` or `'full'`). Native controls remain the accessible alternative to gestures. Automated input and accessibility labels do not establish VoiceOver/TalkBack speech, focus restoration with assistive technology, or acceptable motion on physical devices.

## Primary references

- [Apple: zoom interaction admission](https://developer.apple.com/documentation/uikit/uiviewcontroller/transition/zoomoptions/interactioncontext)
- [Apple: coordinator percentage semantics](https://developer.apple.com/documentation/uikit/uiviewcontrollertransitioncoordinatorcontext/percentcomplete)
- [Android: progress callbacks and custom animations](https://developer.android.com/guide/navigation/custom-back/support-animations-views)
- [Android: Fragment transition requirements](https://developer.android.com/guide/fragments/animate)

[Host capability follow-up #145](https://github.com/rafaelaugustos/vue-router-ns/issues/145) remains outside the rc.3 release gate.

## Observation proposal v0

[The #145 proposal and prototype](https://github.com/rafaelaugustos/vue-router-ns/tree/main/research/transition-observation) observe ordinary UIKit Back without replacing delegates or polling. Native cancellation/commit and unsubscribe/current-replacement controls have recorded evidence, while entry identity mapping, modal inner Back and several lifetime/host cases remain gaps. The decision is to keep it in research: there is no new public observer, continuous progress promise or Jolt adapter. See [the native report](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-transition-observation.md).
