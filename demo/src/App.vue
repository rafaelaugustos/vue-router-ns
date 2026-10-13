<template>
  <TabView androidTabsPosition="bottom">
    <TabViewItem title="Inbox">
      <RouterView name="inbox" initial="/" />
    </TabViewItem>
    <TabViewItem title="Settings">
      <RouterView name="settings" initial="/settings" />
    </TabViewItem>
  </TabView>
</template>
