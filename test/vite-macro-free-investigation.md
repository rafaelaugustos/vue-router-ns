# Native Vite HMR without page-script macros

This is an isolated experiment on `investigate/vite-macro-free`, based on draft
PR #101 (`40059e7`). It does not change the released router or replace
`definePageMeta`. The experimental `metadataFiles` option is not a released API.

## Result

With the registry release of `@nativescript/vite@8.0.19`, Android API 36 and the
iPhone 17 / iOS 26 simulator each passed 22 native navigation/watch assertions.
An additional template-edit probe verified the same native Page, setup instance,
route, back stack, other stack, and retained model/native TextField value.
The probe seeds the native TextField property directly; it does not claim keyboard
input or two-way binding coverage. The fixture initially changes its model from
outside setup, which did not update the visible field in this native HMR build.

The 658 installed package files match the npm tarball byte for byte. Neither the
#11555 import patch nor the #11556 source-capture prototype was installed.

## Changes tested

- Move page metadata into adjacent `index.route.json`, `products/[id].route.json`,
  etc. The generator reads and validates this data; page scripts have no macro.
  The experiment uses exact selected filenames for platform-specific sidecars.
- Publish route-table updates during module evaluation. Subscribers survive in
  `import.meta.hot.data`; the generated table is self-accepting. This works when
  a native host reevaluates a module without invoking dependency accept callbacks.
- Wait for the actual initial native Page before running navigation assertions.
- Use an added page with a nonempty script setup. A scriptless SFC exposed a
  separate assembler failure on the stock native HMR path during the first run;
  this experiment does not fix that compiler behavior.

A regression test first failed with the former dependency-callback implementation,
then passed without dispatching any callback: reevaluating the table updates only
installed routers, and disposing subscriptions prevents later notifications.
Existing Vite watcher/build tests still pass. Invalid external metadata leaves the
last successful generated table intact and recovers after correction.

## Validation

- Router suite: 427 passed, 8 skipped; no type-test errors.
- Root build and TypeScript check passed.
- Example `vue-tsc --noEmit` passed for both generated platform files.
- Android run: `1792549597129`, emulator API 36, 22 checks passed.
- iOS run: `1792549914492`, iPhone 17 / iOS 26 simulator, 22 checks passed.
- Template probe: all seven invariants passed on both platforms.

Native checks cover layouts, middleware discovery, native push/modals/results,
Back/drafts, independent stacks, route add/rename/remove, metadata updates for
future visits, invalid metadata recovery, and retention of open native pages.

Run from this branch after building/installing the example dependencies:

```sh
npm run build
npm test
npm run typecheck
ROUTER_BUNDLER=vite node examples/file-routing/scripts/routes.mjs android
ROUTER_BUNDLER=vite node examples/file-routing/scripts/routes.mjs ios
cd examples/file-routing
npx vue-tsc --noEmit
cd ../..
ROUTER_BUNDLER=vite ANDROID_SERIAL=emulator-5586 node scripts/native/conventions-macro-free.mjs android
ROUTER_BUNDLER=vite IOS_SIMULATOR=<booted-uuid> node scripts/native/conventions-macro-free.mjs ios
```

The runner restores edits and stops its CLI/app processes in `finally`. Android
requires a configured SDK/JDK; iOS requires Ruby/CocoaPods from the same compatible
installation. No machine-wide configuration was changed for these runs.

## Scope before shipping

This supports keeping our native architecture and developing an optional
macro-free metadata format. It does not establish that every Vite feature is
ready, and it does not close #100. In particular:

- `definePageMeta` still needs a pre-compiler source fix on the native HMR path.
- Live middleware edits still use dependency callbacks and were not accepted by
  this experiment; discovery and execution were tested.
- Scriptless SFC compilation and model-to-native-field updates need independent
  investigation; neither should be hidden by a router workaround.
- The sidecar API, platform fallback rules, docs, and compatibility need review
  before integration into PR #101. Released webpack/manual-route behavior remains
  the compatibility baseline.

Evidence is saved in `scripts/native/out/vite-macro-free` in the main workspace,
including stock-package verification, native results/logs, and automated checks.
No release was published and no upstream dependency was modified.
