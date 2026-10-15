# Changelog

## Unreleased

- Opt-in accessibility focus targets and modal initiator restoration after confirmed native transitions, plus live system reduced-motion defaults for router-owned animations.

- Opt-in native keyboard commands scoped to a page/window, with UIKit discovery, Android unhandled-key dispatch, guard-aware back/modal actions and editing/IME protection.

- Page-owned native search with `useNativeSearch()`: UISearchController on iOS and SearchView in the existing Android ActionBar. Query state survives navigation without adding route history; native bar/appearance recipes and a searchable demo inbox.

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
