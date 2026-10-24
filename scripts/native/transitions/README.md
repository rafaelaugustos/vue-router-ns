# Interactive-transition investigation (#136)

This fixture observes real UIKit transitions without replacing its delegate, recognizer, animator or history. It is an opt-in demo entry, never part of the published router. Android reuses the existing predictive-back driver against **published** Core.

Prepare the package and native resources using `demo/README.md`, then build:

```sh
npm ci
npm run build
cd demo
npm install
ns build ios --for-device false --env.transitionsTest
# Separate build for the Android fixture:
ns build android --env.predictiveTest
cd ..
```

Use dedicated devices: installing these fixtures replaces the demo app. The iOS test starts a fresh process. It exercises actual reversing/committed edge gestures, guard admission, source removal and a navigation request during gesture interruption. UIKit completion context is observed, not simulated. The 25 ms sampler is investigation instrumentation, not a proposed runtime feature or performance benchmark.

```sh
xcrun simctl install "$IOS_SIMULATOR" demo/platforms/ios/build/Debug-iphonesimulator/demo.app
ruby scripts/native/transitions/project.rb /tmp/router-transition-tests
xcodebuild test -project /tmp/router-transition-tests/TransitionChecks.xcodeproj \
  -scheme TransitionChecks -destination "platform=iOS Simulator,id=$IOS_SIMULATOR" \
  -derivedDataPath /tmp/router-transition-tests/build -collect-test-diagnostics never \
  -resultBundlePath /tmp/router-transition-tests/checks.xcresult
```

The result bundle must not already exist. Native screenshots are retained in XCTest; the app's Documents/transitions.json contains the last report and sampled UIKit contexts. Record the actual screen with `xcrun simctl io "$IOS_SIMULATOR" recordVideo video.mp4` while running the test.

```sh
node scripts/native/contracts/build-touch.mjs
adb -s "$ANDROID_SERIAL" install -r /tmp/router-contract-touch/touch.apk
ANDROID_APP=demo/platforms/android/app/build/outputs/apk/debug/app-debug.apk \
  PREVIEW_MODE=legacy OUT=scripts/native/out/transitions-android \
  node scripts/native/predictive/android.mjs
```

Set `ANDROID_HOME` and `ANDROID_SERIAL` first. The Android driver restores navigation-mode/back-animation settings and uses real UiAutomation gestures, preserving mid-gesture images and reports. It covers cancel/commit, global refusal, active leave-guard suppression, custom transitions, modal inner Back/result and replace/clear-history. No candidate Core alias is used in this run.

See `test/native-interactive-transitions.md` for observed results and the guide for platform/host gaps. Screen-reader speech, physical-device motion comfort, multiwindow gestures and arbitrary third-party shared-transition configurations require separate acceptance. Do not convert a successful fixture into a universal API claim.
