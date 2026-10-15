<script setup lang="ts">
import { useRouter } from 'vue-router-ns'

const router = useRouter()
</script>

<template>
  <Page>
    <ActionBar title="Router playground" />
    <StackLayout padding="20">
      <Label
        text="Open an item, push another, then go back. Widen the window to keep this list beside the detail."
        textWrap="true"
      />
      <Button
        v-for="id in [1, 2, 3]"
        :key="id"
        :text="`Item ${id}`"
        @tap="router.push({ name: 'item', params: { id } })"
      />
    </StackLayout>
  </Page>
</template>
