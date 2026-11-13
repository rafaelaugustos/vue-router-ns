# Explicit application window policy

Copy [policy.ts](./policy.ts) into the application and implement its `WindowPorts`.
It is an executable composition example, not an exported router API or a process-wide
owner registry. It uses the existing `resolveIntent` and `openIntent` pipeline.

```ts
import { createWindowIntentPolicy } from './policy'

const intents = createWindowIntentPolicy({
  resolve: (request) => routingCatalog.resolveIntent(request),
  find: (key) => accountWindows.get(key),
  open: (key, restore, current) => openApplicationWindow(key, restore, current),
  focus: (owner) => activateApplicationWindow(owner),
})

await intents.dispatch(request, {
  mode: 'focus',
  key: 'account-a:document-42',
  history: 'append',
})
await intents.dispatch(anotherRequest, {
  mode: 'new',
  key: 'account-a:document-43',
  restore: 'saved',
  history: 'reset',
})

// Before replacing the account session:
intents.dispose()
```

The catalog, registry and native callbacks belong to the application. All owners
in this example share routes and URL mapping; the selected router resolves again.
The application chooses the policy after checking the notification/document's
intended account. Never copy the selection from untrusted transport data.

| Policy             | Behavior                                                                                                   |
| ------------------ | ---------------------------------------------------------------------------------------------------------- |
| `reuse`            | Navigate the selected registered owner; make no native focus request.                                      |
| `focus`            | Await app-confirmed native activation, recheck ownership, then navigate.                                   |
| `new`              | Request a fresh application key; await native mount/restoration and activation. Existing keys are refused. |
| `append`           | Set `replace: false` and `clearHistory: false`; append after readiness.                                    |
| `reset`            | Set `replace: false` and `clearHistory: true`; normal guards still run before clearing this stack.         |
| `restore: 'saved'` | The creation callback enables the selected owner's scoped snapshot load.                                   |
| `restore: 'fresh'` | The creation callback skips its old snapshot.                                                              |

No selection falls back to the focused/global Frame. An explicit `target.windowId`
must match the chosen owner; a fresh window cannot satisfy an assertion on an
existing native identity. The final request asserts the acquired owner's native
id and preserves any named frame. A closed or replaced registry entry is rejected.
Native creation/focus errors reject the promise; absence returns
`target-unavailable`. Do not silently convert an OS refusal into another owner.

## Implementing the ports

Create one policy instance and account-scoped registry per authenticated session.
Use account/document keys rather than arrival order. The creation callback requests
a **public** initial window, registers its router, waits for scoped restoration and
first mount, then returns it. Do not also place the requested destination in the
initial route: `openIntent` will deliver it after readiness.

Bound native creation, mount and activation waits, and handle OS denial. Native
window requests do not acknowledge that a scene has actually appeared. Use a
unique correlation token for each OS request, check the supplied `current()`
before adopting its arrival, and ensure expired/late arrivals cannot overwrite a
newer owner under the same key. The [iPad fixture](../../demo/src/testing/intentwindows-app.ts)
shows a token-indexed handoff, public content for abandoned arrivals, native
activation observation and a 15-second bound per wait. Its activation check does
not certify system keyboard focus when multiple iPad scenes remain active. Account/document keys and
tokens are routing metadata, not authorization proofs. Native resources and
permission checks remain application responsibilities.

This example reserves up to 32 pending deliveries before calling native ports and
remembers the latest 256 settled scope/id pairs, including refused attempts. This
prevents duplicate callbacks from creating/focusing multiple windows before a
receiving router exists. Use one scope/id per intentional action; reuse it across
callbacks for that action and supply a new id for a retry. Without a delivery
pair, every call is intentional. The receiving router retains its own compatibility
ledger. Neither ledger persists across process death; do not treat bounded memory
deduplication as durable exactly-once delivery. Concurrent creation of the same
application key returns `busy`.

Disposal invalidates outstanding acquisition/focus handoffs and rejects subsequent
calls. It is not a logout implementation: applications must cancel their login
handles, close/clean protected owners and keep normal authorization guards. A
request already inside `openIntent` follows that API's existing rules; disposal
does not roll back native creation, committed navigation or abort an asynchronous
guard. Use the router's explicit `suspendIntent` flow when login is needed, with
permission and scope checks owned by the selected router's application.

The fixture is iPad-only and uses public UIKit activation/destruction plus the
existing NativeScript window APIs. Its saved histories are controlled snapshots;
it does not claim process-death restoration, Stage Manager, background closure,
external displays or Android native activation. Existing runtime window lifecycle
coverage remains separate.
