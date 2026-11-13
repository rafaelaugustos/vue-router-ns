# Notification destinations — #182 stage 3

Validated on 2026-11-13 from PR199 merge `db1cbfa` plus this implementation.
[Source hashes](./evidence/notification-intents-stage3/sources.json) identify the
runtime, fixture, driver and recording. #182 remains open for additional native
transports and window policies.

`notificationIntent` normalizes a bounded, app-defined notification destination
into the existing versioned contract. Its external payload contains only version,
destination and optional expiry. Delivery identity, receiving window/stack and
navigation options come from a separately validated application context. The
combined envelope passes the same bounds again; an expired deadline is rejected
before resolution. The helper neither resolves nor navigates, consumes no delivery
ids and installs no SDK or native callbacks. The existing router execution and
login resumption engine is unchanged.

## Native evidence

Published Core 9.1.4, NativeScript-Vue 3.1.3 and iOS runtime 9.1.0 on a dedicated
iPad iOS 18.6 simulator, with Xcode 27.2 and no dependency patches. See the
[environment](./evidence/notification-intents-stage3/environment.json) and
[nine reports](./evidence/notification-intents-stage3/ios18.json).

- XCTest grants local notification permission and taps real system banners. The
  application receives actual `UNNotificationResponse` callbacks, extracts a
  bounded JSON field and hands the selected open action to its router on the UI
  thread. Native completion is independent of mounting/login waits.
- Warm delivery retains a destination for app-owned login. Signing in resumes
  once through the normal guard and explicitly replaces the login Page.
- Reprocessing the actual normalized response returns `repeat`. This control is
  an app-level replay; it does not claim the OS delivered a duplicate callback.
- Three further system notifications reject injected navigation policy, an
  expired deadline and an unknown destination without changing either stack.
- Internal actions, URL requests and existing shortcut payloads resolve to the
  same message and produce the normal duplicate-navigation result. These controls
  do not simulate native shortcuts or Spotlight.
- XCTest terminates the process before tapping the final notification. A new
  fixture launch receives its real response, opens login and resumes through its
  guard. Distinct per-launch markers and reset native callback counts accompany
  this test; no suspended request is restored from a previous process.
- Every report compares native/logical histories and checks the source's exact
  Page and unsent draft within that process. The driver additionally checks guard
  counts and unchanged histories after rejected/duplicate requests. Draft
  persistence across process death is not asserted.

[Actual native video](../docs/public/media/notification-intents.mp4) demonstrates
the notification taps, native login Pages and resumed destination. The 59.12-second
H.264 clip at 1032 × 1376 (1283 frames)
preserves every source frame and its relative presentation timestamp; see the
[video metadata](./evidence/notification-intents-stage3/video.json). Authentication
uses controlled fixture state without an external identity provider or credentials.
Reproduce with the [driver](../scripts/native/notifications/README.md). Full reports,
XCTest results and the source recording remain under ignored
`scripts/native/out/notification182-release/`.

## Validation

- **843 tests passed**, with 10 existing skips. Ten new tests cover detached frozen
  copies, external policy rejection, getters/non-JSON/pollution/size limits,
  combined envelope bounds, deadlines, consistent named/URL/shortcut resolution,
  account-scoped delivery, guard outcomes, owner disposal, cold readiness and
  login resumption.
- A negative control allowed authority fields in the external payload. The
  boundary regression failed; restoring validation made it pass without changing
  assertions. Native policy-injection rejection also passed.
- Runtime and native fixture typechecks/builds and formatting passed. The packed
  package installed and cleanly reinstalled in fresh no-bundler, webpack and Vite
  consumers on Node 22.23.3/npm 10.9.9, including the existing documented npm 10
  lockfile setup for Vite. The packed source hash matches the validated source.
- Four-locale docs parity/build passed. Browser checks covered the new anchor,
  language links, narrow layout, search, actual video playback and reduced motion;
  the existing site suite also passed.

## Boundaries

The application must bind a notification to its intended recipient, decide which
open actions navigate and supply an identity for one user action. A provider's
message id can span several intentional taps; a new id per callback defeats
deduplication. This fixture uses one scheduled notification per case and a fixed
test account; it does not establish production recipient verification. Request
validation never grants authorization. Normal guards and resume permission checks
still apply.

The app owns its notification delegate and retains it strongly because the native
notification center does not. This fixture neither replaces runtime navigation
methods nor fabricates native callback objects. Local notification success does
not establish APNs/Firebase/remote push, Android notifications, physical devices,
background navigation or a release-wide acceptance matrix. Existing shortcuts,
Spotlight and links keep their compatibility APIs. Persistence and automatic
window selection remain outside this stage. No merge or release is performed.
