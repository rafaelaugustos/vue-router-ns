<script setup lang="ts">
import { useDraft } from '../state'

const draft = useDraft('A gift for Ana')
</script>
<template>
  <StackLayout class="content">
    <Label
      id="page-heading"
      text="Keep a little inspiration."
      class="heading"
      textWrap="true"
      accessible="true"
    />
    <TextField v-model="draft" hint="Your saved note" />
    <Label
      text="Your note stays here while you explore the other tab."
      class="subtitle"
      textWrap="true"
    />
  </StackLayout>
</template>
