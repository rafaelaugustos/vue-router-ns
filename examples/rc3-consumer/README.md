# Published rc.3 consumer

A standalone NativeScript-Vue app that installs **vue-router-ns 0.1.0-rc.3 from npm**. The webpack config has no local router alias; the lockfile contains the registry tarball and its integrity. This is a pinned acceptance project, not a template that automatically upgrades to the latest release.

```sh
cd examples/rc3-consumer
npm ci
npm run verify:package
npm run resources
npm run typecheck
ns run ios                 # or ns run android
```

For a physical iPhone, use your own development team (`ns build ios --for-device --team-id TEAM`). Signing identities and generated App_Resources/platforms are not committed. The separate app ID is `org.nativescript.routerrc3validation`.

The app adapts the documented Pocket notes example: filter notes, push detail, edit in a native modal, refuse a dirty leave, save a typed result, or discard. Scroll containers and `iosAccessibilityAdjustsFontSize` keep the example usable with Dynamic Type. The search Return key and modal **Hide keyboard** action expose controls that a large keyboard/font combination could otherwise cover. These are application responsibilities, not a new router accessibility API.

`src/environment.ts` writes a one-shot, read-only `Documents/consumer-environment.json` with the package version, OS and actual UIKit content-size/Reduce Motion preferences. It changes no setting and performs no permanent polling.

## Automated acceptance

From the repository root, generate the iOS runner with the Ruby `xcodeproj` gem:

```sh
ruby scripts/native/rc3-consumer/project.rb /tmp/consumer-checks
xcodebuild test -project /tmp/consumer-checks/ConsumerChecks.xcodeproj \
  -scheme ConsumerChecks -destination 'platform=iOS Simulator,id=SIMULATOR' \
  -only-testing:ConsumerChecks/ConsumerUITests/testFirstAppFlow
```

Install the built app first. Set `DEVELOPMENT_TEAM` when generating a runner for hardware; Xcode still needs a valid local account/profile. No team ID is hard-coded.

`testFirstAppFlow` asserts keyboard input, dirty guard refusal, saved/discarded modal results, query retention and real reversed/committed Back. `testSystemPreferences` validates the same application flow using the native back button; run it with the desired OS settings and retain `consumer-environment.json`. It does not itself change or assert an OS preference. Restore any settings you change.

For physical iPhone acceptance, install the signed app and build the signed runner first:

```sh
DEVELOPMENT_TEAM=TEAM ruby scripts/native/rc3-consumer/project.rb /tmp/consumer-checks
xcodebuild build-for-testing -project /tmp/consumer-checks/ConsumerChecks.xcodeproj \
  -scheme ConsumerChecks -destination 'platform=iOS,id=DEVICE' \
  -derivedDataPath /tmp/consumer-derived
python3 scripts/native/rc3-consumer/physical.py --device DEVICE \
  --project /tmp/consumer-checks/ConsumerChecks.xcodeproj \
  --derived-data /tmp/consumer-derived --out /tmp/consumer-physical
```

Keep the device connected and unlocked. Use a new output directory for each run. This runner snapshots the current text size, larger accessibility sizes and Reduce Motion; runs the baseline; enables accessibility XXXL and Reduce Motion; runs the preferences case; and checks what UIKit actually reported inside the app. It restores and verifies the original settings in `finally`, including after test failures or handled interruption. Force-killing the process or disconnecting the phone can prevent restoration; the original values remain in `before-appearance.json` for recovery.

Each case must report exactly one passed native test. Raw XCTest bundles and device metadata stay in the output directory; `physical-summary.json` omits device names and identifiers and records test counts, actual app preferences and restoration. Review it before committing evidence. Optional `--record` attempts `devicectl` screen recording; unsupported devices produce a warning and capture log, not a video. A separate real recording is still required for a PR.

For Android, install the built APK, then run:

```sh
ANDROID_SERIAL=emulator-5560 node scripts/native/rc3-consumer/android.mjs
```

The runner uses actual adb input and UIAutomator snapshots. `CONSUMER_REPORT` selects its output directory. The reversing iOS touch helper is XCTest-only and is never included in the app/package.

## Speech service checks

For Xcode 27 and iOS 27 or later, opt into the VoiceOver runner when generating the project. Older SDK builds exclude that file by default:

```sh
VOICEOVER_TESTS=1 DEVELOPMENT_TEAM=TEAM ruby scripts/native/rc3-consumer/project.rb /tmp/consumer-voiceover
xcodebuild test -project /tmp/consumer-voiceover/ConsumerChecks.xcodeproj \
  -scheme ConsumerChecks -destination 'platform=iOS,id=DEVICE' \
  -only-testing:ConsumerChecks/VoiceOverTests/testSpokenNavigation \
  -resultBundlePath /tmp/consumer-voiceover.xcresult
xcrun xcresulttool export attachments --path /tmp/consumer-voiceover.xcresult \
  --output-path /tmp/consumer-voiceover-attachments
```

The JSON attachment contains actual VoiceOver service utterances. The runner restores the original enabled state even after an assertion failure. Keep the phone connected and unlocked.

For the Android speech check, use an isolated emulator with TalkBack and a working TTS voice installed. In TalkBack settings → Advanced settings → Developer settings, record the current log level, enable **VERBOSE** and accept its confirmation. Enable TalkBack. This is a local test setting: restore its original level afterward. Display speech output is optional. [Android's testing guide](https://developer.android.com/guide/topics/ui/accessibility/testing) describes TalkBack testing; the test helper uses [the flag that keeps accessibility services running](https://developer.android.com/reference/android/app/UiAutomation#FLAG_DONT_SUPPRESS_ACCESSIBILITY_SERVICES).

Build the shell-only tree/action helper using your installed Android SDK (example versions below), then run the test:

```sh
mkdir -p /tmp/consumer-tree-classes
javac -source 8 -target 8 -cp "$ANDROID_HOME/platforms/android-36/android.jar" \
  -d /tmp/consumer-tree-classes scripts/native/rc3-consumer/ConsumerTree.java
"$ANDROID_HOME/build-tools/36.0.0/d8" --lib "$ANDROID_HOME/platforms/android-36/android.jar" \
  --output /tmp/consumer-tree.jar /tmp/consumer-tree-classes/ConsumerTree.class
adb -s emulator-5560 push /tmp/consumer-tree.jar /data/local/tmp/consumer-tree.jar
ANDROID_SERIAL=emulator-5560 python3 scripts/native/rc3-consumer/talkback.py
```

Commands run from the repository root. The helper is never packaged in the app. It activates existing native controls and reads the current consumer window without suppressing TalkBack. The Python runner stores speech fragments, completion callbacks and focus checks under `CONSUMER_REPORT` (default `/tmp/router-consumer-talkback`). It restores service settings to their state at runner entry; restore any manual setup settings afterward. Use a fresh report directory for each attempt and retain `result.json` only from a fully passing run.

[The acceptance report](../../test/native-rc3-consumer.md) separates physical VoiceOver evidence, emulator TalkBack evidence and the limits of both. Neither labels nor an enabled screen-reader setting alone establish spoken acceptance. Follow-up release decisions remain with the maintainer.
