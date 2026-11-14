# Android entrypoints into navigation intents

Copy [android.ts](./android.ts) into an app using NativeScript Core 9.1.4. Install
it once before `app.start()`. This app-owned adapter handles ACTION_VIEW URLs,
router shortcut URLs and the app's explicit notification-open action. It adds no
package API. Keep URL allowlists/mapping, but disable automatic link navigation
with `links: { system: false }` on participating routers.

```ts
import { installAndroidIntentIngress } from './android'

const stop = installAndroidIntentIngress({
  owner: (windowId) => accountOwners.get(windowId),
  notification: { action: 'com.example.OPEN_NOTIFICATION', extra: 'navigation' },
  nextId: () => createActionId(),
  receive: handleEntryIntent,
  error: reportIngressError,
})
```

The stable account-owned registration contains `{ router, scope, frame }`. Resolve
it from the receiving native window id; never use a globally focused Frame. The
[fixture](../../demo/src/testing/androidintents-app.ts) explicitly chooses only
its primary window. Each router's account registry must be ready before ingress;
missing registrations are ignored, not queued for an arbitrary future account.

In `handleEntryIntent`, handle ignored outcomes, revalidate with `resolveIntent`,
then call `openIntent` or `suspendIntent` with current authorization. Mount the
selected Frame before presenting app-owned login; resume or cancel its handle
explicitly. The adapter supplies `replace: true` so successful login resumption
replaces login. Change history policy deliberately. Authorization still belongs
to normal guards and the app's current session, never a native source label.

Create an immutable `PendingIntent.getActivity` pointing directly to the app's
Activity, using the configured action and a JSON string extra with only
`{ version: 1, destination, expiresAt? }`. Use a distinct request code or data URI
for distinct pending notifications so Android cannot accidentally substitute
their payloads. Request notification permission on Android 13+. See Android's
[notification navigation](https://developer.android.com/develop/ui/views/notifications/navigation)
and [permission documentation](https://developer.android.com/develop/ui/compose/notifications/notification-permission).
An explicit action is a dispatch convention, not proof of a trusted caller.

The fixture uses `singleTask` for one Activity, with `SINGLE_TOP | CLEAR_TOP` on its
notification intents. Those are fixture policies, not a requirement for every app.
Apps with multiple Activities/tasks must choose their own manifest, PendingIntent,
Back behavior and receiver registry. Posting or receiving a background notification
does not navigate; only the selected user-open action enters this adapter.

Core 9.1.4 emits a synthetic `activityNewIntent` during `onCreate`. The adapter
suppresses it, carries the receiving window id into the immediately following
`Application.launchEvent` for that same native Intent, then consumes cold delivery.
The legacy launch event includes saved-instance state but omits the window. This
temporary native reference expires at the next microtask, before readiness waits.
Warm actions use `activityNewIntent`. Saved-state
recreation and `FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY` do not replay an old launch
request. Do not add another native bridge or leave legacy system links enabled.
This recipe targets Core's documented events and inspected 9.1.4 ordering; it does
not support an independently embedded Activity lifecycle.
The cold path requires the standard NativeScript-Vue launch bridge. A custom
window content resolver can bypass that event; such a host needs its own ingress
integration rather than assuming this adapter covers new secondary Activities.

At most 16 handoffs wait for router readiness, each for 15 seconds. The adapter
extracts and validates canonical data immediately; it does not retain the native
Intent/Activity. Notification JSON is capped at 8192 characters before parsing,
then the contract's byte/shape limits apply. Invalid JSON, unknown versions,
expiry and removed destinations return explicit ignored outcomes. External
payloads cannot choose scope, target or navigation options.

Disposal, changed registration/account and closed owners invalidate waiting work.
The app owns cleanup of already-running handlers and login UI. Generate an id per
intentional tap, not per content item; replaying the same captured request returns
`repeat`, while a new tap can reach ordinary duplicate navigation. This does not
deduplicate arbitrary OS callbacks given new ids. No suspended Promise, credentials
or request survives process death; a new native action is validated from scratch.

See the [native report](../../test/native-android-intents-stage6.md) for actual
launcher/drawer taps, cold processes, URL delivery and retained Page/draft checks.
