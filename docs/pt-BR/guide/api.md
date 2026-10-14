# API

## Router

`createRouter({ routes, restore })` retorna um router com:

- **Navegação**: `push`, `replace`, `back`, `go`, `backTo`, `backToRoot`, `setStack`, `pushForResult`, `resolve`.
- **Rotas**: `addRoute`, `removeRoute`, `hasRoute`, `getRoutes`.
- **Guards**: `beforeEach`, `beforeResolve`, `afterEach`, `onError`.
- **Estado**: `currentRoute`, `stack`, `isReady()`.

Os métodos de navegação retornam `Promise<NavigationFailure | undefined>`. O `pushForResult<T>()` retorna `Promise<T | undefined>`.

### Opções de navegação

`push` e `replace` aceitam `transition`, `animated`, `clearHistory`, `props`, `frame`, `modal`, `withParents` e `zoomFrom`. `back`, `go`, `backTo` e `backToRoot` aceitam `animated`, `frame` e `result`. `setStack` aceita `frame`, `animated` e `transition`.

## Records de rota

`path`, `name`, `component` (ou uma função que o retorna, síncrona ou assíncrona), `children`, `redirect`, `meta`, `props` (`true`, um objeto ou uma função da rota), `beforeEnter`, mais `modal` (`true` ou `ModalOptions`) e `transition`.

## Composables

`useRouter`, `useRoute`, `onBeforeRouteLeave`, `onPageActivated`, `onPageDeactivated`, `useBackGesture`.

## Componentes

`<RouterView name initial backToRootOnReselect>`, `<RouterLink to replace clearHistory withParents zoom transition frame>` e `<Deferred>`, que renderiza o conteúdo quando a página está na tela e um slot `fallback` até lá.

## Helpers

`isNavigationFailure`, `NavigationFailureType`, `START_LOCATION`, mais `$router` e `$route` nos templates.

## Tipos

`Register` e `RouteMeta` para estender, `RouteLocation`, `RouteLocationRaw`, `RouteRecordRaw`, `NavigationGuard`, `NavigationOptions`, `BackOptions`, `SetStackOptions`, `RestoreOptions`, `SavedStacks`, `ModalOptions`, `ZoomSource`, `BackGesture`, `ParamsFromPath`, e o resto exportado pelo pacote.
