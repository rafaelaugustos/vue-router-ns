# Scene entrypoints into navigation intents

Copy [ios.ts](./ios.ts) into an iOS application using NativeScript Core 9.1.4 and
scene lifecycle. This is application integration code, not a new package API.
The [native fixture](../../demo/src/testing/intententries-app.ts) demonstrates it
with actual quick actions, Spotlight and custom-scheme URLs.

Configure each participating router with `links: { system: false, ... }`, retaining
its scheme/host allowlists and URL mapping. Install this adapter **once for the
application**, before starting the native app, and supply an explicit registry
from native window id to a stable account-owned `{ router, scope, frame }` object.
The fixture deliberately selects only its primary window; a multi-window app must
register every intended receiver. It never chooses a global focused Frame.

```ts
import { installSceneIntentIngress } from './ios'

const stop = installSceneIntentIngress({
  owner: (windowId) => accountOwners.get(windowId),
  activity: publicSearch.url,
  nextId: () => createActionId(),
  async receive({ owner, request }) {
    if ('status' in request) {
      showIgnoredDestination(request.reason)
      return
    }
    // Revalidate current content/permission after readiness, before presenting login.
    const resolved = owner.router.resolveIntent(request)
    if (resolved.status === 'ignored') return
    if (isAuthorized(resolved.location)) {
      await owner.router.openIntent(request)
      return
    }
    const pending = owner.router.suspendIntent(request, {
      scope: () => currentAccountSession,
      authorize: isAuthorized,
    })
    if (pending.status === 'suspended') {
      // App-owned UI must mount owner.frame, then resume/cancel this handle.
      await presentLogin(owner, pending)
    }
  },
  error: reportIngressError,
})

// Remove ingress before disposing the account/window registry.
stop()
```

Only the destination is extracted from native data. The app supplies source,
delivery scope/id, receiving window, named frame and history policy. This recipe
uses `replace: true` so a successful explicit login resume replaces the login Page.
Change that policy deliberately for your app; it is never read from a native
payload. `resolveIntent` validates bounded input and gives a frozen copy. Normal
guards still authorize actual execution, including after asynchronous work.

Core 9.1.4 forwards cold scene connection URLs, quick actions and user activities
through the same three scene events as warm delivery. The adapter listens only
to those events. Also consuming `sceneWillConnect`, the process delegate forwarding
or automatic system links would duplicate the entrypoint. This recipe does not
support the legacy application-delegate lifecycle or older Core forwarding rules.

The queue holds at most 16 receipts, with a 15-second readiness deadline. Native
quick-action completion acknowledges enqueueing immediately, not authorization or
navigation success. Saturation reports `false` to quick-action completion; URL and
activity notifications have no completion and are dropped at that bound. Foreign
shortcut schemes are left alone. The app's error callback receives readiness and
handler failures. Missing/changed registrations, changed account scope, closed
owners or disposal discard outstanding handoffs. Already-running app handlers,
login UI and native resources still need application cleanup.

Use a fresh identity for each intentional native action. A stable shortcut/content
id is not a delivery id. Replaying the same captured intent is deduplicated by its
router; this recipe does not claim that separately delivered callbacks with newly
generated ids will be deduplicated. It avoids Core's known forwarding duplication
by selecting one ingress path. Persist neither native callbacks nor suspended
Promises; a cold process receives and validates a new native request.

Publish quick actions through `router.setShortcuts`. Their stable named payloads
continue to resolve after a path rename; removing the route yields `unmatched`.
The optional `createSystemSearch` adapter indexes only explicitly selected public
metadata and maps its content id to the current URL. Returning `null` refuses a
stale/unauthorized result. Do not index private route params, credentials or all
routes automatically. Search visibility and ranking belong to iOS.

The [acceptance report](../../test/native-scene-intents-stage5.md) distinguishes
real native events from app replay and internal/notification comparison controls.
This stage does not certify Android ingress, physical devices, OS duplicate-callback
identity, process-persistent login, full account cleanup or multi-window lifecycle.
