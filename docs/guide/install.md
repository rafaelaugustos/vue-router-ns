# Install

```sh
npm install vue-router-ns@next
```

It's in beta for now, published under the `next` tag. Requires `nativescript-vue` 3 and `@nativescript/core` 8.9 or later.

## Try it online

Use the [StackBlitz playground](./playground) with NativeScript Preview to edit examples and run them on a device before setting up local native SDKs.

## Getting started

Export the router from `router.ts`, then install it:

```ts
// router.ts
import { createRouter } from 'vue-router-ns'

export const router = createRouter({
  routes: [
    { path: '/', component: () => import('./pages/Home.vue') },
    {
      path: '/messages/:id',
      name: 'message',
      component: () => import('./pages/Message.vue'),
    },
    { path: '/compose', component: () => import('./pages/Compose.vue'), modal: true },
  ],
})
```

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

Complete the other two pages in the route table:

```vue
<!-- pages/Home.vue -->
<script setup lang="ts">
import { useRouter } from 'vue-router-ns'
const router = useRouter()
</script>

<template>
  <Page>
    <ActionBar title="Home" />
    <Button text="Open message" @tap="router.push('/messages/42')" />
  </Page>
</template>
```

```vue
<!-- pages/Compose.vue -->
<script setup lang="ts">
import { useRouter } from 'vue-router-ns'
const router = useRouter()
</script>

<template>
  <Page>
    <ActionBar title="Compose" />
    <Button text="Close" @tap="router.back()" />
  </Page>
</template>
```

For a branded startup screen, keep the first page mounted underneath a [splash overlay](./splash).

## The demo app

The repository ships a small mail app with two tabs in [`demo/`](https://github.com/rafaelaugustos/vue-router-ns/tree/main/demo). It covers typed params, a compose modal that returns its text, a leave guard that only asks while there's a draft, a login guard, a lazy page, `clearHistory`, a message page that follows the Android back swipe, and tabs that go back to their first page when tapped again.

With the [NativeScript CLI](https://docs.nativescript.org/setup/) installed:

```sh
npm install
npm run build

cd demo
npm install
ns run ios         # or: ns run android
```
