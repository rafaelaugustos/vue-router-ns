# Native iPad drag/drop — #181 stage 1

Validated from PR203 merge `b6478da` plus this implementation. The
[source hashes](./evidence/drag-drop-stage1/sources.json) identify the optional
bridge, policy, fixture, driver and published recording. The package runtime,
public API and native-host contract are unchanged.

The [copyable app recipe](../examples/drag-drop/README.md) connects UIKit drag/drop
to the existing intent pipeline. The receiving view owns an explicit router,
window, account scope and named target Frame. Data contains only a versioned public
destination; it cannot choose that authority or request a destructive move.

## Native evidence

Dedicated iPad Pro 13-inch M4 simulator, iOS 18.6, Core 9.1.4,
NativeScript-Vue 3.1.3 and iOS runtime 9.1.0, without dependency patches. See the
[environment](./evidence/drag-drop-stage1/environment.json),
[24 native reports](./evidence/drag-drop-stage1/ios18.json) and
[reproduction instructions](../scripts/native/drag-drop/README.md).

XCTest performs nine actual long-press-and-drag gestures. UIKit owns the preview,
drag and drop delegates and asynchronous item-provider delivery. No fixture
command invokes a native delegate to pretend that a drag happened.

- A typed document travels from Library to the Inbox drop target. Hover highlights
  the target without selecting a tab, loading data or navigating. The real drop
  loads the representation and opens `/documents/7` through the ordinary guard.
- Reports retain the actual local source window/Frame and explicit destination
  window/Frame: the same window, `source` to `target`. Native and logical histories
  agree. The exact Library Page and Inbox root Page retain independent drafts.
- An app replay control resubmits the captured canonical request and gets `repeat`.
  Another actual drag gets a new delivery id and the normal duplicated-navigation
  failure, without pushing another Page.
- Releasing in the cancel area and offering two native items from one card load no
  data and leave both histories unchanged. This is not multi-touch item addition.
- Malformed JSON, an expired request and a removed route load data but return
  explicit rejected outcomes. They do not change either history.
- A deliberately slow provider is accepted, then its policy and native drop
  interaction are disposed while waiting. Late data does not navigate.
- A normal guard refuses a valid transferred destination. Accepted transfer and
  successful navigation remain distinct; the target tab may be revealed, but
  neither history changes. No operation moves or deletes source content.
- An actual native button with a descriptive accessibility label and a real
  Control–O key command reach the same destination through source `internal`.
  Cleanup removes both native interactions and disposes the policy.

The [actual native recording](../docs/public/media/drag-drop-tabs.mp4) shows these
cases. Its [video metadata](./evidence/drag-drop-stage1/video.json) records source
and export frame counts, relative timestamps and hashes. The 115.07-second export scales the
original recording without cuts or speed changes. Native logs, XCTest results and
the original recording remain in ignored `scripts/native/out/dragdrop181-gc/`.

## Bridge lifetime regression

An intermediate run exposed a weak JavaScript wrapper being lost between native
session callbacks: the cancellation's begin callback could not recover its origin,
so the fixture compared against the previous drag. The actual histories remained
intact, and the run correctly failed. The bridge now retains session wrappers in
maps until native session end or registration disposal. The final run forces 18
JavaScript collections between delegate callbacks across nine actual drags; all
24 reports pass, including source/target identity and cancellation. Native maps
also release their entries at session end/disposal.

## Validation and limits

- **909 tests pass**, with 10 existing skips. Twenty new policy cases cover hover,
  typed delivery, duplicate identities versus new actions, unsupported/multiple
  items, malformed/versioned/expired/oversized UTF-8 data, injected authority,
  removed routes, permission denial, account/owner/frame changes, closed windows,
  disposal, provider errors, pending-work limits, timeout, readiness and guards.
- Runtime and fixture typechecks, package and iOS builds, driver syntax and
  formatting pass. This stage changes no packaged runtime; packed-consumer checks
  from earlier stages are not rerun or claimed here.
- Four-locale tabs guides link the recipe, native evidence and actual recording.
  Documentation parity/build and browser checks cover the anchor, language links,
  narrow layout, search, playback and reduced motion.

This stage deliberately proves **one simulator window with two retained tabs**.
It does not prove cross-window transfer, sidebar targets, Stage Manager,
new-window creation, external-app transfer, physical iPad behavior or VoiceOver
speech. The button is inspected through the native accessibility tree and actually
tapped; a screen reader session remains later acceptance. Android's native drag
framework is documented separately; the shared policy is a basis for a command
fallback, without Android gesture or native fallback acceptance here.

Account permission/races and window closure are unit evidence. The native fixture
uses one authorized account and a refusing guard; it does not claim a login UI or
authentication-provider integration. Applications must recheck current permission
through asynchronous guards, and can compose the existing explicit login-resume
contract. Disposal cancels provider/readiness waits, not an executing router guard
or already committed navigation. One pending handoff, a 10-second waiting deadline
and 128 recent scoped identities bound application work; identities are not durable.

#181 remains open for its remaining platform, accessibility and cross-window work.
