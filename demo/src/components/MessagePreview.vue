<script lang="ts" setup>
import { computed } from 'nativescript-vue'
import { inbox } from '../store'
import { initials, tone } from '../ui'

// rendered inside the context menu's preview: its own Vue app, not a page in the stack
const props = defineProps<{ id: number }>()
const message = computed(() => inbox.find(props.id))
</script>

<template>
  <StackLayout class="message-preview">
    <GridLayout rows="auto" columns="auto, *">
      <GridLayout class="avatar" :backgroundColor="tone(message?.from ?? '')">
        <Label
          :text="initials(message?.from ?? '')"
          horizontalAlignment="center"
          verticalAlignment="middle"
        />
      </GridLayout>
      <StackLayout col="1" marginLeft="12" verticalAlignment="middle">
        <Label class="headline" :text="message?.subject" textWrap="true" />
        <Label class="caption" :text="`${message?.from} · ${message?.at}`" />
      </StackLayout>
    </GridLayout>
    <Label class="body" :text="message?.body" textWrap="true" marginTop="12" />
  </StackLayout>
</template>
