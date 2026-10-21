<script setup lang="ts">
import { useRouter } from 'vue-router-ns'
import { useDraft } from '../state'

const router = useRouter()
useDraft()
</script>
<template>
  <StackLayout class="content">
    <Label id="page-heading" text="Make it yours." class="heading" accessible="true" />
    <Label text="Pick a cover for your next chapter." class="subtitle" />
    <Button text="Ocean" class="primary" @tap="router.back({ result: 'Ocean' })" />
    <Button text="Terracotta" @tap="router.back({ result: 'Terracotta' })" />
    <Button text="Cancel" @tap="router.back()" />
  </StackLayout>
</template>
