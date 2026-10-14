<script lang="ts" setup>
import { computed, ref } from 'nativescript-vue'
import { useBackGesture, useRoute, useRouter } from 'vue-router-ns'
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

const gesture = useBackGesture()
const scale = computed(() => 1 - (gesture.value?.progress ?? 0) * 0.1)

inbox.markRead(Number(props.id))

async function compose() {
  reply.value = await router.pushForResult<string>('/compose', {
    props: { subject: `Re: ${message.value?.subject}` },
  })
}
</script>

<template>
  <Page>
    <ActionBar :title="message?.from ?? 'Message'" />

    <GridLayout rows="*, auto" :scaleX="scale" :scaleY="scale">
      <StackLayout class="section">
        <Label class="title" :text="message?.subject" textWrap="true" />
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

        <Button class="button" text="Reply" @tap="compose" />
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
      <StackTrail row="1" />
    </GridLayout>
  </Page>
</template>
