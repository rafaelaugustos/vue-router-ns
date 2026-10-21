<script setup lang="ts">
const title = 'Two ways. One native router.'
</script>
<template>
  <StackLayout class="content">
    <Label
      id="page-heading"
      :text="title"
      class="heading"
      accessible="true"
      textWrap="true"
    />
    <Label
      text="This page uses an explicit route declaration alongside the generated collection pages."
      class="subtitle"
      textWrap="true"
    />
  </StackLayout>
</template>
