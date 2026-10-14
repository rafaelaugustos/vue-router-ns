# vue-router-ns demo

A small mail app with two tabs, each one its own stack:

- **Inbox**: open a message (typed params, `props: true`), go to the next one and back to the inbox in one step (`backTo`). Reply in a modal that hands the text back (`pushForResult`), and that asks before discarding a draft, only when there is one (`onBeforeRouteLeave` with `when`). The unread count refreshes whenever you come back to the inbox (`onPageActivated`). On Android 14+, a message shrinks as you swipe back from it (`useBackGesture`). Opening one zooms it out of its row on iOS 18 (`zoomFrom`), and elsewhere moves the sender's name into place (`SharedTransition`).
- **Settings**: the account page needs a session, so a global guard sends you to the login page first, which then replaces itself with the account page. Signing out starts the tab over (`clearHistory`). A link to a path with no route lands on the catch-all page.

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
