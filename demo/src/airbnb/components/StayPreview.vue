<script setup lang="ts">
import type { Stay } from '../data'
import { stayTotal } from '../utils/stays'

defineProps<{ stay: Stay }>()
</script>

<template>
  <StackLayout backgroundColor="#ffffff">
    <Image :src="stay.image" height="210" stretch="aspectFill" />
    <StackLayout padding="20">
      <Label
        :text="stay.title"
        fontSize="19"
        fontWeight="700"
        textWrap="true"
        color="#222222"
      />
      <Label :text="stay.location" marginTop="8" color="#717171" textWrap="true" />
      <Label
        :text="`${stayTotal(stay)} total · ★ ${stay.rating}`"
        marginTop="12"
        fontWeight="600"
        color="#222222"
      />
    </StackLayout>
  </StackLayout>
</template>
