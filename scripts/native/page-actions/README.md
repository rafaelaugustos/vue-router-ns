# Shared page actions acceptance

Build the package (`npm run build`), install demo dependencies and prepare `demo/App_Resources` using the [demo setup](../../../demo/README.md). The opt-in `--env.actionsTest` fixture and file bridge never ship in the library.

Drivers reinstall/clear `org.nativescript.vuerouterns`; use dedicated test devices. Reports go to `scripts/native/out` (override `OUT`).

## iOS

```sh
cd demo
ns build ios --for-device false --env.actionsTest
cd ..
IOS_SIMULATOR=<booted-dedicated-uuid> node scripts/native/page-actions/run.mjs
ruby scripts/native/page-actions/project.rb /tmp/router-page-actions-tests
xcodebuild test \
  -project /tmp/router-page-actions-tests/PageActionsChecks.xcodeproj \
  -scheme PageActionsChecks \
  -destination 'platform=iOS Simulator,id=<uuid>' \
  -derivedDataPath /tmp/router-page-actions-tests/build \
  -collect-test-diagnostics never \
  -resultBundlePath scripts/native/out/actions-ios/input.xcresult
```

The result bundle path must not already exist. XCTest launches a fresh fixture for each case. It uses real native taps/long presses to inspect shared busy/disabled/localized state, hidden actions, async errors, ordinary ActionItems, modal leave guards/results and a source rebound while its menu is open.

## Android

```sh
cd demo
ns build android --env.actionsTest
cd ..
ANDROID_SERIAL=<dedicated-emulator> node scripts/native/page-actions/run.mjs
ANDROID_SERIAL=<dedicated-emulator> OUT=scripts/native/out/actions-android-input node scripts/native/page-actions/android-input.mjs
```

The input driver uses `adb input` and UIAutomator. It retains XML and a screenshot. PopupMenu enabled-state checks include ancestors because the native menu disables its row, while a child TextView can still report enabled.

Both platform bridge runs exercise serial admission, disabled native buttons, asynchronous errors, page-scoped navigation, modal coverage/results, cooperative abort on removal, actual page-app HMR replacement and inactive-tab rejection. Reports include native diagnostics and logical/native header state. The full `native-page-actions.yml` workflow runs both platforms without adding emulator jobs to PR checks. See the [validation report](../../../test/native-page-actions.md) for manual boundaries.
