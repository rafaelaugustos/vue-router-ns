<script setup lang="ts">
import { computed, ref } from 'nativescript-vue'
import { useNativeSearch, useNavigationFocus, useRouter } from 'vue-router-ns'
import { drawer, notes } from '../state'
import NoteCard from '../components/NoteCard.vue'
const router = useRouter()
const query = ref('')
const search = useNativeSearch({
  query,
  placeholder: 'Search your notes',
  ios: { hidesWhenScrolling: false, placement: 'stacked' },
})
const focus = useNavigationFocus({ initial: 'library-heading' })
const filtered = computed(() =>
  notes.filter((note) => note.title.toLowerCase().includes(query.value.toLowerCase())),
)
function open(id: string) {
  focus.remember(`note-${id}`)
  void router.push(`/notes/${id}`)
}
</script>
<template>
  <Page>
    <ActionBar title="Fieldnotes" iosLargeTitle="true">
      <ActionItem text="Menu" ios.position="left" @tap="drawer?.open()" />
      <ActionItem text="Search" ios.position="right" @tap="search.activate()" />
    </ActionBar>
    <ScrollView>
      <StackLayout class="content">
        <Label
          id="library-heading"
          text="Your next small discovery"
          class="heading"
          textWrap="true"
        />
        <Label
          text="Search, open a note, or hold a card for native actions."
          class="muted"
          textWrap="true"
          marginBottom="16"
        />
        <Label
          :text="query ? `Search: ${query}` : 'All notes'"
          automationText="query-summary"
          class="eyebrow"
        />
        <NoteCard
          v-for="note in filtered"
          :key="note.id"
          :note="note"
          @open="open(note.id)"
        />
        <Label
          v-if="!filtered.length"
          text="No notes found. Try another search."
          textWrap="true"
        />
      </StackLayout>
    </ScrollView>
  </Page>
</template>
