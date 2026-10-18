import type { InjectionKey } from 'nativescript-vue'
import type { Router } from './router.js'
import type { Entry } from './stack.js'
import type { RouteLocation } from './types.js'

export const routerKey: InjectionKey<Router> = Symbol(__DEV__ ? 'router' : '')
export const routeKey: InjectionKey<RouteLocation> = Symbol(__DEV__ ? 'route' : '')
export const entryKey: InjectionKey<Entry> = Symbol(__DEV__ ? 'route entry' : '')

/** Provided by `<RouterTab>`: brings the tab forward before a navigation into its stack. */
export interface TabContext {
  reveal(): void
  selected(): boolean
}
export const tabKey: InjectionKey<TabContext> = Symbol(__DEV__ ? 'router tab' : '')
