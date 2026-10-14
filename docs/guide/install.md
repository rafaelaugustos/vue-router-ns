# Install

```sh
npm install vue-router-ns@next
```

It's in beta for now, published under the `next` tag. Requires `nativescript-vue` 3 and `@nativescript/core` 8.9 or later.

## Getting started

Export the router from `router.ts`, then install it:

```ts
// app.ts
import { createApp } from 'nativescript-vue'
import App from './App.vue'
import { router } from './router'

createApp(App).use(router).start()
```

```vue
<!-- App.vue -->
<template>
  <RouterView />
</template>
```

`<RouterView>` renders a `Frame` and shows the route given in `initial` (`/` by default). Every route component is a page, so it renders a `<Page>`:

```vue
<!-- pages/Message.vue -->
<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router-ns'

const route = useRoute()
const router = useRouter()
</script>

<template>
  <Page>
    <ActionBar :title="`Message ${route.params.id}`" />
    <Button text="Reply" @tap="router.push('/compose')" />
  </Page>
</template>
```

## The demo app

The repository ships a small mail app with two tabs in [`demo/`](https://github.com/rafaelaugustos/vue-router-ns/tree/master/demo). It covers typed params, a compose modal that returns its text, a leave guard that only asks while there's a draft, a login guard, a lazy page, `clearHistory`, a message page that follows the Android back swipe, and tabs that go back to their first page when tapped again.

With the [NativeScript CLI](https://docs.nativescript.org/setup/) installed:

```sh
npm install
npm run dev        # builds the router in watch mode

cd demo
npm install
ns run ios         # or: ns run android
```
