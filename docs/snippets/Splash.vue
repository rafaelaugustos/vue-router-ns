<script setup lang="ts">
import type { EventData, View } from '@nativescript/core'
import { onBeforeUnmount, ref } from 'nativescript-vue'
import { useRouter } from 'vue-router-ns'

const props = withDefaults(defineProps<{ fade?: boolean }>(), { fade: true })
const emit = defineEmits<{ done: [] }>()
const router = useRouter()
const failed = ref(false)
let started = false
let active = true

onBeforeUnmount(() => {
  active = false
})

async function reveal({ object }: EventData) {
  if (started) return
  started = true
  try {
    await router.isReady()
    if (!active) return
    // A guard can cancel initial navigation without throwing an error.
    if (!router.currentRoute.value.matched.length) {
      failed.value = true
      return
    }
  } catch (error) {
    if (active) failed.value = true
    console.error('Initial navigation failed', error)
    return
  }

  try {
    if (props.fade) await (object as View).animate({ opacity: 0, duration: 250 })
  } catch {
    // A cancelled animation must not leave a ready app behind the splash.
  }
  if (active) emit('done')
}
</script>

<template>
  <GridLayout backgroundColor="#0f172a" iosOverflowSafeArea="true" @loaded="reveal">
    <StackLayout verticalAlignment="middle" padding="32">
      <Label text="My app" color="white" fontSize="32" textAlignment="center" />
      <Label
        v-if="failed"
        text="Unable to open the first page. Please restart the app."
        color="white"
        textAlignment="center"
        textWrap="true"
      />
    </StackLayout>
  </GridLayout>
</template>
