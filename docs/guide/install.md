# Install and open a page

You need Node 20.19.4+, NativeScript-Vue 3.1.2+ (3.x), and NativeScript Core 9.1.3+ (9.x). Prepare the native SDKs with [NativeScript environment setup](https://docs.nativescript.org/setup/); building iOS locally requires macOS and Xcode. The full tested baseline is in [compatibility](./compatibility).

## Create or use a NativeScript-Vue project

If you already have a running NativeScript-Vue app, use its directory. Otherwise, follow the [official NativeScript-Vue starter](https://nativescript-vue.org/docs/getting-started/installation):

```sh
ns create pocket-notes --template @nativescript-vue/template-blank@latest
cd pocket-notes
```

Install the router in that project:

```sh
npm install vue-router-ns@next
```

The `next` tag selects a release candidate. Commit the resulting lockfile for reproducible installs.

## Getting started

Use this minimal structure under the project's `src` directory. Replace the starter's app-level Frame with `RouterView`; the router creates its native Frame.

```ts
// src/router.ts
import { createRouter } from 'vue-router-ns'

export const router = createRouter({
  routes: [{ path: '/', component: () => import('./pages/Home.vue') }],
})
```

```ts
// src/app.ts
import { createApp } from 'nativescript-vue'
import App from './App.vue'
import { router } from './router'

createApp(App).use(router).start()
```

```vue
<!-- src/App.vue -->
<template>
  <RouterView />
</template>
```

```vue
<!-- src/pages/Home.vue -->
<template>
  <Page>
    <ActionBar title="Pocket notes" />
    <Label text="Your first native page" margin="24" />
  </Page>
</template>
```

Run on a configured simulator/emulator or connected device:

```sh
ns run ios
# or:
ns run android
```

You should see **Pocket notes** and **Your first native page**. Continue to [build your first app](./first-app): add a list, a detail page, a modal result and an unsaved-edit guard using complete files.

## Try it online

The [StackBlitz playground](./playground) provides a browser editor connected to NativeScript Preview on your device. Its prebuilt native runtime has limits; see that guide before evaluating platform-specific features.

## The demo app

To run the repository examples instead of creating a project, follow the [Fieldnotes checkout setup](./native-showcase#run-from-a-checkout). Use `npm run tutorial:ios` / `tutorial:android` from `demo` for the first-app tutorial, `showcase:ios` / `showcase:android` for Fieldnotes, or `ns run ios` / `ns run android` for the default mail app. All entries share the demo application ID, so installing one replaces the other on that device.

## Installation troubleshooting

With npm 10, use beta.15 or newer. Beta.14's optional Vite peer triggered `Cannot read properties of null (reading 'edgesOut')`; the router no longer declares Vite or webpack peers and does not require `--legacy-peer-deps`.

File routing is optional. If you choose it, install the bundler described in [its guide](./file-routing). Keep a working NativeScript Vite lockfile on npm 10: that builder has a separate optional-peer resolver issue when starting without a lockfile. See [the installation evidence](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/npm-install.md) for tested combinations.
