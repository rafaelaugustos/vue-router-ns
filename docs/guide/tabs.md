# Tabs and other independent stacks

See [native capabilities and container choices](./capabilities) for ownership, platform boundaries and the rc.2/rc.3 distinction.

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

## Hide navigation on a detail page

Set `meta.tabBarVisibility` on a route. The selected tab's committed top page controls its owning `RouterTabs`:

```ts
const router = createRouter({
  routes: [
    { path: '/inbox', component: Inbox },
    {
      path: '/inbox/detail',
      component: Message,
      meta: { tabBarVisibility: 'hidden' },
    },
    { path: '/saved', component: Saved },
  ],
})

// From Inbox: the existing Frame pushes Message and the bar disappears.
await router.push('/inbox/detail', { frame: 'inbox' })
// Native Back or router.back() restores Inbox and its bar.
```

Use this route table with the two `RouterTab` / `RouterView` stacks above. Keep a native Back button or another way back on hidden pages.

| Value                | Meaning                                                                           |
| -------------------- | --------------------------------------------------------------------------------- |
| `hidden`             | Hide the supported bottom bar or Material rail and release its layout space.      |
| `visible`            | Show navigation, including inside a parent route marked `hidden`.                 |
| `inherit` or omitted | Use the nearest matched parent with an explicit value; otherwise show navigation. |

Inheritance follows matched route records, not the previous page in history. Explicit routes and file routes (`definePageMeta({ meta: { tabBarVisibility: 'hidden' } })`) use the same policy.

The policy changes **after native navigation commits**, without adding an animation. Push, replace, native Back, root resets, restoration and incoming links all use the committed route. A pending/rejected guard, failed page load or cancelled interactive Back keeps the current presentation. During an interactive gesture, the current page's bar state stays in place until completion; reduced motion does not gain an extra bar animation.

Each tab remembers its own policy. Selecting another tab uses that tab's current page; it preserves both histories and page instances. A modal leaves its presenting tabs unchanged. A nested `RouterTabs` owns its own policy, and separate containers/windows do not share it. Use one `RouterView` or `RouterSplitView` per tab; for split navigation, the logical top route supplies the policy. Disposal restores the original UIKit state.

| Host                                                  | Support                                                                                                                                      |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| iOS 18+ bottom tab bar                                | Public UIKit `setTabBarHidden:animated:`; UIKit recalculates the safe area.                                                                  |
| `sidebar` on iOS                                      | Keeps native navigation visible, including compact presentations. Disable `sidebar` to use per-page hiding.                                  |
| Android Material bottom bar / rail                    | Collapses the native view and its auto-sized layout row/column; hidden navigation is excluded from accessibility.                            |
| Older UIKit / Android Core fallback / plain `TabView` | No per-page hiding. The existing navigation remains visible. `supportsNativeTabs()` alone does not check the iOS version/sidebar limitation. |

<div class="clips">
<Clip name="ios-tabs-visibility" caption="Detail pages hide the bar; committed navigation restores it. iOS 26 simulator." />
<Clip name="android-tabs-visibility" aspect="9 / 20" caption="Material bottom bar and rail release their space without replacing the page. Android 14 emulator." />
</div>

