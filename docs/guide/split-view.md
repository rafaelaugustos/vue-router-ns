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

## Android foldable layouts

![Native fold-aware split](/media/android-fold-hinge.png)

Android emulator: native panes leave the OS-reported hinge area empty.

Install the optional AndroidX Java callback bridge in `App_Resources/Android/app.gradle`:

```groovy
dependencies {
  implementation 'androidx.window:window-java:1.5.1'
}
```

Rebuild the native app after adding the dependency. For RTL, enable `android:supportsRtl="true"` on the Android manifest's `<application>`, as for other native Android layouts. `foldAware` defaults to `true`; when the bridge is available, each mounted split view observes `WindowLayoutInfo` from its own Activity. It removes the listener when unloaded or unmounted and subscribes again when loaded. No process-wide foreground Activity or device-model heuristic selects its owner.

A separating fold or fully occluding hinge takes precedence over `breakpoint` and `listWidth`. A vertical feature places the list and detail in the two physical regions; the list is on the right in RTL. A horizontal feature places the list above the detail. The gap excludes the hinge, with outward rounding for NativeScript's integer grid lengths. A view intersecting only one usable side keeps both Frames in that side, using compact navigation.

A flat, nonseparating, non-occluding fold does not change layout. Without a relevant feature, without the optional dependency, and on iOS, the usual width-based layout applies. To opt out explicitly:

```vue
<RouterSplitView list="/messages" :foldAware="false" />
```

The same Frames and Pages survive posture changes; navigation history, drafts and scroll state stay attached to their original entries. The `empty` slot occupies the detail region. This is a two-pane layout for a single intersecting folding feature, not Android Activity embedding or an additional native window. The containing app still owns its Android configuration-change and process-restoration policy.

Native evidence and reproduction commands are in [foldable validation](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-folding.md). See also [AndroidX WindowManager](https://developer.android.com/jetpack/androidx/releases/window) and [FoldingFeature semantics](https://developer.android.com/reference/androidx/window/layout/FoldingFeature).

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

The first detail opens across panes, so shared-element and iOS zoom transitions from the list are not used there. Transitions between detail pages work normally, including Android predictive back previews. Returning from the first detail to the list uses the Frame's normal back transition.

`name` and `list` are read when the component mounts. To create a different split stack, mount a new component with a different Vue `key`.
