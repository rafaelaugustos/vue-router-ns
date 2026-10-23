# Native tab reselection regression (#121)

The opt-in fixture has independent A/B/C stacks. A/B enable `backToRootOnReselect`; C disables it. Tests use actual native tab taps, programmatic selection, duplicate deep-link dispatch, selection vetoes and leave guards. They verify visible native pages and reselect event counts. The app also writes `tabs-result.json` to its documents directory for diagnosis.

Prepare the demo's generated `App_Resources` as described in [the native guide](../README.md), install its dependencies, and build the router with `npm run build`. Build only one platform at a time. Normal builds without the flag keep the normal demo.

## iOS

Use a dedicated booted simulator. Install CocoaPods and the `xcodeproj` Ruby gem, then run from the repository root:

```sh
(cd demo && ns build ios --for-device false --env.tabsTest)
xcrun simctl install <uuid> demo/platforms/ios/build/Debug-iphonesimulator/demo.app
ruby scripts/native/tabs/project.rb /tmp/router-tab-tests
xcodebuild test -project /tmp/router-tab-tests/TabChecks.xcodeproj \
  -scheme TabChecks -destination 'platform=iOS Simulator,id=<uuid>' \
  -derivedDataPath /tmp/router-tab-tests/build -collect-test-diagnostics never \
  -resultBundlePath /tmp/router-tabs.xcresult
```

Use a fresh result-bundle path for each run. XCTest launches the fixture, asserts the native pages and retains a final screenshot. It does not call tab delegate methods, synthesize router events or replace UIKit delegates. The pre-fix implementation fails when switching back to A's populated stack on iOS 26.0.

## Android

Use a dedicated emulator/test device: the runner clears this fixture app's data and stops it on exit.

```sh
(cd demo && ns build android --env.tabsTest)
adb -s <serial> install -r demo/platforms/android/app/build/outputs/apk/debug/app-debug.apk
ANDROID_SERIAL=<serial> node scripts/native/tabs/android.mjs
```

The runner drives Material buttons with UIAutomator/adb and records the reached pages and final hierarchy under `scripts/native/out/tabs-<serial>`. It requires an English emulator with other accessibility services off. The core TabView fallback has separate unit coverage; this native debug fixture exercises Material.

See [the validation report](../../../test/native-tabs.md) for tested versions and boundaries.
