# Optional routes from files (experimental)

File routing generates an ordinary typed route array for the existing native router. Applications can keep declaring routes in JavaScript/TypeScript, generate them from native Vue pages, or combine independent tables. Pages still render through NativeScript Pages/Frames, with the same guards, results and history.

The optional webpack plugin handles generation, metadata compilation and native HMR. Explicit-route applications need no build changes. This uses NativeScript components throughout; it does not run Nuxt, the web Vue Router, a DOM renderer or WebView navigation, and does not convert web templates.

## NativeScript webpack setup

Install `@vue/compiler-sfc@^3.5` and `webpack@^5` as development dependencies alongside the application's `@nativescript/webpack`. Both are optional peers of the router. Add the plugin to the existing `webpack.config.js`:

```js
const webpack = require('@nativescript/webpack')
const { NativeFileRoutesPlugin } = require('vue-router-ns/file-routing/webpack')

module.exports = (env) => {
  webpack.init(env)
  webpack.chainWebpack((config) => {
    config.plugin('native-file-routes').use(NativeFileRoutesPlugin, [
      {
        platform: env.android ? 'android' : 'ios',
        pagesDir: 'src/pages',
        outDir: 'src/generated/router',
        layoutsDir: 'src/layouts', // optional discovery
        middlewareDir: 'src/middleware', // optional discovery
        autoImports: true, // only the definePageMeta macro
      },
    ])
  })
  return webpack.resolveConfig()
}
```

Paths are relative to webpack's project context (`rootDir` overrides it). The output must be outside all scanned directories. Include the generated directory in TypeScript's `include` and ignore it in Git. Omit `layoutsDir`/`middlewareDir` or set them to `false` to keep registration explicit.

```ts
import { createRouter } from 'vue-router-ns'
import { routes, layouts, installFileRouting } from './generated/router'

export const router = createRouter({ routes, layouts, defaultLayout: 'default' })
const disposeFileRouting = installFileRouting(router)
// Then app.use(router). Dispose with the app/window when it is destroyed.
```

Create the router once. `installFileRouting` registers discovered middleware and accepts route-table HMR on that instance; it returns a cleanup function. Remove `layouts` and `defaultLayout` when not using a layout. The application still mounts `RouterView`/other native router containers normally.

Generation runs before webpack compilation, including `ns run` watch builds. Before a standalone `tsc --noEmit`, prepare types with the same options in a Node script:

```js
import { prepareFileRouting } from 'vue-router-ns/file-routing/setup'

await prepareFileRouting({
  platform: 'android',
  pagesDir: 'src/pages',
  outDir: 'src/generated/router',
  layoutsDir: 'src/layouts',
  middlewareDir: 'src/middleware',
  autoImports: true,
})
```

Share these options between the script and webpack config. The generated `index.d.ts` describes the **most recently prepared platform**; prepare and typecheck each platform in sequence. Do not generate both platforms concurrently into the same output directory. NativeScript selects `index.android.ts`/`index.ios.ts` at runtime. The Node setup/plugin/compiler modules never belong in application imports.

## Optional discovery and imports

`layouts/default.vue` registers `default`; a nested `layouts/account/settings.vue` registers `account-settings`. Discovery does not select a default layout: set `defaultLayout` or page metadata explicitly. A layout owns the single native `Page`; routed content inside it must not introduce another `Page`. See [layouts](./layouts).

Middleware files default-export a `RouteMiddleware` function. `middleware/auth.ts` registers `auth`; `middleware/01-audit.global.ts` registers global middleware in deterministic filename order. Number prefixes can express ordering. Named middleware runs when selected by page metadata. Explicit `router.addRouteMiddleware()` remains available; discovery does not silently override duplicate names. See [middleware and helpers](./middleware).

Both directories support `.ios`/`.android` variants before the extension (for example `auth.global.android.ts`). Names allow letters, digits, underscores and hyphens, with nested folders joined by `-`; ambiguous names fail. Hidden/underscore entries are skipped, and symlinks are rejected. Configured directories must exist.

With `autoImports: true`, only an unbound top-level `definePageMeta()` call in a page's `<script setup>` may omit its import. The generated declaration supplies its type. Local bindings and imports from other modules retain their meaning. Runtime helpers always use explicit imports. With the default `autoImports: false`, write `import { definePageMeta } from 'vue-router-ns/file-routing'` instead.

## Native example and verified support

The [file-routing example](https://github.com/rafaelaugustos/vue-router-ns/tree/main/examples/file-routing) includes a collection/detail flow, an editable draft, two native tab stacks, a layout, authentication middleware and a typed modal result. It also combines an explicit `/about` destination with generated routes. The [existing playground](https://github.com/rafaelaugustos/vue-router-ns/tree/main/examples/playground) keeps explicit route configuration.

<div class="clips">
  <Clip name="ios-file-routing" caption="iOS: native list/detail, a modal result and authentication through generated routes." />
  <Clip name="android-file-routing" caption="Android: the same conventions on native Pages and Frames." aspect="9 / 20" />
</div>

| Layer                     | Verified configuration                                                    |
| ------------------------- | ------------------------------------------------------------------------- |
| Router integration        | Experimental optional subpaths; explicit route API remains available      |
| NativeScript-Vue / Core   | 3.1.2 / 9.1.3; one instance of each in the inspected bundle               |
| Builder / compiler        | `@nativescript/webpack` 5.0.39, webpack 5.112, `@vue/compiler-sfc` 3.5.44 |
| Node / example types      | Node 20.19.4 locally and Node 22 in CI; TypeScript 6.0.3                  |
| Android                   | Runtime 9.1.1; API 36 locally, API 34 in the native CI lane               |
| iOS                       | Runtime 9.1.0; iOS 26 simulator, local native acceptance                  |
| Other builders/frameworks | Vite and Nuxt runtime integration are not provided or verified            |

`scripts/native/conventions-watch.mjs android|ios` drives the example through the actual NativeScript CLI and edits its source files while the app is running. It checks native Page identity, drafts, Back, cancellation, auth redirects, modal results, accessibility visibility/focus targets, and watch recovery. It restores its temporary edits on exit. Screen-reader speech is not asserted by this fixture; the router's separate accessibility coverage still applies.

The plugin uses webpack's watcher. Adding, renaming or removing a page, and editing only its metadata, updates future matching without recreating open entries or other stacks. An invalid generation reports a build error and keeps the last valid output; correcting the source resumes compilation. Changing Vue script/template content uses Vue's existing HMR behavior and may remount the component/reset local state. Adding, removing or renaming layout/middleware registrations requires restarting the app; editing existing modules follows NativeScript/Vue HMR.

To return to explicit routes, replace generated imports with your own route/layout tables, register middleware explicitly, and remove `installFileRouting`, the plugin, its preparation script and generated declarations. Replace `definePageMeta` with the corresponding route fields and remove its calls. The native router and its navigation API stay the same.

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

Call the macro once as a top-level `<script setup>` statement. Explicit imports may be aliased. The webpack plugin transforms it automatically. For a custom builder, run `transformPageMeta(source, filename, { autoImports: false })` **before the Vue SFC compiler**, using its returned `code` and source `map`. The transform removes the call and its macro import, preserving other content. Running an untransformed macro throws a setup error. Discovery belongs to the optional setup API, not the low-level generator.

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

The repository's `--env.filesTest` fixture continues to test low-level generated output on iOS/Android. The separate conventions example exercises the public plugin and live filesystem-to-device HMR described above.
