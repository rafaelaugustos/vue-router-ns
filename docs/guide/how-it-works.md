# How it works

Each `<RouterView>` renders a NativeScript `Frame`. Pages are mounted with `$navigateTo`, inside a small wrapper that provides their route and a router bound to their stack. NativeScript-Vue mounts every page as its own app, so nothing provided by `<RouterView>` would reach them otherwise.

The router never keeps a history of its own. After every `navigatedTo`, it reads `frame.backStack` and the current page and mirrors them. Pops it didn't start, like an iOS swipe, are picked up the same way as its own. `replace` marks the current entry `backstackVisible: false` before navigating, which is how the frame drops a page natively.

## Where it talks to the platform

- **Android back button**: `activityBackPressed`, cancelled and turned into `router.back()` so leave guards get a say. On Android 14 and later, an `OnBackPressedCallback` above core's follows the predictive swipe and hands its progress to `useBackGesture()`.
- **iOS swipe back**: `enableSwipeBackNavigation` off while a leave guard is active.
- **iOS back button**: `UINavigationItem.backAction` (iOS 16) while a leave guard is active.
- **Modals**: `modalInPresentation` while a leave guard is active, and a delegate in front of core's to hear a held swipe.
- **Tabs**: a delegate in front of the tab bar's on iOS, touch listeners on the tab strip on Android, to hear a tap on the selected tab.

## Tests

The tests run against a stand-in for NativeScript's `Frame` ([`test/shims/core.ts`](https://github.com/rafaelaugustos/vue-router-ns/blob/master/test/shims/core.ts)). It follows the real one's ordering: navigations finish on a later tick, and dropped pages are disposed before `navigatedTo` fires. The pieces above that touch the platform are exercised through small seams the shim can call, and checked on devices one by one.
