<script setup lang="ts">
import { computed, ref } from 'nativescript-vue'
import { Dialogs } from '@nativescript/core'
import { onBeforeRouteLeave, useRouter } from 'vue-router-ns'
import { notes } from '../notes'

const props = defineProps<{ id: string }>()
const router = useRouter()
const note = notes.find((item) => item.id === props.id)
const draft = ref(note?.body ?? '')
const saving = ref(false)
const dirty = computed(() => !!note && !saving.value && draft.value !== note.body)

onBeforeRouteLeave(
  () =>
    Dialogs.confirm({
      title: 'Discard changes?',
      message: 'Your unsaved text will be lost.',
      okButtonText: 'Discard',
      cancelButtonText: 'Keep editing',
    }),
  { when: dirty },
)

async function save() {
  if (!note) return
  saving.value = true
  try {
    await router.back({ result: draft.value })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Page>
    <ActionBar title="Edit note">
      <ActionItem text="Cancel" ios.position="left" @tap="router.back()" />
    </ActionBar>
    <StackLayout padding="24">
      <TextView
        v-model="draft"
        accessibilityLabel="Note draft"
        automationText="Note draft"
        height="180"
        fontSize="20"
      />
      <Label :text="dirty ? 'Unsaved changes' : 'No unsaved changes'" marginTop="12" />
      <Button text="Save note" :isEnabled="!!note && !saving" @tap="save" />
    </StackLayout>
  </Page>
</template>
