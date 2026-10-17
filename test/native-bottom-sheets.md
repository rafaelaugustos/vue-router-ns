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
| `cancelable: false` and typed results | Automated only (`test/bottom-sheet.spec.ts`): no user dismissal until code closes it; `pushForResult` resolves once with `back({ result })`.                      |

## Not validated natively

- On this emulator, `adb shell input tap` did not fire NativeScript `Button` or `ListView` tap handlers (toolbar items, tabs, text fields and the sheet's dimmed area did respond, and keyboard activation of the same buttons navigated normally). The message → reply → `pushForResult` flow therefore could not be driven end to end; it is covered by the automated suite, and the compose sheet's `back({ result })` path was checked above.
- Material's own predictive-back sheet animation is not used: the router's back callback sits above it so leave guards run first. Back inside the sheet pops its pages, then closes it.
- Release builds without the Material dependency were not built; `push` rejects with the gradle instruction in that case, covered by the automated suite.
- Physical devices, TalkBack over the sheet and nested scrolling of long sheet content remain to be checked by hand.
