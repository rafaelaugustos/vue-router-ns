# Native drawer

See [native capabilities and container choices](./capabilities) for ownership, platform boundaries and the rc.2/rc.3 distinction.

`<RouterDrawer>` puts a start-edge menu around existing native stacks. Android uses AndroidX `DrawerLayout`; iOS uses UIKit views, pan gestures and animations. Both keep the content and drawer slots mounted without adding routes.

::: info Added in rc.3
The iOS implementation and adaptive presentation are part of `0.1.0-rc.3`. The previous `0.1.0-rc.2` supports the overlay drawer on Android only.
:::

The same template works on both platforms:

```vue
<RouterDrawer ref="drawer" :width="280">
  <template #drawer>
    <StackLayout class="menu">
      <Button text="Inbox" @tap="router.openLink('/')" />
      <Button text="Settings" @tap="router.openLink('/settings')" />
      <Button text="Account" @tap="router.openLink('/settings/account')" />
    </StackLayout>
  </template>

  <RouterTabs>
    <RouterTab name="inbox" title="Inbox" icon="tray.fill">
      <RouterView name="inbox" />
    </RouterTab>
    <RouterTab name="settings" title="Settings" icon="gearshape.fill">
      <RouterView name="settings" initial="/settings" />
    </RouterTab>
  </RouterTabs>
</RouterDrawer>
```

<Clip name="android-drawer" aspect="9 / 20" caption="The drawer opens Settings; system Back closes the drawer before popping a page. Android 16 emulator." />

The default slot is the content: a `<RouterTabs>`, a `<TabView>`, a `<RouterView>` or a `<RouterSplitView>`. The `drawer` slot is the pane. Opening or closing the menu is not a navigation and creates no route entry; the destinations are whatever the pane navigates to, and each keeps its own named stack. Taking destinations through `openLink` lets the `links.frame` policy select the tab as well as the stack. Highlight the current destination from `router.currentRoute`.

The drawer does not reset a destination's history when selected again. Its button decides the action: navigate with `openLink` or `push`, or explicitly return to a stack's root with `router.backToRoot({ frame: 'inbox' })`. Selecting an already-current route still closes the pane. `backToRootOnReselect` on a `RouterView` applies to its tab's reselect event, not to arbitrary drawer buttons.

## Open, close, back

- `drawer.open()`, `drawer.close()`, `drawer.toggle()` and `drawer.isOpen` on the component's ref; `v-model:open` and the `opened` and `closed` events follow the native state, so a swipe from the edge updates them too.
- The Android back button, and the back swipe on Android 14 and later, close an open drawer before any page pops. This goes through `router.claimSystemBack()`, which any native container can use: `claimSystemBack({ owns: () => isOpen, back: close })` returns what releases the claim.
- A successful navigation closes the drawer, unless `closeOnNavigate` is `false`. A guard that refuses navigation leaves it open.
- A modal or bottom sheet above the drawer receives Back first, including its leave guards and result. If you keep the drawer open with `:closeOnNavigate="false"`, Back returns to that drawer after dismissing the modal.

## Adaptive presentation

Opt in with `presentation="auto"`. The drawer measures its **own available width**, so rotation, a narrower parent and window resizing can change the presentation without replacing the component, its two slots, Frames, Pages or Vue instances.

```vue
<RouterDrawer
  ref="drawer"
  presentation="auto"
  :breakpoint="840"
  :width="280"
  v-model:open="menuOpen"
  @presentationChange="mode = $event"
>
  <template #drawer><!-- Destination buttons --></template>
  <RouterView />
</RouterDrawer>
```

