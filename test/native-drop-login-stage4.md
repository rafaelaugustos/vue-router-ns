# Protected drop and login continuation — #181 stage 4

The optional [login recipe](../examples/drag-drop/login.md) composes native drag/drop
with the existing explicit intent suspension/resumption API. The shared policy gains
a typed application handoff after validation; omitting it keeps direct `openIntent`
behavior. Receiving router identity is now captured and rechecked across asynchronous
provider/readiness work alongside scope, window and Frame. No package runtime,
exports or NativeHost contracts change.

## Native acceptance

One dedicated Android 14/API 34 Pixel 7 ARM64 emulator runs retained Library and
Inbox tabs. The source starts actual native drags. The receiving tab pushes a real
Login Page, and successful resumption replaces Login with the original document.
The existing native inspector only reads node bounds; OS input drives every action.
Authentication is controlled fixture state, without credentials or an external SDK.

| Input                                   | Verified result                                                                           |
| --------------------------------------- | ----------------------------------------------------------------------------------------- |
| Protected drop                          | Transfer accepted; Login appears in the explicit receiving tab before any protected Page. |
| Early completion                        | Unauthorized; the continuation stays pending.                                             |
| Repeated delivery                       | No new Login Page or provider load.                                                       |
| Sign-in and repeated completion         | One authorized Promise, one document presentation; Login replaced.                        |
| Cancel button and native Back           | Pending continuation cancelled; a late callback cannot reopen the document.               |
| Account change, removed route, expiry   | Explicit ignored outcome and unchanged target Page.                                       |
| Refusing guard                          | Transfer remains accepted; ordinary navigation failure preserves Login.                   |
| Permission revoked during waiting guard | Real revoke button releases the guard; admission cancels before a private Page appears.   |
| Target disposal                         | Native target/policy/login registrations disposed; a late completion stays cancelled.     |
| Newer request                           | Original delivery superseded, existing Login Page reused, only newer document opens.      |
| Already authenticated drop              | Destination opens through guards without replacing the Inbox root.                        |
| Button and Control–O                    | Same admission/login path with internal source and fresh identity.                        |

Every report checks the source's exact Page, the receiving stack's exact root,
independent drafts and agreement between native/logical histories. Eleven native
drags force 22 GC cycles between callbacks. The source is never moved or deleted.
The reproduction driver also fails if the screen recording ends before final
cleanup. See [reproduction](../scripts/native/drop-login/README.md).

## Evidence and validation

All [45 native reports](./evidence/drop-login-stage4/android34.json) passed in one process.
[Environment](./evidence/drop-login-stage4/environment.json) and
[source hashes](./evidence/drop-login-stage4/sources.json) identify the run. The [actual
application video](../docs/public/media/drop-login.mp4) includes native drag gestures,
Login controls, system Back, the waiting guard and the unchanged drafts. All source
frames/timestamps are retained at original speed: 52.79 seconds,
2105 frames, lossless H.264 remux. See [video metadata](./evidence/drop-login-stage4/video.json).

The unchanged Android stage 3 acceptance also passed all [29 regression reports](./evidence/drop-login-stage4/stage3-regression.json), including its
native drag/drop, button/keyboard and TalkBack focus/double-tap checks, with the new
shared policy. That regression validates the default direct handoff; it does not
claim screen-reader acceptance of the new Login Page.

**946 tests passed**, with 10 existing skips. Nineteen new integration tests exercise the shared drop policy and real router
resumer together: reserved identity, early/repeated callbacks, native-history
replacement, cancellation, owner/account changes, supersession, removed/expired
requests, asynchronous guard invalidation, presentation failure and router replacement
during provider loading. Existing default drop tests remain unchanged. A negative
control removing the router-identity check failed the provider ownership regression;
restoring it passed without weakening the assertion. Package and Android builds,
root types and all four drag/drop fixture typechecks pass.

Formatting, locale parity and the documentation build pass. Browser checks verify
all four localized guides, Login anchors/search, the published video, responsive
layouts from 320–1440px, reduced motion and navigation without JavaScript.

## Boundaries

Native transfer, completed handoff, pending authentication and completed navigation
are separate outcomes. The app owns the Login Page, cancellation on dismissal,
account/session rotation and protected-history cleanup on sign-out. A session object
must stay stable through the intended sign-in. The helper preserves the original
delivery scope/id and binds continuation admission to the receiving owner.

The native evidence covers one Android emulator Activity, controlled authentication
and same-Activity text ClipData. It does not establish an external provider, process
recovery, combined iPad/cross-window login drops, physical-device or Login-screen
TalkBack/VoiceOver acceptance. Earlier iPad asynchronous-provider and cross-window
recordings remain separately scoped. #181 stays open for broader hardware, Stage
Manager, sidebar and window-creation-by-drag work.
