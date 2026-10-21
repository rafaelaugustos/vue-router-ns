<script lang="ts" setup>
import { Dialogs } from '@nativescript/core'
import { ref } from 'nativescript-vue'
import { onBeforeRouteLeave, usePageState, useRoute, useRouter } from 'vue-router-ns'
import { session } from '../store'

const router = useRouter()
const route = useRoute('login')
const name = ref('')

// a half-typed name survives Android killing the app in the background
usePageState<{ name: string }>('form', {
  save: () => (name.value ? { name: name.value } : undefined),
  restore: (value) => (name.value = value.name),
})

// asks on back, on the iOS back button and on a swipe, only while a name is typed
onBeforeRouteLeave(
  () =>
    Dialogs.confirm({
      title: 'Leave without signing in?',
      okButtonText: 'Leave',
      cancelButtonText: 'Stay',
    }),
  { when: () => name.value.trim() !== '' && !session.user },
)

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

    <StackLayout class="content center">
      <Label class="emoji" text="🔐" />
      <Label class="title" text="Welcome back" textAlignment="center" />
      <Label
        class="caption"
        text="Account needs a session. Your name is enough here."
        textWrap="true"
        textAlignment="center"
        marginTop="4"
        marginBottom="24"
      />
      <TextField
        v-model="name"
        class="field"
        hint="Your name"
        returnKeyType="done"
        width="100%"
        @returnPress="signIn"
      />
      <Button class="button" text="Sign in" width="100%" @tap="signIn" />
    </StackLayout>
  </Page>
</template>
