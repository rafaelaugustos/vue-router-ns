# Setting the whole stack

## Selecting an exact retained entry

`router.stack` lists routes. `router.history` adds a frozen snapshot with a live address for each retained entry, bottom to top. Two entries at the same path have different addresses:

```ts
const snapshot = router.getHistory({ frame: 'inbox' })
const selected = snapshot?.entries[1]
if (selected) await router.backToEntry(selected, { animated: false })
```

`history.value` follows the caller's stack: the focused stack on the application router, or the owning stack inside a page. `getHistory()` reads the same scope; `{ frame }` selects a named frame in this router/window. Reading never reveals a tab or navigates. Use `computed(() => router.getHistory({ frame: 'inbox' }))` for a reactive named-stack view. A missing or closed scope returns `undefined`. A closed page's history does not fall back to another stack.

Each snapshot has `scope` and `entries`. The scope contains `id`, `name`, `kind` (`frame` or `modal`), `windowId` when bound to a native window, and `pinnedRoot`. Each entry contains:

| Field           | Meaning                                                                                                                                |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `scopeId`, `id` | Exact live address accepted by `backToEntry()`. Stable while that stack and entry survive, including temporary unloading and page HMR. |
| `key`           | Page-state identity. Version 2 restoration preserves it, but creates a new live address.                                               |
| `route`         | Detached `path`, `fullPath`, `name`, `params`, `query` and `hash`. No route records, components, metadata or native handles.           |
| `restored`      | This page was reconstructed from a saved stack, including a legacy path-only snapshot. It is a new native object.                      |

Snapshots, entries, route data and nested parameter/query arrays are frozen. An older snapshot remains a historical observation; read again to see current membership. Keeping a snapshot does not retain the router's native Pages.

`backToEntry(selected, { animated, result })` targets the entry's owning stack, even if another named stack gained focus. It reveals that stack's tab before navigating. There is no `frame` override and no route-matching fallback. The supplied result goes only to the departing top page; other removed results settle with `undefined`. Leave guards run from top to bottom through the existing Back path, including guard redirects, native acknowledgement and disposal.

- Selecting the current top returns a `duplicated` navigation failure without running guards or changing history.
- A missing entry, a foreign router/window or a closed/replaced stack rejects with an error. Reusing a frame name or restoring the same path/key cannot make an old address valid again.
- A refused guard returns `aborted` and preserves the stack. A newer navigation, owner closure or native change to the guarded top/target while selection waits returns `cancelled`.
- A retained unloaded stack queues native Back until its host loads; other stacks can continue navigating. An unopened stack has no retained entry to select yet.
- A pinned split root can be selected and remains pinned. Selection never removes it.
- While a modal is open, selection is confined to its top modal stack. Selecting covered history rejects without dismissing a modal; use the existing modal Back flow first. Selecting the modal root keeps the modal open.

Persist application routes and page state through [restoration](./restore), not these live addresses. Popped entries are gone: there is no forward history, and reconstruction does not resurrect their native objects. Native Back controls remain in place.

<Clip name="entry-history" :width="480" aspect="3 / 4" caption="Two native stacks: exact duplicate selection, guard refusal, stale address rejection, cancelled/committed native Back and owner disposal. iOS 18.6 simulator; fixture labels are in English." />

## Optional Back history menu

`useBackHistoryMenu()` opts an app-owned control into the owning page's retained history. It leaves UIKit's system Back button and its built-in long-press menu in place. Android's toolbar Back does not supply a retained-entry menu; this API provides a native popup. On iOS, app-owned controls use an anchored native action sheet/popover, which also works when opened from a keyboard command. No private Back-button lookup or navigation delegate replacement is needed.

Call it during routed page setup. Provide a clearly labelled history button as well as long press, and translate the labels for your app:

