# Changelog

## Unreleased

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
