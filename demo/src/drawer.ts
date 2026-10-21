import { shallowRef } from 'nativescript-vue'
import type { RouterDrawerHandle } from 'vue-router-ns'

/** The app's drawer, for pages that want to open it: each page is its own Vue app. */
export const drawer = shallowRef<RouterDrawerHandle | null>(null)
