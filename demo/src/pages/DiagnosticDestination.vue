<script lang="ts" setup>
import { useRoute } from 'vue-router-ns'

const heavy = useRoute().path.endsWith('/heavy')
if (heavy) {
  // Bounded, intentional main-thread work to make mounting visible in the demo.
  const until = Date.now() + 80
  while (Date.now() < until) {
    /* simulate expensive synchronous setup */
  }
}
</script>

<template>
  <Page>
    <ActionBar :title="heavy ? 'Heavy setup' : 'Slow guard'" />
    <StackLayout class="section">
      <Label
        class="title"
        :text="heavy ? '80ms synchronous setup' : '350ms asynchronous guard'"
        textWrap="true"
      />
      <Label
        class="muted"
        text="Go back to the inspector. The duration should appear in mount or guard, respectively. The transition span also includes synchronous mounting."
        textWrap="true"
      />
    </StackLayout>
  </Page>
</template>
