<script lang="ts" setup>
import { NavigationCommandScope } from 'vue-router-ns'
import { useDemoCommands } from '../navigation-commands'

import { computed, ref } from 'nativescript-vue'
import { Dialogs } from '@nativescript/core'
import {
  createDocumentPicker,
  onBeforeRouteLeave,
  useNativeFlow,
  useNavigationFocus,
  useRouter,
} from 'vue-router-ns'

const props = defineProps<{ subject?: string }>()

const router = useRouter()
const subject = ref(props.subject ?? '')
const body = ref('')
const sent = ref(false)
const dirty = computed(() => !sent.value && body.value.trim() !== '')
useNavigationFocus({ initial: 'compose-subject' })

// the system document picker, outside the back stack: a typed result, settled once
const picker = useNativeFlow(createDocumentPicker())
const attachments = ref<string[]>([])
const attachment = ref('')
async function attach() {
  const outcome = await picker.run({ multiple: true })
  if (outcome.status === 'completed') attachments.value = outcome.value.uris
  attachment.value =
    outcome.status === 'completed'
      ? `${outcome.value.uris.length} attached`
      : outcome.status === 'cancelled'
        ? `Picker ${outcome.reason === 'user' ? 'cancelled' : outcome.reason}`
        : 'Picker failed'
}

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
      <ActionItem text="Attach" ios.position="right" @tap="attach" />
    </ActionBar>

    <NavigationCommandScope :commands="commands">
      <StackLayout class="section">
        <TextField id="compose-subject" v-model="subject" hint="Subject" />
        <TextView v-model="body" hint="Write something…" height="200" marginTop="12" />
        <Label
          v-if="attachment"
          id="attachment"
          class="muted"
          :text="attachment"
          marginTop="12"
        />
      </StackLayout>
    </NavigationCommandScope>
  </Page>
</template>
