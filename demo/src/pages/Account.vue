<script lang="ts" setup>
import { useRouter } from 'vue-router-ns'
import { session } from '../store'
import { initials, tone } from '../ui'

const router = useRouter()

function signOut() {
  session.user = ''
  router.push('/settings', { clearHistory: true })
}
</script>

<template>
  <Page>
    <ActionBar title="Account" />

    <StackLayout class="content">
      <StackLayout class="card center" paddingTop="24" paddingBottom="24">
        <GridLayout class="avatar large" :backgroundColor="tone(session.user)">
          <Label
            :text="initials(session.user)"
            horizontalAlignment="center"
            verticalAlignment="middle"
          />
        </GridLayout>
        <Label class="title" :text="session.user" marginTop="12" />
        <Label
          class="caption"
          text="Only reachable with a session: a guard checks it."
          textWrap="true"
          textAlignment="center"
          marginTop="4"
        />
      </StackLayout>
      <Button class="button danger" text="Sign out" @tap="signOut" />
    </StackLayout>
  </Page>
</template>
