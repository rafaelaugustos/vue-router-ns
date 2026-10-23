# Native tab appearance acceptance

Build the shared public-API example with `cd demo && ns build ios --emulator --env.tabsstyleTest` or `ns build android --env.tabsstyleTest`. The UI exposes palette, selected-color override, label and rail controls, with a draft field in each native page. Only the acceptance command/report bridge inspects native widgets; the example configures `RouterTabs` through props and CSS.

Install the resulting app on a dedicated test device, then run from the repository root:

```sh
IOS_SIMULATOR=<uuid> EXPECTED_HOST=uikit node scripts/native/tabs-style/run.mjs
ANDROID_SERIAL=<serial> EXPECTED_HOST=bottom node scripts/native/tabs-style/run.mjs
```

`RECORD=1` records the same scenario. `OUT` selects the artifact directory (default `scripts/native/out/tabs-style-*`). The driver restarts the test app and **clears its data on Android**; use a dedicated simulator/emulator. It does not operate on a device without its explicit identifier.

The 18 commands check actual native background/title/icon colors, both histories, live Page identities and Vue mount counts. They exercise CSS palette changes, a prop overriding CSS through a palette change, removal returning to the current CSS, all four label modes, switching between bottom/rail, selection, and clearing colors back to native defaults. Material additionally retains menu titles, badges and accessibility descriptions when labels are hidden. The driver reads native ColorStateLists/UITabBarAppearance, not a JavaScript mock.

To exercise **actual absence of Material**, build a signed release of the same fixture without adding Material to `App_Resources/Android/app.gradle`. The default NativeScript runtime includes Material only in debug. Install that APK (uninstall the debug app first if its signature differs) and run:

```sh
ANDROID_SERIAL=<serial> ANDROID_ROOT=1 EXPECTED_HOST=core OUT=scripts/native/out/tabs-style-core node scripts/native/tabs-style/run.mjs
```

`ANDROID_ROOT=1` temporarily uses `adb root` on the dedicated rootable emulator, so the release app can keep `debuggable=false` while the driver reads its private report; the driver unroots it afterward.

`EXPECTED_HOST` prevents silently accepting the wrong backend. The fallback asserts native background/title colors and unchanged histories. Label modes and rail are intentionally ignored by Core; template icon tint and badges are not promised there.

The required native workflow runs UIKit on iOS 18.6, Material bottom/rail on Android API 34, and a release APK without Material. Local acceptance and documentation videos use iOS 26.0 / Android API 34. See `test/native-tabs.md` for the recorded implementation validation. These checks do not claim physical-device, VoiceOver/TalkBack speech or sidebar color customization coverage.
