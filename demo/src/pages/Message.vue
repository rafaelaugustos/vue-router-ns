<script lang="ts" setup>
import { NavigationCommandScope } from 'vue-router-ns'
import { useDemoCommands } from '../navigation-commands'

import type { ScrollView } from '@nativescript/core'
import { computed, ref } from 'nativescript-vue'
import { useNavigationFocus, usePageState, useRoute, useRouter } from 'vue-router-ns'
import StackTrail from '../components/StackTrail.vue'
import { inbox } from '../store'

// `props: true` on the route turns params into props
const props = defineProps<{ id: string }>()

const router = useRouter()
// this page's own route: it stays put while other messages are pushed on top
const route = useRoute('message')

const message = computed(() => inbox.find(Number(props.id)))
const next = computed(() => inbox.find(Number(route.params.id) + 1))
const reply = ref<string>()
const focus = useNavigationFocus({ initial: 'message-title', return: 'reply' })
const scroller = ref<{ nativeView: ScrollView }>()

// the reading position comes back after process death, once the content is laid out
usePageState<{ offset: number }>('reading', {
  save: () => {
    const offset = scroller.value?.nativeView.verticalOffset ?? 0
    return offset > 0 ? { offset } : undefined
  },
  restore({ offset }) {
    const view = scroller.value?.nativeView
    view?.once('layoutChanged', () => view.scrollToVerticalOffset(offset, false))
  },
})

inbox.markRead(Number(props.id))

async function compose() {
  focus.remember('reply')
  reply.value = await router.pushForResult<string>('/compose', {
    props: { subject: `Re: ${message.value?.subject}` },
  })
}
const commands = useDemoCommands()
</script>

<template>
  <Page>
    <ActionBar :title="message?.from ?? 'Message'" />

    <NavigationCommandScope :commands="commands" rows="*, auto">
      <ScrollView ref="scroller">
        <StackLayout class="section">
          <Label
            id="message-title"
            accessible="true"
            accessibilityRole="header"
            class="title"
            :text="message?.subject"
            textWrap="true"
          />
          <Label
            class="muted"
            :text="`From ${message?.from}`"
            :sharedTransitionTag="`from-${props.id}`"
          />
          <Label :text="message?.body" textWrap="true" marginTop="16" />

          <Label
            v-if="reply"
            class="muted"
            marginTop="16"
            :text="`You replied: ${reply}`"
            textWrap="true"
          />

          <Button id="reply" class="button" text="Reply" @tap="compose" />
          <Button
            v-if="next"
            class="button secondary"
            text="Next message"
            @tap="router.push({ name: 'message', params: { id: next.id } })"
          />
          <Button
            v-if="router.stack.value.length > 2"
            class="button secondary"
            text="Back to inbox"
            @tap="router.backTo({ name: 'inbox' })"
          />
        </StackLayout>
      </ScrollView>
      <StackTrail row="1" />
    </NavigationCommandScope>
  </Page>
</template>
