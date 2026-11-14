# Drop into a sidebar destination

A sidebar row chooses a receiving stack; it does not become a navigation stack.
Compose the existing [UIKit bridge](./ios.ts) and [drop policy](./policy.ts) with
`RouterDrawer` and retained `RouterTabs`. Give each destination its own stable
`DropOwner`, policy and native interaction. Inbox and Archive may accept the same
public document payload while opening it in different Frames.

The [complete iPad fixture](../../demo/src/testing/sidebardrop-app.ts) mounts a
permanent sidebar next to three retained stacks. Both rows remain visible when a
destination tab is selected. Its [native acceptance](../../test/native-sidebar-drop-stage5.md)
records actual drags from Library into each sidebar row.

```ts
import { createDropPolicy, type DropOwner } from './policy'
import { installDropTarget } from './ios'

// Create after the receiving window and retained Frames are ready.
// These are stable registration objects, not getters for the selected tab.
const inbox: DropOwner = {
  router,
  scope: accountScope,
  windowId: receivingWindow.id,
  frame: 'inbox',
}
const archive: DropOwner = { ...inbox, frame: 'archive' }

function bindRow(view, owner: DropOwner, highlight) {
  const policy = createDropPolicy({
    owner: () => owner,
    authorize: (location) => accountCanRead(location),
  })
  const native = installDropTarget(view, {
    accepts: policy.accepts,
    nextId: createActionId,
    hover: highlight,
    async receive(id, items, origin) {
      showDropOutcome(await policy.drop(id, items), origin)
    },
    error: reportDropError,
  })
  return {
    // Use an ordinary native button or a page-owned keyboard command.
    // makePublicDocumentItem uses the same bounded, versioned JSON payload.
    async openDocument() {
      const result = await policy.drop(
        createActionId(),
        [makePublicDocumentItem()],
        'internal',
      )
      showDropOutcome(result)
    },
    dispose() {
      policy.dispose()
      native.dispose()
    },
  }
}

const inboxRow = bindRow(inboxView, inbox, showInboxHighlight)
const archiveRow = bindRow(archiveView, archive, showArchiveHighlight)
// On row removal/sign-out/window teardown, dispose its binding.
// Rebinding a recycled row means disposing the old binding first.
```

Render the target views and ordinary “Open in Inbox” / “Open in Archive” buttons
in the drawer slot. Render `RouterView` instances named `source`, `inbox` and
`archive` inside retained tabs in the content slot. The source card belongs to the
Library Page. `RouterDrawer presentation="permanent"` keeps sidebar rows and source
content simultaneously reachable in this example.

Hover only changes the row's highlight. It never loads the item provider, changes
tab selection or pushes a route. A valid drop supplies the receiving registration's
window and Frame to the existing intent pipeline. The router reveals that tab
before running its normal guards. A refused guard can therefore reveal Inbox while
leaving all histories unchanged. A successful transfer still does not mean that
navigation succeeded or that any document was moved.

Never set `owner.frame` from the selected tab or from the payload. If a row is
reassigned while provider data is pending, the captured owner check rejects that
delivery; dispose and create a new binding for the new destination. Disposing
Inbox cancels its pending provider and removes its highlight/interaction without
disposing Archive's binding. Late data cannot fall back to the selected stack.
Account/content permission is checked after data arrives; route guards must also
check current permission throughout asynchronous application work.

Use fresh action ids across all rows, scoped to the account/window registration.
Replaying one delivery with the same scope/id through another row does not create
a second navigation. A deliberate new drop or button action gets a fresh id and
can open the same document in the other stack. Neither row performs destructive
moves or interprets UIKit's copy operation as proof of navigation success.

The fixture covers native hover/removal, cancellation, multi-item refusal, late
provider disposal, owner reassignment, permission revocation, guard refusal,
delivery replay and independent drafts. Its ordinary sidebar button and Control–O
command use the same policy. XCTest verifies button labels and keyboard delivery;
this is not physical VoiceOver acceptance. This stage establishes the permanent
sidebar on the iOS 18.6 iPad simulator. Overlay edge reveal, adaptive transitions,
physical iPad, Stage Manager and creating a window by dragging remain separate
acceptance work. The earlier [cross-window](./windows.md) and [Android](./android.md)
evidence keeps its original scope.
