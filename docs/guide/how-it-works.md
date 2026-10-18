# How it works

Each `<RouterView>` renders a NativeScript `Frame` and hands it to the router as a [native host](./native-hosts). Pages are mounted with `$navigateTo`, inside a small wrapper that provides their route and a router bound to their stack. NativeScript-Vue mounts every page as its own app, so nothing provided by `<RouterView>` would reach them otherwise.

In a `RouterView`, the native stack is the source of navigation history. After every `navigatedTo`, the Frame host reports a change, and the router reads the host's pages and mirrors them. Pops it didn't start, like an iOS swipe, are picked up the same way as its own. `replace` marks the current entry `backstackVisible: false` before navigating, which is how the frame drops a page natively.

The router talks to every container through the same host contract: the Frame of a `<RouterView>`, the frame inside a modal, and the two Frames of a `<RouterSplitView>`. Matching, guards, results and reconciliation live in the router once; presentation, gestures and native handles live in the host. The contract is experimental and documented in [native hosts](./native-hosts).

## Where it talks to the platform

- **Android back button**: `activityBackPressed`, cancelled and turned into `router.back()` so leave guards get a say. On Android 14 and later, an `OnBackPressedCallback` above core's follows the predictive swipe and hands its progress to `useBackGesture()`.
- **iOS swipe back**: `enableSwipeBackNavigation` off while a leave guard is active.
- **iOS back button**: `UINavigationItem.backAction` (iOS 16) while a leave guard is active.
- **Modals**: `modalInPresentation` while a leave guard is active, and a delegate in front of core's to hear a held swipe.
- **Tabs**: a delegate in front of the tab bar's on iOS, touch listeners on the tab strip on Android, to hear a tap on the selected tab.

## Tests

The tests run against a stand-in for NativeScript's `Frame` ([`test/shims/core.ts`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/shims/core.ts)). It follows the real one's ordering: navigations finish on a later tick, and dropped pages are disposed before `navigatedTo` fires. The pieces above that touch the platform are exercised through small seams the shim can call, and checked on devices one by one.

What the shim cannot see runs on a real Android emulator: [`scripts/native/smoke-android.sh`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/scripts/native/smoke-android.sh) installs the demo and drives it through `adb`, checking operating-system links on a cold and a warm start, page state after a genuine process kill, the Material bottom sheet, home-screen shortcuts, the drawer and back, and the router's own timings from its diagnostics against [`scripts/native/baselines.json`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/scripts/native/baselines.json). `npm run test:native:android` runs it against a connected device after `ns build android`; the `Native` workflow runs it on an emulator weekly, on demand, and when the suite itself changes. The [validation reports](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-validation.md) record the manual passes that remain.

## List and detail

`RouterSplitView` keeps two Frames in a native `GridLayout`: one for the pinned list and one for details. The router combines them into one logical stack and omits the detail's internal transparent root. Width changes rearrange the Frames without transferring pages between them. It does not use `UISplitViewController` or implement a drawer.

## Development updates

The wrapper forwards routed-component reloads to NativeScript-Vue for native Page replacement. A covered page waits for the Frame's `navigatedTo` and the next Vue tick before reloading. See [HMR](./pages#hmr-during-development).

Native checks and their environments are recorded in the [validation report](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-validation.md), complementing the shim tests.
