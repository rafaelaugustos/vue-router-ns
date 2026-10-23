# Native Suspense composition (experimental)

Keep the routed **Page synchronous** and put Vue's `Suspense` around its asynchronous
content. The Page, ActionBar, transition and history continue to belong to the native
router. This recipe is opt-in and adds no router component or automatic wrapper.

## Renderer compatibility comes first

On **NativeScript-Vue 3.1.2 / Vue 3.5.44**, stock Suspense throws
`No known component for element div.` Vue asks the renderer for a hidden staging
container; this renderer does not register that element. Exporting `Suspense` does
not by itself make it usable on native pages.

The example explicitly registers that name as a native layout before starting the app:

```ts
import { GridLayout } from '@nativescript/core'
import { getViewMeta, registerElement } from 'nativescript-vue'

registerElement('div', () => GridLayout, getViewMeta('GridLayout'))
```

This is an **application-wide compatibility registration**, using public renderer
APIs. The name must be unused; do not overwrite an existing registration or put
this call in every page. It creates a detached native GridLayout for Vue to stage
pending content, then moves the resolved branch into the visible native tree.
It does not introduce HTML, browser rendering or a WebView.

Use the recipe only with versions you have validated. Vue Suspense is experimental,
and the staging name is an implementation detail of the tested Vue runtime. Recheck
this adaptation after upgrading either renderer; a future native implementation
may make it unnecessary. Stock behavior and the adapted recipe are tested separately
in the [compatibility report](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-suspense.md).

## Consume a route loader explicitly

Declare `productData` through [route data loading](./data-loading). The route starts
the request after authorization. This child consumes that entry's existing attempt:

```vue
<!-- ProductContent.vue -->
<script setup lang="ts">
import { useRouteData } from 'vue-router-ns'
import { productData } from './product-data'

const product = useRouteData(productData)
const ready = product.ready
await ready
const current = product.ready === ready
if (current && product.status.value === 'error') throw product.error.value
const data = current ? product.data.value : undefined
</script>

<template>
  <StackLayout v-if="data">
    <Label :text="data.title" />
    <Label :text="'$' + data.price" />
  </StackLayout>
</template>
```

`ready` resolves on success, error **and cancellation**. Inspect the state rather
than assuming resolution means success. The `await` in child setup is the async
dependency; returning a Promise from a loader alone does not make Vue suspend.
The attempt identity check discards a superseded attempt. The child does not fetch again. Capturing `data` here is an intentional snapshot
of this attempt, so the old content can stay visible during a later timeout.

The synchronous page owns error capture and explicit retry:

```vue
<script setup lang="ts">
import { onErrorCaptured, ref } from 'nativescript-vue'
import { useRouteData } from 'vue-router-ns'
import ProductContent from './ProductContent.vue'
import { productData } from './product-data'

const product = useRouteData(productData)
const error = ref(false)
const attempt = ref(0)
onErrorCaptured(() => {
  error.value = true
  return false
})
function retry() {
  // Invalidate your application cache here if it retains the failed request.
  void product.reload()
  error.value = false
  attempt.value++
}
</script>

<template>
  <Page>
    <ActionBar title="Product" />
    <StackLayout padding="24">
      <Label text="Product details" />
      <StackLayout v-if="error">
        <Label text="Could not load product. Please try again." />
        <Button text="Retry" @tap="retry" />
      </StackLayout>
      <Suspense v-else :timeout="0">
        <ProductContent :key="attempt" />
        <template #fallback>
          <StackLayout>
            <ActivityIndicator :busy="true" />
            <Label text="Loading product…" />
          </StackLayout>
        </template>
      </Suspense>
    </StackLayout>
  </Page>
</template>
```

Use one native root per slot. Capture errors in a synchronous parent of the
boundary, render a separate error view, and return `false` for handled errors.
Suspense's loading fallback is not an error boundary. Put injection and lifecycle
registration before `await` in an ordinary `async setup()`; compiled top-level
await restores Vue's setup context, but does not change request ownership.

## Content lifecycle

| Case                                        | Contract                                                                                                                            |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| First pending child                         | A native fallback appears inside the existing Page.                                                                                 |
| Resolution                                  | Content replaces the fallback; the Page, ActionBar and history stay intact.                                                         |
| `reload()` alone                            | Does not re-run mounted async setup or automatically show a fallback.                                                               |
| Keyed replacement of the default slot root  | Starts a new async child. `timeout="0"` shows the fallback immediately; a positive timeout retains the old branch until it expires. |
| Newly async content below an unchanged root | Does not automatically return the outer boundary to pending. Use an explicit nested boundary where needed.                          |
| Nested `<Suspense suspensible>`             | The inner boundary participates in its parent's async dependency handling.                                                          |
| Covered page or inactive tab                | Its owned request may finish; resolving does not select that page.                                                                  |
| Back or modal dismissal                     | Router disposal cancels result publication; Vue discards the removed async subtree.                                                 |
| Cancelled native Back gesture               | The Page, pending child and request remain.                                                                                         |

The example records `pending`, `fallback` and `resolve` events. These describe the
Vue content boundary, not native navigation completion. The [Vue guide](https://vuejs.org/guide/built-ins/suspense.html)
defines their semantics; this recipe does not provide React concurrent rendering
or React transition APIs.

The app owns its cache and network work. Two pages may await one request; removing
one must not abort the shared request. A raw async setup is still JavaScript and
continues after its component is disposed. Guard application side effects and use
the loader's cancellation contract for work owned solely by that entry. Never
navigate from an async completion to publish a result into a removed page.

## Page boundaries, Deferred and accessibility

A Suspense around `RouterView` does not wrap separately mounted native page apps.
Do not make the Page itself async, put the Page inside the loading boundary, or
use this recipe to wrap an entire native navigator. Lazy route imports load code
before presentation; loaders start data work; Suspense waits for an async content
component. These are three distinct stages.

`Deferred` waits for native page activation before mounting its content. It does
not wait for data. Place Suspense **inside** Deferred when both behaviors are
needed; the loader can already be running while the child waits to mount.

Keep the ActionBar and an accessible heading outside the changing content. The
example uses `useNavigationFocus` with that stable heading. It does not move focus
again when HTTP completes or add a content animation; native motion policy remains
the router's responsibility. Page and heading identity are checked automatically;
this is not a claim that VoiceOver/TalkBack announcements have been manually audited.
No separate safe-area or keyboard layout is introduced by this recipe.

## Native example

The [complete fixture](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/testing/suspense-app.ts)
includes the stock-renderer negative control, the explicit registration, an
application-owned HTTP cache, async setup/SFC/lazy children and lifecycle checks.
See [reproduction commands and tested scope](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-suspense.md).

<div class="clips">
<Clip name="ios-suspense" caption="iOS: pending content, captured error and retry inside the same native Page." />
<Clip name="android-suspense" aspect="9 / 20" caption="Android: Vue Suspense with an explicit native staging container and shared route data." />
</div>
