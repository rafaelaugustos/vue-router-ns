# Optional drag/drop navigation

This copyable application recipe uses UIKit `UIDragInteraction`, `NSItemProvider`
and `UIDropInteraction`, then the existing navigation-intent pipeline. It introduces
no router API, native-host contract or drag-library dependency. Stage 1 targets a
single iPad app window with retained tabs. The [window recipe](./windows.md) extends
the same receiver policy to two existing app windows in stage 2. The [new-window recipe](./new-window.md) adds actual iPad screen-edge creation in
stage 6. The [Android recipe](./android.md)
adds same-Activity local drag/drop and TalkBack/button/keyboard alternatives in stage 3.
The [sidebar recipe](./sidebar.md) binds separate Inbox/Archive rows to their own
retained stacks in a permanent iPad sidebar (stage 5).

Copy [policy.ts](./policy.ts) and [ios.ts](./ios.ts). Install native interactions on
loaded views, retain their registrations (UIKit's delegates are weak) and dispose
them when their owning views/registrations go away. Session maps retain native
bridge wrappers until session end (or registration disposal), so garbage collection
cannot replace a weak wrapper between delegate callbacks. Do not import `ios.ts` on
Android. The [fixture](../../demo/src/testing/dragdrop-app.ts) provides a complete
NativeScript-Vue example with an independent Library and Inbox stack.

```ts
const policy = createDropPolicy({
  owner: () => inboxRegistration,
  authorize: (location) => accountCanRead(location),
})

const target = installDropTarget(inboxDropView, {
  accepts: policy.accepts,
  nextId: () => createActionId(),
  hover: (active) => showDropHighlight(active),
  async receive(id, items, origin) {
    const outcome = await policy.drop(id, items)
    showDropOutcome(outcome, origin)
  },
  error: reportDropError,
})

const source = installDragSource(documentCard, {
  origin: () => ({ windowId: libraryWindow.id, frame: 'library' }),
  items: () => [
    {
      json: JSON.stringify({
        version: 1,
        destination: { route: { name: 'document', params: { id: publicId } } },
      }),
    },
  ],
})

// Dispose waiting work before removing native callbacks.
policy.dispose()
target.dispose()
source.dispose()
```

The stable target registration contains `{ router, scope, windowId, frame }`.
The receiving view chooses it explicitly; global Frame/focus is never consulted.
Rotate `scope` with the account/session and dispose its policy on sign-out or target
removal. Source identity is captured from the local drag session for diagnostics,
not used as proof of permission. A custom type identifier is not authentication.

Declare `org.nativescript.vue-router-ns.destination` as an exported UTI conforming
to `public.data`. The fixture's preparation script demonstrates this declaration.
The source registers an asynchronous data representation restricted to its own
process and restricts the drag to its own application. It transfers JSON, never
live Vue/native objects or credentials. Only selected public destination metadata
belongs in that representation. The source snapshots its JSON when the drag starts.

The receiver accepts exactly one item of that type. Multi-item and unsupported
drags are refused without loading data. The raw JSON is bounded to 8192 UTF-8 bytes
and accepts only `version`, `destination` and optional `expiresAt`; target, scope,
source and history authority cannot come from the payload. Canonical intent limits
apply again. Unknown versions, expired requests and removed routes return explicit
ignored outcomes. Application permission is checked after loading/readiness, then
normal router guards authorize navigation. Guards must recheck current account and
content permission through asynchronous application work. The [login recipe](./login.md) composes this policy with explicit suspension and
app-owned Login Pages. Stage 4 records the combined flow on Android; the iPad
recordings remain scoped to their original guard/provider scenarios.

Only one provider/readiness handoff may be pending per target, with a 10-second
deadline. Owner, frame, account and window are rechecked after waits. Disposal
unblocks the wait and cancels its provider progress. Late completion cannot start
navigation. An executing router guard is not forcibly cancelled by that deadline;
normal router/app lifecycle rules apply once execution has started. The native
completion moves work to the main queue before accessing UI or the router.

Hover only highlights the target: it does not load providers, select a tab or
navigate. Drop acceptance is distinct from data transfer and completed navigation.
`status: 'settled'` contains the ordinary intent result, which may include a guard
failure. Navigation into a target tab reveals it before guards run, so a refused
navigation may still reveal that tab without changing its history. No code deletes
or moves a source document. This recipe offers **copy/open only**; UIKit's copy
proposal and end operation must never be interpreted as a destructive move commit.

Use a fresh id per intentional native drop. Repeated callbacks for the same local
drop session reuse its id; the policy retains at most 128 scoped recent identities.
The router also deduplicates captured intents. Neither cache is durable or a promise
against arbitrary OS callbacks assigned new ids.

Expose an ordinary native button with a descriptive accessibility label and a
page-owned keyboard command calling the same policy with source `internal` and a
fresh action id. Users need not drag. The fixture tests the actual button and
Control–O command and inspects its accessibility-tree label; this is not physical
VoiceOver speech acceptance. Android uses its separate [optional bridge](./android.md)
with the same policy; its stage 3 acceptance includes real emulator drags and
TalkBack focus/activation, without claiming physical-device or speech acceptance.

See Apple's [data-delivery guide](https://developer.apple.com/documentation/uikit/data-delivery-with-drag-and-drop)
and [item-provider threading rules](https://developer.apple.com/documentation/foundation/nsitemprovider).
The [native report](../../test/native-drag-drop-stage1.md) distinguishes actual
simulator drags, provider transfer and app-level replay from unsupported hardware,
Stage Manager and external-app claims. The [stage 2 report](../../test/native-window-drop-stage2.md) separately covers actual cross-window drags.
