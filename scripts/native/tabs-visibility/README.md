# Per-page native tab visibility

`demo/src/testing/tabsvisibility-app.ts` is the public list/detail example. Only its acceptance bridge reads native widgets; pages declare `meta.tabBarVisibility` and use the normal router API.

Build the package (`npm run build`), prepare the demo's native resources, add the iOS URL scheme (`python3 scripts/native/tabs-visibility/prepare.py`), then build in `demo` with `ns build ios --for-device false --env.tabsvisibilityTest` or `ns build android --env.tabsvisibilityTest`. Android needs the `vuerouterns` VIEW/BROWSABLE intent filter used by `.github/workflows/native.yml`.

Use dedicated test devices: the driver **reinstalls the iOS fixture and clears Android app data**. It only operates on the explicit device identifier.

The driver waits up to 30 seconds for the fixture's command bridge before sending its first command, allowing fresh installations to start on busy simulators and emulators. Missing readiness fails the run with an explicit startup error.

```sh
IOS_SIMULATOR=<uuid> EXPECTED_HOST=uikit node scripts/native/tabs-visibility/run.mjs
# Install the Android debug APK first, then:
node scripts/native/contracts/build-touch.mjs
ANDROID_SERIAL=<serial> EXPECTED_HOST=bottom TOUCH_APK=/tmp/router-contract-touch/touch.apk node scripts/native/tabs-visibility/run.mjs
```

`OUT` selects the evidence directory. `RECORD=1` records the same scenario. `IOS_APP` can override the built `.app` path. Android gesture injection enables gestural navigation on that dedicated emulator and uses a separate, self-instrumented APK; it verifies the app's process survives the input.

The driver checks UIKit's real hidden state/safe-area or Material view visibility/layout, push/replace/root/native Back, visible overrides, modal isolation, tab selection and Page identity, rejected guards, failed loading, deep links to another tab and saved-stack restoration after process restart. Android additionally checks bottom/rail size reclamation, native cancelled/committed gestures and a cold OS link. Unit tests cover matched-parent inheritance, initial hidden routes, nested/independent containers, split adaptation, HMR and disposal.

For iOS gestures and cold OS URLs, run XCTest after reinstalling the fixture (clean persisted histories):

```sh
xcrun simctl uninstall "$IOS_SIMULATOR" org.nativescript.vuerouterns
xcrun simctl install "$IOS_SIMULATOR" demo/platforms/ios/build/Debug-iphonesimulator/demo.app
ruby scripts/native/tabs-visibility/project.rb /tmp/router-tab-visibility-tests
xcodebuild test -project /tmp/router-tab-visibility-tests/VisibilityChecks.xcodeproj \
  -scheme VisibilityChecks -destination "platform=iOS Simulator,id=$IOS_SIMULATOR" \
  -derivedDataPath /tmp/router-tab-visibility-tests/build -collect-test-diagnostics never
```

This reverses a genuine interactive edge gesture, checks that details remain hidden, rejects guarded Back, completes native Back and opens an OS URL into a hidden page from a terminated process. The XCTest-only `ContractTouch` helper is shared with the existing native contract suite; it is never linked into the app/router. `app.open` handles iOS URL consent, unlike unattended `simctl openurl`.

To validate the actual Core fallback, build a signed release without adding Material to `app.gradle`, install it on a rootable emulator and run with `ANDROID_ROOT=1 EXPECTED_HOST=core`. The driver confirms navigation continues while the Core title strip stays visible. It restores unrooted adb afterward. The required native workflow runs this variant as well as Material and UIKit on iOS 18.6.

Local evidence for this change: iOS 26.0 completed 20 programmatic native checks plus the gesture/cold-link XCTest; Android API 34 completed 29 checks including real reversing/committed touch input. A signed release without Material completed 21 fallback checks on the same Android API 34 emulator. Recordings in `docs/public/media/*-tabs-visibility.mp4` show actual simulator/emulator runs. No physical-device or screen-reader speech coverage is claimed. Sidebar mode and older UIKit intentionally keep their navigation visible; see the public guide for limits.
