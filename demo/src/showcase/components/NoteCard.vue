<script setup lang="ts">
import { computed } from 'nativescript-vue'
import { usePageActions, vRoutePreview } from 'vue-router-ns'
const props = defineProps<{
  note: { id: string; title: string; category: string; body: string; starred: boolean }
}>()
const emit = defineEmits<{ open: [] }>()
const actions = usePageActions([
  {
    id: 'star',
    title: () => (props.note.starred ? 'Remove star' : 'Star note'),
    run: () => {
      props.note.starred = !props.note.starred
    },
  },
])
const menu = computed(() => ({
  to: `/notes/${props.note.id}`,
  openTitle: `Open ${props.note.title}`,
  actions: actions.menu(['star']),
}))
</script>
<template>
  <StackLayout class="card" v-route-preview="menu">
    <Label :text="note.category" class="eyebrow" />
    <Button
      :id="`note-${note.id}`"
      :text="note.title"
      :automationText="`Open ${note.id}`"
      :accessibilityLabel="`Open ${note.title}`"
      class="card-title"
      @tap="emit('open')"
    />
    <Label :text="note.body" class="muted" textWrap="true" />
    <Label
      :text="note.starred ? 'Starred' : 'Hold card for actions'"
      :automationText="`star-${note.id}`"
      class="card-footer"
    />
  </StackLayout>
</template>
