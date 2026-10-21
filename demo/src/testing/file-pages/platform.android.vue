<script setup lang="ts">
import { definePageMeta } from 'vue-router-ns/file-routing'
import { FilePage } from '~/testing/file-state'

definePageMeta({ meta: { platform: 'android' } })
</script>

<template><FilePage /></template>
