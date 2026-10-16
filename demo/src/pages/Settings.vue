<script lang="ts" setup>
import { NavigationCommandScope } from 'vue-router-ns'
import { useDemoCommands } from '../navigation-commands'

import { RouterLink } from 'vue-router-ns'
import StackTrail from '../components/StackTrail.vue'
import { session } from '../store'

const diagnosticsEnabled = __DEV__
const commands = useDemoCommands()
</script>

<template>
  <Page>
    <ActionBar title="Settings" />

    <NavigationCommandScope :commands="commands" rows="*, auto">
      <StackLayout class="section">
        <Label
          class="muted"
          :text="session.user ? `Signed in as ${session.user}` : 'Not signed in'"
        />

        <RouterLink to="/settings/account">
          <Button class="button" text="Account" />
        </RouterLink>

        <RouterLink to="/does/not/exist">
          <Button class="button secondary" text="A page that does not exist" />
        </RouterLink>

        <RouterLink v-if="diagnosticsEnabled" to="/diagnostics">
          <Button class="button secondary" text="Navigation diagnostics" />
        </RouterLink>
      </StackLayout>
      <StackTrail row="1" />
    </NavigationCommandScope>
  </Page>
</template>
