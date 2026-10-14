# Tabs and other independent stacks

Use one `<RouterView>` per stack and name it:

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

Native tab bars go back to the first page when you tap the tab you're already on. `backToRootOnReselect` does that for a `<RouterView>` inside a `<TabViewItem>`, through the leave guards like any back. `router.backToRoot()` does the same on demand.

On iOS, the router listens in front of the tab bar's delegate, which otherwise answers "no" to the repeated tap and tells no one. On Android, it watches the tab strip's touches, since its own click listener only switches tabs.

## Tabs that haven't been shown yet

On iOS, a `TabView` only loads the selected tab. A `<RouterView>` in another tab waits for its first page until that tab is opened, and a navigation into it (a deep link, for example) waits with it. Navigations in the other stacks aren't held up.
