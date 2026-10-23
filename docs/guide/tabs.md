# Tabs and other independent stacks

`<RouterTabs>` puts named stacks behind a native tab bar and keeps the two in step:

```vue
<RouterTabs v-model:selected="tab" sidebar minimize="onScrollDown">
  <RouterTab name="inbox" title="Inbox" icon="tray.fill" androidIcon="sys://ic_dialog_email" :badge="unread">
    <RouterSplitView name="inbox" list="/" backToRootOnReselect />
  </RouterTab>
  <RouterTab name="settings" title="Settings" icon="gearshape.fill">
    <RouterView name="settings" initial="/settings" backToRootOnReselect />
  </RouterTab>
</RouterTabs>
```

<div class="clips">
<Clip name="ios-tabs" caption="Tabs keep their own history. Tapping Inbox again returns it to its root. iOS 26 simulator." />
<Clip name="android-tabs" aspect="9 / 20" caption="The same stacks behind Material bottom navigation. Android 16 emulator." />
</div>

- **iOS** is `UITabBarController`, with `UITab` on iOS 18 and later: `icon` is an SF Symbol, `badge` goes on the tab, `sidebar` turns on UIKit's sidebar on iPad, `minimize="onScrollDown"` lets the iOS 26 bar shrink while scrolling, and `role="search"` makes a search tab.
- **Android** is Material's `BottomNavigationView`, or a `NavigationRailView` from `rail` (600) device-independent pixels of width; `androidIcon` is a drawable name or `sys://` plus an `android.R.drawable` name. Without the Material library the core `TabView` renders at the bottom; `supportsNativeTabs()` tells.
- A navigation into a stack that lives in another tab brings that tab forward first, so `router.push(to, { frame: 'settings' })` and deep links land in view. Switching tabs runs no route guard; `canSelect(name)` can refuse a tap, and `select`/`reselect` events say what happened. `v-model:selected` holds the tab's name.

Use up to five destinations so they fit the Android bottom bar as well as the rail. `:rail="0"` keeps the bottom bar at every width. Resizing between the bar and rail preserves the mounted stacks and their histories.

`canSelect` applies to user selection. Changes to `selected` and navigation into a named stack select it directly; protect routes with route guards. The target tab is revealed before its navigation runs, including when a guard subsequently refuses that navigation. Outside a page, `router.currentRoute`, navigation and Android back follow the visible tab.

The router saves stack histories with `restore`. Persist `v-model:selected` separately if the app should return to the same tab after process death; restoring the stacks does not change that selection.

## Sidebar on iPad

<Clip name="ipad-tabs" :width="480" aspect="3 / 4" caption="UIKit’s sidebar selects Inbox and Settings, each with its own stack. iPadOS 26 simulator." />

## Material in Android release builds

NativeScript's debug runtime includes Material, but a release build needs an explicit dependency in `App_Resources/Android/app.gradle`:

```groovy
dependencies {
  implementation "com.google.android.material:material:1.12.0"
}
```

`supportsNativeTabs()` reports whether Material is available. The bar uses the app's Material theme when present; otherwise it applies a Material theme just to the widget, including its badges. Without the dependency, `<RouterTabs>` uses the core bottom `TabView` and keeps named selection and independent stacks; Material badges and the rail are unavailable.

## Other tab containers

Any tab container works, though. Use one `<RouterView>` per stack and name it:

```vue
<TabView>
  <TabViewItem title="Inbox">
    <RouterView name="inbox" initial="/" backToRootOnReselect />
  </TabViewItem>
  <TabViewItem title="Settings">
    <RouterView name="settings" initial="/settings" backToRootOnReselect />
  </TabViewItem>
</TabView>
```

Pages navigate in their own tab. From anywhere else, target one with `{ frame: 'settings' }`.

## Tapping the active tab

`backToRootOnReselect` applies only to a new tap on the tab that is already selected. Switching to another tab preserves both histories. Updating `v-model:selected` or navigating/deep-linking into another tab does not count as a reselect. A refused `canSelect` leaves selection and histories unchanged; a leave guard can refuse a reselect-to-root.

Native tab bars go back to the first page when you tap the tab you're already on. `backToRootOnReselect` does that for a `<RouterView>` inside a `<TabViewItem>`, through the leave guards like any back. `router.backToRoot()` does the same on demand.

On iOS, the router listens in front of the tab bar's delegate, which otherwise answers "no" to the repeated tap and tells no one. On Android, it watches the tab strip's touches, since its own click listener only switches tabs.

## Tabs that haven't been shown yet

On iOS, a `TabView` only loads the selected tab. A `<RouterView>` in another tab waits for its first page until that tab is opened, and a navigation into it (a deep link, for example) waits with it. Navigations in the other stacks aren't held up.

Inside `<RouterTabs>`, targeting `{ frame: 'settings' }` selects the tab before the page shows. With a plain `TabView`, update its `selectedIndex` yourself, then await `router.push(to, { frame: 'settings' })`. Names must be unique across `RouterView` and `RouterSplitView`.
