<script lang="ts" setup>
import { RouterLink } from 'vue-router-ns'
import StackTrail from '../components/StackTrail.vue'
import { session } from '../store'
</script>

<template>
  <Page>
    <ActionBar title="Settings" />

    <GridLayout rows="*, auto">
      <StackLayout class="section">
        <Label
          class="muted"
          :text="session.user ? `Signed in as ${session.user}` : 'Not signed in'"
        />

        <!-- the account page needs a session: a guard sends you to /login first -->
        <RouterLink to="/settings/account">
          <Button class="button" text="Account" />
        </RouterLink>

        <RouterLink to="/does/not/exist">
          <Button class="button secondary" text="A page that does not exist" />
        </RouterLink>
      </StackLayout>
      <StackTrail row="1" />
    </GridLayout>
  </Page>
</template>
