<script setup lang="ts">
import { RouterDrawer, RouterView } from 'vue-router-ns'
import { drawer } from './state'
import { router } from './router'
</script>
<template>
  <RouterDrawer ref="drawer" :width="290">
    <template #drawer>
      <StackLayout class="menu">
        <Label text="FIELDNOTES" class="eyebrow" />
        <Label text="A place for small discoveries." class="menu-title" textWrap="true" />
        <Button
          text="Library"
          automationText="Library destination"
          accessibilityLabel="Library"
          :accessibilityState="
            router.currentRoute.value.path === '/' ? 'selected' : undefined
          "
          @tap="router.backToRoot()"
        />
        <Button
          text="About this example"
          automationText="About destination"
          @tap="router.push('/about')"
        />
        <Label
          text="Native navigation, from list to detail."
          class="muted"
          textWrap="true"
          marginTop="28"
        />
      </StackLayout>
    </template>
    <RouterView />
  </RouterDrawer>
</template>
