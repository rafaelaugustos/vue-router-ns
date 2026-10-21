<script setup lang="ts">
import { useRouter } from 'vue-router-ns'
import { signedIn, useDraft } from '../state'

const router = useRouter()
useDraft()
function signOut() {
  signedIn.value = false
  void router.back()
}
</script>
<template>
  <StackLayout class="content">
    <Label id="page-heading" text="All yours." class="heading" accessible="true" />
    <Label text="Your session opened this native page." class="subtitle" />
    <Button text="Sign out" @tap="signOut" />
  </StackLayout>
</template>
