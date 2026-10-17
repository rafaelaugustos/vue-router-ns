<script lang="ts" setup>
import { NavigationCommandScope } from 'vue-router-ns'
import { useDemoCommands } from '../navigation-commands'

import { computed, ref } from 'nativescript-vue'
import {
  isAndroid,
  isIOS,
  PageTransition,
  SharedTransition,
  type ItemEventData,
} from '@nativescript/core'
import {
  onPageActivated,
  useNativeSearch,
  useNavigationFocus,
  useRouter,
} from 'vue-router-ns'
import StackTrail from '../components/StackTrail.vue'
import { drawer } from '../drawer'
import { inbox } from '../store'
import { initials, tone } from '../ui'

const router = useRouter()
const messages = ref(inbox.list())
const unread = ref(0)
const query = ref('')
const search = useNativeSearch({ query, placeholder: 'Search messages' })
const focus = useNavigationFocus({})
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

// a half-height sheet on iOS, with the inbox still usable behind it; a Material sheet on Android
function compose() {
  focus.remember()
  router.push('/compose', {
    modal: {
      ios: {
        detents: ['medium', 'large'],
        largestUndimmedDetent: 'medium',
        grabber: true,
      },
      android: {
        sheet: { peekHeight: 360, state: 'expanded', skipCollapsed: true, height: 520 },
      },
    },
  })
}

// iOS 18 zooms the message out of its row; elsewhere the sender's name flies into place
function open({ index, view }: ItemEventData) {
  focus.remember(`message-${filtered.value[index]!.id}`)
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
      <ActionItem v-if="isAndroid" text="Menu" @tap="drawer?.open()" />
      <ActionItem
        text="Search"
        ios.systemIcon="12"
        ios.position="right"
        @tap="search.activate()"
      />
      <ActionItem text="Compose" ios.systemIcon="7" ios.position="right" @tap="compose" />
    </ActionBar>

    <NavigationCommandScope :commands="commands" rows="*, auto">
      <!-- `accessible` makes a row focusable, and Android's ListView drops taps on focusable rows; TalkBack reads the label either way -->
      <ListView id="messages" class="list" :items="filtered" @itemTap="open">
        <template #default="{ item }">
          <GridLayout
            :id="`message-${item.id}`"
            :accessible="isIOS"
            :accessibilityLabel="`${item.from}: ${item.subject}`"
            class="row"
            :class="{ unread: !item.read }"
            columns="auto, *, auto"
          >
            <GridLayout class="avatar" :backgroundColor="tone(item.from)">
              <Label
                :text="initials(item.from)"
                horizontalAlignment="center"
                verticalAlignment="middle"
              />
            </GridLayout>
            <StackLayout col="1" class="text">
              <GridLayout columns="*, auto">
                <Label
                  class="from"
                  :text="item.from"
                  :sharedTransitionTag="`from-${item.id}`"
                />
                <Label col="1" class="time" :text="item.at" />
              </GridLayout>
              <Label class="subject" :text="item.subject" />
              <Label class="preview" :text="item.body" />
            </StackLayout>
            <StackLayout
              v-if="!item.read"
              col="2"
              class="dot"
              verticalAlignment="top"
              marginTop="18"
            />
          </GridLayout>
        </template>
      </ListView>
      <StackTrail row="1" />
    </NavigationCommandScope>
  </Page>
</template>
