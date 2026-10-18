# Native tabs validation — #51

2026-10-18, for `0.1.0-beta.9`. NativeScript core 9.1.x, NativeScript-Vue 3.1.2, Android runtime 9.1.1 and iOS runtime 9.1.0. The demo uses `RouterTabs` with an Inbox `RouterSplitView` and a Settings `RouterView`.

## iPhone 17, iOS 26.0 simulator

- A clean installation opened Inbox. Before Settings had been selected, `vuerouterns://settings/account` selected it, loaded its first page and reached Sign in through the authentication guard.
- Tapping the selected Settings tab returned to its root. Switching to Inbox, opening a message and tapping Inbox again returned to the inbox root.
- The UIKit tab bar displays SF Symbols and the unread badge. The demo opts into `minimize="onScrollDown"`; scroll-driven minimization was not separately measured.

## iPad Pro 13-inch (M5), iOS 26.0 simulator

- From a clean installation, opened the UIKit sidebar and selected the previously unopened Settings tab. Its page appeared without a crash. Repeated sidebar selections between Inbox and Settings worked.
- Inbox kept its split layout and history across selections. Settings kept its independent stack.
- During development, directly hosting an empty lazy Frame could crash UIKit on the first sidebar selection. Each tab now has a native layout container, so UIKit has a content view before the Frame's first page arrives. Sidebar appearance is applied after loading.

## Android 16 / API 36 emulator

`npm run test:native:android` installs the demo and clears only its app data. The suite exercises real Material tab selections, independent histories, reselect to root, cold/warm links, guarded login, process death with form restoration, modal links, a Material bottom sheet, shortcuts and the drawer. It checks router timings against committed baselines and inspects JavaScript/native error logs.

The Material widget was also checked at 411 and 686 device-independent pixels of width. It changed from bottom navigation to `NavigationRailView` and back while retaining the same native hosts and logical entries. Selecting Settings in the rail remained selected after returning to the bottom bar. Android back popped Settings' account page and left Inbox's history intact. The emulator's original size was restored afterward.

Native checks found and fixed the default AppCompat theme's incompatibility with Material badges, a zero-height bottom bar, system-inset sizing, focus after switching tabs and replay of an old launch intent after process death. The link bridge now accounts for NativeScript's synthetic `activityNewIntent` during creation and the original saved state on `launch`.

## Automated coverage and limits

`test/tabs-host.spec.ts` covers UIKit configuration and selection veto, unopened tabs, duplicate/modal/setStack navigation, restoration without changing selection, Android system back, badges, Material detection/fallback and three independent stacks across rail resizing. `test/links.spec.ts` reproduces the native event sequence after process death.

The core TabView fallback, three-tab histories, selection veto and resize identity checks have automated coverage; the native demo has two tabs. Older iOS releases, search/prominent roles and physical-device accessibility were not part of this run. The Android release dependency is documented; these device checks used debug builds.
