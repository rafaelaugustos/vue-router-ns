# Optional routes from files (experimental)

File routing generates an ordinary typed route array for the existing native router. Applications can keep declaring routes in JavaScript/TypeScript, generate them from native Vue pages, or combine independent tables. Pages still render through NativeScript Pages/Frames, with the same guards, results and history.

The generator and metadata transform are available as low-level build APIs. Turnkey webpack installation, auto-imports and the complete example/setup experience are tracked in [#92](https://github.com/rafaelaugustos/vue-router-ns/issues/92). This does not run Nuxt or the web Vue Router.

## Generate a route module

Install `@vue/compiler-sfc@^3.5` as a **development dependency** when using the generator. It is an optional peer; applications with explicit routes do not need this tooling. Run this Node script before compiling the application:

```js
import { writeFileRoutes } from 'vue-router-ns/file-routing/generator'

await writeFileRoutes({
  pagesDir: 'src/pages',
  outFile: 'src/generated/routes.android.ts',
  platform: 'android',
  exclude: ['components'],
})
```

Use `platform: 'ios'` and a separate output for the iOS build. Imports in the generated module point to the selected SFC, relative to the output file. NativeScript can resolve a shared `./generated/routes` import to its platform file; the application's TypeScript configuration must also resolve the selected output (or import it explicitly).

```ts
import { createRouter } from 'vue-router-ns'
import { routes } from './generated/routes.android'

export const router = createRouter({ routes })
router.push({ name: 'products-id', params: { id: 42 } })
```

The output includes `routes`, `FileRouteMap`, `FileRouteName` and `FileRouteParams<Name>`. Lazy component factories have explicit return types, avoiding inference cycles between pages and the router. Existing [router registration](./typed-routes) gives composables and links the generated names and parameters too. The output has no filesystem, compiler or generator runtime import.

## File conventions

| File                   | Path              | Name             | Parameters                                |
| ---------------------- | ----------------- | ---------------- | ----------------------------------------- |
| `index.vue`            | `/`               | `index`          | none                                      |
| `products.vue`         | `/products`       | `products`       | none                                      |
| `products/index.vue`   | `/products`       | `products-index` | none                                      |
| `products/[id].vue`    | `/products/:id`   | `products-id`    | `id: string`                              |
| `settings/[[tab]].vue` | `/settings/:tab?` | `settings-tab`   | `tab?: string`                            |
| `files/[...path].vue`  | `/files/:path+`   | `files-path`     | `path: string[]` (one or more segments)   |
| `any/[[...path]].vue`  | `/any/:path*`     | `any-path`       | `path?: string[]` (zero or more segments) |

Names keep `index` so adding a parent page does not rename its existing index destination. Use `definePageMeta({ name: '...' })` to override a name. Filenames and folders allow ASCII letters, digits, `_` and `-`; parameters use word characters. Mixed segments such as `product-[id]`, route groups and custom regex are unsupported in generated paths and produce a source diagnostic. Explicit records retain their existing matcher capabilities. Catch-all parameters must be last.

Folders alone do not create native pages or Frames. A nearest ancestor **page file**, such as `products.vue`, becomes a route parent of `products/[id].vue`. With `withParents: true`, the router pushes the actual parent Page before the detail Page. Index files never become parents. When both `products.vue` and `products/index.vue` exist, path navigation to `/products` selects the index; named navigation can select the parent. A parent's custom path propagates to children unless a child declares its own absolute path; required parent parameters must remain available for `withParents`.

The scanner sorts deterministically and the existing matcher ranks destinations. Duplicate names, equivalent case-insensitive patterns (including parameters with different names), repeated parameters and unsupported filenames fail with file/line/column diagnostics. A parent and its index are the intentional same-path exception.

Hidden and `_`-prefixed files/directories and `node_modules` are skipped. `exclude` accepts exact relative files or directory prefixes, without globs. Symlinks must be excluded. A configurable pages directory may be empty.

`page.ios.vue`/`page.android.vue` override `page.vue` on their platform without adding another route. Platform-only pages are absent on the other build. A platform must be specified when variants exist. Keep names/paths consistent across variants if application code needs a shared route map; each platform's generated types describe its own table.

## Compile-time page metadata

```vue
<script setup lang="ts">
import { definePageMeta } from 'vue-router-ns/file-routing'

definePageMeta({
  name: 'product',
  layout: 'default',
  middleware: ['auth'],
  props: true,
  transition: 'fade',
  meta: { requiresAuth: true },
})
</script>

<template>
  <StackLayout><Label text="Product" /></StackLayout>
</template>
```

Register the named [layout](./layouts) and [middleware](./middleware) on the router. Here the layout owns the native `Page`; without a layout the destination must own it. `layout: false` opts out. For a native modal, use `modal: true` or a literal native options object, such as `modal: { fullscreen: true }`. Native sheet options and transition options follow their existing platform contracts.

`definePageMeta` accepts `name`, `path`, `layout`, `middleware`, `meta`, `props`, `modal` and `transition`. Top-level `layout`/`middleware` become route metadata; place application fields inside `meta`. Generated types check the normal route option shapes. Path/name overrides take precedence over file conventions.

Values must be literal strings, finite numbers, booleans, null, arrays or plain objects. TypeScript `as`/`satisfies` wrappers are supported. Imported constants, setup variables, calls, functions, object spreads, getters and computed properties are rejected without execution. Register functional guards/layouts on the router and refer to their names. Use explicit routes for callback props, redirects or native transition objects requiring runtime construction.

Import the macro explicitly, optionally aliased, and call it once as a top-level `<script setup>` statement. The build must run `transformPageMeta(source, filename)` **before the Vue SFC compiler**, using its returned `code` and source `map`. The transform removes both the call and its import, preserving other script/template content. Running an untransformed macro throws a setup error. Auto-discovery and automatic imports are outside this generator.

## Combine explicit and generated records

```ts
import { mergeFileRoutes } from 'vue-router-ns/file-routing'

const router = createRouter({
  routes: mergeFileRoutes(routes, [
    { path: '/help', name: 'help', component: () => import('./Help.vue') },
  ]),
})
```

`mergeFileRoutes()` preserves literal types and rejects conflicting names/patterns across tables. There is no implicit override priority between explicit and generated records. Exclude a file before declaring its replacement explicitly. Ordinary `addRoute()`/`removeRoute()` keep their existing behavior.

## Regeneration and retained pages

`generateFileRoutes()` returns code, the page tree, source files and directory/output paths without writing. `writeFileRoutes()` writes atomically only when the generated code changes. A failed generation leaves the last valid output in place; builders remain responsible for compilation and type diagnostics.

`watchFileRoutes(options, { onGenerated, onError })` is an optional Node watcher for build integrations. It serializes regeneration on creation/edit/rename/removal, reports failures, and resumes after corrections. Await its returned handle's `close()` to stop it. Callbacks must report errors without throwing. Watcher availability follows Node/filesystem support. Builders own compilation, diagnostics, shutdown and delivery of module updates to the app.

In an application that already accepts generated-module HMR, attach an updater after creating the router:

```ts
import { createFileRouteUpdater } from 'vue-router-ns/file-routing'

const fileRoutes = createFileRouteUpdater(router, routes)
// In the builder's HMR accept callback:
fileRoutes.update(nextModule.routes)
```

An update changes **future path/name matching**. Existing native entries keep their Page, route snapshot, layout, guards and drafts, even when their file was removed or renamed. Back still returns to those retained entries; targeting a removed destination by path/name fails. Relative locations from a retained entry continue to use its original matched record, including metadata, following the existing `addRoute`/`removeRoute` semantics. Use a path or name to resolve against the updated table. Vue script/template HMR remains a separate component operation and follows the existing page-HMR contract. The updater does not recreate the router or reset other stacks.

The updater rejects conflicts with explicit destinations and externally changed registrations before mutating the table. If `addRoute`/`removeRoute` has replaced one of its records, recreate the updater with the actual current generated table. Remove manually attached children before updating their generated parent. These rules keep direct registration authoritative.

Generated file IDs and route names are separate from each native entry's restoration key. Renaming a file can change its route name; use an explicit stable name when needed. Saved paths, migrations and unavailable destinations remain governed by [restoration](./restore). Generating a new table does not migrate saved application data.

The repository's `--env.filesTest` acceptance fixture uses a small local webpack loader and generated snapshots to exercise the output on iOS/Android. The low-level filesystem watcher and native table updates are tested separately; turnkey watch-to-device integration belongs to #92.
