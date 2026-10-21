<script setup lang="ts">
import { definePageMeta } from 'vue-router-ns/file-routing'
import { capturePage } from '~/testing/file-state'

definePageMeta({
  modal: { fullscreen: true },
  layout: 'sheet',
  middleware: ['allowModal'],
})
const { route } = capturePage()
</script>

<template>
  <StackLayout><Label :text="'Generated modal ' + route.path" /></StackLayout>
</template>
