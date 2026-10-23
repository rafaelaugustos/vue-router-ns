import { computed, inject, shallowRef, type ComputedRef } from 'nativescript-vue'
import { entryKey } from './injection.js'
import type { Entry } from './stack.js'
import type { RouteLocation } from './types.js'

/** Experimental. Cancellation belongs to this page's request, not to an application cache. */
export interface RouteLoaderContext {
  readonly to: RouteLocation
  readonly from: RouteLocation
  isCancelled(): boolean
  /** Cancel a request owned by this invocation. Returns a subscription disposer. */
  onCancel(callback: () => void): () => void
}

/** A typed definition; no data is stored on it or shared across pages/routers. */
export interface RouteLoader<T = unknown> {
  readonly load: (context: RouteLoaderContext) => T | PromiseLike<T>
}
export type RouteLoaderReference = string | RouteLoader
export type RouteDataStatus = 'pending' | 'success' | 'error' | 'cancelled'

/** Experimental per-entry state. Errors are observed here, not through navigation's onError. */
export interface RouteData<T> {
  readonly data: ComputedRef<T | undefined>
  readonly error: ComputedRef<unknown>
  readonly status: ComputedRef<RouteDataStatus>
  /** Current attempt; resolves on success, error or cancellation, never rejects. */
  readonly ready: Promise<void>
  /** Explicit retry/refetch. Supersedes this entry's old attempt, without navigating. */
  reload(): Promise<void>
}

export function defineRouteLoader<T>(load: RouteLoader<T>['load']): RouteLoader<T> {
  return Object.freeze({ load })
}

const states = new WeakMap<Entry, Map<RouteLoader, RouteData<unknown>>>()
const cleanups = new WeakMap<Entry, () => void>()

/** Consume the same definition declared in this page's matched route metadata. */
export function useRouteData<T>(loader: RouteLoader<T>): RouteData<T> {
  const entry = inject(entryKey, null)
  if (!entry) throw new Error('useRouteData() must be used inside a routed page')
  const state = states.get(entry)?.get(loader)
  if (!state) throw new Error("This loader is not declared in the page's route metadata")
  return state as RouteData<T>
}

/** One registry per router. Resolve all definitions before starting any work. */
export function createRouteData(definitions: Readonly<Record<string, RouteLoader>> = {}) {
  const registry = new Map(Object.entries(definitions))
  return (entry: Entry, from: RouteLocation) => {
    const loaders = new Set<RouteLoader>()
    for (const record of entry.route.matched) {
      const declared = record.meta.loaders
      const references =
        declared === undefined ? [] : Array.isArray(declared) ? declared : [declared]
      for (const reference of references) {
        const loader = typeof reference === 'string' ? registry.get(reference) : reference
        if (!loader || typeof loader.load !== 'function')
          throw new Error(`Unknown or invalid route loader "${String(reference)}"`)
        loaders.add(loader)
      }
    }
    if (!loaders.size) return
    const resources = new Map<RouteLoader, RouteData<unknown>>()
    const disposers: (() => void)[] = []
    states.set(entry, resources)
    cleanups.set(entry, () => {
      for (const dispose of disposers) dispose()
      states.delete(entry)
    })
    for (const loader of loaders) {
      const resource = createResource(entry, from, loader)
      resources.set(loader, resource.state)
      disposers.push(resource.dispose)
    }
  }
}

export function disposeRouteData(entry: Entry) {
  cleanups.get(entry)?.()
  cleanups.delete(entry)
}

function createResource<T>(entry: Entry, from: RouteLocation, loader: RouteLoader<T>) {
  const data = shallowRef<T>()
  const error = shallowRef<unknown>()
  const status = shallowRef<RouteDataStatus>('pending')
  let ready = Promise.resolve()
  let cancel = () => {}
  const invoke = (callback: () => void) => {
    try {
      callback()
    } catch (error) {
      if (__DEV__) console.warn('[vue-router-ns] cancelling route data failed:', error)
    }
  }
  const reload = (): Promise<void> => {
    if (entry.disposed) return Promise.resolve()
    cancel()
    data.value = undefined
    error.value = undefined
    status.value = 'pending'
    let cancelled = false
    let completed = false
    const callbacks = new Set<() => void>()
    let finish!: () => void
    ready = new Promise<void>((resolve) => {
      finish = resolve
    })
    const done = () => {
      completed = true
      callbacks.clear()
      finish()
    }
    cancel = () => {
      if (cancelled || completed) return
      cancelled = true
      status.value = 'cancelled'
      for (const callback of callbacks) invoke(callback)
      done()
    }
    const context: RouteLoaderContext = {
      to: entry.route,
      from,
      isCancelled: () => cancelled || entry.disposed,
      onCancel(callback) {
        if (cancelled || entry.disposed) invoke(callback)
        else if (!completed) callbacks.add(callback)
        return () => {
          callbacks.delete(callback)
        }
      },
    }
    // Both sync exceptions and rejected thenables are observed immediately. Each
    // entry starts independent work after all guards, without blocking its host.
    void Promise.resolve()
      .then(() => {
        if (!context.isCancelled()) return loader.load(context)
      })
      .then(
        (value) => {
          if (!context.isCancelled()) {
            data.value = value
            status.value = 'success'
          }
          done()
        },
        (reason) => {
          if (!context.isCancelled()) {
            error.value = reason
            status.value = 'error'
          }
          done()
        },
      )
    return ready
  }
  const state: RouteData<T> = {
    data: computed(() => data.value),
    error: computed(() => error.value),
    status: computed(() => status.value),
    get ready() {
      return ready
    },
    reload,
  }
  void reload()
  return {
    state,
    dispose() {
      cancel()
      data.value = undefined
      error.value = undefined
      status.value = 'cancelled'
    },
  }
}
