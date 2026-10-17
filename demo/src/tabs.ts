import type { TabView } from '@nativescript/core'
import { shallowRef } from 'nativescript-vue'

/** The app's tabs, for the links policy to select one before navigating into it. */
export const tabs = shallowRef<TabView | null>(null)
