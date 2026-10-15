<script lang="ts" setup>
import { NavigationCommandScope } from 'vue-router-ns'
import { useDemoCommands } from '../navigation-commands'

import { computed, ref } from 'nativescript-vue'
import { Dialogs } from '@nativescript/core'
import { onBeforeRouteLeave, useRouter } from 'vue-router-ns'

const props = defineProps<{ subject?: string }>()

const router = useRouter()
const subject = ref(props.subject ?? '')
const body = ref('')
const sent = ref(false)
const dirty = computed(() => !sent.value && body.value.trim() !== '')

// only asks while there is a draft; with an empty draft the sheet still swipes away
onBeforeRouteLeave(
  () =>
    Dialogs.confirm({
      title: 'Discard draft?',
      message: 'Your message will be lost.',
      okButtonText: 'Discard',
      cancelButtonText: 'Keep editing',
    }),
  { when: dirty },
)

function send() {
  sent.value = true
  router.back({ result: body.value.trim() })
}
const commands = useDemoCommands()
</script>

<template>
  <Page>
    <ActionBar title="New message">
      <ActionItem text="Cancel" ios.position="left" @tap="router.back()" />
      <ActionItem text="Send" ios.position="right" @tap="send" />
    </ActionBar>

    <NavigationCommandScope :commands="commands">
      <StackLayout class="section">
        <TextField v-model="subject" hint="Subject" />
        <TextView v-model="body" hint="Write something…" height="200" marginTop="12" />
      </StackLayout>
    </NavigationCommandScope>
  </Page>
</template>
