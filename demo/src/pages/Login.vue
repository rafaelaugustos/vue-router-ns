<script lang="ts" setup>
import { ref } from 'nativescript-vue'
import { useRoute, useRouter } from 'vue-router-ns'
import { session } from '../store'

const router = useRouter()
const route = useRoute('login')
const name = ref('')

function signIn() {
  if (!name.value.trim()) return
  session.user = name.value.trim()

  // swap this page for the one the guard stopped us from opening
  const next = route.query.next
  router.replace(typeof next === 'string' ? next : '/settings')
}
</script>

<template>
  <Page>
    <ActionBar title="Sign in" />

    <StackLayout class="section">
      <Label class="muted" text="Account needs a session." textWrap="true" />
      <TextField
        v-model="name"
        hint="Your name"
        returnKeyType="done"
        @returnPress="signIn"
        marginTop="12"
      />
      <Button class="button" text="Sign in" @tap="signIn" />
    </StackLayout>
  </Page>
</template>
