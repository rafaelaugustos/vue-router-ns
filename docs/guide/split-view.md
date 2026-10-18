# List and detail

`RouterSplitView` shows a list and its detail side by side when there is enough room. In a narrow window, the detail covers the list. It uses the same routes and navigation methods in both layouts:

```vue
<RouterSplitView name="inbox" list="/messages">
  <template #empty>
    <Label text="Select a message" horizontalAlignment="center" verticalAlignment="middle" />
  </template>
</RouterSplitView>
```

<Clip name="ipad-split" :width="480" aspect="3 / 4" caption="The inbox stays visible as messages are pushed onto the detail stack. iPadOS 26 simulator." />

The `list` route is the pinned first page. Every non-modal route pushed into this stack becomes a detail, regardless of its path or nesting in the route table. Routes with `modal` still open separately. A named split view can live alongside ordinary `RouterView`s, including in different tabs.

```ts
// Inside either pane, useRouter() is bound to the whole split stack.
await router.push('/messages/42')
await router.push('/messages/42/edit')

// From elsewhere, name the stack.
await router.push('/messages/42', { frame: 'inbox' })
```

## Layout and state

The layout follows the component's available width, in device-independent pixels, rather than the device type or full screen size. Rotation, window resizing and folding that changes the available width can therefore change the layout. The default breakpoint is 840 and the list column is 320 wide:

```vue
<RouterSplitView list="/messages" :breakpoint="900" :listWidth="300" />
```

Both native Frames stay mounted. Resizing does not recreate pages, run navigation guards, or change the selected route. List scroll position, local component state, unsaved detail fields and the detail's native back stack stay in place. In the expanded layout, the list and the top detail are both active for `onPageActivated`; a modal deactivates both. `router.currentRoute` remains the top detail until the user goes back to the list.

The `empty` slot appears in the detail column when the expanded layout has no selected detail. It is not a route or a history entry.

## History and back

History works the same in both layouts. Selecting another item with `push()` adds a detail; it does not discard the previous selection. Given:

```text
/messages → /messages/42 → /messages/42/edit
```

Back first returns to `/messages/42`, then to the list. In the expanded layout, that last back clears the detail column. Native back and router back stay in sync, and leave guards can prevent pages from being removed.

- `push(list)` and `backToRoot()` return to the existing list through the guards.
- `replace()` replaces the top detail. At the list, it opens the first detail.
- `clearHistory: true` clears the detail history and keeps the list.
- `setStack()` keeps the list as the first entry, prepending it when omitted.
- `pushForResult()` returns results from details or modals as usual.
- `restore` saves and restores the combined list/detail history as one named stack.
- `backToRootOnReselect` works inside a `TabViewItem`, like on `RouterView`.

## Native behavior

The list and detail each use a native Frame. A transparent native root in the detail Frame provides its back destination; this implementation detail never appears in `router.stack` or saved state. Compact mode places the detail Frame over the list; expanded mode places it alongside. Pages are never transferred between Frames during resizing.

The first detail opens across panes, so shared-element and iOS zoom transitions from the list are not used there. Transitions between detail pages work normally, including Android predictive back previews. Returning from the first detail to the list uses the Frame's normal back transition. The component adapts to width; it does not position panes around a physical fold hinge.

`name` and `list` are read when the component mounts. To create a different split stack, mount a new component with a different Vue `key`.
