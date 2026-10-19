# Optional native layouts

Explicit route records stay the default. Register layouts only when you want to share a native `Page`, its `ActionBar` and body structure between destinations. Layouts use NativeScript-Vue components and slots, with the same native entries, guards and history as existing pages. No Nuxt runtime, Vue Router or WebView is added.

## One owner for Page and ActionBar

A selected layout owns the entry's **one root `Page`** and its optional **one `ActionBar`**, directly inside that Page. Its default slot renders the destination exactly once. The destination supplies body content, without another `Page` or `ActionBar`.

```vue
<!-- layouts/Default.vue -->
<script setup lang="ts">
import { useRoute } from 'vue-router-ns'

const route = useRoute()
</script>

<template>
  <Page>
    <ActionBar :title="String(route.meta.title ?? 'My app')" />
    <GridLayout padding="16">
      <slot />
    </GridLayout>
  </Page>
</template>
```

```vue
<!-- pages/Account.vue: content for a configured layout -->
<script setup lang="ts">
import { ref } from 'nativescript-vue'

const name = ref('')
</script>

<template>
  <StackLayout>
    <Label text="Account" />
    <TextField v-model="name" hint="Your name" />
  </StackLayout>
</template>
```

Put shared ActionItems, navigation buttons and native Page properties in the layout. It can read the entry's `useRoute().meta` to choose its title/actions. Browser Nuxt layouts and HTML markup are not converted into native views.

## Register and select explicitly

```ts
import { createRouter } from 'vue-router-ns'

const router = createRouter({
  layouts: {
    default: () => import('./layouts/Default.vue'),
    compact: () => import('./layouts/Compact.vue'),
  },
  defaultLayout: 'default',
  routes: [
    {
      path: '/account',
      component: () => import('./pages/Account.vue'),
      meta: { title: 'Account' },
    },
    {
      path: '/preview',
      component: () => import('./pages/PreviewBody.vue'),
      meta: { layout: 'compact', title: 'Preview' },
      modal: true,
    },
    {
      path: '/legacy',
      component: () => import('./pages/LegacyPage.vue'),
      meta: { layout: false },
    },
  ],
})
```

`layouts` accepts component objects or factories, including lazy `.vue` imports. The registry is captured when the router is created. `defaultLayout` is `false` unless explicitly set: registering a component named `default` alone does not activate it. `meta.layout` selects a registered name or `false` to opt out. Without a selected layout, the destination follows the existing contract and owns its own root `Page`, as `LegacyPage.vue` does above.

Metadata merges from parent to child. A child inherits its parent's layout unless it supplies another name or `false`. Layout selection/loading happens after entry guards and middleware, with component loading, before `beforeResolve`; choose the layout in route records or an earlier guard. An unknown default fails at router creation. An unknown route layout or failed import rejects navigation and reaches `onError()` before any native page is mounted. A failed import can be retried.

There is no filesystem discovery in this runtime API. Optional file routing and build integration remain separate roadmap work; explicit route arrays work with layouts now.

## Lifetime and native behavior

Layout code can be cached, but **each native entry gets its own layout and destination instances**. Local refs are not shared between visits, including repeated paths. A covered entry stays mounted; returning with Back reveals its existing Page and state. Popping or replacing that entry unmounts its layout and content with the native page.

Both components receive the same entry-bound `useRoute()`, stack-bound `useRouter()` and native host. Route props and navigation `props` go to the destination. Layout/page activation hooks, leave guards, modal results and accessibility focus use the existing entry lifecycle. A guard registered in a layout can protect that entry just like a guard in its content.

The layout and content share the entry's hook namespaces: give `usePageState()` distinct keys, and install only one `useNavigationFocus()` owner for that entry. Its targets may be inside either component. Normal native gesture limits still apply; see [guards](./guards) and [accessibility](./accessibility).

A layout is per page, while `RouterTabs`, `RouterDrawer` and `RouterSplitView` are persistent app containers. Keep those containers outside the page layout. Selecting another layout must not create another Frame, replace the tab bar or flatten a stack.

## Changes, HMR and diagnostics

The chosen layout is fixed when an entry is created. Changing a route's metadata or a live route's `meta.layout` does not swap an existing entry's native Page. To show a different layout, navigate to a new entry or explicitly replace the current one (`force: true` when replacing the same path). Changing the registry or `defaultLayout` configuration requires creating a new router; no dynamic registry mutation API is provided.

During development, script HMR of either the layout or the destination uses NativeScript-Vue's existing native Page replacement. If another page covers the entry in its Frame, the replacement waits for the Frame to return. A discarded entry drops its pending reload. Entry/history identity is retained; remounting may reset local setup refs. Template-only updates follow Vue's normal HMR behavior.

Development diagnostics identify a missing root Page, nested destination Pages, conflicting/misplaced ActionBars and omitted/repeated destination slots. These are authoring warnings, not a production renderer or repair mechanism: invalid native trees remain unsupported and NativeScript-Vue/Core may reject them. Keep exactly one layout-owned root Page and render its default slot once.
