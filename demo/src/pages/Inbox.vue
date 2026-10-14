<script lang="ts" setup>
import { ref } from 'nativescript-vue'
import type { ItemEventData } from '@nativescript/core'
import { onPageActivated, useRouter } from 'vue-router-ns'
import StackTrail from '../components/StackTrail.vue'
import { inbox } from '../store'

const router = useRouter()
const messages = ref(inbox.list())
const unread = ref(0)

// runs when the inbox shows up and every time the user comes back to it
onPageActivated(() => {
  messages.value = inbox.list()
  unread.value = inbox.unread()
})

// a half-height sheet on iOS, with the inbox still usable behind it
function compose() {
  router.push('/compose', {
    modal: {
      ios: {
        detents: ['medium', 'large'],
        largestUndimmedDetent: 'medium',
        grabber: true,
      },
    },
  })
}

function open({ index }: ItemEventData) {
  router.push({ name: 'message', params: { id: messages.value[index]!.id } })
}
</script>

<template>
  <Page>
    <ActionBar :title="unread ? `Inbox (${unread})` : 'Inbox'">
      <ActionItem text="Compose" ios.position="right" @tap="compose" />
    </ActionBar>

    <GridLayout rows="*, auto">
      <ListView :items="messages" @itemTap="open">
        <template #default="{ item }">
          <StackLayout class="message" :class="{ unread: !item.read }">
            <Label class="from" :text="item.from" />
            <Label class="muted" :text="item.subject" />
          </StackLayout>
        </template>
      </ListView>
      <StackTrail row="1" />
    </GridLayout>
  </Page>
</template>
