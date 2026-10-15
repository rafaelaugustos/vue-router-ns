# Native search validation — #55

2026-10-15, NativeScript Android 9.1.1 / iOS 9.1.0, NativeScript-Vue 3.1.2.

- Android API 35 emulator: actual androidx.appcompat.widget.SearchView in the existing ActionBar, native query callback, list → detail → back, query retained, logical stack length unchanged by typing.
- iPad Pro 11 (M5), iPadOS 26.5: actual UISearchController on the split list UINavigationItem, largeTitleDisplayMode = Always, native updater callback, list → detail → back, query retained, no extra history. This caught and fixed UIKit's empty cleanup update during dismissal.
- Six automated scenarios cover both bridges, reactive query synchronization, modal dismissal/return, hidden tab refusal, split expansion/collapse, guard rejection and cleanup on router disposal.
- Library typecheck/build, demo TypeScript and documentation build pass. Full suite: 189 tests.

The implementation does not replace core's backAction, ActionBar/navigation-controller delegates, or interactive pop recognizer. A manually cancelled UIKit edge swipe and hardware keyboard behavior are not asserted by the above automated native scenario.
