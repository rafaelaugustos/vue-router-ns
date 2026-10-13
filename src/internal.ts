import type { Frame } from '@nativescript/core'
import type { RouteLocationRaw } from './types.js'

/** What `<RouterView>` needs from the router, kept off the public API. */
export interface RouterInternals {
  mount(name: string, frame: Frame, initial: RouteLocationRaw): Promise<void>
  unmount(name: string): void
}

export const INTERNAL = Symbol(__DEV__ ? 'router internals' : '')
