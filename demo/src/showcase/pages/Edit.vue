<script setup lang="ts">
import { computed, ref } from 'nativescript-vue'
import { Dialogs } from '@nativescript/core'
import {
  onBeforeRouteLeave,
  PageActionItem,
  usePageActions,
  useRouter,
  useNavigationFocus,
} from 'vue-router-ns'
import { drawer, noteById } from '../state'
const props = defineProps<{ id: string }>()
const note = noteById(props.id)
const draft = ref(note?.body ?? '')
const saved = ref(false)
const dirty = computed(() => !!note && !saved.value && draft.value !== note.body)
const router = useRouter()
useNavigationFocus({ initial: 'edit-heading' })
onBeforeRouteLeave(
  () =>
    Dialogs.confirm({
      title: 'Discard changes?',
      message: 'Your unsaved note will be lost.',
      okButtonText: 'Discard',
      cancelButtonText: 'Keep editing',
    }),
  { when: dirty },
)
const actions = usePageActions([
  {
    id: 'save',
    title: 'Save',
    enabled: () => !!note,
    run: async ({ router }) => {
      if (!note) return
      note.body = draft.value
      saved.value = true
      await router.back()
    },
  },
])
</script>
<template>
  <Page>
    <ActionBar title="Edit note">
      <NavigationButton
        text="Back"
        android.systemIcon="ic_menu_back"
        @tap="router.back()"
      />
      <PageActionItem :actions="actions" action="save" ios.position="right" />
      <ActionItem text="Menu" ios.position="right" @tap="drawer?.open()" />
    </ActionBar>
    <StackLayout class="content">
      <Label id="edit-heading" text="Make it yours" class="heading" />
      <TextView
        v-model="draft"
        automationText="Note draft"
        accessibilityLabel="Note draft"
        class="editor"
        height="210"
      />
      <Label
        :text="
          dirty ? 'Unsaved changes — leaving asks first.' : 'Your note is up to date.'
        "
        automationText="draft-status"
        class="muted"
        textWrap="true"
      />
    </StackLayout>
  </Page>
</template>
