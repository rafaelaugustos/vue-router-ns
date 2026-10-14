<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/rafaelaugustos/vue-router-ns/master/.github/assets/logo-dark.png">
    <img src="https://raw.githubusercontent.com/rafaelaugustos/vue-router-ns/master/.github/assets/logo.png" alt="vue-router-ns" width="360">
  </picture>
</p>

<p align="center">
  Vue Router's API for <a href="https://nativescript-vue.org">NativeScript-Vue 3</a>, built on top of the native navigation stack instead of a URL history.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/vue-router-ns"><img src="https://img.shields.io/npm/v/vue-router-ns/next?label=npm%40next" alt="npm"></a>
  <a href="https://github.com/rafaelaugustos/vue-router-ns/actions/workflows/ci.yml"><img src="https://github.com/rafaelaugustos/vue-router-ns/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/rafaelaugustos/vue-router-ns/blob/master/LICENSE"><img src="https://img.shields.io/npm/l/vue-router-ns" alt="MIT license"></a>
</p>

```ts
const router = createRouter({
  routes: [
    { path: '/', name: 'inbox', component: () => import('./pages/Inbox.vue') },
    {
      path: '/messages/:id',
      name: 'message',
      component: () => import('./pages/Message.vue'),
    },
    { path: '/compose', component: () => import('./pages/Compose.vue'), modal: true },
  ],
})

router.push({ name: 'message', params: { id: 42 } })
```

Vue Router can't drive a mobile app: it models navigation as one URL that changes, with a `<RouterView>` that swaps components. A NativeScript app has a `Frame` with a stack of pages that stay alive underneath each other, a back button and an iOS swipe that pop pages without asking anyone, modals, and often one stack per tab.

So this is not a wrapper around Vue Router. The frame's back stack is the source of truth, and the router mirrors it after every native navigation. What you get is the API you already know (`push`, guards, `useRoute`, named routes, params) with semantics that make sense on a phone.

## Features

