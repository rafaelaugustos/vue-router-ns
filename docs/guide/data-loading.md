# Route data loading (experimental)

Declare data loading on a route and render pending, success and error states inside the same native Page. This opt-in API uses the existing router and native stacks. Explicit routes remain the default; it requires neither file routing, Vue Router, Nuxt nor a cache library.

A lazy `component: () => import('./Product.vue')` loads **page code**. A route loader fetches **data**. Data loading does not block native presentation: `router.push()` settles when navigation finishes, independently of the request.

## Define a typed loader

Keep the definition in a module shared by the route table and the page:

```ts
// product-data.ts
import { defineRouteLoader } from 'vue-router-ns'

type Product = { id: string; title: string; price: number }

export const productData = defineRouteLoader(async ({ to }) => {
  const response = await fetch(
    `https://api.example.com/products/${encodeURIComponent(String(to.params.id))}`,
  )
  if (!response.ok) throw new Error('Could not load product')
  return response.json() as Promise<Product>
})
```

```ts
// router.ts
import { createRouter } from 'vue-router-ns'
import { productData } from './product-data'

export const router = createRouter({
  routes: [
    { path: '/', component: () => import('./Home.vue') },
    {
      path: '/products/:id',
      component: () => import('./Product.vue'),
      meta: { loaders: productData },
    },
  ],
})
```

```vue
<!-- Product.vue -->
<script setup lang="ts">
import { useRouteData } from 'vue-router-ns'
import { productData } from './product-data'

const product = useRouteData(productData)
// Top-level refs unwrap in the template; data is Product | undefined.
const { data, status } = product
function retry() {
  void product.reload()
}
</script>

<template>
  <Page>
    <ActionBar title="Product" />
    <StackLayout padding="24">
      <StackLayout v-if="status === 'pending'">
        <ActivityIndicator :busy="true" />
        <Label text="Loading product…" />
      </StackLayout>
      <StackLayout v-else-if="status === 'error'">
        <Label text="Could not load product. Please try again." textWrap />
        <Button text="Retry" @tap="retry" />
      </StackLayout>
      <StackLayout v-else-if="data">
        <Label :text="data.title" />
        <Label :text="'$' + data.price" />
      </StackLayout>
    </StackLayout>
  </Page>
</template>
```

Call `useRouteData(definition)` in the routed page's setup, using the same definition object declared by the route. It throws outside a routed page or for an undeclared definition. Multiple consumers inside that entry receive the same handle. Different entries, stacks and routers have separate handles, even if their URLs and definitions match.

`data`, `error` and `status` are readonly refs. Results are shallow: the router does not deeply proxy returned objects. `status` is `pending`, `success`, `error` or `cancelled`. A successful loader may return `undefined`; use `status` to distinguish it from pending.

`await product.ready` waits for the **current attempt** and always resolves, including on failure or cancellation. Inspect `status`/`error` afterward. `reload()` explicitly clears the old data/error, cancels the previous pending attempt and starts a new one on this entry; its promise has the same settlement rules. It does not change the Page or history. There is no automatic retry. Calling it after disposal is a no-op.

## Authorization and lifecycle

The existing transaction runs leave guards, `beforeEach`, middleware, `beforeEnter`, page/layout imports and `beforeResolve` before starting destination data work. Once authorized, independent loaders start concurrently during entry creation; native presentation does not await their promises. An aborted, redirected or superseded pre-commit navigation never starts that destination's loaders. A failed code import also prevents loading.

| Operation                                                   | Data behavior                                                        |
| ----------------------------------------------------------- | -------------------------------------------------------------------- |
| Initial route, push, replace, `force`, changed params/query | A new entry gets new loader state.                                   |
| Duplicate navigation without `force`                        | No new entry or load.                                                |
| Back, tab switch, revealing a covered page                  | Retained state; no automatic refetch.                                |
| Reconstructed saved stack                                   | New loaders after guards; data/results are not serialized.           |
| Deep link or `setStack`                                     | Newly created entries load; a retained common prefix keeps its data. |
| Modal                                                       | Own entry; dismissal cancels its pending publication.                |
| Removal, native Back or router/window disposal              | Cancel pending attempts, clear results, ignore late responses.       |
| Covering a page with another page/modal                     | The retained entry can finish its request.                           |

`meta.loaders` accepts a definition/name or an array. All matched parent and child declarations contribute; a child's `[]` does not remove a parent's loaders. Repeated definition objects run once per entry, including a name and inline reference to the same object. Unknown names/invalid definitions reject navigation before starting any sibling loader.

Data exceptions and rejected promises become `error` state, including when they arrive after presentation. They do not reject `router.push()` or call `router.onError()`. Configuration, component-import and native-navigation failures keep the existing navigation error behavior. Handle or log data errors through the returned state or your data client.

## Cancellation and an existing cache

The context contains `to`, `from` (the originating stack's route), `isCancelled()` and `onCancel(callback)`. `onCancel` returns an unsubscribe function. It runs when a **pending** attempt is superseded or its entry is disposed, and immediately if registered after cancellation. Completed attempts release their callbacks. Cancellation settles `ready` immediately and prevents late success/error publication, even if the underlying request continues.

This contract intentionally does not expose a browser `AbortSignal`. NativeScript Core 9.1.3's abort signal uses its Observable event contract; it is not interchangeable with every HTTP client's signal. To abort work owned solely by this invocation, adapt `onCancel` to your client's supported cancellation API. The router does not cancel shared requests indiscriminately.

For example, reuse an app-owned Promise cache:

```ts
const products = new Map<string, Promise<Product>>()