Runnable example: [`demo/src/testing/tabsvisibility-app.ts`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/testing/tabsvisibility-app.ts). Build the package, then run `ns run ios --env.tabsvisibilityTest` or `ns run android --env.tabsvisibilityTest` in `demo`. [Native acceptance instructions](https://github.com/rafaelaugustos/vue-router-ns/tree/main/scripts/native/tabs-visibility) cover real gestures, guards, layout, restoration and cold links.

## Colors and labels

Use NativeScript's existing tab color names on `RouterTabs`. These update the current native bar without remounting pages or resetting histories:

```vue
<script setup lang="ts">
import { ref } from 'nativescript-vue'
import { RouterTabs, RouterTab, RouterView } from 'vue-router-ns'
const dark = ref(false)
</script>

<template>
  <RouterTabs
    :tabBackgroundColor="dark ? '#172033' : '#f1f5f9'"
    :tabTextColor="dark ? '#cbd5e1' : '#475569'"
    :selectedTabTextColor="dark ? '#38bdf8' : '#2563eb'"
    labelVisibility="labeled"
  >
    <RouterTab
      name="inbox"
      title="Inbox"
      icon="tray.fill"
      androidIcon="sys://ic_dialog_email"
      :badge="2"
    >
      <RouterView name="inbox" initial="/inbox" />
    </RouterTab>
    <RouterTab
      name="saved"
      title="Saved"
      icon="bookmark.fill"
      androidIcon="sys://ic_menu_save"
    >
      <RouterView name="saved" initial="/saved" />
    </RouterTab>
  </RouterTabs>
</template>
```

| Prop                   | CSS                       | Meaning                                                                                          |
| ---------------------- | ------------------------- | ------------------------------------------------------------------------------------------------ |
| `tabBackgroundColor`   | `tab-background-color`    | Native bar background/tint.                                                                      |
| `tabTextColor`         | `tab-text-color`          | Unselected titles; also template icons on UIKit and Material.                                    |
| `selectedTabTextColor` | `selected-tab-text-color` | Selected titles; also template icons on UIKit and Material.                                      |
| `labelVisibility`      | —                         | Material: `auto`, `selected`, `labeled` or `unlabeled`. Omit to use the widget's themed default. |

Color props accept a string or NativeScript `Color`. You can instead use a class on `RouterTabs`:

```css
.app-tabs {
  tab-background-color: #f1f5f9;
  tab-text-color: #475569;
  selected-tab-text-color: #2563eb;
}
.ns-dark .app-tabs {
  tab-background-color: #172033;
  tab-text-color: #cbd5e1;
  selected-tab-text-color: #38bdf8;
}
```

The class is applied to the native root (`TabView` on iOS/core fallback, `RouterTabsHost` on Material). Use a class selector for both platforms. These tab colors do not inherit from a parent and do not change page colors. Explicit props and inline style are local NativeScript values and take precedence over stylesheet rules; avoid setting the same color through both. Omitted colors retain the platform/theme defaults. Fixed colors do not automatically invert in dark mode: bind a palette or use NativeScript's light/dark CSS classes. Changing a palette or class updates the existing widget, including a rail created after resizing.

Material supports all four label modes on both bottom navigation and rail. Hiding a label preserves its title and accessibility description. UIKit and core `TabView` ignore `labelVisibility` and keep their native title layout. Core Android fallback supports the three existing color properties for background/text; icon tint remains Core's behavior. Material remains optional.

On iOS, these colors style the **tab bar** using Core's appearance APIs and UIKit template-icon tint. They do not theme the iPad sidebar. UIKit controls sidebar rows, placement, title visibility and iOS 26 Liquid Glass compositing; the rendered background may be translucent rather than a flat exact color. In the iOS 26 acceptance recording, UIKit also retains the system color for the unselected SF Symbol despite accepting the configured icon tint; titles and the selected icon do change. Do not depend on exact unselected-icon coloring on that version. Existing `TabView` CSS (including title fonts) keeps working on that host; extra Core-only properties are not a cross-platform Material contract.

<div class="clips">
<Clip name="ios-tabs-style" caption="Changing tab colors with detail pages open. iOS 26 simulator." />
<Clip name="android-tabs-style" aspect="9 / 20" caption="Colors, labels and Material rail change while both stacks remain mounted. Android 14 emulator." />
</div>

Run the [shared example](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/testing/tabsstyle-app.ts) with `cd demo && ns run ios --env.tabsstyleTest` (or `ns run android --env.tabsstyleTest`). It includes palette, label and rail controls and a draft field. See [native acceptance](https://github.com/rafaelaugustos/vue-router-ns/blob/main/scripts/native/tabs-style/README.md) for the automated checks.

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

## Native iPad drag/drop {#native-drag-drop}

The optional [drag/drop recipe](https://github.com/rafaelaugustos/vue-router-ns/tree/main/examples/drag-drop) opens a document in another retained tab using UIKit interactions and the existing navigation-intent pipeline. The app explicitly registers the receiving router, window and Frame. Hover highlights the target; only dropping loads and validates the asynchronous item before calling `openIntent` through normal guards.

This recipe accepts one versioned JSON destination and offers copy/open only. It rejects unsupported or multiple items, oversized or invalid data, expiry, removed routes and changed owners. Disposal cancels pending provider work. Accepted transfer and completed navigation are separate outcomes; a guard can refuse navigation after transfer, and the target tab may already be visible. Source content is never deleted or moved.

An ordinary native button and Control–O use the same policy with source `internal`. Both retained Pages and their independent drafts survive. The [runnable fixture and reproduction steps](https://github.com/rafaelaugustos/vue-router-ns/tree/main/scripts/native/drag-drop) include actual drags, cancellation, replay, a slow provider, guard refusal and the non-drag commands.

<Clip name="drag-drop-tabs" :width="480" aspect="3 / 4" caption="Nine real UIKit drags and button/keyboard alternatives between retained tabs. iPad iOS 18.6 simulator." />

The [acceptance report](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-drag-drop-stage1.md) covers one iPad simulator window. Stage Manager and physical-device VoiceOver remain later stages of #181. Android coverage is documented below.

### Between app windows {#cross-window-drag-drop}

The [window recipe](https://github.com/rafaelaugustos/vue-router-ns/blob/main/examples/drag-drop/windows.md) binds each drop view to its own router and account registration. Both windows can name their Frame `main`: the receiving window selects the destination. The local drag-session origin is diagnostic context, never permission or routing authority.

The native example opens a second scene with public UIKit standard placement before dragging. Seven real gestures cross the visible windows or cancel in the source. Guard refusal, account changes, document removal and closing the receiver during asynchronous loading preserve the source. An ordinary button reaches the same destination without dragging.

<Clip name="drag-drop-windows" :width="480" aspect="3 / 4" caption="Dragging between two real app windows, then closing the receiver while its provider is pending. iPad iOS 18.6 simulator." />

[Stage 2 evidence and reproduction](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-window-drop-stage2.md) cover same-process windows in Split View. Placement remains an OS preference; creating a window by dragging, sidebar targets, Stage Manager and physical-device/screen-reader acceptance remain outside this stage.

## Android drag/drop {#android-drag-drop}

The optional [Android recipe](https://github.com/rafaelaugustos/vue-router-ns/blob/main/examples/drag-drop/android.md) uses local, same-Activity text `ClipData` and an explicit receiving tab. Hover does not navigate; dropping validates one JSON destination through the shared policy and normal guards. It offers copy/open only, without URI grants, external-app transfers or an asynchronous OS provider.

An ordinary button and Control–O call the same policy with source `internal`. Native Android 14 emulator acceptance also enables TalkBack, verifies touch-exploration focus on the button and activates it with a double tap. Both Pages and their independent drafts stay retained.

<Clip name="android-drag-drop" aspect="9 / 20" caption="Ten native Android drags, guard refusal and button/keyboard/TalkBack alternatives. Android 14 emulator." />

[Stage 3 evidence and reproduction](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-android-drop-stage3.md) cover one Activity, real input and TalkBack focus/activation. Physical devices, recorded speech, cross-Activity/global drags and new windows remain outside this stage.

### Login after dropping {#drop-login}

The [login recipe](https://github.com/rafaelaugustos/vue-router-ns/blob/main/examples/drag-drop/login.md) adds an optional typed `handoff` after drop validation. The default still calls `openIntent`. For a protected destination, the app uses `suspendIntent`, presents Login in the receiving tab and resumes only after authentication and current permission checks.

The delivery identity stays reserved through login. Only the login continuation uses `replace: true`; already authenticated requests preserve their history policy. Cancel and native Back invalidate the pending request. Account changes, expiry, removed routes and permission revocation during a waiting guard cannot open a stale destination. Button and keyboard alternatives use source `internal`.

<Clip name="drop-login" aspect="9 / 20" caption="Eleven real Android drags through controlled sign-in, native Back and revocation during a guard. Android 14 emulator." />

The [stage 4 report](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-drop-login-stage4.md) separates accepted native transfer, pending authentication and completed navigation. The fixture controls authentication state and preserves both Pages and drafts; it uses no external identity provider. This combined flow is recorded on one Android emulator Activity, without additional iPad, physical-device or screen-reader claims.
