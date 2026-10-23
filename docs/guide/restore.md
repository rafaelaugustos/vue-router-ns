# Restoring the stack after the app is killed

Android kills apps in the background all the time, and brings a native app back on the screen it was on, with its back stack. Every page here is a path, so the stack is a list of strings and the router can save it for you:

```ts
import { ApplicationSettings } from '@nativescript/core'

const router = createRouter({
  routes,
  restore: {
    save: (state) => ApplicationSettings.setString('stacks', JSON.stringify(state)),
    load: () => JSON.parse(ApplicationSettings.getString('stacks', 'null')),
  },
})
```

<Clip name="android-restore" aspect="9 / 20" caption="A typed name returns after the demo goes to the background, its process is killed, and it opens again. Android 16 emulator." />

`save` runs after every navigation and when the app goes to the background, with the paths of every named `<RouterView>`, and with `null` when the app exits on its own, so a fresh start after the user left stays fresh. When a `<RouterView>` mounts, the router asks `load` once (it can be async) and rebuilds the saved stack without animating, through the guards, so a page that needs a session still sends you to the login.

Saves older than `maxAge` (30 minutes by default) are ignored; pass `Infinity` to always restore.

## What can't come back

Modals, and `props` passed through `push`. A page that relies on them should cope with their absence, by reading its params instead. If a saved path matches no route anymore, after an update for example, the stack starts from `initial` instead.

## Format and limits

`SavedStacks` has the shape `{ version: 2, savedAt: number, stacks: Record<string, string[]>, entries: Record<string, SavedEntry[]> }`. `savedAt` is a timestamp in milliseconds. Keep stack names stable; a split view saves list and details as one stack. `load()` runs once per router instance, and each view restores its stack when mounted.

Restoration recreates pages from paths. It does not save local refs, scroll offsets or arbitrary objects on its own; a page keeps those with [`usePageState()`](#page-state). `maxAge` belongs inside `restore`, for example `restore: { save, load, maxAge: Infinity }`.

## Page state

Paths bring the pages back; what the user had in them is another matter. A draft, a reading position or a selection can come back too, if the page says what to keep:

```ts
import { usePageState } from 'vue-router-ns'

const body = ref('')
usePageState('draft', {
  save: () => (body.value ? { body: body.value } : undefined),
  restore: (value) => (body.value = value.body),
})
```

`save` runs after every navigation and when the app goes to the background, and must return small, JSON-compatible data: no native views, closures or promises. Return `undefined` to keep nothing, which is how a page leaves a sensitive draft out. `restore` runs once, after the page's native view has loaded, with what `save` kept; it receives the version it was saved with and the native `Page`, in case a scroll offset has to wait for a layout. A page that only wants to know it came back can set a flag inside `restore`.

Every page gets a stable key, saved next to its path, so two pages at the same path each get their own state back. Keys and state travel in `SavedStacks.entries`, aligned with `stacks`; the `version: 2` format still loads a path-only save, which simply has no state.

### Versions and migrations

Give the shape a `version` when it changes, and a `migrate` to bring old saves forward:

```ts
usePageState('draft', {
  version: 2,
  save: () => ({ subject: subject.value, body: body.value }),
  restore: (value) => Object.assign(form, value),
  migrate: (old, version) =>
    version === 1 ? { subject: '', body: (old as { text: string }).text } : undefined,
})
```

A save from another version goes through `migrate`; without one, or when it returns `undefined`, the page starts fresh. A `restore` or `migrate` that throws is reported in development and the page starts fresh too.

### Renamed and removed routes

Page-state `migrate` changes a hook's data shape. It does not rename routes. Saved history contains paths, so changing a route's name alone does not change its saved location. When a path changes, translate it in `restore.load` before returning the snapshot:

```ts
import type { SavedStacks } from 'vue-router-ns'

function migratePaths(saved: SavedStacks | null): SavedStacks | null {
  if (!saved) return null
  return {
    ...saved,
    stacks: Object.fromEntries(
      Object.entries(saved.stacks).map(([name, paths]) => [
        name,
        paths.map((path) => (path === '/legacy-edit' ? '/edit' : path)),
      ]),
    ),
  }
}

// Inside restore:
// load: () => migratePaths(JSON.parse(ApplicationSettings.getString('stacks', 'null')))
```

This example only maps that exact path. Handle params/query strings explicitly for your application's old URLs. Keep entry order and `entries` aligned: two `/legacy-edit` entries still keep their separate keys and drafts. If you remove or reorder paths, transform their corresponding entries at the same indices. Preserve `savedAt` so migration does not revive expired state, and preserve `windowKey` so a different window cannot consume it.

Without an explicit migration, an unavailable path resets that stack to its `initial` route. Guards still run during restoration. If a guard redirects a saved page to another path, its draft is not transferred to the redirected page. For sign-out, clear the application's stored snapshots and sensitive data as well as enforcing authorization guards; guards are not a storage-erasure mechanism.

### What stays app-owned

- State that does not survive `JSON.stringify` is dropped with a warning in development, and so is a page whose state exceeds `restore.stateLimit` (8 KiB by default).
- A page restored somewhere else, because a guard redirected it, leaves its saved state behind: the state follows the path.
- A `pushForResult()` promise does not survive process death. The page that was waiting comes back without it; a flow that needs the answer later should keep it in its own store, or in the asking page's state.
- Modals are not restored. Persist and reselect the active tab yourself. Window-scoped snapshots carry `windowKey`, but the app must supply a stable document key and reconnect it to the correct native window; see [native windows](#native-windows).

## Native windows

On Core 9.1.3+, a router bound to a `NativeWindow` receives window context in `save(state, context)` and `load(context)`. Use `restore.key` and `context.key` to separate snapshots. In this mode, process exit preserves history; closing a window saves `null` only for that window. The clear-on-exit behavior above applies to legacy mode without an owning window. See [native windows](./windows#persistence-by-window) for bootstrapping and limits.

### Ownership and validated behavior

| Data                                                         | Owner                                                              |
| ------------------------------------------------------------ | ------------------------------------------------------------------ |
| Named-stack paths, stable entry keys and opted-in page state | The router snapshot, persisted by your `save` callback.            |
| Page-state schema migration                                  | Each `usePageState` hook's `version` and `migrate`.                |
| Path migration, account changes and storage cleanup          | Your application's `load`/storage policy.                          |
| Selected tab and window/document identity                    | Your application; use independent snapshot keys per document.      |
| Pending modal/result promises and native objects             | Not persisted. Reconstruct recoverable work from application data. |

Runnable native examples: [`state-app.ts`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/testing/state-app.ts) (`--env.stateTest`) covers duplicate drafts and scroll positions, schema migration, expiry, removed routes and sign-out; [`windows-app.ts`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/testing/windows-app.ts) (`--env.windowsTest`) restores duplicate drafts and entry keys in independent windows. Follow the demo setup and [window resource preparation](https://github.com/rafaelaugustos/vue-router-ns/tree/main/scripts/native/windows) before building them.

The required CI validates genuine Android process death and original task restoration on API 34/36, plus original UIKit scene reconstruction in a new process on iPadOS 18.6. The [acceptance report](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-page-state.md) distinguishes this from ordinary background resume and same-process reconnection. These are emulator/simulator results; window ownership remains experimental and its [platform limits](./windows#original-tasks-and-scene-sessions) still apply.
