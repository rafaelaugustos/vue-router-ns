<script lang="ts" setup>
import { computed } from 'nativescript-vue'
import { useRouter } from 'vue-router-ns'

// inside a page, this is the stack of the tab (or modal) the page lives in
const { stack } = useRouter()
const trail = computed(() => stack.value.map((route) => route.path).join('  ›  '))
</script>

<template>
  <Label class="trail" :text="trail" />
</template>
