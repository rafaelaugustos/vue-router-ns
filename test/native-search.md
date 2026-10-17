# Native search validation — #55

2026-10-15, NativeScript Android 9.1.1 / iOS 9.1.0, NativeScript-Vue 3.1.2.

- Android API 35 emulator: actual androidx.appcompat.widget.SearchView in the existing ActionBar, native query callback, list → detail → back, query retained, logical stack length unchanged by typing.
- iPad Pro 11 (M5), iPadOS 26.5: actual UISearchController on the split list UINavigationItem, largeTitleDisplayMode = Always, native updater callback, list → detail → back, query retained, no extra history. This caught and fixed UIKit's empty cleanup update during dismissal.
- Six automated scenarios cover both bridges, reactive query synchronization, modal dismissal/return, hidden tab refusal, split expansion/collapse, guard rejection and cleanup on router disposal.
- Library typecheck/build, demo TypeScript and documentation build pass. Full suite: 189 tests.

The implementation does not replace core's backAction, ActionBar/navigation-controller delegates, or interactive pop recognizer. A manually cancelled UIKit edge swipe and hardware keyboard behavior are not asserted by the above automated native scenario.

## 2026-10-17 — placement under a tab bar, Android row taps

NativeScript 9.1.3, NativeScript-Vue 3.1.2.

- iPhone 17 simulator, iOS 26.0 (Xcode 27.0): before the change, the inbox's `UISearchController` inside a `<TabView>` rendered at the bottom of the screen, behind the Liquid Glass tab bar, which is UIKit's automatic placement on iOS 26. With the `stacked` default inside a `TabView`, the bar stays out of the way until activated and then opens in the navigation bar with the keyboard; the tab bar is untouched. Activation was fired from the page for this check, since the simulator has no tap automation here; typing, submit and dismissal were not driven on iOS 26.
- Android API 36 emulator: a row marked `accessible` is focusable, and `ListView` never delivered `itemTap` to it (`AbsListView` skips rows with explicitly focusable content). With `accessible` only on iOS, `adb shell input tap` on each row opens `/messages/1`, `/messages/2` and `/messages/3` on a fresh install and again after back, with the detail pane's transparent root in place. The Android `SearchBar` in the ActionBar is unchanged.
- Automated: a scenario asserts `preferredSearchBarPlacement` is `Stacked` inside a `TabView`, untouched elsewhere, `Integrated` on request when the enum has it, ignored when it does not, and restored on disposal. Full suite: 309 tests.
