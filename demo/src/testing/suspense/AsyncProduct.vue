<script setup lang="ts">
import { consumeProduct } from './data'

const { product, consumer } = consumeProduct()
const ready = product.ready
await ready
const current = product.ready === ready && !consumer.disposed
if (current && product.status.value === 'error') throw product.error.value
const data = current ? product.data.value : undefined
if (data) consumer.resolved = true
</script>

<template>
  <StackLayout v-if="data" padding="16" backgroundColor="#edf8f1">
    <Label :text="data.title" fontSize="24" accessibilityLabel="Loaded product" />
    <Label :text="'$' + data.price" />
  </StackLayout>
</template>
