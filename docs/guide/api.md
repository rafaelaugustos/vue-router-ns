# API

## Creating a router

```ts
import { createRouter } from 'vue-router-ns'

const router = createRouter({ routes, restore, backPreview: true })
```

| Option        | Default  | Meaning                                                                                                                |
| ------------- | -------- | ---------------------------------------------------------------------------------------------------------------------- |
| `diagnostics` | `false`  | `true` or `{ maxEvents }` for a bounded timeline and native snapshots. See [diagnostics](./diagnostics).               |
| `routes`      | Required | Readonly array of `RouteRecordRaw`.                                                                                    |
| `restore`     | Disabled | `save(state)`, `load()` and optional `maxAge` in milliseconds (default: 30 minutes). See [restoration](./restore).     |
| `backPreview` | `true`   | Reveal the previous page during Android 14+ back gestures. Requires the [platform opt-in](./android-back#enabling-it). |

Install once with `createApp(App).use(router).start()`. This registers the components and provides `$router` and `$route` in templates. `router.install(app)` is the Vue plugin hook.

## Router methods

`to` is a `RouteLocationRaw`: a path string, `{ path, query?, hash? }`, `{ name, params?, query?, hash? }`, or a location relative to the current route. Object locations also accept `replace` and `force`. Use `force: true` to push another instance of the current location. Params belong to named or relative locations, not a `path` object.

| Method                           | Behavior                                                                                                                                             |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `push(to, options?)`             | Add a page or present a modal.                                                                                                                       |
| `replace(to, options?)`          | Replace the current page.                                                                                                                            |
| `back(options?)`                 | Pop one page; close a modal at its root. At a non-modal root it does nothing. Android's system back can still leave the app.                         |
| `go(delta)`                      | Go back by a negative number of pages. Zero and positive values do nothing. Takes no options argument.                                               |
| `backTo(to, options?)`           | Return to the closest matching page below the top; rejects if absent.                                                                                |
| `backToRoot(options?)`           | Return to the first page in the current stack.                                                                                                       |
| `setStack(locations, options?)`  | Reconcile a nonempty list of locations with the stack. Preserves the common prefix; stops at the first failure without rolling back completed steps. |
| `pushForResult<T>(to, options?)` | Open a page and wait for `back({ result })`. Resolves to `T \| undefined` when it closes or opening is prevented.                                    |
| `resolve(to)`                    | Resolve a location synchronously without navigating. Returns `RouteLocation`; throws for an unmatched route.                                         |
| `isReady()`                      | Promise that settles after initial navigation; does not wait for every hidden tab to load.                                                           |

Navigation methods other than `pushForResult` resolve to `NavigationFailure | undefined`. Unexpected errors reject; see [failures](./navigating#failures-and-errors). Back methods have the [split-view semantics](./split-view#history-and-back) when called in a split stack.

### Navigation options

`push`, `replace` and `pushForResult` accept `NavigationOptions`:

| Option         | Meaning                                                                                                                             |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `frame`        | Named stack to target. Otherwise use the caller's page stack, or the focused stack outside a page. Does not select a `TabView` tab. |
| `transition`   | A name such as `'fade'` or a NativeScript transition object; overrides the route default. Includes `SharedTransition`.              |
| `animated`     | Set `false` to skip animation.                                                                                                      |
| `clearHistory` | Remove earlier pages, subject to guards. A split stack retains its list.                                                            |
| `props`        | Extra page props, merged over route-record props. Not persisted by `restore`.                                                       |
| `modal`        | `true`, `false`, or `ModalOptions`; overrides the route's presentation.                                                             |
| `withParents`  | Push component-bearing ancestors before the destination.                                                                            |
| `zoomFrom`     | View, element ref, component, or `null`; native iOS 18+ zoom source.                                                                |

`back`, `backTo` and `backToRoot` accept `BackOptions`: `animated`, `frame` and `result`. `go(delta)` has no options parameter. `setStack` accepts `SetStackOptions`: `frame`, `animated` and `transition`; animation applies to the last step only.

### Routes and hooks

| Method                                              | Return value                                                     |
| --------------------------------------------------- | ---------------------------------------------------------------- |
| `addRoute(record)` / `addRoute(parentName, record)` | Callback that removes the added route.                           |
| `removeRoute(name)`                                 | `void`. Removes a registered route; does not pop existing pages. |
| `hasRoute(name)`                                    | `boolean`.                                                       |
| `getRoutes()`                                       | Normalized `RouteRecord[]`.                                      |
| `beforeEach(guard)` / `beforeResolve(guard)`        | Callback that unregisters the guard.                             |
| `afterEach((to, from, failure?) => …)`              | Callback that unregisters the hook.                              |
| `onError((error, to, from) => …)`                   | Callback that unregisters the handler.                           |

A `NavigationGuard` receives `(to, from, { type })`, where `type` is `'push'`, `'replace'` or `'back'`. It can return a promise. Return `false` to abort, a location to redirect, or `undefined`/`true` to continue. Guards use return values, not `next()`. See [guards](./guards).

### State

- `currentRoute`: readonly ref to the focused route, including the active modal.
- `stack`: readonly ref to routes in bottom-to-top order. A page-bound router exposes that page's stack; the exported router follows the focused stack.
- `diagnostics`: `RouterDiagnostics` when enabled; otherwise `undefined`. See [diagnostics](./diagnostics).
- `options`: the router configuration.
- `START_LOCATION`: empty location before initial navigation (`path: '/'`, no matched records).

## Locations and route records

`RouteLocation` contains `path`, `fullPath`, `name`, `params`, `query`, `hash`, `meta`, `matched` and `redirectedFrom`. Resolved params are strings or string arrays. Query values are strings, `null`, or arrays; input query values also accept numbers, booleans and `undefined`. `meta` merges parent to child.

`RouteRecordRaw` accepts `path`, `name` (string or symbol), `component` (component or sync/async loader), `children`, `redirect` (location or function), `meta`, `props` (`true`, object or mapper), `beforeEnter` (guard or array), `modal` (`boolean` or `ModalOptions`) and `transition`.

Paths support named parameters, optional/repeated parameters and custom patterns. See [typed routes](./typed-routes). `children` nests paths and metadata; it does not create nested UI automatically.

`ModalOptions` forwards NativeScript `showModal` options except `context` and `closeCallback`, which the router owns. Its `ios` options also accept `detents`, `selectedDetent`, `largestUndimmedDetent`, `grabber` and `cornerRadius`. See [modals and sheets](./modals).

## Composables

| Function                               | Contract                                                                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `useRouter()`                          | Router bound to the current page's stack; app router outside a page. Requires an app using the router.                          |
| `useRoute(name?)`                      | This page's fixed route, or the focused route outside pages. The optional name narrows types; it does not select another route. |
| `onBeforeRouteLeave(guard, { when }?)` | Page leave guard. `when` accepts a boolean, ref or getter. Removed on unmount.                                                  |
| `onPageActivated(hook)`                | Called when the page becomes visible, including its first activation and returns.                                               |
| `onPageDeactivated(hook)`              | Called when covered. For removal use Vue's `onUnmounted`.                                                                       |
| `useBackGesture()`                     | Readonly shallow ref to `{ progress, edge }` or `null`; Android 14+. `edge` is `'left'`, `'right'` or `'none'`.                 |

Register page hooks in the routed component's setup. In an expanded split view, both list and top detail are active. See [page lifecycle and HMR](./pages).

## Components

| Component         | Props and slots                                                                                                                                                                                          |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RouterView`      | `name` (`'default'`), `initial` (`'/'`), `backToRootOnReselect` (`false`). Mounts one Frame.                                                                                                             |
| `RouterSplitView` | Required `list`; `name` (`'default'`), `breakpoint` (840), `listWidth` (320), `backToRootOnReselect` (`false`). Slot: `empty`.                                                                           |
| `RouterLink`      | Required `to`; `replace`, `clearHistory`, `withParents`, `zoom` (all `false`); `transition`, `frame`. One default-slot child; slot receives `{ navigate }`. Adds a tap handler without a native wrapper. |
| `Deferred`        | No props. Slots: default content and `fallback`. Shows content after the page's first activation and keeps it mounted afterward. Outside a routed page, renders immediately.                             |

Router view names must be unique, including split views. `name` and the initial route (`initial`/`list`) are read at mount; use a new Vue `key` to create a different stack. Split view dimensions are device-independent pixels; list width is capped at half the available width. See [split view](./split-view).

## Failures and exported types

`isNavigationFailure(value, type?)` identifies a `NavigationFailure` (`Error` with `type`, `to`, `from`). `NavigationFailureType` has `aborted` (4), `cancelled` (8), and `duplicated` (16); the optional type argument also accepts a bitmask.

Public types are exported from the package root:

- Router configuration: `Router`, `RouterOptions`, `RestoreOptions`, `SavedStacks`.
- Routes: `RouteRecordRaw`, `RouteRecord`, `RouteRecordName`, `RouteMeta`, `RouteProps`, `RouteComponent`, `RawRouteComponent`, `Lazy`.
- Locations: `RouteLocation`, `RouteLocationRaw`, `RouteLocationPathRaw`, `RouteLocationNamedRaw`, `RouteLocationRelativeRaw`, `RouteParams`, `RouteParamsRaw`, `RouteParamValue`, `RouteParamValueRaw`, `LocationQuery`, `LocationQueryRaw`, `LocationQueryValue`, `LocationQueryValueRaw`.
- Navigation: `NavigationOptions`, `BackOptions`, `SetStackOptions`, `NavigationType`, `NavigationInfo`, `NavigationGuard`, `NavigationGuardReturn`, `NavigationHookAfter`, `NavigationErrorHandler`, `NavigationFailure`, `LeaveGuardOptions`.
- Native presentation: `ModalOptions`, `SheetOptions`, `SheetDetent`, `TransitionOption`, `ZoomSource`, `BackGesture`, `BackGestureEdge`.
- Inferred route types: `Register`, `RegisteredRouter`, `RouteMapFrom`, `RouteMapGeneric`, `RouteNames`, `RouteLocationOf`, `RouteLocationRawOf`, `ParamsFromPath`.

Augment `Register` and `RouteMeta` as shown in [typed routes](./typed-routes).

## Diagnostics

`RouterDiagnostics` exposes `routerId`, `stopped`, `events`, `droppedEvents`, `snapshot()`, `subscribe(listener)`, `toJSON()`, `export()`, `clear()` and `stop()`. Data is readonly, bounded and redacted; `stop()` releases live sources. Exported types: `DiagnosticsOptions`, `RouterDiagnostics`, `DiagnosticsExport`, `DiagnosticSnapshot`, `DiagnosticStack`, `DiagnosticHost`, `DiagnosticEntry`, `DiagnosticIssue`, `DiagnosticIssueCode`, `DiagnosticEvent`, `DiagnosticPhase` and `DiagnosticOutcome`. See [diagnostics](./diagnostics) for format, timing semantics and lifetime.

## Native search

`useNativeSearch(options)` registers page-owned native search. Exports: `NativeSearchOptions`, `NativeSearch`. See [native bars and search](./native-bars) for query ownership, activation and platform differences.

## Keyboard commands

`useNavigationCommands(source)` and `NavigationCommandScope` bind opt-in commands to a page/window. Types: `NavigationCommand`, `NavigationCommandState`, `NavigationCommands`, `NavigationShortcut`, `KeyModifier`. See [keyboard commands](./keyboard).

## Accessibility and motion

`useNavigationFocus(options)` supplies opt-in initial/return accessibility targets and modal initiator restoration. Types: `NavigationFocus`, `NavigationFocusOptions`, `NavigationFocusTarget`. `RouterOptions.motion` accepts `MotionPolicy` (`system`, `reduced`, `full`); default `system`. See [accessibility and motion](./accessibility).
