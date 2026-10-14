# Changelog

## Unreleased

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
