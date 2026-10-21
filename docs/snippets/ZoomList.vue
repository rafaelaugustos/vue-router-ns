<script setup lang="ts">
import { PageTransition, SharedTransition, type ItemEventData } from '@nativescript/core'
import { useRouter } from 'vue-router-ns'

const router = useRouter()
const messages = [
  { id: 1, subject: 'Lunch on Friday?' },
  { id: 2, subject: 'Release notes' },
]
function open({ index, view }: ItemEventData) {
  const message = messages[index]
  if (!message) return
  router.push(
    { name: 'message', params: { id: message.id } },
    {
      zoomFrom: view,
      transition: SharedTransition.custom(new PageTransition()),
    },
  )
}
</script>

<template>
  <Page>
    <ActionBar title="Inbox" />
    <ListView :items="messages" @itemTap="open">
      <template #default="{ item }">
        <Label
          :text="item.subject"
          :sharedTransitionTag="`message-${item.id}`"
          padding="24"
        />
      </template>
    </ListView>
  </Page>
</template>
