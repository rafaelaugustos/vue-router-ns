<script setup lang="ts">
import { Dialogs } from '@nativescript/core'
import { computed, ref } from 'nativescript-vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router-ns'

const router = useRouter()
const text = ref('')
const submitting = ref(false)
const dirty = computed(() => text.value.trim().length > 0 && !submitting.value)
onBeforeRouteLeave(() => Dialogs.confirm('Discard this draft?'), { when: dirty })

async function send() {
  submitting.value = true
  try {
    await router.back({ result: text.value })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Page>
    <ActionBar title="Compose" />
    <StackLayout padding="20">
      <Label
        text="Write a draft and cancel to try the leave guard, or send it back to the item."
        textWrap="true"
      />
      <TextView v-model="text" hint="Your reply" height="160" />
      <Button text="Send result" @tap="send" />
      <Button text="Cancel" @tap="router.back()" />
    </StackLayout>
  </Page>
</template>
