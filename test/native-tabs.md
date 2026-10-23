# Native tabs validation

## Reselection regression — #121, 2026-10-22

Tested with published, unmodified NativeScript Core 9.1.3, NativeScript-Vue 3.1.2 and iOS runtime 9.1.0 on a dedicated iPhone 17 / iOS 26.0 simulator.

The previous implementation reproduced the reported failure: open detail in A, switch to B and open detail there, then switch to A. A incorrectly returned to its root. A temporary forwarding observer recorded `shouldSelect(B) → didSelect(B) → shouldSelect(B)` for one physical tap, followed by the same sequence for A. Native call stacks showed UIKit dispatching through a gesture recognizer and then `UIControl.touchesEnded` within the same native event. The second callback arrived after the target became selected, producing a false `reselect`. It was not nested inside the first delegate call.

The fix coalesces requests for the same destination until the next native event turn; it does not use a fixed-duration tap debounce. It also cancels queued delegate installation and pending selection cleanup when the last observer detaches.

The final XCTest runs **without the diagnostic observer** and drives actual tab buttons:

- A and B keep their detail pages through repeated tab changes, programmatic `selected` changes and duplicate deep-link navigation into B.
- Switching produces zero `reselect` events. A refused `canSelect` leaves B's detail visible.
- Reselecting B while its leave guard refuses keeps the detail. After allowing, one reselect returns B to root; A's detail survives until A itself is reselected.
- C has `backToRootOnReselect=false`; repeated taps and leaving/returning keep its detail.
- Exactly four intentional reselects are emitted across the guard/allowed/disabled scenarios. The original failing test passes after the fix, and the final suite completes with no failures.

The same native-tap scenario passed on an Android 14 / API 34 emulator with Material navigation and Android runtime 9.1.1: 17 visible-page checks, zero incidental reselections and four intentional reselections. All 527 unit tests passed (10 existing skips), along with package/demo typechecks, library/docs builds, formatting and workflow lint.

Unit coverage exercises duplicate callbacks through both UIKit delegate families, next-turn reselection, selection vetoes, observer disposal/remount and queued installation cancellation. Android core TabView fallback touch checks cover changing tabs, an active-tab release, out-of-bounds releases and listener disposal. Material navigation is also covered by the existing host tests.

See [the native fixture and reproduction commands](../scripts/native/tabs/README.md). CI runs the real-tap fixture on iOS 18.6 and Android API 34, alongside the existing native suites. Local iOS 26 acceptance establishes the reported regression; this does not claim physical-device or VoiceOver validation.

## Original native host acceptance — #51

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

## Public appearance (#122) — 2026-10-22

The `tabsstyleTest` fixture uses public RouterTabs props/CSS for its UI. The command bridge reads the actual native widgets for assertions. The shared driver and release fallback instructions live in [scripts/native/tabs-style](../scripts/native/tabs-style/README.md).

| Host                                                              | Native acceptance                                                                                                                                                                                                             | Visual inspection                                                                                                                                                                                        |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| iPhone 16 Pro / iOS 18.6 simulator                                | 18 commands passed: native title/icon/background values, prop/CSS precedence and clearing, selection, live Page identities, mount counts, independent histories, default restoration                                          | Both icon states and titles follow the palette; the background uses the configured tint.                                                                                                                 |
| iPhone 17 / iOS 26.0 simulator                                    | Same 18 commands passed; UIKit accepts the configured appearance values                                                                                                                                                       | Titles and the selected SF Symbol change. Liquid Glass retains system compositing and the unselected SF Symbol's system color despite the native tint value. This limitation is explicit in both guides. |
| Android 14 / API 34 emulator, Material debug APK                  | 18 commands passed across BottomNavigationView and NavigationRailView; all four label modes, default restoration, both icon/text state colors, backgrounds, menu titles, badge count and unlabeled accessibility descriptions | Recorded native bottom/rail changes; both stacks remain at detail pages.                                                                                                                                 |
| Android 14 / API 34 emulator, signed release APK without Material | 18 commands passed; driver required the Core backend, asserted native background/text colors and default restoration, plus live Pages/histories                                                                               | Core retains its native title layout; rail/label modes are ignored.                                                                                                                                      |

Local artifacts: `scripts/native/out/tabs-style-ios18`, `tabs-style-ios-acceptance`, `tabs-style-ios-video`, `tabs-style-android-acceptance`, `tabs-style-android-video`, and `tabs-style-core`. EN/pt-BR docs include the actual iOS 26 and Android recordings, encoded at 480 px width. The required native CI now runs the UIKit, Material and no-Material scenarios as well.

Package validation: 570 tests passed, 10 existing skips; package/demo typechecks, package/docs builds, formatting and workflow lint passed. Unit coverage checks in-place changes/default restoration, menu/Page identity, CSS observation cleanup, rail propagation and Core fallback. Native checks are necessary for Java array marshalling and the NativeScript-Vue attribute-reset/cascade behavior; neither is proven by the unit shims.

No physical-device or screen-reader speech validation is claimed. UIKit sidebar colors and non-native title hiding are outside this appearance contract. See the guide for the platform support boundary.
