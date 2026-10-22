# Try it with StackBlitz

[Open the router playground in StackBlitz](https://stackblitz.com/fork/github/rafaelaugustos/vue-router-ns/tree/main/examples/playground?file=src%2Frouter.ts)

Edit a NativeScript-Vue app in the browser and run its native UI on a phone or tablet through [NativeScript Preview](https://preview.nativescript.org/). The browser hosts the editor and build process; it does not emulate UIKit or Android views.

## Start a session

1. Install NativeScript Preview on your device using the links on its website.
2. Open the playground above. StackBlitz installs dependencies and starts `ns preview` using the official NativeScript StackBlitz integration.
3. Wait for the Preview QR code and scan it with the device. Keep the session open while editing.
4. Open `src/router.ts` to change routes, or a page under `src/pages/` to change its UI.

The [example source](https://github.com/rafaelaugustos/vue-router-ns/tree/main/examples/playground) is self-contained and pins `vue-router-ns@0.1.0-beta.15`. It does not require building this repository or resolving a `../dist` alias.

## What to try

| Exercise                                                | Where                                         |
| ------------------------------------------------------- | --------------------------------------------- |
| Push several items, then go back through them           | `src/pages/Home.vue`, `src/pages/Item.vue`    |
| Open a modal and return a reply                         | `src/pages/Item.vue`, `src/pages/Compose.vue` |
| Cancel a nonempty draft to run a leave guard            | `src/pages/Compose.vue`                       |
| Keep list and detail visible in a wide window           | `src/App.vue` (`RouterSplitView`)             |
| Inspect the route of each page and the combined history | `src/pages/Item.vue`                          |

See [navigation](./navigating), [guards](./guards), [modal results](./modals) and [split view](./split-view) for the corresponding APIs.

## Native capabilities

Preview provides a prebuilt native app. Its installed runtime, libraries and manifest determine which platform APIs are available; adding an npm dependency cannot add a native library that is missing from that app. Changes to your own `App_Resources` require a full native build.

In particular, Android 14/15 predictive-back progress requires manifest opt-in, and iOS zoom requires iOS 18+ and a compatible runtime. Do not use a Preview session to conclude that those features work in your own production manifest. Use the [local demo](./install#the-demo-app) to test native configuration, process-death restoration and release builds.

The example follows the [official Vue 3 StackBlitz template](https://github.com/nativescript-vue/nativescript-vue/tree/main/packages/stackblitz-template). TypeScript and platform bundle checks are separate from testing an end-to-end Preview session on a connected device; this example does not claim the latter has been verified.

## If the session does not start

Check the StackBlitz terminal for install/build errors and follow [StackBlitz browser support](https://developer.stackblitz.com/platform/webcontainers/browser-support). Confirm that your Preview app is current and can connect to the session. To try the same code locally, install the NativeScript CLI, run `npm install` inside `examples/playground`, then `ns preview`.

The full local demo remains available if Preview's native runtime cannot provide a feature. Background: [NativeScript's Preview integration and limitations](https://blog.nativescript.org/nativescript-preview-announcement/).
