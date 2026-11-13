# Route data preloading (experimental)

Prepare one explicitly opted-in route loader when a user touches a card. The destination consumes valid prepared/in-flight data only after its normal navigation guards. Preparation does not import components, mount Vue/native views, reveal tabs, change history or run navigation guards. Existing loaders and [code preloading](./preloading) remain independent; there is no automatic speculative network traffic or required cache framework.

## Authorize an explicitly safe loader

Pass a `preload` policy as the second argument to `defineRouteLoader()`. `scope()` must return a stable object for the current session/permission epoch, or `null`/`undefined` to deny preparation. `authorize({ to, from })` must return the boolean `true` synchronously. It must be a side-effect-free permission check; asynchronous policies are denied. Resolve asynchronous authentication in the app before allowing preparation. These checks do not replace server authorization or navigation guards.

```ts
import { defineRouteLoader } from 'vue-router-ns'

type Session = { accessToken: string; mayReadProducts: boolean }
type Product = { id: string; title: string }
let session: Session | null = null

export function updateSession(next: Session | null) {
  session = next ? { ...next } : null
}
export const productData = defineRouteLoader(
  async ({ to }) => {
    const account = session
    if (!account?.mayReadProducts) throw new Error('Product access denied')
    const response = await fetch(
      `https://api.example.com/products/${encodeURIComponent(String(to.params.id))}`,
      { headers: { Authorization: `Bearer ${account.accessToken}` } },
    )
    if (!response.ok) throw new Error('Could not load product')
    return response.json() as Promise<Product>
  },
  {
    preload: {
      scope: () => session,
      authorize: () => session?.mayReadProducts === true,
    },
  },
)
```

The example captures credentials at invocation. Replace the scope object when the account, credentials or permissions change. Do not return a new object on every scope read. After updating the session, clear prepared work as shown below.

Declare the same loader definition in route metadata. Named definitions and matched parent declarations also work. Preparation selects only the requested definition; sibling loaders are not started. The configuration shows the defaults for a separate data pool:

```ts
const router = createRouter({
  routes: [
    { path: '/', component: () => import('./Home.vue') },
    {
      path: '/products/:id',
      name: 'product',
      component: () => import('./Product.vue'),
      meta: { loaders: productData },
    },
  ],
  preloadData: { concurrency: 2, maxEntries: 16, ttl: 30_000 },
})
```

## Prepare from a page

Capture `useRouteDataPreload()` during routed page setup. Connect these functions to touch-down, abandoned drag/cancel and release using the [complete touch handler](./preloading#prepare-from-a-page); keep its ordinary accessible button as another way to open. The helper releases interest on page/scope disposal. Keep the handle through navigation so asynchronous guards can still reuse it. Example identifiers and labels are in English.

```ts
import { useRouter, useRouteDataPreload, type RoutePreload } from 'vue-router-ns'
import { productData } from './product-data'

const router = useRouter()
const prepare = useRouteDataPreload()
const to = { name: 'product', params: { id: '42' } } as const
let interest: RoutePreload | undefined

function touchDown() {
  interest?.cancel()
  interest = prepare(to, productData)
}
function abandon() {
  interest?.cancel()
  interest = undefined
}
async function open() {
  const held = interest
  interest = undefined
  try {
    await router.push(to)
  } finally {
    held?.cancel()
  }
}
```

Outside a page, call `router.preloadData(to, productData)`. A stack-bound router owns its interests until stack closure; root interests belong to the router/window. The target must resolve and the definition must be declared and opted in, otherwise the handle reports an error. Code can be prepared separately with `router.preload(to)`.

## Results, matching and navigation

The result is the same `RoutePreload` handle: readonly live `state`, first-outcome `ready` promise and `cancel()`. It never exposes the prepared payload. States are `queued`, `loading`, `ready`, `error` and `cancelled`. Data permission denial uses cancellation reason `unauthorized`; other reasons are `cancelled`, `expired`, `invalidated`, `disposed` and `capacity`. The promise never rejects and keeps its first outcome even if live readiness later expires.

Sharing requires the same loader, session identity, matched route records, full destination and full origin, including params/query/hash. Origin is included because loaders can depend on it. Routers/windows have separate pools. Consumers have independent interests; cancelling one does not cancel another or an entry already consuming the request. A normal load that started before preparation is not retroactively pooled; an app-owned cache can coalesce that work.

After all normal guards, a new entry acquires matching preparation and still presents without waiting for data. `useRouteData(productData)` exposes that entry’s usual state. Ready values and pending requests can be reused; expiry or speculative failure falls back to normal loading. Account/permission changes and explicit invalidation cancel a joined pending publication without silently retrying protected work. Navigation refusal or redirect does not create an entry for the prepared target.

`RouteLoaderContext.preloading` distinguishes speculative invocation from ordinary loading. `reload()` always starts a normal attempt rather than consuming preparation again. Ordinary loads without preparation remain independent. Retained Back/tab entries keep their existing state. Shared values are shallow references, not cloned or deeply frozen: treat prepared results as immutable. Data is never serialized with saved stacks.

## Budgets, cancellation and account changes

`RouterOptions.preloadData` has independent `concurrency` (2), `maxEntries` (16) and `ttl` (30,000 ms) limits. Values must be positive finite integers. The budget counts loader jobs/retained results, not bytes or app-cache contents. TTL starts at the first request, including queue time, and reuse does not extend it. Ready results use LRU eviction; a pool full of pending jobs returns `capacity`. Authorized navigation can promote its queued request past unrelated speculation.

Queued work with no consumers never runs. The last pending interest releases the shared loader context and invokes its `onCancel()` callbacks. An executing request still occupies a speculative slot until its promise settles, even after cancellation. Connect the callback to an HTTP client only when that invocation owns the request or its own cache subscription. Cancellation always stops router publication; it only aborts transport if the client supports and implements that adapter. The native fixture deliberately lets HTTP finish after cancellation.

Call this immediately on sign-out/account/permission changes, and invalidate the corresponding app-owned cache:

```ts
updateSession(nextSession)
router.clearPreloads()
```

The scope and permission are checked before execution, reuse and publication. Scope changes are not watched continuously, so clearing gives prompt cancellation; the checks also reject late responses without a clear. Route removal/replacement, generated route-table HMR and changed factories invalidate preparation. Use `router.clearPreloads()` after in-place metadata changes or explicit refresh. Replacing named loader registrations requires the existing full router reload.

Clearing affects code and data preparation, including entries still waiting for prepared work. It does not erase values already consumed into live entries or an application cache; the app owns retiring account pages and cached data. Normal route-data reload and disposal keep their existing behavior. No prepared result survives process death.

## Native evidence

<Clip name="route-data-preload" :width="480" aspect="3 / 4" caption="Cold/prepared real HTTP, abandoned drag, denied speculation, guard refusal, account change during HTTP and owner disposal. Controlled 900 ms server delay; not a network benchmark. iOS 18.6 simulator; English fixture labels." />

The fixture counts construction before commit and checks source Page/history identity. Its HTTP server independently verifies request counts, including zero denied requests and separate account A/B requests. See the [validation report](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-route-preload-stage2.md) and [repeatable driver](https://github.com/rafaelaugustos/vue-router-ns/blob/main/scripts/native/preload/README.md). Native evidence covers an iOS simulator; it does not establish Android touch acceptance, physical-device performance or garbage collection.
