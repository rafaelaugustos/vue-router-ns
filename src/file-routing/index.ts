import type { RouteMeta, RouteRecordRaw } from '../types.js'

export { mergeFileRoutes, createFileRouteUpdater } from './runtime.js'
export type { FileRouteUpdater } from './runtime.js'

export type PageMetaValue =
  | string
  | number
  | boolean
  | null
  | readonly PageMetaValue[]
  | { [key: string]: PageMetaValue }

/** Compile-time metadata. Values must be literal data, including nested values. */
export interface PageMeta {
  name?: string
  path?: string
  layout?: string | false
  middleware?: string | readonly string[]
  meta?: RouteMeta & { [key: string]: PageMetaValue }
  props?: boolean | { [key: string]: PageMetaValue }
  modal?: RouteRecordRaw['modal']
  transition?: RouteRecordRaw['transition']
}

/** Import in <script setup>; the opt-in build transform removes this call. */
export function definePageMeta(_meta: PageMeta): void {
  throw new Error(
    'definePageMeta() requires the vue-router-ns file-routing build transform',
  )
}
