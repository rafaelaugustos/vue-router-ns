# Android drawer validation — #43

2026-10-16, NativeScript Android runtime 9.1.1, NativeScript-Vue 3.1.2, Medium Phone emulator, Android 16 / API 36 with gesture navigation. The demo wraps its `TabView` in `<RouterDrawer :width="280">` with a pane of destination buttons that call `router.openLink`, and the inbox has a Menu action that opens it.

| Check                             | Result                                                                                                                                                                                                                                                                                 |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native container                  | The pane slid in over the tabs with AndroidX's scrim; its root measured 280 dp wide (`[42,42][693,110]` for the title at 2.625×). Nothing moved in the Frames.                                                                                                                         |
| Menu action                       | Opened the drawer; the `opened` event fired (`isOpen` true).                                                                                                                                                                                                                           |
| Back key                          | `KEYCODE_BACK` closed the drawer and left the inbox where it was: `DrawerLayout` handles the key itself before the activity sees it.                                                                                                                                                   |
| Back gesture, page history behind | With `/ › /messages/2` on the stack and the drawer open (a temporary Menu on the message page), one left-edge swipe closed the drawer and kept both pages; the next swipe popped to `/`. This is the `claimSystemBack` path, since the gesture never reaches the layout's key handler. |
| Navigation while open             | A link delivered while the drawer was open navigated and closed it (`closeOnNavigate`).                                                                                                                                                                                                |
| Edge swipe to open                | On gesture navigation the start edge is the system's back zone, so an `adb` swipe from x=5 is a back gesture, not a drawer drag. Opening from the menu is the reliable path there; a drag works where the edge is free.                                                                |

No JavaScript errors were logged. The temporary Menu on the message page and the console logging used during the run are not in the commit.

## Automated

`test/drawer.spec.ts` covers the two-child layout and its width, the iOS fallback to content only, the handle, `v-model:open` and native drags, starting open, the back key and back swipe closing before any pop, `closeOnNavigate` on and off, and `claimSystemBack` for any claimant. 308 tests pass.

## Not validated natively

- Keyboard or touch activation of the pane's own buttons: synthetic taps do not fire NativeScript button handlers on this emulator (see `test/native-bottom-sheets.md`); the pane's buttons go through `openLink`, which the link validation covers.
- RTL, configuration changes with the drawer open, and a physical device.
