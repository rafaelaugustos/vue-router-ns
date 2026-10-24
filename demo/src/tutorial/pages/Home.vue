<script setup lang="ts">
import { computed, ref } from 'nativescript-vue'
import { useRouter } from 'vue-router-ns'
import { notes } from '../notes'

const router = useRouter()
const query = ref('')
const filtered = computed(() =>
  notes.filter((note) => note.title.toLowerCase().includes(query.value.toLowerCase())),
)
</script>

<template>
  <Page>
    <ActionBar title="Pocket notes" />
    <StackLayout padding="24">
      <Label text="Your first native flow" fontSize="26" textWrap="true" />
      <TextField
        v-model="query"
        hint="Find a note"
        accessibilityLabel="Find a note"
        marginTop="16"
      />
      <Button
        v-for="note in filtered"
        :key="note.id"
        :text="note.title"
        @tap="router.push(`/notes/${note.id}`)"
      />
      <Label v-if="!filtered.length" text="No notes found." />
    </StackLayout>
  </Page>
</template>
