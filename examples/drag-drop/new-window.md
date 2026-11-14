# Drag to create an iPad window

This optional, same-process recipe lets iPadOS create a scene when a user drags a
public document card to a supported screen-edge target. The application validates
the arriving activity and opens the document in that new window's router. Copy
[new-window.ts](./new-window.ts) and the separately named
[new-window-source.ios.ts](./new-window-source.ios.ts). Keeping distinct basenames
prevents NativeScript's platform resolver from replacing the policy with the iOS
bridge. No package runtime, public export or native-host contract changes.

## Native gesture and activity

Declare scene support and your activity type in `NSUserActivityTypes`; the
[preparation script](../../scripts/native/window-create/prepare.py) demonstrates
both. Register an `NSUserActivity` on the drag item's `NSItemProvider` with `.All`
visibility. The drag must be allowed outside the source application so the system
can accept it. Apple's [multiple-window guide](https://developer.apple.com/documentation/uikit/supporting-multiple-windows-on-ipad)
and [Introducing Multiple Windows on iPad](https://developer.apple.com/videos/play/wwdc2019/212/)
describe this system-owned creation path. Placement and availability remain OS decisions.

The activity carries only `{ version: 1, windowDrag: UUID }`, with a public title.
Keep destinations, account identity, credentials, routers and native objects out of
its metadata. Visibility permits another recipient to read that title/token: it
must contain no sensitive information. The token only correlates a short-lived,
app-owned offer in the same process; neither the activity type nor the token alone
establishes permission. External transfer and process recovery are unsupported.

```ts
const grants = createWindowDropOffers({
  owner: () => currentSourceRegistration,
  session: () => currentSessionIdentity,
  authorize: (location) => currentAccountCanRead(location),
  nextId: () => NSUUID.UUID().UUIDString,
})
const drag = installWindowDragSource(card, () => {
  const offered = grants.offer({ route: { name: 'document', params: { id: 7 } } })
  if (offered.status !== 'offered') return
  const activity = NSUserActivity.alloc().initWithActivityType(activityType)
  activity.title = 'Document 7'
  activity.userInfo = Utils.dataSerialize(offered.data)
  activity.eligibleForHandoff = false
  activity.eligibleForSearch = false
  activity.eligibleForPublicIndexing = false
  return {
    activity,
    title: 'Document 7',
    cancel: offered.cancel,
    ended(operation) {
      if (operation !== UIDropOperation.Copy) offered.cancel()
    },
  }
})
```

Retain the registration for the loaded view's lifetime. UIKit delegates are weak;
the bridge retains session wrappers through end/disposal. Source teardown and
sign-out must dispose the grant registry and then the interaction. A stable session
object must rotate on account changes; missing identity refuses offers. Permission
callbacks are synchronous and fail closed on throws or accidental Promises.

A Copy end means system transfer, not navigation success. It can arrive **before**
scene connection, so do not revoke that offer at Copy end or create a window from
the end callback. Cancellation revokes immediately; unclaimed transfers expire.
The bridge offers one item, disallows moves, and never deletes the source document.

## Bind the actual new owner

Use the actual `WindowContentRequest.ios.connectionOptions.userActivities` in
`Application.setWindowContentResolver`. Require exactly one activity of the declared
type before passing its decoded metadata to `grants.take`. Do not interpret arbitrary
`request.data` as permission: Core's general activity decoding does not discriminate
your custom activity type. Preserve any existing root and handle the primary window
separately. The [complete fixture](../../demo/src/testing/windowcreate-app.ts) shows
the resolver, mounting, readiness, close handling and cleanup together.

For a claimed offer, create one app/router for `request.window`, register a stable
`DropOwner` with its actual window id and explicit Frame, and call
`claim.deliver(owner, () => registry.get(windowId))`. Attach close handling before
mounting: cancel the claim, unregister and unmount when that window closes. Repeated
delivery to the same registration shares the first Promise; another owner cannot
rebind it. A repeat activity cannot allocate another router. Unknown, stale or
unsupported activities receive public placeholder content and the new native window
is closed. A refused or failed navigation also closes its new window. The existing
source window is never used as a fallback.

The registry retains at most eight offers including claimed readiness waits, with
a deadline of at most 30 seconds covering drag, connection, readiness and admission.
It retains at most 128 recent action ids. It snapshots the validated destination,
source registration, router, window, Frame and session identity before returning
the offer; only a fresh action token enters the native activity. It checks them
again on connection and through receiving-router readiness and guards. Removed
routes, changed sessions, revoked permission, owner replacement and closed windows
cannot redirect an offer into another owner.

Delivery binds the exact new window/Frame and uses the existing `suspendIntent`
continuation, resumed immediately with live authorization checks. There is no Login
Page in this recipe. Normal guards and redirects still run; the final redirect
destination must also be authorized. History appends normally after the new window's
public root. Once a guard is running, invalidation prevents later admission but does not forcibly
interrupt the guard Promise. Cancellation cannot roll back an already committed
native presentation. Applications remain responsible for their data authorization and window lifecycle.

## Alternatives and acceptance

Provide an ordinary, descriptively labelled button and page-owned keyboard command.
They create a fresh offer with source `internal` and make an explicit public UIKit
scene activation request carrying the same activity. Only these non-drag commands
call the activation API. The fixture uses Control–O and public standard placement
(iPadOS 17+); placement is still a preference.

[Reproduction](../../scripts/native/window-create/README.md) and the
[stage 6 report](../../test/native-window-create-stage6.md) cover real screen-edge
gestures on an iPad iOS 18.6 simulator in Split View. They distinguish transfer,
scene connection, navigation result and actual native closure. The recording does
not establish physical iPad/VoiceOver, Stage Manager, external apps, cold process
launch or Android window creation. Earlier tab, sidebar, Android and login recipes
keep their separate acceptance scope.
