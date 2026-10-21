# Native incoming destinations (#48, #58)

This fixture builds against the demo's published NativeScript dependencies. It does not patch Core or NativeScript-Vue, replace native navigation methods, or synthesize router callbacks.

It records route histories alongside the actual Frame pages, native window/task ids, incoming events and process ids. Android drives links with OS intents and shortcuts through the launcher menu and pin dialog. XCTest opens URLs, taps SpringBoard quick actions and activates real iPad scenes. Core Spotlight uses the native index; XCTest searches Spotlight and taps the app's actual result, verifying native NSUserActivity delivery through the resolver and authentication guard. The fixture then deletes its index. Search ranking outside this controlled fixture remains the operating system's decision.

Prepare a disposable demo resource directory from a NativeScript blank template, then from the repository root:

```sh
npm ci
npm run build
npm install --prefix demo
python3 scripts/native/entrypoints/prepare.py
```

The prepare script changes only ignored `demo/App_Resources`: it registers a test scheme, multiple iOS scenes, Android static shortcuts and the explicit Java entry Activity example. Android uses `standard` so the fixture can create two independent tasks. Static shortcuts use a separate task affinity and forward after the temporary Activity has been destroyed; this prevents clearing the application's existing task.

Build from `demo`:

```sh
ns build android --env.entrypointsTest
# or
ns build ios --for-device false --env.entrypointsTest
```

Run from the repository root on **dedicated** simulators/emulators; the drivers clear/uninstall this fixture app:

```sh
ANDROID_SERIAL=emulator-5554 \
ANDROID_APP=demo/platforms/android/app/build/outputs/apk/debug/app-debug.apk \
ENTRYPOINT_LAUNCHER=1 node scripts/native/entrypoints/android.mjs

IOS_SIMULATOR=<iPad-UDID> node scripts/native/entrypoints/ios.mjs
```

The Android launcher must expose shortcuts and support pinning. The default app label is `demo`; override `ENTRYPOINT_APP_LABEL` if your scaffold uses another label. The iOS driver requires Ruby's `xcodeproj` gem and Xcode; use an iPad to include the two-scene test. `ENTRYPOINT_TEST=testLinks` (or `testShortcuts`, `testSystemSearch`, `testWindows`) runs one XCTest scenario for diagnosis. Override `OUT` for each rerun to preserve earlier evidence and avoid reusing an xcresult path.

Spotlight first runs an independent Swift indexing probe. Some hosted simulators report indexing availability but never complete that native call. Only an unavailable service or a timed-out independent probe skips this optional system-search scenario; failures after a successful probe fail the test. Read `native-capabilities.json` and the XCTest log: `skipped` is not native Spotlight acceptance. The other entrypoint scenarios remain required. The full search flow must also pass in a responsive simulator; see [the native acceptance report](../../../test/native-shortcuts.md).

Reports, launcher dumps, screenshots, package versions and native logs are saved under `scripts/native/out/entrypoints-*`. Both Android API 34/36 lanes and the iPad lane in `Native contracts` run the acceptance fixture with launcher checks enabled. Existing native navigation/HMR tests remain required.

Coverage includes cold delivery into an unvisited tab, warm authentication and modal routes, background delivery, intentional repeat, stable named payloads after path changes, deleted destinations, cold/warm static and dynamic launcher entry, user-confirmed pinning, sign-out cleanup and receiving-window isolation. The iPad lane covers cold/warm quick actions, native Spotlight metadata and scene activities, and cold/warm links to a secondary scene. A custom-scheme intent or a UIKit browsing activity proves native delivery; it does not prove website domain association. Production AASA/assetlinks verification is app-owned and documented in the deep-link guide.
