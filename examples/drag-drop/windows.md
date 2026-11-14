# Drop into an existing app window

Each receiving window owns its own router, native drop view and
[drop policy](./policy.ts). Copy the [UIKit bridge](./ios.ts); attach the receiver
to that window's view and bind it to a stable registration containing its router,
account/session scope, native window id and Frame name. Two windows may use the
same Frame name. The receiving registration selects the router; focus, the source
window and a global current Frame do not select it.

The [complete fixture](../../demo/src/testing/windowdrop-app.ts) creates one
NativeScript-Vue app/router per native window through the standard window content
resolver. It reuses the existing policy and bridge without changing the package
runtime. The source and receiver remain in the same process/application, as
required by the bridge's item-provider visibility and drag restriction.

```ts
const owner = {
  router: inboxRouter,
  scope: accountSessionKey,
  windowId: inboxWindow.id,
  frame: 'main',
}
registry.set(inboxWindow.id, owner)
const policy = createDropPolicy({
  owner: () => (registry.get(inboxWindow.id) === owner ? owner : undefined),
  authorize: (location) => currentAccountCanRead(location),
})
const target = installDropTarget(inboxDropView, {
  accepts: policy.accepts,
  nextId: () => createActionId(),
  hover: showDropHighlight,
  async receive(id, items, origin) {
    showResult(await policy.drop(id, items), origin)
  },
  error: reportError,
})

inboxWindow.on('close', () => {
  registry.delete(inboxWindow.id)
  policy.dispose()
  target.dispose()
  inboxApp.unmount()
})
```

Register the owner before installing the target. On sign-out, replacement or view
removal, revoke the registration and dispose waiting work too. A changed account,
removed document or closed receiver must never fall back to whichever window is
still focused. Keep application authorization in normal guards as well as the
post-provider check. This example does not add an authentication UI.

The source's local drag-session identity is diagnostic context, not authorization.
Only versioned JSON destination metadata crosses the provider; target window,
account, Frame and history authority remain in the receiver. One policy belongs
to one registration. This gives each receiving window independent pending/recent
limits and permits an explicit button to use the same policy with source
`internal`. The ordinary intent result still distinguishes transfer from successful
navigation, including guard refusal. Copy/open never deletes the source document.

## Preparing visible windows

Dragging targets an **existing** window. The fixture's separate “create” button
uses [requestAdjacentWindow](./windows.ios.ts), an optional iPadOS 17+ helper with
public UIKit activation and standard placement, and passes the actual source scene.
Placement is a preference controlled by the OS. The native test asserts two
non-overlapping visible scene windows before dragging; merely constructing two
routers would not establish this behavior.

The creation request carries only an app-generated correlation token. The app keeps
one bounded pending request, accepts its matching content-resolution callback once,
and rejects late/unexpected windows with public placeholder content before closing
them. Do not retain a navigation Promise or credentials in the native request.
Applications may already have suitable windows open and need no creation helper.

See Apple's [placement contract](https://developer.apple.com/documentation/uikit/uiwindowscene/activationrequestoptions/placement)
and [standard placement](https://developer.apple.com/documentation/uikit/uiwindowscenestandardplacement-swift.struct).
No private frame manipulation or simulated lifecycle callback positions the windows.
The fixture runs with Split View on an iPad iOS 18.6 simulator. It does not promise
a particular split ratio or window position across system versions and modes.

[Reproduce the real gestures](../../scripts/native/window-drop/README.md) and read
the [stage 2 acceptance report](../../test/native-window-drop-stage2.md). Stage
Manager, physical iPad/VoiceOver speech, cross-process/external-app transfer,
Android gestures, sidebar targets and creating a new window by dragging remain
outside this stage. Its ordinary button is a native accessibility-tree/tap check;
stage 1 separately records the keyboard alternative.
