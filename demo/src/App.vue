<template>
  <TabView androidTabsPosition="bottom">
    <TabViewItem title="Inbox">
      <RouterSplitView name="inbox" list="/" backToRootOnReselect>
        <template #empty>
          <Label
            text="Select a message"
            class="muted"
            horizontalAlignment="center"
            verticalAlignment="middle"
          />
        </template>
      </RouterSplitView>
    </TabViewItem>
    <TabViewItem title="Settings">
      <RouterView name="settings" initial="/settings" backToRootOnReselect />
    </TabViewItem>
  </TabView>
</template>
