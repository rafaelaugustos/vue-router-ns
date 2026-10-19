# Native layout acceptance — 2026-10-19

Follow-up for [#90](https://github.com/rafaelaugustos/vue-router-ns/issues/90). The opt-in `demo/src/testing/layouts-app.ts` fixture runs NativeScript-Vue 3.1.2, NativeScript Core 9.1.3, Android runtime 9.1.1 and iOS runtime 9.1.0.

| Environment                                     | Result                                                                                                                                                          |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Android API 36 arm64 emulator (`emulator-5554`) | All 18 native checks passed. System Back refused while the layout guard was active, then returned to the retained root after Allow leaving.                     |
| iPhone 17 simulator, iOS 26.0                   | All 18 native checks passed. The UIKit ActionBar Back button refused while the layout guard was active, then returned to the retained root after Allow leaving. |

## Native checks

1. The default layout owns exactly one native Page and one ActionBar.
2. Layout and destination receive the same entry route and owning stack.
3. Forced repeated paths get separate layout instances and draft refs.
4. A covered page keeps its route and both layout/content drafts.
5. Back returns to the original native Page with both drafts retained.
6. Popped layouts unmount; a retained root layout remains mounted.
7. A named layout supplies its own native title with one valid Page/ActionBar hierarchy.
8. `layout: false` preserves a destination-owned Page without creating a layout instance.
9. An unknown layout rejects once before mounting or changing the native Page.
10. Navigations retain both native tab Frames and their independent histories.
11. A modal uses its named layout in a separate modal Frame with one Page/ActionBar hierarchy.
12. An asynchronous leave guard registered in that layout refuses modal Back.
13. Closing the modal delivers its typed result to the retained root entry.
14. Layout script HMR defers replacing a covered native Page.
15. On return it replaces the Page while retaining the entry route identity and history.
16. Destination script HMR also defers while covered by a page in the same Frame.
17. Returning replaces that native Page without flattening or duplicating history.
18. The layout's asynchronous leave guard also refuses ordinary router Back.

HMR uses Vue's actual `__VUE_HMR_RUNTIME__.reload()` and NativeScript-Vue's native Page replacement. Neither the router nor a native host is patched. The fixture inspects real `Page`/`ActionBar` classes, native Page identities and Frame back stacks; these checks are independent of the runtime shim.

## Reproduce

```sh
npm run build
cd demo
ns build android --env.layoutsTest
adb -s <serial> install -r platforms/android/app/build/outputs/apk/debug/app-debug.apk
cd ..
ANDROID_SERIAL=<serial> npm run test:native:layouts
```

The Android runner reads `LAYOUT_RESULT`, validates all 18 checks and then presses actual system Back while the layout guard refuses. It taps Allow leaving and presses Back again, expecting the retained root. JSON, logs and screenshots are saved to `scripts/native/out/layouts`. The Native CI workflow builds and runs the fixture after the normal demo, drawer and middleware suites.

For iOS, build `ns build ios --emulator --env.layoutsTest`, install and launch `org.nativescript.vuerouterns`, then read `LAYOUT_RESULT` in the simulator's unified log. The final screen remains on `/guarded`. Tap the UIKit ActionBar Back button: the Page must remain. Tap Allow leaving and the same native Back button: the root `/` must return.

After switching a native iOS tab, the fixture explicitly waits for the presenting Page's `viewIfLoaded.window` before launching the modal. An immediate burst of test commands initially hit Core's "Parent page is not part of the window hierarchy" refusal; waiting for UIKit attachment establishes the native precondition instead of adding an arbitrary delay or changing router presentation behavior.

## Automated coverage and limits

The full suite passed 378 tests with 8 existing skips and no type errors. Layout tests additionally cover lazy loading/retry, metadata inheritance, opting out, destination props, default configuration, development diagnostics including registered native element aliases, persistent containers, HMR discard and accessibility focus restoration to a modal initiator. Type assertions cover layout component factories and invalid metadata/default values. Root/demo typechecks, build, documentation build, formatting and shell checks passed.

These results do not claim a new physical-device, VoiceOver/TalkBack, process-death, rotation or interactive gesture-cancellation pass. The focus contract is covered by the automated suite; no screen reader was enabled during native layout acceptance. The fixture invokes the real script-HMR runtime, not a filesystem watcher or future file-routing transform. Script remounts can reset setup refs, as documented. Invalid native authoring trees receive development warnings; they are not repaired or made supported in production.
