<script setup lang="ts">
import { computed, ref } from 'nativescript-vue'
import {
  PageActionItem,
  usePageActions,
  useRouter,
  useNavigationFocus,
  vRoutePreview,
} from 'vue-router-ns'
import { drawer, noteById } from '../state'
const props = defineProps<{ id: string }>()
const note = noteById(props.id)
const router = useRouter()
const review = ref('Not reviewed')
const focus = useNavigationFocus({ initial: 'note-heading' })
const actions = usePageActions([
  {
    id: 'star',
    title: () => (note?.starred ? 'Unstar' : 'Star'),
    run: () => {
      if (note) note.starred = !note.starred
    },
  },
  {
    id: 'edit',
    title: 'Edit',
    run: ({ router }) => router.push(`/notes/${props.id}/edit`),
  },
  {
    id: 'review',
    title: 'Review',
    run: async ({ router }) => {
      focus.remember('review-button')
      const result = await router.pushForResult<string>(`/notes/${props.id}/review`)
      if (result) review.value = result
    },
  },
])
const menu = computed(() => ({
  to: `/notes/${props.id}`,
  actions: actions.menu(['star', 'edit', 'review']),
}))
</script>
<template>
  <Page>
    <ActionBar :title="note?.title ?? 'Note not found'">
      <NavigationButton
        text="Back"
        android.systemIcon="ic_menu_back"
        @tap="router.back()"
      />
      <PageActionItem :actions="actions" action="star" ios.position="right" />
      <PageActionItem :actions="actions" action="edit" ios.position="right" />
      <ActionItem text="Menu" ios.position="right" @tap="drawer?.open()" />
    </ActionBar>
    <ScrollView>
      <StackLayout v-if="note" class="content">
        <Label :text="note.category" class="eyebrow" />
        <Label id="note-heading" :text="note.title" class="heading" textWrap="true" />
        <StackLayout class="card" v-route-preview="menu">
          <Label :text="note.body" fontSize="21" lineHeight="8" textWrap="true" />
          <Label
            :text="note.starred ? 'Starred' : 'Not starred'"
            automationText="detail-star"
            class="card-footer"
          />
          <Label
            text="Hold this note: the same actions are in its native header and menu."
            class="muted"
            textWrap="true"
          />
        </StackLayout>
        <Button
          id="review-button"
          text="Review in a modal"
          @tap="actions.dispatch('review')"
        />
        <Label
          :text="review"
          automationText="review-result"
          class="muted"
          marginTop="12"
        />
      </StackLayout>
      <StackLayout v-else class="content"
        ><Label text="This note does not exist."
      /></StackLayout>
    </ScrollView>
  </Page>
</template>
