# Native Vite file-routing acceptance (#100)

The optional Vite plugin uses the existing native router, Pages and Frames.
The example supports either webpack or Vite with adjacent `.route.json` metadata.
No NativeScript dependency patches are required. Explicit routes are unchanged.

## Accepted behavior

The shared `scripts/native/conventions-watch.mjs` runner invokes the real
NativeScript CLI, edits source files while the app is running, and restores them
on exit. With Vite HMR enabled, the original 8.0.19 acceptance passed 24 native assertions on each platform:

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

## Vite 8.0.20 revalidation (2026-10-21)

The example dependency and lockfile now select stock `@nativescript/vite` 8.0.20.
This published version includes [NativeScript#11555](https://github.com/NativeScript/NativeScript/pull/11555):
Vue runtime package boundaries no longer swallow unrelated `vue-*` imports, and
Vue navigation helpers use the canonical `/ns/rt` bridge.

The existing native acceptance runner passed again with HMR enabled:

| Platform                                                      | Run             | Navigation/watch checks | Template-retention invariants |
| ------------------------------------------------------------- | --------------- | ----------------------- | ----------------------------- |
| iPhone 17 / iOS 26.0 simulator                                | `1792612835988` | 24 passed               | 7 passed                      |
| Pixel 7 / Android API 36 emulator (`RouterPredictive62API36`) | `1792612902433` | 24 passed               | 7 passed                      |

Vite 8.3.4, NativeScript-Vue 3.1.2, Core 9.1.3, runtimes Android 9.1.1 /
iOS 9.1.0 and Node 22.23.3 were unchanged. No installed package was patched.
Logs, JSON results and template probes are in
`scripts/native/out/vite-8.0.20-ios` and
`scripts/native/out/vite-8.0.20-android-retry`.

The ten Vite plugin tests, root/example type checks, both bundled Vite builds,
bundle inspections and the documentation build also passed. Bundle inspection
found one native renderer/Core instance and no build tooling or web router.

The first Android attempt (`1792612420554`, `emulator-5554`) failed while waiting
for the modal, then its logcat query timed out. That emulator also reported system
ANRs. Its logs remain in `scripts/native/out/vite-8.0.20-android`; it is not counted
as a pass. The successful run used a separately cold-booted emulator. The runner
now accepts run-identified CLI output on Android as well as iOS, including a
failure reported before the ready phase; navigation assertions are unchanged.

This revalidation uses the example's packed local dependency (`install-links=true`)
and JSON metadata. It does not establish raw workspace-link compatibility or
support for `definePageMeta` during native Vite HMR. The independent upstream
macro-transform issue #11556 remains open.

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
- Local dependencies are installed as packed files (`install-links=true`), matching
  the published layout. NativeScript/NativeScript#11555 shipped in Vite 8.0.20;
  raw workspace links were not part of this native acceptance.
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
