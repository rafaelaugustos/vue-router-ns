<script lang="ts" setup>
import type { TabView } from '@nativescript/core'
import { onMounted, ref } from 'nativescript-vue'
import { useRouter, type RouterDrawerHandle } from 'vue-router-ns'
import { drawer } from './drawer'
import { tabs } from './tabs'

const router = useRouter()
const menu = ref<RouterDrawerHandle>()
const tabView = ref<{ nativeView: TabView }>()
onMounted(() => {
  drawer.value = menu.value ?? null
  tabs.value = tabView.value?.nativeView ?? null
})

// destinations go through the links policy, which also selects the tab
const destinations = [
  { title: 'Inbox', to: '/' },
  { title: 'Settings', to: '/settings' },
  { title: 'Account', to: '/settings/account' },
  { title: 'New message', to: '/compose' },
]
</script>

<template>
  <RouterDrawer ref="menu" :width="280">
    <template #drawer>
      <StackLayout class="section">
        <Label class="title" text="vue-router-ns" />
        <Button
          v-for="destination of destinations"
          :key="destination.to"
          class="button secondary"
          :text="destination.title"
          @tap="router.openLink(destination.to)"
        />
      </StackLayout>
    </template>

    <TabView ref="tabView" androidTabsPosition="bottom">
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
  </RouterDrawer>
</template>
