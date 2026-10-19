import { ref } from 'nativescript-vue'
import {
  useRoute,
  useRouter,
  useNativeHost,
  type NavigationFocus,
  type RouteLocation,
  type RegisteredRouter,
} from 'vue-router-ns'
import type { Frame } from '@nativescript/core'

export const signedIn = ref(false)
export const navigationLocked = ref(false)
export const selectedColor = ref('Ocean')
export const globalVisits = ref(0)
export const status = ref('')
export const captures = new Map<
  string,
  {
    route: RouteLocation
    router: RegisteredRouter
    host: ReturnType<typeof useNativeHost<Frame>>
    draft: ReturnType<typeof ref<string>>
  }[]
>()
export const focusOwners = new Map<string, NavigationFocus>()
export function useDraft(initial = '') {
  const draft = ref(initial)
  if (__FILE_ROUTING_TEST__) {
    const route = useRoute()
    const list = captures.get(route.fullPath) ?? []
    list.push({ route, router: useRouter(), host: useNativeHost<Frame>(), draft })
    captures.set(route.fullPath, list)
  }
  return draft
}
