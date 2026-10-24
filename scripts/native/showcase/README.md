# Integrated native showcase acceptance

Run the normal example with `npm run showcase:ios` / `showcase:android` from `demo`, after package/resource setup in `demo/README.md`. For identity evidence, build the same app through the opt-in test entry:

```sh
npm run build
cd demo
ns build ios --for-device false --env.showcaseTest
ns build android --env.showcaseTest
cd ..
```

The test entry explicitly calls the same bootstrap function and adds bounded diagnostic snapshots in Documents/files `showcase.json`. It does not implement an alternative UI or substitute navigation callbacks. It is excluded from the normal `--env.showcase` entry and package runtime.

Use dedicated devices because installing replaces the mail demo. Each test starts a fresh process; the fictional catalog is in memory.

## iOS real input

```sh
xcrun simctl install "$IOS_SIMULATOR" demo/platforms/ios/build/Debug-iphonesimulator/demo.app
ruby scripts/native/showcase/project.rb /tmp/router-showcase-tests
xcodebuild test -project /tmp/router-showcase-tests/ShowcaseChecks.xcodeproj \
  -scheme ShowcaseChecks -destination "platform=iOS Simulator,id=$IOS_SIMULATOR" \
  -derivedDataPath /tmp/router-showcase-tests/build -collect-test-diagnostics never \
  -resultBundlePath /tmp/router-showcase-tests/checks.xcresult
```

Use a new result-bundle path each run. XCTest taps native drawer/header controls, types in UISearchController, opens a real context menu, toggles the shared header action, receives a modal result, edits with a real software-keyboard key, refuses native Back and drawer navigation, then saves and returns to the retained query. Explicit key input avoids relying on XCTest's inconsistent `hasKeyboardFocus` metadata for the NativeScript UITextView. Screenshots stay in the result bundle.

For a recording, run `xcrun simctl io "$IOS_SIMULATOR" recordVideo video.mp4` during the test and stop it with SIGINT. Copy `Documents/showcase.json` from the app container for native/logical evidence.

## Android real input

```sh
ANDROID_SERIAL=<dedicated-emulator> node scripts/native/showcase/android.mjs
ANDROID_SERIAL=<dedicated-emulator> REDUCED_MOTION=1 \
  OUT=scripts/native/out/showcase-android-reduced \
  node scripts/native/showcase/android.mjs
```

`ANDROID_APP` can override the APK path. The driver installs the APK, restarts the app, locates controls in UIAutomator and injects actual taps/long presses/text. It checks query/root-entry retention, correct menu item ownership, native modal result, guard refusal, drawer Back consumption and saving. XML, screenshots and bounded diagnostic snapshots go to `OUT` (default `scripts/native/out/showcase-android`). The reduced-motion run sets system animator duration scale to zero and restores its previous value in `finally`.

The native hierarchy checks labels and actionable alternatives; they do not certify spoken VoiceOver/TalkBack focus. See `test/native-showcase.md` for platform/version and manual boundaries. No emulator job is added to the PR gate for this opt-in example.
