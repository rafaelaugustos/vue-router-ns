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

## Manual checks still required

[The acceptance report](../../test/native-rc3-consumer.md) distinguishes verified runs from remaining physical checks. Spoken VoiceOver traversal is pending at the maintainer's request; TalkBack on physical Android remains pending. The final consumer now has physical iPhone baseline and maximum text/Reduce Motion passes, with original settings restored. Do not turn an automation pass into a screen-reader speech claim. Track completion in [#152](https://github.com/rafaelaugustos/vue-router-ns/issues/152).
