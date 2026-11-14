# Optional Android drag/drop navigation

Copy [policy.ts](./policy.ts) and [android.ts](./android.ts) into an Android app.
The optional bridge uses Android API 24+ `startDragAndDrop` and `OnDragListener` on
loaded, dedicated views. It adds no router API, native-host requirement or package
dependency. It owns each view's drag listener; dispose registrations on unload and
create new ones if the view loads again. Dispose the policy when its receiving
registration, account or window goes away.

```ts
const policy = createDropPolicy({
  owner: () => inboxRegistration, // { router, scope, windowId, frame }
  authorize: (location) => accountCanRead(location),
})
const target = installAndroidDropTarget(inboxDropView, {
  accepts: policy.accepts,
  nextId: () => createActionId(),
  hover: (active) => showDropHighlight(active),
  async receive(id, items, origin) {
    showDropOutcome(await policy.drop(id, items), origin)
  },
  error: reportDropError,
})
const source = installAndroidDragSource(documentCard, {
  origin: () => ({ windowId: libraryWindow.id, frame: 'library' }),
  items: () => [
    JSON.stringify({
      version: 1,
      destination: { route: { name: 'document', params: { id: publicId } } },
    }),
  ],
  error: reportDropError,
})

// Receiving registration removed or account changed:
policy.dispose()
target.dispose()
source.dispose()
```

The source snapshots JSON at long press into a `ClipData` text item with MIME
`application/vnd.vue-router-ns.destination+json`. It creates a native Java string
array for the MIME constructor. Flags are zero: this recipe supports local drags
within one Activity. It retains the native local-state wrapper until drag end or
disposal and checks its originating app window. External apps, other Activities,
URI grants and global drags are not supported. Local-state identity and a custom
MIME are admission checks, not content authorization. The receiving view always
chooses its own router, account scope and Frame; payloads cannot redirect ownership.
See Android's [drag/drop framework](https://developer.android.com/develop/ui/views/touch-and-input/drag-drop/view)
and [DragEvent contract](https://developer.android.com/reference/android/view/DragEvent).

Start/hover inspect metadata only. Exactly one local item is required. Only
`ACTION_DROP` reads `ClipData`; URI and Intent items are refused without coercion or
I/O. Text is bounded before conversion and the shared policy independently enforces
8192 UTF-8 bytes, schema/version/expiry, route existence, app authorization and
normal router guards. Android local text is already transferred at this point;
wrapping it in the shared policy's Promise does **not** demonstrate an asynchronous
OS provider. Policy readiness and authorization can still be asynchronous.

A target returning true at drop means native transfer acceptance. It does not mean
navigation succeeded, and the source's drag-ended result must never commit a move.
This recipe is **copy/open only**. Hover changes a highlight without selecting tabs
or navigating. A guard can refuse navigation after transfer and after the target
tab has been revealed; both histories and source content remain intact. Repeated
callbacks within a gesture reuse its delivery id; a fresh intentional gesture gets
a new id. Disposing a source invalidates its local token and cancels its active
gesture. Disposing a target detaches callbacks and clears highlighting.

Always offer an ordinary native button and a page-owned keyboard command using the
same policy with source `internal` and a fresh action id. Use a descriptive button
label such as “Open document in Inbox”. Keep these commands available when dragging
is unavailable, including older Android versions where the API 24+ bridge should
not be installed. The [fixture](../../demo/src/testing/androiddrop-app.ts) uses
Control–O and has no required dragging step. Its [native acceptance](../../test/native-android-drop-stage3.md)
covers actual Android 14 emulator gestures, button activation, keyboard input and
TalkBack touch exploration plus double-tap activation. This is not physical-device,
cross-Activity, external-app or speech/audio acceptance.

For protected destinations, the [login recipe](./login.md) adds an optional typed
handoff, explicit sign-in resumption and cancellation on native Back. Native
transfer acceptance and authentication/navigation outcomes stay separate.