- [A route per page](#every-page-keeps-its-route): `useRoute()` inside a page never changes, even with other pages pushed on top.
- [Leave guards](#guards) that the Android back button goes through, and that turn the iOS swipe off while they'd block it.
- [Modal routes](#modals) with their own stack, and [`pushForResult()`](#getting-a-result-back) to get a value back from a page.
- [One stack per tab](#tabs-and-other-independent-stacks), with named `<RouterView>`s, and [`setStack()`](#setting-the-whole-stack) to set a stack as a list.
- [Typed routes](#typed-routes): names and params checked across the app, with no code generation.
- [Android predictive back](#android-predictive-back) for pages that want to follow the swipe.

## Install

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

## Navigating

```ts
router.push('/messages/42?from=push')
router.push({ name: 'message', params: { id: 42 }, query: { from: 'push' } })
router.replace('/login')
router.back()
router.go(-2)
router.backTo({ name: 'inbox' }) // closest page below that matches
```

Everything returns a promise that settles once the page is on screen, with a `NavigationFailure` when a guard stopped it, like Vue Router.

A second argument takes what only makes sense on a device:

```ts
router.push('/messages/42', {
  transition: 'slideLeft', // or a full NativeScript transition object
  animated: false,
  clearHistory: true, // nothing left to go back to
  props: { preview }, // any value, unlike params
  frame: 'profile', // a named <RouterView>
  modal: true, // present modally, whatever the route says
})
```

Navigations queue behind native transitions, so a double tap on a button opens the page once: the second `push` finds the page already on top and resolves with a `duplicated` failure.

## Setting the whole stack

Like SwiftUI's `NavigationStack(path:)`, the stack can be set as a list, and the pages follow:

```ts
await router.setStack(['/', '/orders', { name: 'order', params: { id: 42 } }])
```

The router keeps the pages both stacks share from the bottom up, goes back to the last of them, then pushes the rest. Only the last step animates. Guards run for every step, and the first failure stops it. A modal route in the list becomes a plain page: the list describes one frame's stack.

It takes `frame`, `animated` and `transition` as a second argument, and it's what a deep link into a nested page or a "back to the first tab page" helper is built on.

## Every page keeps its route

Pushing a page doesn't destroy the one below: it stays mounted until it leaves the stack. That's why `useRoute()` inside a page returns that page's route, and it never changes. While `/messages/2` sits on top of `/messages/1`, the first page still sees `id: '1'`, and nothing re-runs because another page moved.

Outside pages (in `App.vue`, for example), `useRoute()` follows the page on screen. `router.currentRoute` is always the page on screen, and `router.stack` is the whole stack, bottom to top, reactive:

```ts
const { stack } = useRouter()
const canGoBack = computed(() => stack.value.length > 1)
```

`useRouter()` inside a page navigates in the stack that page lives in: its tab, or its modal.

## Guards

Global guards and `beforeEnter` work as in Vue Router 4: return `false` to cancel, a location to redirect, or nothing to continue. They can be async. A third argument tells you what kind of navigation it is:

```ts
router.beforeEach((to, from, { type }) => {
  // type: 'push' | 'replace' | 'back'
  if (to.meta.requiresAuth && !session.user) {
    return { name: 'login', query: { next: to.fullPath } }
  }
})
```

`onBeforeRouteLeave` runs when its page is about to be removed from the stack: on back, replace or `clearHistory`, and also on the Android back button, which the router intercepts so your guard gets a say. Pushing another page on top keeps the page alive, so the guard doesn't run then.

```ts
const dirty = computed(() => draft.value.trim() !== '')

onBeforeRouteLeave(() => Dialogs.confirm('Discard this draft?'), { when: dirty })
```

`when` is optional, and it matters on iOS. A swipe back can't wait for an async guard, so while a leave guard is active the router turns swipe-back off for that page. With `when`, the guard only blocks while it's true: with an empty draft, the page swipes away as usual.

A modal is different: while a guard is active, swiping it down or tapping outside runs the guard instead, with the sheet staying put. Mail does this with a draft: the sheet bounces back and asks whether to discard. If the guard allows it, the modal closes.

## Modals

Mark a route with `modal: true`, or pass `ModalOptions` (`fullscreen`, `animated`, `cancelable`, `ios.presentationStyle`…):

```ts
{ path: '/compose', component: Compose, modal: { fullscreen: true } }
```

`router.push('/compose')` presents it inside its own frame, so it has an ActionBar and its own stack. Pages inside push within the modal. `router.back()` from the first page of the modal closes it. Swiping it down, tapping outside or pressing the Android back button closes it too, through the leave guards of its pages. The router follows along and runs `afterEach`.

## Getting a result back

A page can return a value to whoever opened it. This works with modals and with plain pages:

```ts
// Message.vue
const reply = await router.pushForResult<string>('/compose')
if (reply) send(reply)
```

```ts
// Compose.vue
router.back({ result: text.value })
```

If the page closes any other way (a swipe, the back button) or a guard stops it from opening, the promise resolves with `undefined`.

## Tabs and other independent stacks

Use one `<RouterView>` per stack and name it:

```vue
<TabView>
  <TabViewItem title="Inbox">
    <RouterView name="inbox" initial="/" />
  </TabViewItem>
  <TabViewItem title="Settings">
    <RouterView name="settings" initial="/settings" />
  </TabViewItem>
</TabView>
```

Pages navigate in their own tab. From anywhere else, target one with `{ frame: 'settings' }`.

Native tab bars go back to the first page when you tap the tab you're already on. `backToRootOnReselect` does that for a `<RouterView>` inside a `<TabViewItem>`, through the leave guards like any back:

```vue
<RouterView name="inbox" initial="/" backToRootOnReselect />
```

`router.backToRoot()` does the same on demand.

## When a page comes back into view

A page that stays in the stack isn't mounted again when you return to it, so `onMounted` won't help you refresh it. Use these instead:

```ts
onPageActivated(() => refresh()) // shown, and every time the user comes back
onPageDeactivated(() => pause()) // covered by another page or a modal
```

When the page leaves the stack it is unmounted, so cleanup goes in `onUnmounted`.

## Android predictive back

Since Android 14, the back swipe reports its progress while the finger moves. `useBackGesture()` hands it to the page the swipe would close, so the page can follow the finger:

```vue
<script setup lang="ts">
import { computed } from 'nativescript-vue'
import { useBackGesture } from 'vue-router-ns'

const gesture = useBackGesture()
const scale = computed(() => 1 - (gesture.value?.progress ?? 0) * 0.1)
</script>

<template>
  <Page>
    <GridLayout :scaleX="scale" :scaleY="scale">...</GridLayout>
  </Page>
</template>
```

While the user drags, it's `{ progress, edge }`, with `progress` going from 0 to 1. The rest of the time it's `null`: once the swipe is cancelled or released, on iOS, on the first page (where back leaves the app), on a modal with `cancelable: false`, and while a leave guard is active, since letting go won't simply close the page then. Releasing goes back through the router like the back button, guards included.

Apps that target Android 16 (API 36) get predictive back by default. Earlier targets opt in with `android:enableOnBackInvokedCallback="true"` on `<application>` in `AndroidManifest.xml`.

The page below doesn't show through during the swipe. `@nativescript/core` doesn't keep it in a fragment back stack the system could preview, so what happens on screen is up to the page ([#19](https://github.com/rafaelaugustos/vue-router-ns/issues/19)).

## Deep links

Routes are paths, so wherever your app receives a link (a URL handler, a notification payload), hand the path to the router:

```ts
router.push('/messages/42')
```

That's safe on a cold start: a navigation requested before the first page is up waits for it and stacks on top, so back still lands on your home page.

A link into a nested page can bring its parents along, so back walks up the app's hierarchy instead of jumping home:

```ts
router.push('/settings/account', { withParents: true })
// stack: / → /settings → /settings/account
```

The parents come from `children` nesting in the route table, and only those with a component become pages. Parents already on top are skipped, only the last page animates, and guards run for every page. With `clearHistory`, the parents and the page become the whole stack.

## Typed routes

Register the router once, and route names and params get checked across the app, inferred from the route table with no code generation:

```ts
declare module 'vue-router-ns' {
  interface Register {
    router: typeof router
  }
  interface RouteMeta {
    requiresAuth?: boolean
  }
}
```

```ts
router.push({ name: 'message', params: { id: 1 } }) // ✓
router.push({ name: 'mesage' }) // ✗ Did you mean 'message'?
router.push({ name: 'message' }) // ✗ missing param `id`

const route = useRoute('message')
route.params.id // string
```

Declare `routes` inline in `createRouter`, as above, and load route components lazily (`() => import(...)`). With eager imports, the route table's type depends on your `<script setup>` pages, while those pages use the route table's types. TypeScript can't resolve that cycle. Lazy loading breaks it, and it keeps startup light ([#17](https://github.com/rafaelaugustos/vue-router-ns/issues/17)).

## Differences from Vue Router

| Vue Router                                 | vue-router-ns                                                                                                    |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `createWebHistory()` and friends           | No history option: the native stack is the history.                                                              |
| `<RouterView>` swaps components            | `<RouterView>` is a `Frame`. Every navigation is a page in its stack.                                            |
| `useRoute()` is the current route          | Inside a page, it's that page's route.                                                                           |
| `onBeforeRouteLeave` runs on any departure | Runs when the page leaves the stack. A push on top keeps it alive.                                               |
| `onBeforeRouteUpdate`                      | Not available: different params mean a new page.                                                                 |
| `router.forward()`, `go(n > 0)`            | There is no forward history.                                                                                     |
| Nested `<RouterView>` through `children`   | `children` nest paths and merge `meta`. Nested UI is another `<RouterView>`.                                     |
| `beforeEnter` runs on back navigations     | Going back reveals a page that already exists, so only leave guards and global guards run.                       |
| A guard redirect during back               | Becomes a push to the redirect target.                                                                           |
| `next()` in guards                         | Return values only.                                                                                              |
| Unknown paths render nothing               | `push` rejects with `No route matches`. Add a catch-all route (`/:pathMatch(.*)*`) if you want a not-found page. |
| `scrollBehavior`                           | Not applicable. `hash` is kept in locations for parity.                                                          |

On iOS, the ActionBar's back button pops the page natively, and no NativeScript API can stop it. The router keeps its stack in sync and runs `afterEach`, but a leave guard can't veto that pop. If a page must confirm before leaving, replace the system back button with your own action that calls `router.back()` ([#9](https://github.com/rafaelaugustos/vue-router-ns/issues/9)).

## API

**Router**: `createRouter({ routes })`, `push`, `replace`, `back`, `go`, `backTo`, `backToRoot`, `setStack`, `pushForResult`, `resolve`, `addRoute`, `removeRoute`, `hasRoute`, `getRoutes`, `beforeEach`, `beforeResolve`, `afterEach`, `onError`, `isReady`, `currentRoute`, `stack`.

**Route records**: `path`, `name`, `component` (or a lazy loader), `children`, `redirect`, `meta`, `props` (`true`, an object or a function of the route), `beforeEnter`, plus `modal` and `transition`.

**Composables**: `useRouter`, `useRoute`, `onBeforeRouteLeave`, `onPageActivated`, `onPageDeactivated`, `useBackGesture`.

**Components**: `<RouterView name initial backToRootOnReselect>` and `<RouterLink to replace clearHistory withParents transition frame>`. `RouterLink` makes its only child navigate on tap, without adding a view:

```vue
<RouterLink to="/settings">
  <Button text="Settings" />
</RouterLink>
```

**Helpers**: `isNavigationFailure`, `NavigationFailureType`, `START_LOCATION`, plus `$router` and `$route` in templates.

## How it works

Each `<RouterView>` renders a NativeScript `Frame`. Pages are mounted with `$navigateTo`, inside a small wrapper that provides their route and a router bound to their stack. NativeScript-Vue mounts every page as its own app, so nothing provided by `<RouterView>` would reach them otherwise.

The router never keeps a history of its own. After every `navigatedTo`, it reads `frame.backStack` and the current page and mirrors them. Pops it didn't start, like an iOS swipe, are picked up the same way as its own. `replace` marks the current entry `backstackVisible: false` before navigating, which is how the frame drops a page natively.

## Demo

[`demo/`](./demo) is a small mail app with two tabs. It covers typed params, a compose modal that returns its text, a leave guard that only asks while there's a draft, a login guard, a lazy page, `clearHistory`, and a message page that follows the Android back swipe.

With the [NativeScript CLI](https://docs.nativescript.org/setup/) installed:

```sh
npm install
npm run dev        # builds the router in watch mode

cd demo
npm install
ns run ios         # or: ns run android
```

## Development

```sh
npm test           # unit tests, plus type tests for typed routes
npm run typecheck
npm run build
```

The tests run against a stand-in for NativeScript's `Frame` ([`test/shims/core.ts`](./test/shims/core.ts)). It follows the real one's ordering: navigations finish on a later tick, and dropped pages are disposed before `navigatedTo` fires.

### Releasing

Releases go out from `master` on their own. Bump the version and move the changes under it in `CHANGELOG.md`:

```sh
npm version 0.2.0 --no-git-tag-version
```

Once that lands on `master`, the [release workflow](./.github/workflows/release.yml) sees a version that isn't on npm yet. It runs the tests, publishes the package and creates the `v0.2.0` GitHub release from the changelog entry. Versions with a suffix, like `0.2.0-beta.1`, go out under `next` as pre-releases, and under `latest` too until a stable version is out. Pushes that don't change the version do nothing.

npm authenticates the workflow through [trusted publishing](https://docs.npmjs.com/trusted-publishers), so the repository holds no npm token. An `NPM_TOKEN` secret works too, if you'd rather use one.

## License

[MIT](./LICENSE)