| API                   | Behavior                                                                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `presentation`        | `overlay` (default), `permanent`, or `auto`.                                                                                                                  |
| `breakpoint`          | Minimum container width for automatic permanent presentation; default 840 DIPs. No device-model detection.                                                    |
| `width`               | Requested pane width. Permanent presentation caps it at half the container, except when a separating vertical fold determines the two regions.                |
| `foldAware`           | Default `true`. Uses the existing optional AndroidX WindowManager integration in permanent mode. Without that dependency, width-based adaptation still works. |
| `drawer.presentation` | Read-only resolved `overlay` or `permanent`.                                                                                                                  |
| `presentationChange`  | Emits the resolved mode when it changes. The first measured layout can resolve `auto`; read the handle for the current mode.                                  |

`open`, `drawer.isOpen`, `opened` and `closed` describe the **overlay**. A permanent pane stays visible with `isOpen=false`: `open()`, `close()` and `toggle()` do not change it, and an attempted `v-model:open=true` is normalized to `false`. It has no scrim or drawer drag, does not claim system Back, and `closeOnNavigate` does not hide it. Both the menu and content remain available to touch and accessibility traversal.

Entering permanent mode cancels an in-flight drawer animation/gesture and normalizes the model. A previously settled open overlay emits `closed` once; an opening that never settled emits no late `opened`. Returning to overlay starts closed, with its hidden pane excluded from accessibility. Mode changes do not navigate, run guards, dismiss route modals or settle pending route results. On iOS, changing modes is immediate, including with Reduce Motion; ordinary overlay animations retain their existing policy.