export const productData = defineRouteLoader(({ to }) => {
  const id = String(to.params.id)
  let request = products.get(id)
  if (!request) {
    request = fetchProduct(id) // Your existing client, returning Promise<Product>.
    products.set(id, request)
    const own = request
    void own.catch(() => {
      if (products.get(id) === own) products.delete(id)
    })
  }
  return request
})
```

Two entries can reuse one request; removing one only discards its result subscription. The other still receives the data. The app owns cache scope, account boundaries, expiry, invalidation and network cancellation. `reload()` calls the loader again; invalidate your cache first if you want a fresh network request. This small example removes failures so explicit retry can request again, but keeps successful values until the app invalidates them.

## Optional file routes

Register named definitions on the same router:

```ts
createRouter({ routes, loaders: { product: productData } })
```

Then declare a literal name with the existing [file-routing metadata](./file-routing):

```vue
<script setup lang="ts">
import { definePageMeta } from 'vue-router-ns/file-routing'
definePageMeta({ meta: { loaders: ['product'] } })
</script>
```

For native Vite HMR, use the page's `.route.json` instead, as with other metadata:

```json
{ "meta": { "loaders": ["product"] } }
```

Names resolve in that router's registry, captured at creation. The page still imports `productData` and calls `useRouteData(productData)` for inference. There is no implicit loader discovery or auto-import. Template-only HMR can retain the same entry state; replacing a loader definition or changing its registration requires a full reload to keep page/registry identity aligned. Route-table changes apply to newly created entries.

## When the destination must wait

An async [guard](./guards) remains the existing option for work that must finish before navigation. For example, an authorization guard can return `false` or redirect; a later `beforeResolve` can await your app cache. That delays navigation and uses navigation error handling if it throws. Keep authorization before protected requests. Do not start another navigation from a loader to implement authorization.

This API supplies explicit reactive UI state. It does not add an automatic Suspense boundary or require async page setup; keep the root Page synchronous. See the opt-in [native Suspense composition](./suspense) for renderer compatibility, async content and explicit loader consumption.

## Native example and recordings

The [complete example](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/testing/loaders-app.ts) uses a real local HTTP endpoint and an app-owned cache. Both recordings show pending, success, an HTTP failure, retry on the same Page, and returning while a request is pending.

<div class="clips">
<Clip name="ios-loaders" caption="iOS: native Pages stay responsive while product data loads." />
<Clip name="android-loaders" aspect="9 / 20" caption="Android: HTTP error and retry preserve the native Page and history." />
</div>

Run the demo with `--env.loadersTest` and `node scripts/native/loaders/server.mjs`. The local endpoint needs fixture-only transport setup and Android port forwarding. See [reproduction and acceptance](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-route-data.md) for the exact commands and validation scope.
