<script setup lang="ts">
import { useRoute, useNavigationFocus } from 'vue-router-ns'
import { focusOwners, status } from '../state'
const route = useRoute()
const focus = useNavigationFocus({ initial: 'page-heading', return: 'page-heading' })
if (__FILE_ROUTING_TEST__) focusOwners.set(route.fullPath, focus)
</script>
<template>
  <Page class="screen">
    <ActionBar :title="String(route.meta.title ?? 'Native collection')" />
    <GridLayout rows="*,auto">
      <slot />
      <Label v-if="status" row="1" :text="status" class="status" textWrap="true" />
    </GridLayout>
  </Page>
</template>
