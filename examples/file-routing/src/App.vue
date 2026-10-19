<script setup lang="ts">
import { RouterTabs, RouterTab, RouterView } from 'vue-router-ns'
</script>
<template>
  <RouterTabs>
    <RouterTab
      name="shop"
      title="Discover"
      icon="square.grid.2x2"
      androidIcon="sys://ic_menu_view"
    >
      <RouterView />
    </RouterTab>
    <RouterTab
      name="saved"
      title="Saved"
      icon="bookmark"
      androidIcon="sys://ic_menu_save"
    >
      <RouterView name="saved" initial="/saved" />
    </RouterTab>
  </RouterTabs>
</template>
