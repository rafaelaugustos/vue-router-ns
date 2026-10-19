# Native Android checks

`npm run test:native:android` runs the demo smoke suite. `npm run test:native:drawer` runs a separate drawer fixture with three independent stacks, guards, modal results and saved page state.

Both suites clear their installed test app's data. Use a test device or emulator. With multiple devices connected, set `ANDROID_SERIAL` explicitly. The drawer runner restores the device's rotation settings even after an assertion fails; it writes screenshots, the accessibility hierarchy and `results.json` under `scripts/native/out/drawer-<serial>`.

## Middleware and helper acceptance

`npm run test:native:middleware` runs the fixture built with `ns build android --env.middlewareTest`. Install that APK first and select a test device with `ANDROID_SERIAL`. The fixture performs 15 checks of real Frame history, authentication redirects, async refusal, errors, page-bound helpers across two stacks, repeated entries, disposal, guarded Back and modal results. The runner then uses Android system Back to verify refusal while dirty and successful return after allowing. It records logs, the JSON report and screenshots under `scripts/native/out/middleware`.

Build the same fixture with `ns build ios --emulator --env.middlewareTest` to run those 15 checks on the iOS runtime. Both platforms print `MIDDLEWARE_RESULT` with the outcome; a passing fixture remains on a guarded page for native Back checks. The fixture does not use file routing or a Nuxt/Vue Router runtime. Building without either test flag restores the normal demo entry point.

## Layout acceptance

Build `ns build android --env.layoutsTest` in `demo`, install its APK and run `ANDROID_SERIAL=<serial> npm run test:native:layouts`. The fixture checks default/named/disabled layouts, one Page/ActionBar per entry, isolated drafts, two native tabs, modal guards/results, missing layouts, disposal and actual native Page replacement for layout/destination HMR. Its 18-check report is followed by a real Android system Back refusal/allow test. Logs, JSON and screenshots go to `scripts/native/out/layouts`.

Use `ns build ios --emulator --env.layoutsTest` for the same fixture on iOS; inspect the unified log's `LAYOUT_RESULT`. The final screen remains on a layout-guarded page so its UIKit ActionBar Back can be tested. Both script HMR cases exercise Vue's real HMR runtime and NativeScript-Vue's Page replacement; no router/native host methods are patched. Building without a fixture flag restores the normal demo.

## Drawer acceptance

Build the router, then build and install the fixture:

```sh
npm run build
cd demo
ns build android --env.drawerTest
adb -s <serial> install -r platforms/android/app/build/outputs/apk/debug/app-debug.apk
cd ..
ANDROID_SERIAL=<serial> npm run test:native:drawer
```

The generated demo's `App_Resources/Android/src/main/AndroidManifest.xml` must have `android:supportsRtl="true"` and `android:enableOnBackInvokedCallback="true"` on `<application>`, plus the `vuerouterns` scheme intent filter from the deep-link guide. CI supplies these flags. `--env.drawerTest` replaces only the webpack entry point; a normal `ns build android` restores the regular demo.

The runner uses UIAutomator's **compressed** hierarchy. The default dump includes views marked unimportant for accessibility, including content underneath an open drawer; checking that dump alone would incorrectly report a focus leak.

The fixture's ActionBar opens the drawer. Its native buttons exercise touch and keyboard activation. Rotation must keep the detail stack and draft. `Use RTL` changes the drawer's native layout direction; the pane must move to the right. On Android versions before system edge Back gestures, the suite also drags the start edge. Modals and Material sheets deliberately leave the drawer open underneath so their Back handling, guards and results are tested separately.

For process restoration, the runner backgrounds the app and tries `am kill`. If Android retains it as the previous app rather than a cached process, the runner uses the debug build's `run-as` to kill only that app's PID. It verifies that the process died and that the restored process has a new PID; it does not force-stop the task for this check.

## TalkBack and gestures

The automated hierarchy check complements TalkBack testing. Enable TalkBack on the test device, open the fixture's menu, swipe through its destinations and double-tap `Go settings`. Confirm that the covered page and tabs are not reached, the destination opens, and Back returns to normal page navigation after closing the drawer. Restore the device's original accessibility setting afterward.

Run the automated suite with TalkBack off. UIAutomator temporarily suppresses other accessibility services, so running a dump during the manual check can interrupt TalkBack or reopen its tutorial. Use screenshots and the tester's spoken-feedback confirmation for that check.

On Android 14 and later with gesture navigation, check both cancelled and committed Back swipes while the drawer is open, then repeat with a modal above it. Android owns the edge; an ActionBar menu button remains necessary when an edge drag is interpreted as system Back.

The checked device/version matrix and outcomes belong in [`test/native-drawer.md`](../../test/native-drawer.md).
