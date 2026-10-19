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

While `ns run` is watching, add/rename/remove a page or edit its literal metadata. Existing native entries keep their snapshots; future navigation uses the changed table. Script/template HMR can remount components. Adding/removing layout or middleware registrations requires a restart. Auto-imports cover only the compile-time `definePageMeta` macro; all runtime helpers have explicit imports.

The [English guide](../../docs/guide/file-routing.md) and [Portuguese guide](../../docs/pt-BR/guide/file-routing.md) describe conventions, overrides, removal and verified versions.

## Vite (experimental)

Use Node 22. The example defaults to webpack; select Vite explicitly:

```sh
npm run run:vite:android
npm run run:vite:ios
```

These commands use `--no-hmr`. NativeScript Vite 8.0.19's native SFC assembler bypasses plugin transforms, leaving `definePageMeta` in runtime code. Native HMR is blocked; see [#100](https://github.com/rafaelaugustos/vue-router-ns/issues/100). The plugin's generation, bundled output and Vite watcher are tested separately. No dependency patches are installed by this example.

`npm run build:vite:android` and `npm run build:vite:ios` bundle without launching devices. Keep the same `ROUTER_BUNDLER=vite` setting when invoking standalone routes/type preparation. Vite-only users do not need the webpack plugin; this example includes both for compatibility checks.

## Native acceptance

From the repository root, after installing/preparing this example:

```sh
ANDROID_SERIAL=emulator-5554 node scripts/native/conventions-watch.mjs android
IOS_SIMULATOR=<booted-uuid> node scripts/native/conventions-watch.mjs ios
```

Run platforms sequentially: this fixture deliberately edits the same source files, restores them in `finally`, and stops its own app/watch process. Results and CLI/runtime logs go to `scripts/native/out/conventions-<bundler>-<platform>`. It tests real device HMR, native Page identities, retained drafts/stacks, guards, modal results and accessibility visibility/focus targets. It does not automate screen-reader speech.

For Vite navigation acceptance without HMR:

```sh
ROUTER_BUNDLER=vite NATIVE_HMR=0 ANDROID_SERIAL=emulator-5554 node scripts/native/conventions-watch.mjs android
ROUTER_BUNDLER=vite NATIVE_HMR=0 IOS_SIMULATOR=<booted-uuid> node scripts/native/conventions-watch.mjs ios
```

This mode checks the 15 native navigation assertions; it does not run the seven live-edit assertions. Android launch uses an explicit `adb` Activity intent if the CLI stalls after syncing.