```vue
<script setup lang="ts">
import { ref } from 'nativescript-vue'
import type { View } from '@nativescript/core'
import {
  useRouter,
  useBackHistoryMenu,
  useNavigationCommands,
  NavigationCommandScope,
} from 'vue-router-ns'

const router = useRouter()
const back = ref<{ nativeView: View }>()
const menu = useBackHistoryMenu({
  title: 'Back history',
  cancelTitle: 'Cancel',
  label: (entry, index) => `${entry.route.fullPath} · ${index + 1}`,
  onError: console.error,
})
const open = () => (back.value ? menu.show(back.value.nativeView) : false)
const commands = useNavigationCommands([
  {
    id: 'history',
    title: 'Back history',
    shortcut: { input: 'h', modifiers: ['ctrl'] },
    action: open,
  },
  { id: 'back', title: 'Back', shortcut: { input: 'Escape' }, action: 'back' },
])
</script>

<template>
  <Page>
    <NavigationCommandScope :commands="commands">
      <StackLayout>
        <Button
          ref="back"
          text="Back"
          accessibilityLabel="Back; hold for history"
          @tap="!menu.active.value && router.back()"
          @longPress="open"
        />
        <Button text="Show history" accessibilityLabel="Show Back history" @tap="open" />
      </StackLayout>
    </NavigationCommandScope>
  </Page>
</template>
```

`show(source: View)` returns whether the menu is open. It never navigates or reveals another stack. Repeated calls while open are idempotent, including NativeScript's multiple long-press phases. The source must be loaded and belong to this visible page. At the root, during native navigation, behind a modal, in an unselected tab, after disposal, or when native presentation is unavailable, it returns `false`.

The menu snapshots earlier entries, newest first, excluding the current top. `label(entry, index, history)` receives the root-based index and the frozen history; the default is the route name (or full path) followed by its one-based position. Distinguish repeated locations and reconstructed entries in your labels when useful. `title` and `cancelTitle` accept a string, ref or getter and are read on opening; Android displays the entry labels without a heading or Cancel row.

Selection dismisses the menu and uses `backToEntry()` with that exact address. Guards can refuse it without changing history. Unexpected navigation errors go to `onError`, or the console. `active` is a readonly ref; `dismiss()` closes only this menu and returns whether it was open. Page coverage, source unloading, history changes and owner disposal close it and invalidate old callbacks. It cannot retarget a new occurrence of the same route.

Native UI handles selection and dismissal. The optional keyboard command opens the same menu; Escape closes it before route Back when dispatched through the command scope. Android also supports arrow keys/Enter and hardware Back. UIKit supports native cancellation and outside-tap dismissal on iPad. The native checks verify accessible labels and keyboard input; they do not certify VoiceOver/TalkBack speech or every OS keyboard mode. A custom host needs a loaded routed NativeScript Page/anchor for this UI; otherwise use the readonly history API to render its own controls.

On the audited iOS 18.6/Core 9.1.4 combination, selecting from UIKit’s original long-press history bypassed an active page leave guard. The optional menu above uses the guarded router path; installing it does not intercept the original UIKit menu. Apps that require guarded history selection must use app-owned controls and hide the system Back control (for example, a NativeScript `NavigationButton` with `visibility="collapsed"`). The native-control guard gap remains follow-up work in #178.

<Clip name="back-history-menu" :width="480" aspect="3 / 4" caption="Two stacks: original UIKit history, app-owned Back long press, Ctrl H/Escape, guard refusal, exact duplicate selection, concurrent navigation and disposal. iOS 18.6 simulator; fixture labels are in English." />

## Reconciling a list of routes

Like SwiftUI's `NavigationStack(path:)`, the stack can be set as a list, and the pages follow:

```ts
await router.setStack(['/', '/orders', { name: 'order', params: { id: 42 } }])
```

The router keeps the pages both stacks share from the bottom up, goes back to the last of them, then pushes the rest. Only the last step animates. Guards run for every step, and the first failure stops it. A modal route in the list becomes a plain page: the list describes one frame's stack.

It takes `frame`, `animated` and `transition` as a second argument. It's what [`withParents`](./deep-links#bringing-the-parents-along) and [restoring a saved stack](./restore) are built on.

The list cannot be empty. If a guard interrupts reconciliation, completed steps remain: `setStack()` is not a transaction. In a `RouterSplitView`, the list stays pinned as the first entry, even when omitted from the argument.

## Going back without animating

`back()`, `backTo()` and `backToRoot()` take `animated: false`. `go(delta)` only accepts the offset; use `backTo()` or `backToRoot()` when you need options. A frame animates a pop the way the page being popped came in, so the router sets that on the page before popping.
