# Native file-routing example

An optional convention-based application on the same native router as the [explicit-route playground](../playground). No Nuxt or web Vue Router runtime is used. Pages contain NativeScript views; the discovered layout owns the native `Page`.

From a clean repository checkout, with the [NativeScript environment](https://docs.nativescript.org/setup/) installed:

```sh
npm ci
npm run build
cd examples/file-routing
npm ci
npm run setup
npm run typecheck
ns run android
```

For iOS on macOS:

```sh
npm run routes:ios
npm run typecheck
ns run ios --emulator
```

`setup` scaffolds missing `App_Resources` from the NativeScript blank TypeScript template without replacing existing resources. Generated files/resources/platforms are ignored. This repository example uses the local router package; build it before preparing the example. `install-links=true` installs a packed copy of that local package, matching the published layout. After changing the router, rebuild it and run `npm ci` in this example to refresh the copy. Bundler aliases keep the application on a single NativeScript-Vue/Core instance.

`file-routing.config.js` is shared by standalone type preparation and both public bundler plugins. `src/router.ts` combines generated destinations with explicit `/about`, selects the discovered default layout, and installs discovered middleware plus route-table HMR. Remove those optional pieces to use explicit route configuration throughout.

Try the collection, edit a product draft, choose a color in the native modal, open Account to sign in, and switch to Saved. Back retains the original draft. `auth.ts` is a demonstration session guard, not a production authentication service.

While `ns run` is watching, add/rename/remove a page or edit its adjacent `.route.json` metadata. Existing native entries keep their snapshots; future navigation uses the changed table. Script/template HMR can remount components. Adding/removing layout or middleware registrations requires a restart. This example uses `metadataFiles: true` with no page macros, on both builders. All runtime helpers have explicit imports.

The [English guide](../../docs/guide/file-routing.md) and [Portuguese guide](../../docs/pt-BR/guide/file-routing.md) describe conventions, overrides, removal and verified versions.

## Vite (experimental)

Use Node 22. The example defaults to webpack; select Vite explicitly. When switching builders on an existing native build, add `--clean` (for example `npm run run:vite:android -- --clean`) so the CLI rebuilds the native entrypoint:

```sh
npm run run:vite:android
npm run run:vite:ios
```

These commands keep native HMR enabled. Metadata lives in adjacent `.route.json` files, so page scripts need no compile-time macro. Existing middleware edits and route-table changes update the installed router. No dependency patches are installed.

`definePageMeta` remains supported by webpack and bundled Vite builds (`--no-hmr`). Native Vite 8.0.19 bypasses macro transforms ([upstream issue](https://github.com/NativeScript/NativeScript/issues/11556)); use the JSON format for native Vite HMR. The tested native assembler also needs a nonempty script block in SFCs, as used by this example.

`npm run build:vite:android` and `npm run build:vite:ios` bundle without launching devices. Keep the same `ROUTER_BUNDLER=vite` setting when invoking standalone routes/type preparation. Vite-only users do not need the webpack plugin; this example includes both for compatibility checks.

## Native acceptance

From the repository root, after installing/preparing this example:

```sh
ANDROID_SERIAL=emulator-5554 node scripts/native/conventions-watch.mjs android
IOS_SIMULATOR=<booted-uuid> node scripts/native/conventions-watch.mjs ios
```

Run platforms sequentially: this fixture deliberately edits the same source files, restores them in `finally`, and stops its own app/watch process. Results and CLI/runtime logs go to `scripts/native/out/conventions-<bundler>-<platform>`. It tests real device HMR, native Page identities, retained drafts/stacks, guards, modal results and accessibility visibility/focus targets. It does not automate screen-reader speech.

For Vite navigation and HMR acceptance:

```sh
ROUTER_BUNDLER=vite ANDROID_SERIAL=emulator-5554 node scripts/native/conventions-watch.mjs android
ROUTER_BUNDLER=vite IOS_SIMULATOR=<booted-uuid> node scripts/native/conventions-watch.mjs ios
```

The fixture checks 24 navigation/watch assertions plus seven template-retention invariants in the Vite run. Webpack template edits retain their existing remount behavior; its compatibility run checks route and middleware updates. It seeds the native TextField property directly; keyboard input and two-way binding are not covered. Set `NATIVE_HMR=0` to run only the 15 navigation assertions against a bundled build. Android launch uses an explicit `adb` Activity intent if the CLI stalls after syncing.
