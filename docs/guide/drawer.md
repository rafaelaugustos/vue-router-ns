# Android drawer

On Android, a drawer that slides in from the start edge is a native container: AndroidX's `DrawerLayout` owns the drag, the settle, the scrim and the accessibility of the pane. `<RouterDrawer>` puts your stacks inside one without moving any page around:

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

## Open, close, back

- `drawer.open()`, `drawer.close()`, `drawer.toggle()` and `drawer.isOpen` on the component's ref; `v-model:open` and the `opened` and `closed` events follow the native state, so a swipe from the edge updates them too.
- The Android back button, and the back swipe on Android 14 and later, close an open drawer before any page pops. This goes through `router.claimSystemBack()`, which any native container can use: `claimSystemBack({ owns: () => isOpen, back: close })` returns what releases the claim.
- A navigation closes the drawer, unless `closeOnNavigate` is `false`.

## Styling and platforms

The pane is a `GridLayout` with the class `router-drawer` and a white background; give your slot's root its own background and padding. `width` is in device-independent pixels. `DrawerLayout` comes with AppCompat, so nothing is added to the build; the optional Material `NavigationView` is not used, your own views are the menu.

On iOS, `<RouterDrawer>` renders the content alone and the `drawer` slot is ignored. To navigate between tabs through the native iPad sidebar, use [`<RouterTabs sidebar>`](./tabs).
