# Retained entry history acceptance

This opt-in demo fixture exercises the first stage of #178 on two real Frame
stacks. It uses public router APIs; native Page references are retained only by
the fixture to compare identity. It is not a garbage-collection measurement.

Prepare the ignored demo resources following [the demo setup](../../../demo/README.md).
Use macOS, Xcode, Ruby with `xcodeproj`, NativeScript CLI and a dedicated iPad
simulator. The driver reinstalls `org.nativescript.vuerouterns` on that simulator.
From the repository root:

```sh
npm ci
npm run build
npm --prefix demo ci
cd demo
ns build ios --for-device false --env.historyTest --no-hmr
cd ..
IOS_SIMULATOR=<dedicated-booted-iPad-UDID> RECORD_VIDEO=1 node scripts/native/history/ios.mjs
```

`OUT` selects a fresh output directory (default `scripts/native/out/history`).
`XCTEST_PROJECT` selects the generated test project directory. If the project was
already generated and built, `XCTEST_PREPARED=1` reuses it. The driver preserves
the XCTest log/result bundle, recording, final screenshot and eight application
reports; every report must pass. Run the fixture typecheck with
`demo/node_modules/.bin/tsc --noEmit -p scripts/native/history/tsconfig.json`.

The sequence seeds duplicate paths in Inbox and a separate Archive stack;
refuses an exact selection through a guard; selects the older duplicate while
preserving its Page and every Archive Page; rejects the removed duplicate's
address; reverses and then commits actual UIKit Back gestures; and closes both
owners. Reports check native/logical identity, all result settlements and every
destination's single unmount. The gesture page uses an animated transition so
the reversed gesture can cancel. The reversing touch helper uses XCTest-only
event APIs; no private touch API is included in the app or router.

This fixture validates iOS simulator behavior. It does not establish physical
hardware, Android gesture behavior, process-death execution, accessibility of a
history menu or repeated resource collection. Window boundaries, reconstructed
identities, pinned roots, unloaded hosts and asynchronous races also have focused
contract tests. The menu has a separate fixture below.

## Optional Back history menu (stage 2)

Build `demo` with `--env.historymenuTest --no-hmr` instead of `historyTest`.
The fixture supports both iOS and Android and renders two native stacks. On iOS,
run the same driver with `HISTORY_MENU=1` and a fresh `OUT` directory:

```sh
IOS_SIMULATOR=<dedicated-booted-iPad-UDID> HISTORY_MENU=1 RECORD_VIDEO=1 OUT=scripts/native/out/history-menu node scripts/native/history/ios.mjs
```

XCTest audits UIKit's original unguarded Back history, then exercises the opt-in
menu by long press, Ctrl+H, Escape, outside tap and selection. Reports assert
exact duplicate identity, another stack's unchanged Pages, refused selection,
concurrent navigation and owner disposal. No private native Back lookup is used.

For Android, configure `ANDROID_HOME`, the Java runtime and `adb` on `PATH`, build
with `ns build android --env.historymenuTest --no-hmr` in `demo`, then run:

```sh
ANDROID_SERIAL=<dedicated-emulator-serial> OUT=scripts/native/out/history-menu-android node scripts/native/history/menu-android.mjs
```

The Android driver installs the debug APK, starts the fixture and uses UIAutomator
labels plus real input events. It checks long press, hardware Back, Ctrl+H,
Escape, arrow keys/Enter and the same guard/identity/lifecycle assertions. It
keeps seven application reports and the accessible menu hierarchy. Existing app
data is retained; use a dedicated emulator. The native checks exercise accessible
labels and keyboard events, not screen-reader speech or every keyboard mode.

### Separate UIKit guard audit

`HISTORY_MENU_AUDIT=1` selects `testGuardedUIKitHistoryAudit` instead of the passing
menu suite. On iOS 18.6/Core 9.1.4 this reproduction **fails**: UIKit's original
long-press history pops past an active `onBeforeRouteLeave` guard. The guard uses
the existing router Back interception; the opt-in menu does not replace that
system control. The failed audit is retained in the stage-2 report and #178 stays
open. This probe is not counted as passing native acceptance.
