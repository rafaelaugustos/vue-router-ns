# Optional middleware and navigation helpers

Explicit route records and `router.push()` remain the default API. You can optionally use named middleware and navigation helpers with those same records. They use the existing matcher, guard transaction and native stacks; neither Nuxt nor Vue Router is a dependency.

This is the middleware/helper part of the optional Nuxt-style conventions. File routing, named layouts and auto-import tooling are separate roadmap items, not enabled by these APIs. All examples use explicit imports.

## Register middleware on your router

```ts
import { createRouter, defineRouteMiddleware } from 'vue-router-ns'

const auth = defineRouteMiddleware((to, from, { type }) => {
  if (!session.user) {
    return { name: 'login', query: { next: to.fullPath }, replace: true }
  }
})

const router = createRouter({
  routes: [
    { path: '/', component: () => import('./Home.vue') },
    { path: '/login', name: 'login', component: () => import('./Login.vue') },
    {
      path: '/account',
      component: () => import('./Account.vue'),
      meta: { middleware: ['auth'] },
    },
  ],
})

const removeAuth = router.addRouteMiddleware('auth', auth)
router.addRouteMiddleware(
  'metrics',
  (to, from, info) => {
    // Observe this guarded navigation. Return nothing to continue.
  },
  { global: true },
)
```

Register before mounting the app to cover initial navigation. Registration belongs to that router instance, including its stacks and modals. It creates no process-wide singleton. A duplicate name throws; the returned disposer unregisters that registration and is safe to call repeatedly. `defineRouteMiddleware()` only types the function; it does not register it.

`meta.middleware` accepts a name, a function, or a readonly array of names/functions. Parent metadata is merged into the destination as usual: a child's `middleware` replaces the parent's list. Use `[]` to clear inherited middleware; global middleware still runs. Unknown names throw and reach `router.onError()`.

## Execution and results

Each guarded navigation runs:

1. Leave guards on entries being removed.
2. `beforeEach` guards, in registration order.
3. Global middleware, in registration order, then destination middleware in declaration order.
4. `beforeEnter` on newly entered records, then the component loader, for push/replace.
5. `beforeResolve`, the native operation, then `afterEach`.

A repeated middleware name, or repeated inline function reference, runs once in the middleware phase. A global name also listed in metadata runs once. The phase snapshots registrations after `beforeEach`; unregistering during an asynchronous middleware does not change that attempt's snapshot. A function separately installed as a `beforeEach` guard is a separate registration and still runs at that phase.

Middleware uses the same `(to, from, { type })` and return values as [guards](./guards): `false` aborts; a native route location redirects; `true`/`undefined` continues; promises are awaited. Throwing rejects the navigation and reaches `onError()` once. A redirect reuses the existing navigation machinery and redirect limit. **Return the destination from middleware; do not call `router.push()` or `navigateTo()` from inside it.** Those start another navigation, with the usual cancellation semantics, rather than returning a guard decision.

Middleware runs for initial navigation, push, replace and router-mediated back, including repeated visits to the same record. Duplicate navigation to the current page is still skipped unless `force` is set. On back it checks the destination's metadata, not the page being removed. Use a page's leave guard to protect its unsaved work.

## Navigate in the owning stack

In a routed page's setup, capture the helper once:

```vue
<script setup lang="ts">
import { useNavigateTo, useRoute } from 'vue-router-ns'

const navigateTo = useNavigateTo()
const route = useRoute()

function openAccount() {
  return navigateTo('/account')
}
</script>

<template>
  <Page>
    <Button text="Account" @tap="openAccount" />
  </Page>
</template>
```

The captured helper stays bound to that page's stack even when another stack is focused. `useRoute()` still describes that particular page entry while it is covered. Calling the helper after the component unmounts or its entry is disposed rejects, instead of navigating in a different stack. `useNavigateTo()` requires a routed page's setup.

Outside setup, pass the owning router explicitly:

```ts
import { navigateTo } from 'vue-router-ns'

await navigateTo(router, '/account', { frame: 'settings', replace: true })
```

Named locations inherit the supplied router's route-name and parameter types. `useNavigateTo()` picks up the router's [type registration](./typed-routes). Options are existing `NavigationOptions` plus `replace`: frame, modal, transition, animated, clearHistory, props, withParents and zoomFrom keep their native meanings. A location's own `replace: true` also keeps its existing behavior.

The promise has the same result as `router.push()`/`replace()`: `undefined` on success, a `NavigationFailure` on refusal/cancellation/duplication, or rejection on error. It settles when the native operation completes. Opening a modal settles at presentation; use `router.pushForResult<T>()` to await the result returned when that modal closes. There is no second history or browser-style forward stack.

## Native limits and supported conventions

Middleware has the same native gesture limits as global guards. Android Back goes through the router. An unguarded iOS native pop can complete before JavaScript sees it, so middleware cannot veto it afterward. An active `onBeforeRouteLeave()` holds iOS swipe-back and cancellable modal dismissal while its asynchronous decision runs; see [guard behavior](./guards#what-the-platform-does-while-a-guard-is-active). Middleware alone does not install a page leave guard or disable native gestures.

These helpers accept native route locations. External URLs, browser `open`/`external` options and server `redirectCode` are unsupported and reject. Middleware redirects also reject external URLs. For an app/Universal Link use `router.openLink()` and its URL policy; for opening a browser use NativeScript's platform API explicitly.

There is no filesystem discovery or auto-import installation in this API. Explicit registrations/imports work without build tooling. Any future discovery must register through the same API and report name collisions rather than overwrite handlers.
