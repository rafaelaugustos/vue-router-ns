<script setup lang="ts">
import { computed, ref } from 'nativescript-vue'
import { useRoute, useRouter } from 'vue-router-ns'

const router = useRouter()
const route = useRoute('item')
const next = computed(() => Number(route.params.id) + 1)
const trail = computed(() =>
  router.stack.value.map((entry) => entry.fullPath).join(' → '),
)
const reply = ref('')

async function compose() {
  const result = await router.pushForResult<string>('/compose')
  if (result !== undefined) reply.value = result
}
</script>

<template>
  <Page>
    <ActionBar :title="`Item ${route.params.id}`" />
    <StackLayout padding="20">
      <Label :text="trail" textWrap="true" />
      <Button
        :text="`Push item ${next}`"
        @tap="router.push({ name: 'item', params: { id: next } })"
      />
      <Button text="Compose a reply" @tap="compose" />
      <Label :text="reply ? `Reply: ${reply}` : 'No reply yet'" textWrap="true" />
      <Button text="Back one page" @tap="router.back()" />
      <Button text="Back to list" @tap="router.backToRoot()" />
    </StackLayout>
  </Page>
</template>
