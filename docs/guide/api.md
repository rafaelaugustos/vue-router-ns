# API

## Router

`createRouter({ routes, restore })` returns a router with:

- **Navigation**: `push`, `replace`, `back`, `go`, `backTo`, `backToRoot`, `setStack`, `pushForResult`, `resolve`.
- **Routes**: `addRoute`, `removeRoute`, `hasRoute`, `getRoutes`.
- **Guards**: `beforeEach`, `beforeResolve`, `afterEach`, `onError`.
- **State**: `currentRoute`, `stack`, `isReady()`.

Navigation methods return `Promise<NavigationFailure | undefined>`. `pushForResult<T>()` returns `Promise<T | undefined>`.

### Navigation options

`push` and `replace` take `transition`, `animated`, `clearHistory`, `props`, `frame`, `modal` and `withParents`. `back`, `go`, `backTo` and `backToRoot` take `animated`, `frame` and `result`. `setStack` takes `frame`, `animated` and `transition`.

## Route records

`path`, `name`, `component` (or a function returning it, sync or async), `children`, `redirect`, `meta`, `props` (`true`, an object or a function of the route), `beforeEnter`, plus `modal` (`true` or `ModalOptions`) and `transition`.

## Composables

`useRouter`, `useRoute`, `onBeforeRouteLeave`, `onPageActivated`, `onPageDeactivated`, `useBackGesture`.

## Components

`<RouterView name initial backToRootOnReselect>`, `<RouterLink to replace clearHistory withParents transition frame>` and `<Deferred>`, which renders its content once the page is on screen and a `fallback` slot until then.

## Helpers

`isNavigationFailure`, `NavigationFailureType`, `START_LOCATION`, plus `$router` and `$route` in templates.

## Types

`Register` and `RouteMeta` to augment, `RouteLocation`, `RouteLocationRaw`, `RouteRecordRaw`, `NavigationGuard`, `NavigationOptions`, `BackOptions`, `SetStackOptions`, `RestoreOptions`, `SavedStacks`, `ModalOptions`, `BackGesture`, `ParamsFromPath`, and the rest exported from the package.
