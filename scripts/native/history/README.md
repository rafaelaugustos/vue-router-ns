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

`HISTORY_MENU_AUDIT=1` selects `testGuardedUIKitHistoryAudit` instead of the menu
suite. It reproduced a guard bypass on the stage-2 revision: UIKit history removed
entries despite an active `onBeforeRouteLeave` guard. That failed audit remains
in the stage-2 report. With stage 3, the same unchanged-history assertion must pass;
the router supplies a guarded native Back/history item automatically.

## Guarded UIKit Back/history (stage 3)

Build with both `--env.historymenuTest --env.historyGuards --no-hmr`, then run:

```sh
IOS_SIMULATOR=<dedicated-booted-iPad-UDID> HISTORY_GUARDS=1 RECORD_VIDEO=1 OUT=scripts/native/out/guarded-back node scripts/native/history/ios.mjs
```

The XCTest sequence requires all fourteen application reports. It checks top and
covered page guards, asynchronous Stay/Leave confirmation, exact duplicate Page
identity, independent Archive Pages, app-owned header updates, a guard activating
while original UIKit history is open, a single Back, restored system history and
owner disposal with an open guarded menu. The activation probe holds the touch
through the timer: releasing over UIKit's first history row may select it before
the guard activates. These are native UIKit controls driven through XCTest.

Focused contracts additionally cover stale callbacks after modal coverage,
repeated selection, hidden Back controls, later ActionBar wrappers and the iOS 15
boundary. Run the full fixture on separate dedicated iOS simulators sequentially;
the generated XCTest project/build directory is shared by default. This stage is
iOS-specific; it does not extend the native Android, physical-device or
screen-reader evidence from earlier work.
