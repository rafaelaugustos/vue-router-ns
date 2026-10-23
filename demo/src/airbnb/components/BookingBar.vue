<script setup lang="ts">
import type { Stay } from '../data'
import { stayTotal } from '../utils/stays'

withDefaults(defineProps<{ stay: Stay; bottomInset?: number }>(), { bottomInset: 0 })
const emit = defineEmits<{ reserve: [] }>()
</script>

<template>
  <GridLayout columns="*, 145" class="booking-bar" :paddingBottom="15 + bottomInset">
    <StackLayout verticalAlignment="middle">
      <Label
        fontSize="17"
        fontWeight="700"
        textDecoration="underline"
        :text="`${stayTotal(stay)} total`"
      />
      <Label :text="stay.dates" fontSize="13" textDecoration="underline" marginTop="5" />
    </StackLayout>
    <Button
      col="1"
      class="primary"
      text="Reservar"
      borderRadius="28"
      marginTop="0"
      @tap="emit('reserve')"
    />
  </GridLayout>
</template>

<style scoped>
.booking-bar {
  background-color: #ffffff;
  border-top-width: 1;
  border-top-color: #ebebeb;
  padding: 15 24;
}
</style>