With the [optional folding dependency](./split-view#android-foldable-layouts), a separating/occluding vertical feature places the permanent pane in the start-side region and content in the other region, excluding the hinge. A horizontal hinge keeps both beside each other in the larger usable region. `foldAware=false` opts out. Fold geometry does not force `auto` below its breakpoint; overlay mode keeps the existing full-container drawer behavior. Use permanent mode when the app needs hinge-separated navigation below that threshold.

Keep one `RouterDrawer` mounted when adapting. Do not switch between two keyed `RouterView` trees with `v-if`. A drawer adds a menu around existing stacks; [`RouterTabs sidebar`](./tabs) asks UIKit to present its tab destinations as an iPad sidebar, and [`RouterSplitView`](./split-view) owns a list/detail navigation arrangement. A permanent drawer is a custom persistent menu on iOS, not `UISplitViewController` or UIKit's tab sidebar. `RouterUIKitSplitView` still owns the window root and cannot be wrapped by this component.

<Clip name="adaptive-drawer" aspect="834 / 1210" caption="Real iPad input: overlay and permanent modes, retained draft and tabs, RTL and a modal result." />

Run `ns run ios --env.adaptivedrawerTest` or `ns run android --env.adaptivedrawerTest` from `demo` after building the package. The [acceptance report](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-drawer-adaptive.md) distinguishes automated native input/state checks from outstanding spoken screen-reader and real multiwindow checks.

## Rotation during navigation

On the iPadOS 18.6 simulator, orientation requests made during an animated push, programmatic Back or interactive swipe-back were followed by **visual rotation after navigation finished**. The tested pages, Vue instances, drafts and both native and logical histories survived that ordering; a committed Back removed its page once, while a cancelled swipe retained it. This is evidence of state retention under a mid-navigation rotation request, not a guarantee that UIKit runs both animations simultaneously.

On iPadOS 26.0, the same fixture also retained coherent state when UIKit cancelled the long swipe that was intended to commit. Use the native commit/cancel outcome; do not assume that a gesture will continue unchanged across rotation.

Swiping from the content edge of the permanent sidebar did not start an interactive navigation in the current driver. That direction remains an explicit coverage gap. Physical iPads and Stage Manager have not been validated by this run. See the [rotation acceptance report](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-drawer-rotation.md) for the scenarios, observed ordering and remaining limits.

The [isolated Back controls](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-back-content-edge.md) reproduce the inset-content limitation with a plain NativeScript Core 9.1.3 Frame, without Vue or RouterDrawer. On iPadOS 26.0, a UIKit control distinguishes default navigation from delegates exposing custom transition callbacks. Keep an explicit Back action available in permanent mode. This investigation does not establish rotation-during-swipe coverage for that direction.

## Styling and platforms

The pane is a `GridLayout` with the class `router-drawer` and a white background; give your slot's root its own background and padding. `width` is in device-independent pixels. `DrawerLayout` comes with AppCompat, so nothing is added to the build; the optional Material `NavigationView` is not used, your own views are the menu.

The small native host lives in this package and uses the AndroidX dependencies already shipped with the NativeScript runtime. It does not require a separate drawer plugin or a core patch. See the [native validation report](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-drawer.md) for the tested Android and dependency versions.

In overlay mode on iOS, the pane covers the content on iPhone and iPad. Its width is capped to leave a 44-point strip for scrim dismissal when the window is narrow. In permanent mode, the same UIKit views are laid out beside each other. On Android, the same AndroidX host lays out two content children in permanent mode; it does not leave a modal drawer locked open over the content.

`RouterUIKitSplitView` must own the window root: do not place it inside a drawer. `RouterSplitView`, which composes Frame stacks, can be drawer content. See [split navigation](./split-view).

### iOS gestures and accessibility

- At a stack root, drag inward from the first 24 points of the start edge to open. Drag the open pane or tap the scrim to close. A reversed or interrupted drag settles to a consistent open/closed state.
- On a pushed page, the edge belongs to UIKit's interactive Back. An active leave guard may disable that gesture, as described in [guards](./guards). The drawer does not replace the navigation controller's delegate or bypass the guard. Keep an ActionBar Menu button available.
- Opening dismisses the keyboard, isolates the covered content from VoiceOver traversal and requests focus in the pane. Closing restores the previous focus target if it is still attached. Accessibility Escape closes the pane. Reduce Motion skips the sliding animation.
- A presented native modal remains above the drawer. `closeOnNavigate=false` leaves the drawer in place when returning from that modal.
- `opened`/`closed` and `v-model:open` reflect settled states, not intermediate drag progress. Resizing retains the content and its native stacks.

The [iOS validation report](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-drawer-ios.md) separates automated accessibility-state checks from manual VoiceOver checks.

### Runnable acceptance example

[`demo/src/testing/drawer-app.ts`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/testing/drawer-app.ts) includes the router setup, three independent tabs, Menu buttons, an editable draft, conditional guards and modal results. Follow the [demo setup](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/README.md), build the package, then run `ns run ios --env.drawerTest` or `ns run android --env.drawerTest` from `demo`.

<Clip name="ios-drawer" aspect="393 / 852" caption="Native iOS drawer: gestures, retained stacks, guards and a modal result. iPhone simulator." />

## Direction, input and accessibility

The pane opens from the start edge: left in LTR, right in RTL. iOS follows UIKit's effective layout direction; Android uses `START`. For automatic direction from the system language, enable [`android:supportsRtl="true"`](https://developer.android.com/guide/topics/manifest/application-element#rtl) on your app's `<application>` in `App_Resources/Android/src/main/AndroidManifest.xml`. You can also set `direction="rtl"` on the drawer explicitly. Rotation keeps the same native container and mounted pages.

`direction` accepts `ltr` or `rtl`; omitting it follows the platform. On iOS the prop sets the container's semantic direction and lets UIKit inherit it, keeping the native navigation views' own gesture configuration intact.

Keep an ActionBar button to open the drawer. With Android gesture navigation, the system can consume the edge swipe as Back; the button remains available. Back closes the pane when the gesture is committed; it does not preview or pop a page behind the drawer.

`DrawerLayout` hides the covered content from accessibility traversal while open. The menu contents belong to the app: prefer native `Button` destinations, give each a clear label and expose the current destination with `accessibilityState="selected"`. A custom layout with only a tap handler also needs keyboard and accessibility activation; labeling it alone does not provide those actions.
