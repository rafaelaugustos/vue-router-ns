<script setup lang="ts">
import { useRouter } from 'vue-router-ns'
import { notes } from '../notes'

const props = defineProps<{ id: string }>()
const router = useRouter()
const note = notes.find((item) => item.id === props.id)

async function edit() {
  const result = await router.pushForResult<string>(`/notes/${props.id}/edit`)
  if (note && result !== undefined) note.body = result
}
</script>

<template>
  <Page>
    <ActionBar :title="note?.title ?? 'Note not found'">
      <NavigationButton
        text="Back"
        android.systemIcon="ic_menu_back"
        @tap="router.back()"
      />
    </ActionBar>
    <StackLayout v-if="note" padding="24">
      <Label :text="note.body" fontSize="22" textWrap="true" marginBottom="24" />
      <Button text="Edit in a modal" @tap="edit" />
    </StackLayout>
    <Label v-else text="This note does not exist." margin="24" />
  </Page>
</template>
