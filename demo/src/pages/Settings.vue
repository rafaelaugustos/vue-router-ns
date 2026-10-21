<script lang="ts" setup>
import { NavigationCommandScope } from 'vue-router-ns'
import { useDemoCommands } from '../navigation-commands'

import { RouterLink } from 'vue-router-ns'
import StackTrail from '../components/StackTrail.vue'
import { session } from '../store'
import { initials, tone } from '../ui'

const diagnosticsEnabled = __DEV__
const commands = useDemoCommands()
</script>

<template>
  <Page>
    <ActionBar title="Settings" iosLargeTitle="true" />

    <NavigationCommandScope :commands="commands" rows="*, auto">
      <ScrollView>
        <StackLayout class="content">
          <GridLayout class="card" rows="auto" columns="auto, *">
            <GridLayout
              class="avatar large"
              :backgroundColor="session.user ? tone(session.user) : '#9ca3af'"
            >
              <Label
                :text="session.user ? initials(session.user) : '?'"
                horizontalAlignment="center"
                verticalAlignment="middle"
              />
            </GridLayout>
            <StackLayout col="1" verticalAlignment="middle" marginLeft="14">
              <Label class="headline" :text="session.user || 'Guest'" />
              <Label
                class="caption"
                :text="session.user ? 'Signed in' : 'Not signed in. Account asks first.'"
              />
            </StackLayout>
          </GridLayout>

          <Label class="section-title" text="Routes" />
          <StackLayout class="card group">
            <RouterLink to="/settings/account">
              <GridLayout class="cell" columns="*, auto">
                <Label text="Account" />
                <Label col="1" class="chevron" text="›" />
              </GridLayout>
            </RouterLink>
            <RouterLink to="/transitions">
              <GridLayout class="cell" columns="*, auto">
                <Label text="Zoom from a card" />
                <Label col="1" class="chevron" text="›" />
              </GridLayout>
            </RouterLink>
            <RouterLink to="/does/not/exist">
              <GridLayout
                class="cell"
                :class="{ last: !diagnosticsEnabled }"
                columns="*, auto"
              >
                <Label text="A page that does not exist" />
                <Label col="1" class="chevron" text="›" />
              </GridLayout>
            </RouterLink>
            <RouterLink v-if="diagnosticsEnabled" to="/diagnostics">
              <GridLayout class="cell last" columns="*, auto">
                <Label text="Navigation diagnostics" />
                <Label col="1" class="chevron" text="›" />
              </GridLayout>
            </RouterLink>
          </StackLayout>
        </StackLayout>
      </ScrollView>
      <StackTrail row="1" />
    </NavigationCommandScope>
  </Page>
</template>
