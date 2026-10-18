<script lang="ts" setup>
import { ApplicationSettings } from '@nativescript/core'
import { onMounted, ref, watch } from 'nativescript-vue'
import { useRouter, type RouterDrawerHandle } from 'vue-router-ns'
import { drawer } from './drawer'
import { counts } from './store'

const router = useRouter()
const menu = ref<RouterDrawerHandle>()
const tab = ref(ApplicationSettings.getString('selected-tab', 'inbox'))
watch(tab, (name) => ApplicationSettings.setString('selected-tab', name))
onMounted(() => {
  drawer.value = menu.value ?? null
})

// destinations go through the links policy, which also selects the tab
const destinations = [
  { title: 'Inbox', to: '/' },
  { title: 'Settings', to: '/settings' },
  { title: 'Account', to: '/settings/account' },
  { title: 'New message', to: '/compose' },
]
const isSelected = (to: string) => {
  const path = router.currentRoute.value.path
  if (to === '/') return path === '/' || path.startsWith('/messages/')
  return path === to
}
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
        <Button
          v-for="destination of destinations"
          :key="destination.to"
          class="drawer-item"
          :class="{ selected: isSelected(destination.to) }"
          :text="destination.title"
          :accessibilityLabel="destination.title"
          :accessibilityState="isSelected(destination.to) ? 'selected' : undefined"
          @tap="router.openLink(destination.to)"
        />
      </StackLayout>
    </template>

    <!-- UITabBarController with UITab on iOS (sidebar on iPad, minimizing bar on iOS 26); Material bottom navigation or rail on Android -->
    <RouterTabs v-model:selected="tab" sidebar minimize="onScrollDown">
      <RouterTab
        name="inbox"
        title="Inbox"
        icon="tray.fill"
        androidIcon="sys://ic_dialog_email"
        :badge="counts.unread || null"
      >
        <RouterSplitView name="inbox" list="/" backToRootOnReselect>
          <template #empty>
            <StackLayout verticalAlignment="middle" horizontalAlignment="center">
              <Label class="emoji" text="✉️" />
              <Label text="Select a message" class="muted" textAlignment="center" />
            </StackLayout>
          </template>
        </RouterSplitView>
      </RouterTab>
      <RouterTab
        name="settings"
        title="Settings"
        icon="gearshape.fill"
        androidIcon="sys://ic_menu_preferences"
      >
        <RouterView name="settings" initial="/settings" backToRootOnReselect />
      </RouterTab>
    </RouterTabs>
  </RouterDrawer>
</template>
