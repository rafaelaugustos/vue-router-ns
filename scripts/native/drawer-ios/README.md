# Native iOS drawer contracts

Build the package (`npm run build`), prepare the demo's native resources following `demo/README.md`, then build in `demo`:

```sh
ns build ios --for-device false --env.drawerTest
```

Use a dedicated iPhone or iPad simulator. The file-bridge driver **reinstalls the fixture**, removing its saved app data:

```sh
IOS_SIMULATOR=<uuid> node scripts/native/drawer-ios/run.mjs
```

`IOS_APP` overrides the built `.app` location; `OUT` overrides the evidence directory. `results.json` records native pane geometry, accessibility state, event counts, recognizer count and retained content identity. Commands cover imperative methods, binding, repeated calls, Escape, RTL, width changes, navigation, duplicate destinations and remount with an initially open pane.

For touch input and native navigation, install the fixture and run XCTest (Ruby needs `xcodeproj`):

```sh
xcrun simctl install "$IOS_SIMULATOR" demo/platforms/ios/build/Debug-iphonesimulator/demo.app
ruby scripts/native/drawer-ios/project.rb /tmp/router-drawer-tests
xcodebuild test \
  -project /tmp/router-drawer-tests/DrawerChecks.xcodeproj -scheme DrawerChecks \
  -destination "platform=iOS Simulator,id=$IOS_SIMULATOR" \
  -derivedDataPath /tmp/router-drawer-tests/build -collect-test-diagnostics never \
  -resultBundlePath scripts/native/out/drawer-ios/checks.xcresult
```

Each XCTest launch clears only this fixture's saved navigation state using the `drawer-reset` argument. The tests exercise reversing and committed edge gestures, scrim dismissal, keyboard input, independent stacks/drafts, conditional leave guards, native Back, modal result/layering, RTL and rotation. The input helper uses XCTest-only event synthesis; it is not compiled into the router or demo.

The `Native iOS drawer` workflow runs this suite on iPhone and iPad. The full release/weekly native gate requires it, while pull requests retain the lightweight required check. Android continues through the existing `scripts/native/drawer-android.mjs` lane.

Accessibility flags and direct Escape dispatch are automated. Actual VoiceOver speech, focus traversal/restoration and the two-finger escape gesture require a manual check with VoiceOver enabled; an accessibility hierarchy alone is not evidence of spoken focus. See `test/native-drawer-ios.md` for recorded results and gaps.
