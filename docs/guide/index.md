# What vue-router-ns is

vue-router-ns gives [NativeScript-Vue 3](https://nativescript-vue.org) the API of Vue Router, built on top of the native navigation stack instead of a URL history.

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

## Why not Vue Router itself

Vue Router can't drive a mobile app: it models navigation as one URL that changes, with a `<RouterView>` that swaps components. A NativeScript app has a `Frame` with a stack of pages that stay alive underneath each other, a back button and an iOS swipe that pop pages without asking anyone, modals, and often one stack per tab.

So this is not a wrapper around Vue Router. The frame's back stack is the source of truth, and the router mirrors it after every native navigation. What you get is the API you already know (`push`, guards, `useRoute`, named routes, params) with semantics that make sense on a phone.

## What it covers

- [A route per page](./pages): `useRoute()` inside a page never changes, even with other pages pushed on top.
- [Leave guards](./guards) that the Android back button, the iOS back button and a modal's swipe-down go through, and that turn the iOS swipe off while they'd block it.
- [Modal routes](./modals) with their own stack, and `pushForResult()` to get a value back from a page.
- [One stack per tab](./tabs), with a tap on the active tab going back to its first page.
- [Typed routes](./typed-routes): names and params checked across the app, with no code generation.
- [Deep links](./deep-links) that bring their parents along, [the whole stack set as a list](./stack), and [restoring it](./restore) after the app is killed.
- [Android predictive back](./android-back) for pages that want to follow the swipe.
- [`<Deferred>`](./pages#pages-with-a-lot-to-lay-out) for pages that should animate in before they fill up.

## Where to start

1. [Install it](./install) and mount a `<RouterView>`.
2. Read [Navigating](./navigating) and [Every page keeps its route](./pages): that's where it differs most from the web.
3. Coming from Vue Router, skim [the differences](./vue-router).

It's in beta, published under the `next` tag. The router is covered by tests against a stand-in `Frame`, and the pieces that touch the platform are being checked on devices one by one.
