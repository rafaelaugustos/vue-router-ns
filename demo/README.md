# vue-router-ns demo

A small mail app with two tabs, each one its own stack:

- **Inbox**: `RouterSplitView` shows the list beside the selected message in wide windows and keeps the same history when resized. Open a message (typed params, `props: true`), go to the next one and back to the inbox in one step (`backTo`). Reply in a modal that hands the text back (`pushForResult`), and that asks before discarding a draft, only when there is one (`onBeforeRouteLeave` with `when`). The unread count refreshes whenever you come back to the inbox (`onPageActivated`). On Android 14+, a message shrinks as you swipe back from it, revealing the page below (the router’s built-in back preview). Opening one zooms it out of its row on iOS 18 (`zoomFrom`), and elsewhere moves the sender's name into place (`SharedTransition`).
- **Settings**: the account page needs a session, so a global guard sends you to the login page first, which then replaces itself with the account page. Signing out starts the tab over (`clearHistory`). A link to a path with no route lands on the catch-all page.

`RouterTabs` selects the stack targeted by a deep link, shows badges, and adapts from Android bottom navigation to a rail at 600 device-independent pixels. On iPad it enables UIKit's sidebar. Each stack returns to its root when its selected tab is tapped again. The demo saves the selected tab alongside the router's saved histories and page state.

The trail at the bottom of each page is `router.stack`, live.

Run it from the repository root:

```sh
npm install
npm run dev        # builds the router in watch mode

cd demo
npm install
ns run ios         # or: ns run android
```

The webpack config points `vue-router-ns` at `../dist`, and pins `nativescript-vue` and `@nativescript/core` to the demo's own copies, so the app and the router share one Vue.

## Route data example

`--env.loadersTest` selects the standalone product/details example in `src/testing/loaders-app.ts`: real HTTP, per-page pending/error/retry, shared app cache and cancellation after Back. See [setup and native acceptance](../test/native-route-data.md) for the local API and simulator/emulator commands.

## Native Suspense example

`--env.suspenseTest` selects an experimental stable-Page composition with route loaders, Vue async content and explicit native container registration. Stock NativeScript-Vue 3.1.2 does not support this boundary without that registration. See [compatibility and reproduction](../test/native-suspense.md) before copying the recipe into an app.
