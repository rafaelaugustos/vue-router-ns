<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router-ns'
import { useDraft, signedIn } from '../state'

const router = useRouter(),
  route = useRoute(),
  draft = useDraft('')
function signIn() {
  signedIn.value = true
  void router.replace(String(route.query.next ?? '/account'))
}
</script>
<template>
  <StackLayout class="content">
    <Label
      id="page-heading"
      text="Your collection awaits."
      class="heading"
      textWrap="true"
      accessible="true"
    />
    <Label text="This example uses a local demo session." class="subtitle" />
    <TextField v-model="draft" hint="Your name" />
    <Button text="Continue" class="primary" @tap="signIn" />
    <Button text="Back" @tap="router.back()" />
  </StackLayout>
</template>
