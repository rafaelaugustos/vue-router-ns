# NativeWindow routing validation — 2026-10-15

Follow-up for [#46](https://github.com/rafaelaugustos/vue-router-ns/issues/46). The implementation chooses **one router per NativeWindow**, preserving the existing per-router matching, guards, result handling and navigation queue. A global router with window-qualified names was considered but would have required every operation and callback to carry a window discriminator.

## Public contract

- `createRouter({ routes, window })`; omitted ownership is inferred from a mounted view's `getNativeWindow()`.
- `router.window`: readonly owner ref. One window cannot be claimed by two routers, and a router cannot mount views in two windows.
- `router.openWindow(to, { data })` resolves a typed destination and forwards it through the native window-opening API. The app supplies content using `getWindowRoute(request.data)` in its content resolver.
- Scoped persistence receives `RestoreContext` with native `windowId` and an application `key`; snapshots carry `windowKey` and mismatches are ignored. NativeWindow APIs are feature-gated so legacy single-window code remains supported.

## Environments and evidence

NativeScript core/runtime 9.1.1, NativeScript-Vue 3.1.2, Android 15/API 35 arm64 emulator, iPad Pro 11-inch (M5) simulator on iPadOS 26.5. Temporary instrumentation used the demo's existing message/compose routes, a window content resolver and inspector snapshots of the route, logical history and actual Frame back stack. Android used `launchMode="standard"`; iPad enabled multiple scenes.

| Scenario                                                        | Result                                                                                                                                                                                                                                      |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Open a typed message route in a second Activity and UIKit scene | Passed; the first window retained its independent history.                                                                                                                                                                                  |
| Android system back in each foreground task                     | Passed; the other window did not pop. Test switched native tasks before invoking each Activity's dispatcher. Dispatching back to a stopped Activity is not a valid simulation of user input because lifecycle-bound callbacks are disabled. |
| Android back blocked by a guard in one window                   | Passed; both logical and native history remained in that window, with the other unchanged.                                                                                                                                                  |
| Two simultaneous compose modals                                 | Passed on Android and iPad; results `A` and `B` returned independently, and closing A's modal left B's modal open.                                                                                                                          |
| Close the secondary UIKit scene                                 | Passed; the original scene remained and the closed router was torn down. Scene destruction completes asynchronously.                                                                                                                        |
| Android Activity recreation on published NativeScript-Vue 3.1.2 | Reproduced a framework bug: apparent history survived until back, then logical history became empty while native history still contained a page.                                                                                            |
| Android Activity recreation with NativeScript-Vue PR #1178      | Passed; confirmed a replacement Activity, preserved both window histories, then back and another push worked in the reconstructed window.                                                                                                   |

## Framework boundaries found

NativeScript core 9.1 sends a copied back event to NativeWindow before dispatching the original event on Application.android. Cancelling the window copy does not cancel the original. The router observes the original cancelable event and filters by the owning window/Activity; gesture callbacks remain attached to the owning dispatcher. The shim now mirrors the copied-event ordering.

NativeScript-Vue immediately unmounted page apps on native-view disposal, including temporary native surface teardown. [Upstream PR #1178](https://github.com/nativescript-vue/nativescript-vue/pull/1178) defers cleanup until Frame history settles and preserves apps whose page/window are retained. The correction passed its 74 tests, typecheck/build, and the real Android recreation scenario above. This dependency is **not** vendored into vue-router-ns or silently patched in installed packages. Reconnection support needs the upstream fix to become available.

Closing the original Android Activity exposed another core issue: subsequent `Application.openWindow()` could target an undeclared hard-coded Activity class when `startActivity` was gone. Reported as [NativeScript #11526](https://github.com/NativeScript/NativeScript/issues/11526). The route request forwards native API errors; this experimental integration does not claim to repair the platform launcher.

## Automated coverage and limits

The router suite checks owner-specific back/guards/gesture progress, independent modal result settlement, detach/attach callback cleanup, stable persistence keys, snapshot mismatches, typed route handoff, unique window ownership and fallback when NativeWindow APIs are absent. The NativeScript-Vue fix adds regression coverage for retained page reactivity, real disposal after pop, window closure and root replacement.

No physical-device pass, OS-driven iOS scene reconnection, or full process-death multi-scene restoration was performed for this feature. Direct invocation of UIKit scene delegate callbacks was explored as a diagnostic and failed on return/back with a missing native transition owner (`_transition` on null). A root reported attached while its native Frame UI was unloaded. This diagnostic is not equivalent to an OS disconnect; iOS scene resumption remains unverified and must not be marked complete. OS-originated link receipt remains #48; per-entry UI-state serialization remains #49. The application must reuse an existing window root/router during reconnect, compose its content resolver with other integrations, and choose fresh-route versus saved-history precedence explicitly.
