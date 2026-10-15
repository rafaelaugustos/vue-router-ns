<script lang="ts" setup>
import { NavigationCommandScope } from 'vue-router-ns'
import { useDemoCommands } from '../navigation-commands'

import { computed, ref } from 'nativescript-vue'
import { PageTransition, SharedTransition, type ItemEventData } from '@nativescript/core'
import { onPageActivated, useNativeSearch, useRouter } from 'vue-router-ns'
import StackTrail from '../components/StackTrail.vue'
import { inbox } from '../store'

const router = useRouter()
const messages = ref(inbox.list())
const unread = ref(0)
const query = ref('')
const search = useNativeSearch({ query, placeholder: 'Search messages' })
const filtered = computed(() => {
  const term = query.value.toLocaleLowerCase()
  return messages.value.filter((message) =>
    `${message.from} ${message.subject}`.toLocaleLowerCase().includes(term),
  )
})

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

// iOS 18 zooms the message out of its row; elsewhere the sender's name flies into place
function open({ index, view }: ItemEventData) {
  router.push(
    { name: 'message', params: { id: filtered.value[index]!.id } },
    { zoomFrom: view, transition: SharedTransition.custom(new PageTransition()) },
  )
}
const commands = useDemoCommands()
</script>

<template>
  <Page>
    <ActionBar :title="unread ? `Inbox (${unread})` : 'Inbox'" iosLargeTitle="true">
      <ActionItem text="Search" ios.position="right" @tap="search.activate()" />
      <ActionItem text="Compose" ios.position="right" @tap="compose" />
    </ActionBar>

    <NavigationCommandScope :commands="commands" rows="*, auto">
      <ListView :items="filtered" @itemTap="open">
        <template #default="{ item }">
          <StackLayout class="message" :class="{ unread: !item.read }">
            <Label
              class="from"
              :text="item.from"
              :sharedTransitionTag="`from-${item.id}`"
            />
            <Label class="muted" :text="item.subject" />
          </StackLayout>
        </template>
      </ListView>
      <StackTrail row="1" />
    </NavigationCommandScope>
  </Page>
</template>
