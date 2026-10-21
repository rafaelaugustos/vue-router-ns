# Native Vite file-routing acceptance (#100)

The optional Vite plugin uses the existing native router, Pages and Frames.
The example supports either webpack or Vite with adjacent `.route.json` metadata.
No NativeScript dependency patches are required. Explicit routes are unchanged.

## Accepted behavior

The shared `scripts/native/conventions-watch.mjs` runner invokes the real
NativeScript CLI, edits source files while the app is running, and restores them
on exit. With Vite HMR enabled it passed 24 native assertions on each platform:

- Android API 36 emulator: run `1792550646308`.
- iPhone 17 / iOS 26 simulator: run `1792550577384`.

Coverage includes native layout ownership, discovered guards, cancellation,
auth redirects, typed params and modal results, accessibility visibility and
focus targets, Back with retained drafts, and independent stacks. Live changes
cover existing middleware replacement, page add/rename/remove, metadata updates,
invalid metadata recovery, and updated metadata on future visits.

Seven additional template-edit invariants passed on both platforms: same native
Page, same Vue setup capture, retained model draft, retained native TextField text,
current route, back-stack depth, and the unrelated stack's Page. The fixture seeds
the native TextField property directly; it does not test keyboard input or two-way
binding. Screen-reader speech is outside this fixture.

Environment: stock `@nativescript/vite` 8.0.19, Vite 8.3.4, NativeScript-Vue 3.1.2,
Core 9.1.3, Android runtime 9.1.1, iOS runtime 9.1.0, and Node 22.23.3.
The original investigation verified all 658 installed Vite package files against
the npm tarball; final acceptance reinstalled stock dependencies with `npm ci`.
Native logs and JSON results are in `scripts/native/out/vite-final-{android,ios}`.

The webpack compatibility run passed the same 24 route/middleware assertions on
Android API 36 (`1792550864760`). Its existing template-HMR behavior remounts the
page; the seven preservation invariants apply specifically to the Vite run.

## Automated coverage

Real Vite build/dev-server tests cover generation, platform selection, macro
stripping in bundled builds, watcher delivery, recovery, and build-tool exclusion.
JSON tests cover validation, source conflicts, platform selection and opt-in defaults.
VM regressions deliberately omit dependency accept callbacks: route-table
reevaluation updates installed routers, disposal removes subscriptions, and
middleware reevaluation updates existing guard wrappers. Failed guard evaluation
preserves the preceding implementation. The shared native runner exercises this
through real navigation, rather than asserting only generated source.

## Support boundaries

- `definePageMeta` works with webpack and bundled Vite (`--no-hmr`). Native Vite
  HMR bypasses pre-compiler SFC transforms: NativeScript/NativeScript#11556 remains
  open. The plugin reports how to switch to `.route.json` before startup when a
  macro is present. This acceptance does not claim that the upstream bug is fixed.
- JSON metadata belongs to the exact selected `.vue` file, including platform
  suffixes. There is no implicit fallback or merge between sidecars.
- Stock native SFC assembly needs a nonempty script block; template-only SFCs
  exposed a separate compiler failure. The example includes scripts.
- Local dependencies are installed as packed files (`install-links=true`). Raw
  linked-import rewriting is tracked by NativeScript/NativeScript#11555.
- Adding/removing/renaming layout or middleware registrations requires restarting
  the app. Existing middleware edits update guards in place. Vue script edits can
  remount components; the tested compatible template edit retains native state.

## Reproduce

After root build, example `npm ci` and `npm run setup`, run sequentially because
the fixtures edit the same files:

```sh
ROUTER_BUNDLER=vite ANDROID_SERIAL=emulator-5586 node scripts/native/conventions-watch.mjs android
ROUTER_BUNDLER=vite IOS_SIMULATOR=<booted-uuid> node scripts/native/conventions-watch.mjs ios
```

Omit `ROUTER_BUNDLER=vite` for the webpack compatibility run. `NATIVE_HMR=0`
selects bundled native acceptance (15 navigation assertions). SDK/JDK or
Xcode/Ruby/CocoaPods must be configured for the selected platform.
