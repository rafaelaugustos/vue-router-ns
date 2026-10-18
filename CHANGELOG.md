# Changelog

## Unreleased

## 0.1.0-beta.10 (2026-10-18)

- Android drawer navigation now keeps the pane open when a guard refuses the destination. Selecting an already-current route still closes it.
- Back now reaches a modal or Material bottom sheet before an open drawer underneath it. NativeScript emits the dialog's Back event globally before notifying its Frame; the router now leaves that event to the modal host, preserving guards and results.
- The demo uses native buttons for drawer destinations, with route-driven selection and keyboard activation. The English and Portuguese guides explain reselect behavior, RTL, accessibility and system edge gestures.
- A dedicated native drawer fixture and CI suite exercise three stacks, guards, modals, rotation, RTL, keyboard input, deep links and process restoration. See the [device validation report](https://github.com/rafaelaugustos/vue-router-ns/blob/master/test/native-drawer.md).

## 0.1.0-beta.9 (2026-10-18)

- Documentation now includes native demo recordings beside feature examples in English and Portuguese: tabs, the iPad sidebar and split view, navigation, context menus, sheets, guards, search, the Android drawer and form restoration. A visual demo guide collects the clips, and the README includes GIF previews.

- Fixed Android process restoration replaying the task's original deep link. The link bridge now distinguishes NativeScript's synthetic `activityNewIntent` during creation from a new delivery, using the launch event's original saved state.

- `<RouterTabs>` and `<RouterTab>` put named stacks behind a native tab bar: `UITabBarController` with `UITab` on iOS (SF Symbol icons, badges, the iPad sidebar with `sidebar`, the iOS 26 minimizing bar with `minimize`, search tabs with `role`), Material's `BottomNavigationView` or a `NavigationRailView` on Android, and the core `TabView` without Material. A navigation into a stack in another tab brings that tab forward first, including deep links; `canSelect` can refuse a tap, `select` and `reselect` report, and `backToRootOnReselect` keeps working. `supportsNativeTabs()` reports the Android dependency.

- `v-route-preview` and `<RouterLink menu>` give a view a native context menu for a route: on iOS a long press shows the destination in UIKit's preview with a menu of actions, and committing the preview navigates through the guards; Android shows the actions in a popup menu, with the route first. The preview is a Vue app of its own, never a stack entry, and list rows keep one interaction per recycled view.

- Demo: a lighter look on both platforms, with system bars, avatars and previews in the inbox, cards on the message page, grouped settings cells and friendlier login and not-found pages. The drawer menu action shows only on Android, where `<RouterDrawer>` has a presentation.

- A tap inside `NavigationCommandScope` no longer cancels the touch underneath on iOS, so `ListView` rows select again inside a scope. The tap only moves keyboard focus to the scope.

- `useNativeSearch` takes `ios.placement` (`automatic`, `stacked`, `inline` or `integrated`). Inside a `TabView` the search bar now defaults to `stacked`, under the title: on iOS 26 the automatic placement moved it to the bottom of the screen, behind the tab bar. The demo's inbox rows are `accessible` only on iOS, since Android's `ListView` ignores taps on focusable rows.

- A native smoke suite for Android (`npm run test:native:android`, `scripts/native/`) drives the demo on an emulator through `adb`: links on cold and warm starts, page state after a process kill, the bottom sheet, shortcuts, the drawer and back, plus the router's diagnostics timings against committed baselines. A `Native` GitHub workflow runs it weekly, on demand and when the suite changes.

- `<RouterDrawer>` wraps the app's stacks in an AndroidX `DrawerLayout` on Android: a `drawer` slot for the menu, `v-model:open`, `opened`/`closed` events and a ref with `open`, `close`, `toggle` and `isOpen`. The Android back and back swipe close an open drawer before any page pops, through the new `router.claimSystemBack()`, and a navigation closes it. iOS renders the content alone.

- `useNativeFlow(flow)` runs system-owned UI with a typed input and result: `completed`, `cancelled` (user, guard, replaced or the page leaving) or `failed`, settled exactly once, keyed by a reserved Android request code and presented from the page's own controller on iOS. `createDocumentPicker()` is the first flow, returning scoped URIs on both platforms.

- `router.setShortcuts(shortcuts)` publishes routes as Android dynamic shortcuts and iOS quick actions in one call, within each platform's limit; a tap opens the route through `openLink`, with the shortcut id on the `LinkResult`. Destinations that no longer exist are ignored when tapped. `supportsShortcuts()` reports platform support.

- `createRouter({ links })` takes operating-system URLs: Android launch and new intents, iOS `openURL`, Universal Links and scene connections, next to the app's own handlers. Schemes and hosts are allow-listed, `map` turns URLs into typed locations, `frame` picks the stack and selects its tab, and links land with their parents through the guards, after the first page and on top of a restored stack. `router.openLink(url)`, `resolveLink(url)` and `onLink(listener)` serve notifications, widgets and deferred logins; a repeated system delivery within 1.5 s is one tap.

- `usePageState(key, { save, restore, version, migrate })` keeps a page's own state across process death: saved with the stack after every navigation and when the app goes to the background, restored once the page's native view has loaded. Every page gets a stable key, so two pages at the same path get their own state back. `SavedStacks` is now `version: 2` with `entries`; path-only saves still load. Values must be JSON-compatible and fit `restore.stateLimit`.

- Android modal routes can be presented in Material bottom sheets with `modal.android.sheet`: peek height, opening state, half-expanded ratio, content height and dismissibility, on top of the same Frame, guards, results and nested history as every modal. A held sheet can't be dragged away; outside taps and back go through the leave guards. `supportsBottomSheets()` reports whether the build has Material, which the runtime includes only in debug.

- Experimental native host contract: `NativeHost`, `mountNativeHost()`, `useNativeHost()`, `createFrameHost()`, `createSplitFrameHost()` and `NATIVE_HOST_VERSION`. `<RouterView>`, `<RouterSplitView>` and modal routes now drive their Frames through it. Hosts declare capabilities, and unsupported `replace`/`clearHistory` reject instead of being faked. A shared contract suite runs against the Frame hosts and an in-memory example adapter, with English/Portuguese guides and a versioning policy.

## 0.1.0-beta.8 (2026-10-15)

- Opt-in accessibility focus targets and modal initiator restoration after confirmed native transitions, plus live system reduced-motion defaults for router-owned animations.

- Opt-in native keyboard commands scoped to a page/window, with UIKit discovery, Android unhandled-key dispatch, guard-aware back/modal actions and editing/IME protection.

- Page-owned native search with `useNativeSearch()`: UISearchController on iOS and SearchView in the existing Android ActionBar. Query state survives navigation without adding route history; native bar/appearance recipes and a searchable demo inbox.

Accessibility focus is opt-in. Manual VoiceOver and audible TalkBack acceptance checks remain pending; see the [native validation report](https://github.com/rafaelaugustos/vue-router-ns/blob/v0.1.0-beta.8/test/native-accessibility.md).

## 0.1.0-beta.7 (2026-10-15)

- Opt-in navigation diagnostics: bounded and redacted event timeline, correlated guard/load/mount/transition timings, read-only logical/native snapshots, HMR and native-pop observation, invariant checks and versioned JSON export. Includes a debug demo inspector and English/Portuguese guides.

## 0.1.0-beta.6 (2026-10-14)

- Fixed: HMR reloads routed pages through NativeScript-Vue's native Page replacement. Covered pages wait until the Frame finishes returning to them, preserving the navigation history on iOS and Android.
- Documented the explicit manifest opt-in required for predictive back progress on Android 14 and 15, including apps targeting API 36.

## 0.1.0-beta.5 (2026-10-14)

- `<RouterSplitView list="/messages">` keeps list and detail pages in one logical history, showing them side by side in wide windows and as a single pane in narrow ones. Resizing preserves page instances and native detail history.
- Android 14+ back swipes now reveal the previous page in the same stack, including inside modals. Cancellation restores the views, and completion goes through router guards. Set `createRouter({ backPreview: false, routes })` to keep only `useBackGesture()` for a custom animation.
- Fixed: an iOS tab that has never loaded no longer holds up navigation in the other tabs when NativeScript reports its `isLoaded` state as undefined.

## 0.1.0-beta.4 (2026-10-14)

- `push(to, { zoomFrom: view })` and `<RouterLink zoom>`: on iOS 18 and later, the page grows out of the view through UIKit's zoom transition, and shrinks back into it when it closes. The drag to dismiss is held while a leave guard is active. Elsewhere the page gets its usual transition, and a shared transition passed along is used there instead.
- `SharedTransition.custom(...)` from `@nativescript/core` is documented as a `transition`, and checked on both platforms with pages the router mounts.
- `<Deferred>` renders its content once the page is on screen, after the transition, and a `fallback` slot until then, so a page with a lot to lay out still animates in on time.
- iOS sheet options for modal routes, under `modal.ios`: `detents` (`'medium'`, `'large'` or a fraction of the screen), `selectedDetent`, `largestUndimmedDetent`, `grabber` and `cornerRadius`. Set before the sheet is presented. `push` merges its `modal.ios` with the record's.

## 0.1.0-beta.3 (2026-10-14)

- On iOS 16 and later, the ActionBar's back button goes through the leave guards while one is active, instead of popping the page on its own. It still looks like the system button.
- Typed routes with pages imported up front: `component: () => Message` keeps the page's type out of the route table's, so `<script setup>` pages can use `useRoute('message')` without the cycle that `component: Message` causes. The function form is now part of the `component` type.
- `createRouter({ restore: { save, load } })` saves the paths of every stack after each navigation and rebuilds them when the app comes back after being killed, through the guards and without animating. Saves older than `maxAge` (30 minutes) are ignored, and the app forgets them when it exits on its own.
- On iOS, swiping down a modal whose page has an active leave guard, or tapping outside it, now runs the guard with the sheet staying put, and closes the modal if the guard allows it. Before, the swipe was only blocked.

## 0.1.0-beta.2 (2026-10-14)

- `router.setStack([...])` sets a stack as a list of locations: it keeps the pages both stacks share, goes back to the last of them and pushes the rest, animating only the last step.
- `router.back({ animated: false })`.
- `<RouterView backToRootOnReselect>` goes back to the tab's first page when its tab is tapped while selected, like native tab bars. `router.backToRoot()` does it on demand.
- `push(to, { withParents: true })` pushes the route's parents first, so a deep link's back goes up the route tree. Parents come from `children` nesting. `<RouterLink>` takes it too.

## 0.1.0-beta.1 (2026-10-14)

- `useBackGesture()`: the progress of the Android 14+ predictive back swipe, for the page it would close. Releasing the swipe still goes back through the router and its guards.
- Fixed: on iOS, navigating did nothing until every tab had been opened once. A tab iOS hasn't shown yet no longer holds up navigations elsewhere.

## 0.1.0-beta.0 (2026-10-13)

First release, written from scratch for NativeScript-Vue 3. It's a beta: the router is covered by tests against a stand-in `Frame`, but hasn't been through real apps on iOS and Android yet.

- `createRouter` with Vue Router's route records, guards, named routes, params, query, redirects and lazy components.
- `<RouterView>` as a native `Frame`, kept in sync with the frame's back stack, including pops the router didn't start.
- A route per page: `useRoute()` inside a page never changes while other pages are pushed on top.
- `onBeforeRouteLeave` with an optional `when`, run on back, replace, `clearHistory` and the Android back button, and blocking the iOS swipe while active.
- Modal routes presented in their own frame, with their own stack.
- `pushForResult()` and `back({ result })` to return values between pages.
- Named `<RouterView>`s for independent stacks, such as tabs.
- `backTo()`, a reactive `stack`, `onPageActivated` and `onPageDeactivated`.
- Route names and params inferred from the route table and checked across the app.
