# Adaptive drawer acceptance

Build the package with `npm run build`, install the demo dependencies and prepare `demo/App_Resources` as described in the [demo setup](../../../demo/README.md). The fixture is selected only by `--env.adaptivedrawerTest`.

The drivers reinstall/clear the fixture app `org.nativescript.vuerouterns`; use dedicated test devices. They save JSON reports in `scripts/native/out`, and input drivers also retain accessibility trees/screenshots or XCTest attachments. The fixture compares actual Page/Frame objects, native Frame views, Vue state objects, logical/native entry IDs and drafts; the file bridge is not part of the library.

## iOS

```sh
cd demo
ns build ios --for-device false --env.adaptivedrawerTest
cd ..
IOS_SIMULATOR=<dedicated-booted-uuid> node scripts/native/adaptive-drawer/run.mjs
```

Repeat on iPhone 16 and iPad Pro 11-inch M4 with iOS 18.6. To test Reduce Motion, save the current `com.apple.Accessibility ReduceMotionEnabled` preference, set it with `xcrun simctl spawn <uuid> defaults write com.apple.Accessibility ReduceMotionEnabled -bool YES`, rerun the driver, then restore the original preference. The report records the actual UIKit Reduce Motion value.

For real keyboard input, native accessibility reachability, tab navigation, modal results and rotation, reinstall the app to clear the bridge run's saved navigation state, then:

```sh
ruby scripts/native/adaptive-drawer/project.rb /tmp/router-adaptive-tests
xcodebuild test \
  -project /tmp/router-adaptive-tests/AdaptiveDrawerChecks.xcodeproj \
  -scheme AdaptiveDrawerChecks \
  -destination 'platform=iOS Simulator,id=<uuid>' \
  -derivedDataPath /tmp/router-adaptive-tests/build \
  -collect-test-diagnostics never \
  -resultBundlePath scripts/native/out/adaptive-ios/checks.xcresult
```

The result bundle path must not already exist. The iPad test verifies the actual `auto` transition at 840 DIPs between portrait and landscape; the phone also exercises explicit permanent presentation.

## Android

```sh
node scripts/native/prepare-folds.mjs
cd demo
ns build android --env.adaptivedrawerTest
cd ..
ANDROID_SERIAL=<dedicated-emulator> node scripts/native/adaptive-drawer/run.mjs
ANDROID_SERIAL=<dedicated-emulator> OUT=scripts/native/out/adaptive-input node scripts/native/adaptive-drawer/android-input.mjs
```

The first driver verifies state and identity; the second uses `input tap/text/keyevent` and UIAutomator to prove that both regions receive real input in permanent mode, hidden/covered regions leave the accessibility tree, typed drafts survive tab/mode changes, and Back pops a page instead of consuming permanent visibility.

On a Pixel Fold emulator configured with [`prepare-fold-avd.mjs`](../prepare-fold-avd.mjs):

```sh
ANDROID_SERIAL=<dedicated-fold-emulator> OUT=scripts/native/out/adaptive-hinge node scripts/native/adaptive-drawer/folds.mjs
```

This uses the emulator hinge sensor and the platform `display_features` setting to deliver an occluding FoldingFeature through the real AndroidX WindowManager provider. It verifies flat/half-open postures, RTL, horizontal rotation under a pending modal, and disabling/re-enabling the observer. Display-feature and rotation settings are restored in `finally`; the dedicated device returns to its open posture.

The full native workflows run these drivers. They do not add emulator jobs to the fast pull-request gate. See the [validation report](../../../test/native-drawer-adaptive.md) for manual boundaries.
