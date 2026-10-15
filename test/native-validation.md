# Native validation — 2026-10-14

Follow-up for [#4](https://github.com/rafaelaugustos/vue-router-ns/issues/4), using the demo on `0.1.0-beta.5` plus the HMR fix in this change. NativeScript-Vue 3.1.2; Android runtime 9.1.1; iOS runtime 9.1.0. These are native simulator/emulator checks, separate from the automated tests against the Frame shim.

| Environment                                 | Checks completed                                                                                                             |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| iPhone 17 Pro simulator, iOS 26.5           | Route-record and push-option transitions; replace; clearHistory                                                              |
| iPad 11-inch (M5) simulator, iOS 26.5       | HMR of a covered page, followed by back                                                                                      |
| Pixel 7 emulator, Android 14 / API 34       | Transitions; replace; clearHistory; covered-page HMR; process-death restoration; predictive-back cancellation and completion |
| Pixel 7 emulator, Android 15 / API 35       | Predictive-back cancellation and completion                                                                                  |
| ASUS Z017DC, Android 8.0 / API 26, physical | Debug demo installed and launched. Device disconnected before navigation checks; these remain pending.                       |

## Transitions and native history

Use three temporary routes, A/B/C. Give A a route-record `slideLeft` transition with a 500 ms duration. Push B with a `fade` transition and the same duration. Check the Frame's transition configuration after each navigation.

Starting at Settings, push A, push B, then replace B with C. Both `router.stack` and the native history must contain Settings/A/C. Back must return to the existing A page, without B reappearing. Push B with `clearHistory: true`: only B remains, the native history is empty, and back cannot reveal an older page. On iOS, also inspect the navigation controller's view controllers.

All checks passed on the iPhone simulator and Android 14 emulator.

## HMR while covered

Open Settings, then push A over it. Change Settings' SFC script/content while the app runs with HMR. Before returning, verify that the top page and covered native page retain their identities and the router history stays Settings/A. Back to Settings: its updated text must appear in a replacement native Page, with Settings as the sole router/native entry.

This exposed a bug: Vue reloaded the routed child under `RouterPage`, bypassing NativeScript-Vue's native Page replacement. The fix sends the reload through the native app callback. Covered pages wait for `Frame.navigatedTo` and the next Vue tick; reloading on `Page.navigatedTo` is too early on Android and can dispose the remounted app.

The corrected behavior passed on the iPad simulator and Android 14 emulator. `hmr.spec.ts` exercises Vue's real HMR runtime and checks deferral, repeated edits, preserved native page identities, and discarding a covered page before returning. Native Page replacement itself is checked on the native runtimes, not simulated by that test.

## Process death

Enable `restore` using ApplicationSettings persistence. Build `/ → /messages/1 → /messages/2`, background the app, and run `adb shell am kill org.nativescript.vuerouterns`. Relaunch its activity and verify that the process PID changed, the three routes were restored, and back returns to `/messages/1`.

Passed on Android 14: PID changed from 7289 to 7379, the stack was restored, and back returned to the previous message. Stop the NativeScript run watcher before this check so it does not restart/reinstall the app during the test.

## Predictive back

Use gesture navigation and explicitly set `android:enableOnBackInvokedCallback="true"` on the manifest's `<application>`. On Android 14, enable predictive-back animations in developer options as well. Targeting API 36 alone did not enable progress on Android 14 or 15; the documentation now distinguishes target SDK from device OS version.

From `/messages/2`, drag from the left edge. Mid-gesture screenshots showed `/messages/1` underneath the moving/scaled page on both Android 14 and 15. Cancelling kept all three routes and restored translation/scale. Completing returned to `/messages/1`, with two routes, restored transforms, and one child remaining in the Frame container.

## Remaining physical-device pass

Reconnect and authorize the ASUS over USB. Validate hardware back with a leave guard and at the root, modal back/dismissal including `cancelable: false`, tab stacks, replace/clearHistory, and restoration after process death. Android 8 does not support predictive-back progress; that feature was covered on the Android 14/15 emulators above.

The physical-device requirement remains open. This report does not claim that simulator/emulator results replace it. Temporary validation routes, inspector globals, persistence settings, and demo text edits were removed after the checks.
