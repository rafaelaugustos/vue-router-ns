<template>
  <TabView androidTabsPosition="bottom">
    <TabViewItem title="Inbox">
      <RouterView name="inbox" initial="/" backToRootOnReselect />
    </TabViewItem>
    <TabViewItem title="Settings">
      <RouterView name="settings" initial="/settings" backToRootOnReselect />
    </TabViewItem>
  </TabView>
</template>
