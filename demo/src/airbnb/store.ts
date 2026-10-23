import { ApplicationSettings } from '@nativescript/core'
import { ref, watch } from 'nativescript-vue'
import { stays } from './data'

function readSaved(): string[] {
  try {
    const value: unknown = JSON.parse(ApplicationSettings.getString('airbnb.saved', '[]'))
    return Array.isArray(value)
      ? value.filter(
          (id): id is string =>
            typeof id === 'string' && stays.some((stay) => stay.id === id),
        )
      : []
  } catch {
    return []
  }
}
export const saved = ref(readSaved())
watch(saved, (value) =>
  ApplicationSettings.setString('airbnb.saved', JSON.stringify(value)),
)
export function toggleSaved(id: string) {
  saved.value = saved.value.includes(id)
    ? saved.value.filter((item) => item !== id)
    : [...saved.value, id]
}
export interface SearchFilters {
  destination: string
  maxPrice: number
}

export const defaultSearch: Readonly<SearchFilters> = { destination: '', maxPrice: 1500 }
function readSearch(): SearchFilters {
  try {
    const value = JSON.parse(ApplicationSettings.getString('airbnb.search', 'null'))
    if (typeof value?.destination === 'string' && Number.isFinite(value.maxPrice)) {
      return {
        destination: value.destination,
        maxPrice: Math.max(200, Math.min(defaultSearch.maxPrice, value.maxPrice)),
      }
    }
  } catch {}
  return { ...defaultSearch }
}
export const search = ref<SearchFilters>(readSearch())
watch(search, (value) =>
  ApplicationSettings.setString('airbnb.search', JSON.stringify(value)),
)

const tabs = ['explore', 'saved', 'trips', 'messages', 'profile']
const storedTab = ApplicationSettings.getString('airbnb.tab', 'explore')
export const selectedTab = ref(tabs.includes(storedTab) ? storedTab : 'explore')
watch(selectedTab, (value) => ApplicationSettings.setString('airbnb.tab', value))
