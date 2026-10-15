# Navigating

```ts
router.push('/messages/42?from=push')
router.push({ name: 'message', params: { id: 42 }, query: { from: 'push' } })
router.replace('/login')
router.back()
router.go(-2)
router.backTo({ name: 'inbox' }) // closest page below that matches
router.backToRoot() // first page of the stack
```

Everything returns a promise that settles once the page is on screen, with a `NavigationFailure` when a guard stopped it, like Vue Router.

## Options

A second argument takes what only makes sense on a device:

```ts
router.push('/messages/42', {
  transition: 'slideLeft', // or a full NativeScript transition object
  animated: false,
  clearHistory: true, // nothing left to go back to
  props: { preview }, // any value, unlike params
  frame: 'profile', // a named <RouterView>
  modal: true, // present modally, whatever the route says
  withParents: true, // push the route's parents first
  zoomFrom: thumbnail, // iOS 18: grow out of this view
})
```

`back()` takes `animated`, `frame` and `result` (see [Modals and results](./modals)).

## Double taps

Navigations queue behind native transitions, so a double tap on a button opens the page once: the second `push` finds the page already on top and resolves with a `duplicated` failure.

## `<RouterLink>`

`RouterLink` makes its only child navigate on tap, without adding a view:

```vue
<RouterLink to="/settings">
  <Button text="Settings" />
</RouterLink>
```

It takes `to`, `replace`, `clearHistory`, `withParents`, `zoom`, `transition` and `frame`.

## Failures and errors

A completed navigation resolves to `undefined`. An expected interruption resolves to `NavigationFailure`: `aborted` when a guard returns `false`, `duplicated` when the destination is already on top, or `cancelled` when a newer navigation supersedes one still pending.

```ts
import { isNavigationFailure, NavigationFailureType } from 'vue-router-ns'

const failure = await router.push('/messages/42')
if (isNavigationFailure(failure, NavigationFailureType.aborted)) {
  // The current page remains open.
}
```

An unmatched route, failed loader or thrown guard error rejects the promise. Use `try/catch` at the call site and `router.onError((error, to, from) => …)` for global observation. `afterEach((to, from, failure) => …)` receives expected navigation failures; these are distinct from exceptions.

To push another instance of the current location, use `router.push({ path: '/messages/42', force: true })`. Without `force`, changes to params, query or hash already represent a different location.
