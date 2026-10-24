# Native bars and search

To share state, asynchronous execution and error handling across the header, menu and keyboard, see [page actions](./page-actions).

Keep titles and actions in NativeScript's `ActionBar`. It owns the native Toolbar/UINavigationBar, delegates, and back button. Reactive titles and `ActionItem` bindings already work, including on return from detail. On iOS, `iosLargeTitle="true"` enables the native collapsing title; use a native scrolling view as the page content. Android has no equivalent large-title policy in the standard ActionBar.

<Clip name="ios-search" caption="The native search field filters the inbox without adding a route. iOS 26 simulator." />

## Search owned by a page

```vue
<script setup lang="ts">
import { computed, ref } from 'nativescript-vue'
import { useNativeSearch } from 'vue-router-ns'

const query = ref('')
const search = useNativeSearch({ query, placeholder: 'Search messages' })
const messages = ref([{ subject: 'Welcome' }])
const filtered = computed(() =>
  messages.value.filter((message) =>
    message.subject.toLowerCase().includes(query.value.toLowerCase()),
  ),
)
</script>

<template>
  <Page>
    <ActionBar title="Inbox" iosLargeTitle="true">
      <ActionItem text="Search" ios.position="right" @tap="search.activate()" />
    </ActionBar>
    <ListView :items="filtered">
      <template #default="{ item }"><Label :text="item.subject" /></template>
    </ListView>
  </Page>
</template>
```

`useNativeSearch({ query, placeholder?, onSubmit?, ios?: { hidesWhenScrolling?, placement? } })` registers once in the routed page's setup. `query` is an app-owned writable ref. Keep it in the page for its back-stack lifetime, or in a store for persistence across page removal/relaunch. Typing never pushes routes or changes URL queries; explicitly navigate on submit if that is your application's policy. `placeholder` accepts a string, ref or getter. `onSubmit(query)` is optional.

The result has a readonly `active` ref, `activate(): boolean`, and `dismiss(): boolean`. Activation requires the page to be loaded, current in its own Frame, in its selected tab and not covered by a modal. Dismissal closes the search UI/keyboard and preserves the query. Returning to a page does not automatically summon the keyboard. Both visible split panes can own their own search independently. A guard rejection leaves search untouched.

| Platform | Presentation                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| iOS 11+  | A page-local `UISearchController` in its `UINavigationItem`. By default the search field hides while scrolling; set `ios.hidesWhenScrolling: false` to keep it visible. `ios.placement` is `automatic`, `stacked`, `inline` or `integrated` (iOS 26, at the bottom). Inside a `TabView` the default is `stacked`, under the title: iOS 26's automatic placement puts the bar at the bottom, behind the tab bar. |
| Android  | NativeScript's `SearchBar` (`androidx.appcompat.widget.SearchView`) temporarily becomes the existing ActionBar's title view while active. The previous title view returns on dismissal. ActionItems remain owned by NativeScript.                                                                                                                                                                               |

Existing search controllers are left alone: activation returns false and development builds explain the conflict. Register only one search owner per page. Search bindings and native delegates are released on page disposal, router-host disposal and HMR replacement. No global bar or navigation delegate is replaced, and leave-guard `backAction` interception remains intact.

## Appearance beyond NativeScript styles

Prefer ActionBar `color`, `backgroundColor`, `flat`, `title`, `titleView` and ActionItems. If UIKit-specific appearance is needed, configure the **page's navigation item**, not a shared navigation bar. A loaded handler has access to `event.object.ios.navigationItem`:

```ts
function loaded({ object: page }) {
  if (!__IOS__ || !page.ios) return
  const appearance = UINavigationBarAppearance.new()
  appearance.configureWithDefaultBackground()
  page.ios.navigationItem.standardAppearance = appearance
  page.ios.navigationItem.scrollEdgeAppearance = appearance
}
```

This is an iOS 13+ application recipe and requires iOS typings. Preserve any existing per-item appearance if multiple application features modify it. Keep ActionItems declarative and do not assign `backAction` or replace navigation-controller delegates: the router uses those for guarded back navigation. UIKit restores the previous page's own navigation item on pop, including a cancelled interactive pop.

See [NativeScript ActionBar](https://docs.nativescript.org/ui/action-bar), [UISearchController](https://developer.apple.com/documentation/uikit/uisearchcontroller), and [page lifecycle](./pages).
