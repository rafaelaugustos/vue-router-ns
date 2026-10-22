<script setup lang="ts">
import { ref } from 'nativescript-vue'
import { RouterView } from 'vue-router-ns'
import Splash from './Splash.vue'

const showSplash = ref(true)
</script>

<template>
  <GridLayout>
    <GridLayout :isUserInteractionEnabled="!showSplash" :accessibilityHidden="showSplash">
      <RouterView />
    </GridLayout>
    <Splash v-if="showSplash" @done="showSplash = false" />
  </GridLayout>
</template>
