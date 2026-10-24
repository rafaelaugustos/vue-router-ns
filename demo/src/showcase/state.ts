import { reactive, shallowRef } from 'nativescript-vue'
import type { RouterDrawerHandle } from 'vue-router-ns'
export const drawer = shallowRef<RouterDrawerHandle | null>(null)
export const notes = reactive([
  {
    id: 'coast',
    title: 'Along the coast',
    category: 'FIELD JOURNAL',
    body: 'A quiet path, salt in the air, and time to notice the details.',
    starred: false,
  },
  {
    id: 'forest',
    title: 'Into the forest',
    category: 'WEEKEND NOTES',
    body: 'Follow the shade. Stop where the light reaches the forest floor.',
    starred: false,
  },
  {
    id: 'city',
    title: 'The city on foot',
    category: 'SMALL DISCOVERIES',
    body: 'A familiar street looks different when there is no hurry.',
    starred: false,
  },
])
export function noteById(id: string) {
  return notes.find((note) => note.id === id)
}
