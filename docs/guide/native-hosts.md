# Native hosts

::: warning Experimental
The host contract is new and may change between beta releases. Changes bump `NATIVE_HOST_VERSION` and are listed in the changelog. See the [versioning policy](#versioning-policy).
:::

A **host** is the native container the router drives a stack in. `<RouterView>` hands the router a NativeScript `Frame`; `<RouterSplitView>` hands it two; a modal route gets a frame inside a native modal. Each goes through the same contract, so the router keeps one implementation of matching, guards, results, history and reconciliation while the host owns presentation, gestures and the native handles.

The contract exists so that native drawers, sheets and platform controllers can be added without forking the router or reimplementing guards inside every adapter. The built-in hosts are the first users: `createFrameHost(frame)`, `createFrameHost(frame, { modal: true })` and `createSplitFrameHost(list, detail, options)`.

## What a host does

```ts
import type { NativeHost } from 'vue-router-ns'
```

| Member                       | Role                                                                                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `version`                    | The contract version it implements. Must equal `NATIVE_HOST_VERSION`.                                                                            |
| `kind`                       | A short name for diagnostics and errors, like `'frame'`.                                                                                         |
| `capabilities`               | What it can do natively. See [capabilities](#capabilities).                                                                                      |
| `native`                     | The container, `null` once disposed.                                                                                                             |
| `loaded`                     | `false` while the container can't show pages yet, like a tab iOS has never shown. Its pushes wait; other stacks don't.                           |
| `attach(delegate)`           | Called once before the first push. The host keeps the delegate and reports through it.                                                           |
| `pages()`                    | Pages in native order, bottom to top, whether the router mounted them or not. The router reconciles from this after every change.                |
| `visible()`                  | Optional. The pages on screen right now, when more than one can be. `onPageActivated` follows it.                                                |
| `push(component, options)`   | Mounts the component as a new page on top. Report completion with `delegate.changed()`. Throw or reject to fail the navigation.                  |
| `back(target, options)`      | Returns to `target`, a page from `pages()`, dropping what is above it. `null` closes the host. Report with `changed()` or `closed()`.            |
| `holdDismissal(hold)`        | Optional. Holds the user's own dismissal while a leave guard is active. Report attempts with `delegate.dismissAttempted()`.                      |
| `previewBack(top, below, …)` | Optional. Android 14+ predictive back: show `below` while the swipe moves, and call `commit` when it lands. See [`BackPreview`](./android-back). |
| `ownsSystemBack()`           | Optional. Whether the current window's system back lands on this host.                                                                           |
| `willAnimate(options)`       | Optional. `false` when the next page appears in a pane that isn't on screen yet, so zooms and shared elements are skipped.                       |
| `parts()`                    | Optional. The native containers for [diagnostics](./diagnostics), each with a role, a native handle, `loaded` and its pages.                     |
| `dispose()`                  | Stops listening and releases handles. Called when the stack closes. Safe to call twice.                                                          |

The delegate the router passes to `attach()` has five methods: `changed()` after every native change, `closed()` when the host went away on its own, `dismissAttempted()` for a held dismissal, `backPressed()` for a system back the host claims, and `backGesture()` to start an interactive back. A host that reports a change it didn't make, like an iOS swipe, gets the same treatment as a `<RouterView>`: the router mirrors it, disposes the pages that left, and runs `afterEach`.

## Capabilities

The router asks instead of guessing. A navigation that needs a capability the host lacks rejects with an explicit error, so an unsupported `clearHistory` never looks like it worked.

| Capability             | Meaning                                                                                                                     | Without it                                     |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `replace`              | `replace` drops the page on top natively, in the same step as the push.                                                     | `router.replace()` rejects.                    |
| `clearHistory`         | `clearHistory` drops every page below natively, in the same step as the push.                                               | `push(to, { clearHistory: true })` rejects.    |
| `pinnedRoot`           | The first page stays, like a split view's list. `clearHistory` keeps it, back never removes it, and `setStack` prefixes it. | The first page is an ordinary entry.           |
| `close`                | The host as a whole can be closed, like a modal. `back(null)` closes it.                                                    | Back at the root does nothing.                 |
| `cancellableDismissal` | The host can hold a dismissal the user starts until the leave guards have run.                                              | Guards only see navigations the router starts. |
| `multipleVisible`      | More than one page can be on screen. `visible()` says which.                                                                | Only the page on top is active.                |

Transitions, `animated` and zoom sources are presentation: a host may ignore them. The options a host receives are `NativeHostPushOptions` (`initial`, `animated`, `transition`, `replace`, `clearHistory`) and `NativeHostBackOptions` (`animated`).

## Mounting a host

`<RouterView>` does this for a Frame. For your own container, mount the host under a name and navigate there with `{ frame: name }`, exactly like a named view:

```ts
import { mountNativeHost } from 'vue-router-ns'

const unmount = mountNativeHost(router, 'sidebar', host, '/menu')
await router.push('/menu/settings', { frame: 'sidebar' })
unmount()
```

Names are shared with `<RouterView>`s and must be unique. Unmounting closes the stack: pending results settle with `undefined`, leave guards don't run, and the host is disposed.

## Reaching the native container

Inside a routed page, `useNativeHost()` gives the host the page's stack lives in. Type the container yourself:

```ts
import { useNativeHost } from 'vue-router-ns'
import type { Frame } from '@nativescript/core'

const host = useNativeHost<Frame>()
host.kind // 'frame', 'modal-frame', 'split-frame' or your own
host.capabilities.close
host.native?.ios // the UINavigationController, on iOS
```

`native` is `null` once the page has left its stack or the host is gone. Read it when you need it rather than keeping it: the handle belongs to the host, and a modal's frame does not survive the modal.

## Writing a host

The smallest complete host is the in-memory example the contract suite runs against: [`test/hosts/memory.ts`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/hosts/memory.ts). It has no native container at all; it mounts pages with `createNativeView`, keeps them in an array and reports on a later tick, the way a transition would. A Frame-based host can reuse `createFrameHost()` and wrap it, which is how the built-in modal and split hosts are put together.

What the router relies on:

- `pages()` is the truth. Include pages the router didn't mount; diagnostics report them as `unknown-native-page` instead of the router guessing.
- Call `delegate.changed()` once per native change, after it is complete and `pages()` reflects it. Call it for the router's own pushes and backs too: that is how the router knows they finished.
- Don't fake what you can't do. Declare it in `capabilities`.
- Dispose completely. After `dispose()`, `native` is `null`, listeners are gone and later platform events are ignored.
- Ship native dependencies with the adapter. A host that needs Android Material or a Swift wrapper packages it as its own plugin; the router stays free of it.

Run the contract suite against the host before claiming support. It lives in [`test/host-contract.ts`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/host-contract.ts) and checks order, external pops, cancelled and concurrent navigations, disposal, unsupported operations and results settled exactly once. It runs against the Frame host, the split host and the memory host. It cannot replace device checks: system gestures, process death and accessibility need the real platform, recorded in the [validation reports](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-validation.md).

## Versioning policy

- `NATIVE_HOST_VERSION` is `1`. A host declares the version it implements, and the router refuses a different one with an explicit error rather than running it against assumptions it doesn't share.
- While experimental, the contract may change in a beta release. Any incompatible change bumps the version, is listed in the changelog, and updates the built-in hosts, the memory example and the contract suite together.
- Adding an optional member or capability does not bump the version. Hosts that don't implement an optional member keep their current behavior.
- When the contract leaves experimental status, the version will follow this package's semver: incompatible host changes only in a major release.
