<script lang="ts" setup>
import { useRouter } from 'vue-router-ns'
import { session } from '../store'

const router = useRouter()

function signOut() {
  session.user = ''
  router.push('/settings', { clearHistory: true })
}
</script>

<template>
  <Page>
    <ActionBar title="Account" />

    <StackLayout class="section">
      <Label class="title" :text="session.user" />
      <Label
        class="muted"
        text="Only reachable with a session: a guard checks it."
        textWrap="true"
      />
      <Button class="button secondary" text="Sign out" @tap="signOut" />
    </StackLayout>
  </Page>
</template>
