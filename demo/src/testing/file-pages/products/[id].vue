<script setup lang="ts">
import { definePageMeta } from 'vue-router-ns/file-routing'
import { FilePage } from '~/testing/file-state'

definePageMeta({
  name: 'product',
  props: true,
  transition: 'fade',
  meta: { revision: 1 },
})
</script>

<template><FilePage /></template>
