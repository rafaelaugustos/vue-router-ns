import type { Page } from '@nativescript/core'
import { inject, nextTick, onUnmounted } from 'nativescript-vue'
import { entryKey } from './injection.js'
import { pageEffect } from './page-effects.js'
import type { Entry } from './stack.js'
import type { SavedState } from './types.js'

export interface PageStateContext {
  /** The version the value was saved with. */
  readonly version: number
  readonly page: Page
}

export interface PageStateOptions<T> {
  /** The version of the shape `save` returns. Defaults to 1. */
  version?: number
  /**
   * What to keep: small, JSON-compatible data. Called after every navigation
   * and when the app goes to the background. Return `undefined` to keep
   * nothing, for a sensitive draft for example.
   */
  save(): T | undefined
  /** Called once with what `save` kept, after the page's native view has loaded. */
  restore(value: T, context: PageStateContext): void
  /** Turns a value saved with another version into the current shape, or `undefined` to start fresh. */
  migrate?(value: unknown, version: number): T | undefined
}

export interface PageStateHooks {
  version: number
  save(): unknown
}

/** Bytes of JSON one page's state may take by default. */
export const DEFAULT_STATE_LIMIT = 8 * 1024

/**
 * Keeps a page's own state across process death: a draft, a reading
 * position, a selection. The router saves it next to the page's path, with a
 * stable identity per page instance, and hands it back when the page is
 * rebuilt. Native objects, closures and promises can't be kept; the value has
 * to survive `JSON.stringify`.
 */
export function usePageState<T>(key: string, options: PageStateOptions<T>) {
  const entry = inject(entryKey, null)
  if (!entry) throw new Error('usePageState() must be used inside a routed page')
  if (entry.state.has(key)) {
    throw new Error(`usePageState("${key}") is already used by this page`)
  }
  const version = options.version ?? 1
  entry.state.set(key, { version, save: options.save })

  const saved = entry.saved?.[key]
  const unregister = pageEffect(entry, (page) => {
    if (!saved || entry.disposed) return () => {}
    delete entry.saved![key]
    let cancelled = false
    const apply = () => {
      if (cancelled || entry.disposed) return
      void nextTick(() => {
        if (cancelled || entry.disposed) return
        const value = migrated(saved, version, options)
        if (value === undefined) return
        try {
          options.restore(value, { version: saved.version, page })
        } catch (error) {
          if (__DEV__) console.warn(`[vue-router-ns] restoring "${key}" failed:`, error)
        }
      })
    }
    if (page.isLoaded) apply()
    else page.once('loaded', apply)
    return () => {
      cancelled = true
      page.off('loaded', apply)
    }
  })
  onUnmounted(() => {
    unregister()
    entry.state.delete(key)
  })
}

function migrated<T>(
  saved: SavedState,
  version: number,
  options: PageStateOptions<T>,
): T | undefined {
  if (saved.version === version) return saved.value as T
  if (!options.migrate) return undefined
  try {
    return options.migrate(saved.value, saved.version)
  } catch (error) {
    if (__DEV__) console.warn('[vue-router-ns] migrating page state failed:', error)
    return undefined
  }
}

/** What `save` hooks return for `entry`, checked and bounded; `undefined` when there is nothing. */
export function collectPageState(
  entry: Entry,
  limit: number,
): Record<string, SavedState> | undefined {
  if (!entry.state.size) return undefined
  const state: Record<string, SavedState> = {}
  let bytes = 0
  for (const [key, hooks] of entry.state) {
    let value: unknown
    try {
      value = hooks.save()
    } catch (error) {
      if (__DEV__) console.warn(`[vue-router-ns] saving "${key}" failed:`, error)
      continue
    }
    if (value === undefined) continue
    const problem = check(value)
    if (problem) {
      if (__DEV__) console.warn(`[vue-router-ns] "${key}" was not saved: ${problem}`)
      continue
    }
    bytes += JSON.stringify(value).length
    if (bytes > limit) {
      if (__DEV__) {
        console.warn(
          `[vue-router-ns] "${key}" was not saved: the page's state is over ${limit} bytes`,
        )
      }
      break
    }
    state[key] = { version: hooks.version, value }
  }
  return Object.keys(state).length ? state : undefined
}

/** Why `value` can't be saved as JSON, or `undefined` when it can. */
function check(value: unknown, depth = 0): string | undefined {
  if (depth > 32) return 'it nests too deep'
  if (value === null) return undefined
  switch (typeof value) {
    case 'string':
    case 'boolean':
      return undefined
    case 'number':
      return Number.isFinite(value) ? undefined : 'it holds a number JSON cannot carry'
    case 'object':
      break
    default:
      return `it holds a ${typeof value}`
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const problem = check(item, depth + 1)
      if (problem) return problem
    }
    return undefined
  }
  const proto = Object.getPrototypeOf(value)
  if (proto !== Object.prototype && proto !== null)
    return 'it holds a native or class object'
  for (const item of Object.values(value as object)) {
    if (item === undefined) continue
    const problem = check(item, depth + 1)
    if (problem) return problem
  }
  return undefined
}
