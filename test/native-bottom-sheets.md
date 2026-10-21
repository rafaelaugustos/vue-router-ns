# Android bottom sheet validation — #52

2026-10-16, NativeScript Android runtime 9.1.1, NativeScript-Vue 3.1.2, `com.google.android.material` 1.8.0 from the runtime's debug dependency. Medium Phone emulator, Android 16 / API 36, gesture navigation. The demo's compose route presented with `modal.android.sheet = { peekHeight: 360, state: 'expanded', skipCollapsed: true, height: 520 }`.

| Check                                 | Result                                                                                                                                                            |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native class                          | `uiautomator` hierarchy shows Material's `coordinator`, `touch_outside` and `design_bottom_sheet` wrapping the route's Frame; the sheet height matched `height`.  |
| Keyboard                              | Tapping the body field opened the IME over the sheet; the sheet, its ActionBar and the subject field stayed in place.                                             |
| Dirty draft, back                     | With text typed, back showed the page's "Discard draft?" guard. "Keep editing" kept the sheet; "Discard" closed it.                                               |
| Dirty draft, outside tap              | A tap on the dimmed area asked the guard, including a second time after a first refusal. This exposed and fixed a stale in-flight token after refused guards.     |
| Clean sheet, outside tap              | Closed through the router.                                                                                                                                        |
| Drag                                  | A slow 76 dp drag released snapped back to expanded. A long drag and a fast short fling hid the sheet, which Material treats as a dismissal with `skipCollapsed`. |
| Two pages                             | A temporary action pushed `/settings` inside the sheet (trail `/compose › /settings`); back returned to compose inside the sheet, then closed it.                 |
| Rotation                              | Landscape and back with the sheet open: same process, the sheet and its page survived.                                                                            |
| Send                                  | The sheet's Send action ran `router.back({ result })`: the sheet closed and the inbox returned, same process.                                                     |
| `cancelable: false` and typed results | Initially automated only (`test/bottom-sheet.spec.ts`); the native follow-up below covers both.                                                                   |

## Follow-up — 2026-10-19

Android 16 / API 36 emulator, gesture navigation, NativeScript Android runtime 9.1.1 and NativeScript-Vue 3.1.2. Temporary Vue destinations were registered in the running demo through the inspector using public router APIs. The router and native presenter were not patched. Touch gestures, text input, system Back and rotation were driven through `adb`; snapshots read the actual native dialog, behavior, Frame and ScrollView.

| Check                | Observed result                                                                                                                                                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native ownership     | `useNativeHost()` returned `bottom-sheet` and the modal Frame; its fragment supplied `org.nativescript.vuerouterns.BottomSheetDialog` with Material's native behavior.                                                                                  |
| Nested scrolling     | A normal NativeScript ScrollView containing 50 rows had native nested scrolling enabled. Up/down swipes changed its offset from 0 to 296.76 dp and back to 28.95 dp; the sheet stayed expanded (`STATE_EXPANDED = 3`), with no navigation or result.    |
| Keyboard             | Tapping the native field opened the IME and accepted `sheet-result-52`. The dialog's window insets reported the IME visible. Back hid it while the sheet, route and draft remained.                                                                     |
| Cancelled sheet drag | A short downward drag returned to the expanded state, preserving the route and leaving the result pending.                                                                                                                                              |
| System Back gesture  | The injected edge gesture committed Back, closed the sheet and settled its result once with `undefined`. This is not evidence of a cancelled predictive-back gesture.                                                                                   |
| Nested history       | Pushing a second destination produced `/_sheet52 → /_sheet52-detail` in the same sheet. Back returned to its root without closing the dialog.                                                                                                           |
| Guard refusal        | Native Back and an outside tap each invoked the refusing guard. Both kept the dialog, root history and pending result. A long drag could collapse the held sheet (`STATE_COLLAPSED = 4`), but could not hide it (`hideable = false`).                   |
| Rotation             | Landscape retained the same native Frame and a primed `rotation-draft-52` value. This was not a process-death or Activity-recreation test.                                                                                                              |
| Result               | Programmatic `back({ result })` returned `{ accepted: true, draft: 'rotation-draft-52' }` to the original caller and closed the sheet once.                                                                                                             |
| `cancelable: false`  | Native Back, an outside tap and a downward drag left the sheet open and its result pending. Programmatic Back closed it and returned `{ closedByCode: true }` once.                                                                                     |
| Cleanup              | The three presentations settled once each: one user dismissal and two explicit results. The modal Frame handles became unavailable, the demo returned to Inbox, and diagnostics reported no invariant issues. Original rotation settings were restored. |

The focused suite passed: 13 bottom-sheet tests, with no type errors. Existing coverage includes absent Material classes, option merging, API 30/36 Back paths, reduced motion, guards, dismissal, results and host cleanup.

## Lifecycle and supported boundaries

The `BottomSheetDialogFragment` owns the dialog and mounts the router's modal Frame. NativeScript's modal bookkeeping and Vue-app disposal remain in the normal `showModal`/`closeModal` path. Sheet options configure the native Material behavior; they do not translate UIKit detents.

- Material's interactive predictive-back sheet animation is not enabled: the router handles Back so leave guards run before dismissal. The short-drag cancellation and committed Back observations above do not certify interactive predictive-back cancellation.
- Release builds need an explicit Material dependency, as documented in the modal guides. A release APK without Material was not tested natively; rejection with the Gradle instruction is covered by the unit suite.
- A dedicated physical-device TalkBack traversal of the Material sheet was not performed. The [accessibility report](./native-accessibility.md) records physical modal focus/result checks separately; those are not presented as proof of Material-sheet screen-reader traversal.
- Independent-window ownership and OS surface reconstruction remain part of #46. The rotation check above establishes retained content in the existing Activity, not multi-window recreation support.
