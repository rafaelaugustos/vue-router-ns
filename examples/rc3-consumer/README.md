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

For Android, install the built APK, then run:

```sh
ANDROID_SERIAL=emulator-5560 node scripts/native/rc3-consumer/android.mjs
```

The runner uses actual adb input and UIAutomator snapshots. `CONSUMER_REPORT` selects its output directory. The reversing iOS touch helper is XCTest-only and is never included in the app/package.

## Manual checks still required

[The acceptance report](../../test/native-rc3-consumer.md) distinguishes verified runs from remaining physical checks. Spoken VoiceOver traversal is pending at the maintainer's request; TalkBack on physical Android and final-consumer physical text/motion settings are not certified. Do not turn an automation pass into a screen-reader speech claim. Track completion in [#152](https://github.com/rafaelaugustos/vue-router-ns/issues/152).
