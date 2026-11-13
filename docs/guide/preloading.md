# Route code preloading (experimental)

Prepare a lazy destination's code when the user touches a card. The later navigation can reuse that work. Preparation resolves the destination and declarative redirects, then loads only the matched leaf component. It does not navigate, reveal a tab, create a window, mount Vue/native views, run guards or start data loaders. Parent pages and layouts load normally during navigation.

This is opt-in and experimental. The router does no speculative work until you call `router.preload(to)` or the function returned by `useRoutePreload()`.

## Prepare from a page

Keep lazy factories limited to importing code. The configuration below shows the defaults:

```ts
const router = createRouter({
  routes: [
    { path: '/', component: () => import('./Home.vue') },
    { path: '/products/:id', name: 'product', component: () => import('./Product.vue') },
  ],
  preload: { concurrency: 2, maxEntries: 16, ttl: 30_000 },
})
```

Capture `useRoutePreload()` during routed page setup. Each call owns separate interest in the code; page/scope disposal releases its interests automatically. Cancel when the gesture is abandoned. Keep the interest until navigation settles so an asynchronous guard can still reuse it. The ordinary button supplies an accessible path without requiring a hold. Example labels are in English.

```vue
<script setup lang="ts">
import type { TouchGestureEventData } from '@nativescript/core'
import { useRouter, useRoutePreload, type RoutePreload } from 'vue-router-ns'

const router = useRouter()
const prepare = useRoutePreload()
const to = { name: 'product', params: { id: '42' } } as const
let interest: RoutePreload | undefined
let inside = false

function abandon() {
  inside = false
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
function touch(event: TouchGestureEventData) {
  if (event.action === 'down') {
    abandon()
    inside = true
    interest = prepare(to)
  } else if (event.action === 'cancel') {
    abandon()
  } else if (event.action === 'move') {
    const size = event.view.getActualSize()
    if (
      event.getX() < 0 ||
      event.getY() < 0 ||
      event.getX() > size.width ||
      event.getY() > size.height
    )
      abandon()
  } else if (event.action === 'up' && inside) {
    inside = false
    void open().catch(console.error)
  }
}
</script>

<template>
  <Page>
    <ActionBar title="Products" />
    <StackLayout>
      <GridLayout height="160" backgroundColor="#19385c" @touch="touch">
        <Label text="Hold to prepare, release to open" color="white" />
      </GridLayout>
      <Button text="Open product" @tap="open().catch(console.error)" />
    </StackLayout>
  </Page>
</template>
```

## Outcomes and ownership

`RoutePreload` exposes readonly `state`, a `ready` promise and `cancel()`. The live state is `queued`, `loading`, `ready`, `error` or `cancelled`. An error carries `error`; cancellation carries a `reason`: `cancelled`, `expired`, `invalidated`, `disposed` or `capacity`.

`ready` never rejects. It settles once with the first ready/error/cancelled outcome. A previously ready interest can later be cancelled or expire; its live state changes, while the promise keeps its original outcome. Readiness is not permission to navigate or a guarantee of future cache retention.

```ts
const interest = router.preload({ name: 'product', params: { id: 42 } })
const result = await interest.ready
if (result.status === 'error') console.error(result.error)
interest.cancel()
router.clearPreloads()
```

The page helper cancels on page or component-scope disposal. A directly called `router.preload(to)` belongs to that router; a stack-bound router releases its interests when the stack closes. Permanent router/window closure invalidates all preparation. Two routers have independent pools. Resolution follows `router.resolve()` rules, including the caller's stack for relative params, without changing focus.

## Budgets and invalidation

| Option        | Default   | Policy                                                                                                                                                        |
| ------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `concurrency` | 2         | Maximum executing speculative factories. Authorized navigation can promote its queued destination past unrelated work.                                        |
| `maxEntries`  | 16        | Maximum pending/ready route records. At capacity, evict the least recently used ready record; reject new interest with `capacity` if all records are pending. |
| `ttl`         | 30,000 ms | Maximum lifetime from a record's first request, including queue/loading time. Reuse does not extend it.                                                       |

Values must be positive finite integers. A cancelled executing import still occupies its slot until it settles. Queued work with no consumers never executes. Consumers for different params of one route share code, not page state or data. One consumer cancelling does not cancel other consumers or an authorized navigation already sharing the import. Normal navigation also shares an import it started first.

Removing/replacing a route, generated route-table HMR and a changed component factory invalidate old preparation. Use `router.clearPreloads()` on sign-out/account changes or explicit invalidation. Late completion cannot refill that speculative pool. In-place Vue component HMR still belongs to Vue. No prepared state is persisted across process death.

The budget limits router-held speculative references and work counts, not imported module bytes. Cancellation cannot abort an executing JavaScript import, undo its top-level effects, unload the JavaScript module cache or clear the router's ordinary component cache after navigation. An expired/failed preparation falls back to normal loading when navigation is authorized.

## Authorization and native evidence

Preloading code runs the lazy factory and module initialization before navigation guards. Do not put protected fetches, credentials or navigation side effects there. Keep protected data in [authorized route loaders](./data-loading). Actual navigation always runs its normal guards; a guard redirect may choose a different destination. This stage has no speculative-data API or cache framework requirement.

<Clip name="route-code-preload" :width="480" aspect="3 / 4" caption="Cold/prepared touch, abandoned drag, guard refusal and owner disposal. The factory includes a controlled 900 ms delay; timings are not an import benchmark. iOS 18.6 simulator; English fixture labels." />

The native fixture counts Page, Frame, UIViewController and Vue app construction before commit, compares exact source history, and records guard/data calls. Its real touch sequence demonstrates preparation with zero such allocations, refusal and disposal. Native evidence is from an iOS simulator; it does not certify physical hardware, Android native input or memory collection. Contract tests cover shared consumers, budgets, invalidation and window ownership. See the [validation report](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-route-preload-stage1.md) and [API reference](./api#route-code-preloading).
