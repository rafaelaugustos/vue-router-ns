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
  { icon: '📥', title: 'Inbox', to: '/' },
  { icon: '⚙️', title: 'Settings', to: '/settings' },
  { icon: '👤', title: 'Account', to: '/settings/account' },
  { icon: '✍️', title: 'New message', to: '/compose' },
]
</script>

<template>
  <RouterDrawer ref="menu" :width="280">
    <template #drawer>
      <StackLayout>
        <StackLayout class="drawer-header">
          <Label class="title" text="vue-router-ns" />
          <Label
            class="caption"
            text="Every item opens through the links policy."
            textWrap="true"
          />
        </StackLayout>
        <GridLayout
          v-for="destination of destinations"
          :key="destination.to"
          class="drawer-item"
          rows="auto"
          columns="32, *"
          @tap="router.openLink(destination.to)"
        >
          <Label :text="destination.icon" />
          <Label col="1" :text="destination.title" />
        </GridLayout>
      </StackLayout>
    </template>

    <TabView ref="tabView" androidTabsPosition="bottom">
      <TabViewItem title="Inbox">
        <RouterSplitView name="inbox" list="/" backToRootOnReselect>
          <template #empty>
            <StackLayout verticalAlignment="middle" horizontalAlignment="center">
              <Label class="emoji" text="✉️" />
              <Label text="Select a message" class="muted" textAlignment="center" />
            </StackLayout>
          </template>
        </RouterSplitView>
      </TabViewItem>
      <TabViewItem title="Settings">
        <RouterView name="settings" initial="/settings" backToRootOnReselect />
      </TabViewItem>
    </TabView>
  </RouterDrawer>
</template>
