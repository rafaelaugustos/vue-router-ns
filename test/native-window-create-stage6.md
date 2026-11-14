# Drag-to-create-window acceptance — #181 stage 6

An optional UIKit source attaches a public activity to a drag item. iPadOS creates
an actual new scene from a screen-edge gesture, and the application validates the
activity before opening its destination in that scene's router. The bounded local
offer registry uses the existing intent continuation for current authorization
through readiness, guards and redirects. No router runtime, package export,
native-host contract or mandatory dependency changes. See the
[recipe](../examples/drag-drop/new-window.md) and
[complete fixture](../demo/src/testing/windowcreate-app.ts).

## Native acceptance

The actual app runs on an iOS 18.6 iPad Pro 13-inch M4 simulator in Split View.
XCTest performs nine real long-press-and-drag gestures. Eight reach the system's
screen-edge target; one cancels inside the source. The drag delegate contains no
scene activation call. Each accepted system transfer connects a distinct native
scene. Successful delivery must show two non-overlapping visible windows.

| Input                                                          | Verified result                                                                                     |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Drag Document 7 to the screen edge                             | OS-created scene opens the destination in its own explicit window/Frame; source remains on Library. |
| Replay consumed activity metadata                              | Repeated-delivery result; no extra router, scene or navigation.                                     |
| Cancel inside the source                                       | No scene connection, navigation or pending grant.                                                   |
| Refusing destination guard                                     | Transfer succeeds; only the new public root exists, then its native window closes.                  |
| Rotate session identity during drag                            | Connection refuses the stale account scope and closes the new window.                               |
| Revoke permission during drag                                  | Unauthorized activity cannot expose a document; new window closes.                                  |
| Remove the route during drag                                   | Unmatched destination is refused; new window closes.                                                |
| Expire the offer during drag                                   | Expired activity is refused; new window closes.                                                     |
| Close new window while its initial guard blocks readiness      | Actual native closure cancels the pending delivery.                                                 |
| Revoke permission through a real button during a waiting guard | Current admission fails; no document Page, and new window closes.                                   |
| Ordinary button and Control–O                                  | Two explicit public activation requests use fresh internal offers and the same receiving policy.    |

All 25 ordered reports pass in one process. The final counts are nine drags,
eighteen forced JS collections, eight Copy ends, one cancelled end, ten scene
connections, six allocated destination routers and ten closed new windows. Only
the original native window remains after cleanup, with zero pending grants.
Every live-owner report compares native and logical histories. The fixture checks
the exact source Page/draft after each outcome and the exact public root/draft of
mounted receivers. Both routers may name their Frame `main`; each intent binds the
new window id explicitly. The source router never receives document navigation.

## Evidence and checks

[Native reports](./evidence/window-create-stage6/ios18.json),
[environment](./evidence/window-create-stage6/environment.json) and
[source hashes](./evidence/window-create-stage6/sources.json) identify the run.
The [actual application video](../docs/public/media/window-create.mp4) records the
entire 119.19-second sequence (4,054 frames) at original speed, including launch, native drag previews,
system-created windows, rejection cleanup and the non-drag alternatives.
[Video metadata](./evidence/window-create-stage6/video.json) records duration,
frame count, dimensions, hashes and timestamp preservation for the lossless H.264
remux. See [reproduction](../scripts/native/window-create/README.md).

**987 tests pass**, with ten existing skips. The 35 new policy cases cover one-time
claim/delivery, frozen source and target ownership, destination mutation, malformed
metadata, unknown/repeated tokens, capacity/expiry, readiness cancellation, account
and permission changes, ordinary guard refusal and redirected-destination
permission. A negative control removing the receiving-Frame check fails its race
test; restoring the check passes. Throwing and accidentally asynchronous permission
callbacks fail closed. Package/iOS builds and root/focused-fixture typechecks pass.

Formatting, four-locale parity and documentation build pass. Browser checks verify
the new anchor, search, actual video playback, localized captions and reduced-motion
behavior. The existing documentation experience check covers responsive layouts
and server-rendered navigation without JavaScript.

## Boundaries

Only versioned correlation metadata and a public title cross the activity provider.
The registry keeps the destination and source/session authority in process, allows
at most eight outstanding offers, expires within 30 seconds and remembers at most
128 recent identities. The actual new-scene callback verifies activity type and
claims the offer once. Neither a custom type nor an unguessable token substitutes
for current permission. Copy completion can precede connection: it acknowledges
transfer, not completed navigation or a destructive move.

Cancellation/expiry invalidates future admission and releases registry state; it
does not forcibly interrupt an already running guard or reverse a committed native
transition. The application owns lifecycle cleanup. Unknown and rejected activities
receive public placeholder content and their new windows close. Session/permission
changes are controlled fixture events, with no external authentication service or
Login UI. The separate login recipe retains its own acceptance scope.

This establishes same-process screen-edge creation in the recorded simulator's
Split View configuration. OS placement remains a preference. Native button labels
and actual keyboard delivery are checked; physical VoiceOver speech/focus,
physical iPad, Stage Manager, external recipients, cold process launch and Android
window creation are not established. #181 remains open for hardware acceptance.
