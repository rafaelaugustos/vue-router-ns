# Core-owned predictive-back prototype — #62

The prototype investigation is implemented and native behavior compared; the upstream API is proposed in [NativeScript #11558](https://github.com/NativeScript/NativeScript/pull/11558), following [#11557](https://github.com/NativeScript/NativeScript/issues/11557). No upstream merge or published Core support is implied. Shipping behavior stays on the existing preview unless the application opts into `backPreview: 'core'` and supplies a compatible candidate Core.

## Audit and decision

Audited published Core 9.1.3 and upstream main `3224f1b` on 2026-10-20. Frame's `_navigateCore`/`_goBackCore` use FragmentTransaction.replace and Core maintains its own entry stack. They do not use addToBackStack. AndroidX predictive Fragment transitions are tied to FragmentManager back-stack semantics and supported Animator/AndroidX Transition types; replacing Frame's history would change replace/clearHistory, nested/modals and custom transition behavior. See [Core's source](https://github.com/NativeScript/NativeScript/blob/3224f1b/packages/core/ui/frame/index.android.ts) and [Android's fragment animation requirements](https://developer.android.com/guide/fragments/animate).

The chosen prototype adds a presentation-only Frame session: update/cancel/finish/dispose, protocol version 1. Frame captures the previous native Page into a bounded bitmap/ImageView and owns teardown. Its live Page stays detached/unloaded, with no preview-driven Fragment lifecycle or FragmentManager back-stack entries. `finish()` never navigates; router guards decide whether to call native Back after release. Unknown API versions are disposed and fall back. A changed top/target or disposed session cannot pop a newer page.

The existing preview remains the default and the versioned fallback. Custom/shared transitions are declined by the candidate and still use the existing preview; regular transitions, root Back and modal-root dismissal retain their normal ownership. Reduced-motion behavior and active leave-guard suppression remain in the router.

## Reproducible candidate

Core revision: `fadb58f034e403933028f86746280375ea9811ff` in `rafaelaugustos/NativeScript`. The first commit, `b27f2eb`, is a separable Frame recreation fix. Core build and 540 unit tests passed (one existing skip); the router passed 482 tests (10 existing skips), with package/demo typechecks. Native Core tests and a plain toolbox example are included upstream; the entire Core device-test app was not executed as a whole.

The demo webpack option `--env.predictiveCore=/absolute/path/to/core/dist/packages/core` aliases the compiled candidate. It never edits `node_modules`. Native resources/runtime remain from the installed Core 9.1.3 and Android runtime 9.1.1; NativeScript-Vue is 3.1.2. With no alias the app uses its installed Core. CI checks out the exact candidate revision and preserves both kinds of artifacts.

## Native matrix

Local dedicated ARM64 emulators on Android 14/API 34, 15/API 35 and 16/API 36 all passed the following on the final candidate:

| Scenario                                                                          | Existing preview                     | Core snapshot                     |
| --------------------------------------------------------------------------------- | ------------------------------------ | --------------------------------- |
| Actual system gesture cancel / commit                                             | Passed                               | Passed                            |
| Global guard refusal after progress                                               | Passed                               | Passed                            |
| Active leave guard suppresses preview                                             | Passed                               | Passed                            |
| Custom transition preview                                                         | Existing preview                     | Declines; existing preview passes |
| Modal inner Back and exactly-once result                                          | Passed                               | Passed                            |
| Replace and clearHistory                                                          | Passed                               | Passed                            |
| Previous Page during progress                                                     | Temporarily attached, stays unloaded | Detached and unloaded             |
| FragmentManager back-stack entries                                                | Zero                                 | Zero                              |
| Navigation interrupts finishing session                                           | Existing contract coverage           | Passed                            |
| Eight snapshot cycles and native collection                                       | No bitmap allocated                  | All eight Bitmaps collected       |
| Same-process Activity recreation, retained Page identities/draft, subsequent Back | Passed on corrected Core             | Passed on corrected Core          |

Input comes from the separate `ContractTouch` APK's public UiAutomation input injection. The app stays in its original process. Each gesture has a mid-progress screenshot and post-gesture screenshot. Reports include logical/native diagnostics, Page lifecycle events and actual previous-view parent state. No native gesture callback or Fragment transaction is simulated.

The bitmap collection check uses Java WeakReference plus ReferenceQueue, without reading the referents back into strong JS bridge wrappers. Three fixed JS/native GC rounds follow eight cycles; no retry-until-pass or nonzero retention allowance is used.

## Recreation regression and negative control

Plain NativeScript, without Vue, reproduced an existing bug on published Core 9.1.3 / API 35: the recreated Frame view attaches while the new Activity is INITIALIZED. `_onAttachedToWindow()` declines, but no second native attachment happens at CREATED. `onLoaded()` runs with a genuinely attached native view and `_attachedToWindow === false`; later Back remains queued. Both pre-fix preview paths disposed their sessions, but navigation could not resume.

The candidate checks the owning Activity and revalidates an already-attached view after `super.onLoaded()`. Native tests verify different Activity identities in the same PID, original Page identities/draft, old session disposal, reset transforms, and a subsequent successful Back. The regression is fixed for both preview paths on all three APIs. The published-Core negative control on API 35 must fail at exactly `back-after-recreate` with a loaded Frame/Page, false attached flag, and a nonempty queue; unrelated errors do not count.

## Measured tradeoffs and limits

At 1080 × 2400, each snapshot allocates **10,368,000 bytes** (about 9.9 MiB), versus no snapshot buffer in the existing preview. The cap is 4,194,304 pixels / 16 MiB; larger pages fall back. Recorded candidate capture times for cancel/commit/global-guard/modal scenarios:

| Local emulator | First capture | Other three captures |
| -------------- | ------------- | -------------------- |
| Android 14     | 7.03 ms       | 2.94–6.88 ms         |
| Android 15     | 15.30 ms      | 2.47–2.73 ms         |
| Android 16     | 10.46 ms      | 3.07–5.63 ms         |

These are synchronous capture samples on ARM64 emulators with other local work running, not frame-rate baselines or hardware performance claims. Observation wraps the real candidate method only to measure elapsed time/allocation; it does not substitute an implementation. Capture can exceed a frame budget on other content/devices. Static snapshots do not represent live video, surfaces or changing SDK content. Secure windows, SurfaceView/TextureView descendants, failed software drawing, and custom/shared transitions decline capture. The ImageView is excluded from accessibility traversal; audible TalkBack acceptance is not claimed.

Edge-to-edge screenshot inspection confirmed visible previous/current content and intact system status/navigation bars during the gesture. Insets/styles are not changed by the prototype. The test covers single-window Frames and modal inner Frames; it does not claim multiwindow scene reconstruction. Window ownership, same-process reconnection and cold task/scene restoration have separate evidence in [native-windows.md](./native-windows.md); those results do not extend this gesture matrix.

## Run

Build the Core revision using its documented Nx setup, then from this repo:

```sh
npm ci
npm run build
cd demo
npm install
ns build android --env.predictiveTest --env.predictiveCore=/absolute/core/dist/packages/core
cd ..
node scripts/native/contracts/build-touch.mjs
ANDROID_SERIAL=emulator-5554 ANDROID_APP=demo/platforms/android/app/build/outputs/apk/debug/app-debug.apk PREVIEW_MODE=core OUT=scripts/native/out/predictive-core node scripts/native/predictive/android.mjs
ANDROID_SERIAL=emulator-5554 PREVIEW_MODE=legacy OUT=scripts/native/out/predictive-legacy node scripts/native/predictive/android.mjs
```

For the plain Frame recreation fixture, build with `--env.predictiveplainTest` and the same candidate alias, then run `scripts/native/predictive/recreation.mjs` with `ANDROID_SERIAL`, `ANDROID_APP` and `OUT`. For the negative control, build that fixture with stock Core 9.1.3 and no alias, then use `PREVIEW_MODE=legacy EXPECT_RECREATION_FAILURE=1` on API 35.

Both runners preserve reports/logs and never modify installed dependencies. The gesture runner restores emulator navigation-mode/back-animation settings. Use a dedicated emulator; builds install over the router demo app. `.github/workflows/native-predictive.yml` runs the API 34/35/36 matrix, uploads its evidence, and is part of the required `native-contracts` aggregate.
