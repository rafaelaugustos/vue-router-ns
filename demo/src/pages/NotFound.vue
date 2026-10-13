<script lang="ts" setup>
import { useRoute, useRouter } from 'vue-router-ns'

const route = useRoute()
const router = useRouter()
</script>

<template>
  <Page>
    <ActionBar title="Not found" />

    <StackLayout class="section">
      <Label class="title" text="Nothing here" />
      <Label class="muted" :text="route.fullPath" />
      <Button class="button secondary" text="Go back" @tap="router.back()" />
    </StackLayout>
  </Page>
</template>
