# Notification destinations — #182 stage 3

This opt-in iOS fixture installs its own `UNUserNotificationCenterDelegate`, asks
for local notification permission, schedules real notifications and receives real
user responses. XCTest taps system banners with the app backgrounded, then repeats
with the process terminated. The package installs no delegate or provider SDK.

```sh
npm run build
npx tsc --noEmit -p scripts/native/notifications/tsconfig.json
python3 scripts/native/entrypoints/prepare.py
ns build ios --path demo --for-device false --env.notificationsTest --no-hmr
IOS_SIMULATOR=<dedicated-iPad-UUID> RECORD_VIDEO=1 \
  OUT=scripts/native/out/notifications node scripts/native/notifications/ios.mjs
```

Use Node 20.19.4 for the NativeScript CLI, Xcode and Ruby's `xcodeproj` gem. Select
a dedicated simulator: the driver reinstalls only this demo there. It bounds
XCTest to 300 seconds and retains environment, reports, result bundle and video.
Use a fresh output directory for each run. The driver does not reset or shut down
other simulators. The fixture retains its delegate explicitly because Apple's
notification center holds it weakly.

Nine reports check warm response, login/resume, reprocessing that response,
invalid policy injection, expiry, unknown destination, consistent internal/URL/
shortcut-payload resolution, cold response and cold login/resume. The driver
asserts distinct per-launch markers after XCTest terminates the app, plus real
native callback counts.
It compares native/logical histories, verifies unchanged stacks after rejected or
duplicate requests and checks the exact source Page and its draft within each
process. Draft persistence across process death is not asserted.

The fixture extracts a bounded app-selected JSON string from `userInfo`, processes
only the default open action, and completes the native callback before waiting
for login or mounting. Its fixed account scope and request/action pair describe
one scheduled notification per case; a production adapter must bind the intended
recipient and distinguish intentional repeat taps according to its provider.
Authentication is controlled fixture state, without an identity provider.

The `compare` control submits real route/URL/shortcut payloads through the router;
it does not trigger native quick actions or Spotlight. Local notification delivery
does not prove APNs, Firebase, remote push, Android notification or physical-device
acceptance. No notification SDK, credentials, background navigation or persistent
resumption is introduced. See the [acceptance report](../../../test/native-notification-intents-stage3.md).
