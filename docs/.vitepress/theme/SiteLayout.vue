<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'
import { useRoute } from 'vitepress'
import OrbitSignature from './OrbitSignature.vue'
import VersionBadge from './VersionBadge.vue'
import DocsExperience from './experience/DocsExperience.vue'
import { provideMotionPreference } from './experience/motion'
provideMotionPreference()
const route = useRoute()
</script>

<template>
  <DefaultTheme.Layout>
    <template #nav-bar-title-after><VersionBadge /></template>
    <template #doc-before><DocsExperience :key="route.path" /></template>
    <template #layout-bottom><OrbitSignature /></template>
  </DefaultTheme.Layout>
</template>
