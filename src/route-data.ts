import { computed, inject, shallowRef, type ComputedRef } from 'nativescript-vue'
import { entryKey } from './injection.js'
import type { Entry } from './stack.js'
import type { RouteLocation } from './types.js'
import type { PreparedRouteData } from './data-preload.js'

/** Experimental. Cancellation belongs to this page's request, not to an application cache. */
export interface RouteLoaderContext {
  readonly to: RouteLocation
  readonly from: RouteLocation
  /** True only for explicitly authorized speculative work. */
  readonly preloading: boolean
  isCancelled(): boolean
  /** Cancel a request owned by this invocation. Returns a subscription disposer. */
  onCancel(callback: () => void): () => void
}

/** Explicit promise that this loader is safe to invoke before navigation guards. */
export interface RouteLoaderPreload {
  /** Stable session/permission identity; replace on account/permission changes. Null denies. */
  scope(): object | null | undefined
  /** Synchronous, side-effect-free permission check; repeated before execution and reuse. */
  authorize(context: Pick<RouteLoaderContext, 'to' | 'from'>): boolean
}
export interface RouteLoaderOptions {
  preload?: RouteLoaderPreload
}

/** A typed definition; data and consumer ownership live in routers/entries, never here. */
export interface RouteLoader<T = unknown> {
  readonly load: (context: RouteLoaderContext) => T | PromiseLike<T>
  readonly preload?: Readonly<RouteLoaderPreload>
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

export function defineRouteLoader<T>(
  load: RouteLoader<T>['load'],
  options: RouteLoaderOptions = {},
): RouteLoader<T> {
  return Object.freeze({
    load,
    ...(options.preload ? { preload: Object.freeze({ ...options.preload }) } : {}),
  })
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
export function createRouteData(
  definitions: Readonly<Record<string, RouteLoader>> = {},
  prepare?: (
    loader: RouteLoader,
    to: RouteLocation,
    from: RouteLocation,
  ) => PreparedRouteData | undefined,
) {
  const registry = new Map(Object.entries(definitions))
  const resolve = (route: RouteLocation) => {
    const loaders = new Set<RouteLoader>()
    for (const record of route.matched) {
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
    return loaders
  }
  return {
    resolve,
    start(entry: Entry, from: RouteLocation) {
      const loaders = resolve(entry.route)
      if (!loaders.size) return
      const resources = new Map<RouteLoader, RouteData<unknown>>()
      const disposers: (() => void)[] = []
      states.set(entry, resources)
      cleanups.set(entry, () => {
        for (const dispose of disposers) dispose()
        states.delete(entry)
      })
      for (const loader of loaders) {
        const resource = createResource(
          entry,
          from,
          loader,
          prepare?.(loader, entry.route, from),
        )
        resources.set(loader, resource.state)
        disposers.push(resource.dispose)
      }
    },
  }
}

export function disposeRouteData(entry: Entry) {
  cleanups.get(entry)?.()
  cleanups.delete(entry)
}

function createResource<T>(
  entry: Entry,
  from: RouteLocation,
  loader: RouteLoader<T>,
  prepared?: PreparedRouteData,
) {
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
      preloading: false,
      isCancelled: () => cancelled || entry.disposed,
      onCancel(callback) {
        if (cancelled || entry.disposed) invoke(callback)
        else if (!completed) callbacks.add(callback)
        return () => {
          callbacks.delete(callback)
        }
      },
    }
    const inherited = prepared
    const cancelAttempt = cancel
    prepared = undefined // Explicit reload never consumes preparation again.
    if (inherited) context.onCancel(inherited.release)
    // Both sync exceptions and rejected thenables are observed immediately. Each
    // entry starts or acquires work after all guards, without blocking its host.
    void Promise.resolve()
      .then(async () => {
        if (context.isCancelled()) return
        if (inherited) {
          const result = await inherited.result
          if (context.isCancelled()) return
          const invalid = inherited.invalid()
          if (
            result.kind === 'cancelled' ||
            (invalid && invalid !== 'expired' && invalid !== 'capacity')
          ) {
            cancelAttempt()
            return
          }
          if (result.kind === 'value' && !invalid) return result.value as T
        }
        return loader.load(context)
      })
      .then(
        (value) => {
          const invalid = inherited?.invalid()
          if (invalid && invalid !== 'expired' && invalid !== 'capacity') cancelAttempt()
          if (!context.isCancelled()) {
            data.value = value
            status.value = 'success'
          }
          done()
        },
        (reason) => {
          const invalid = inherited?.invalid()
          if (invalid && invalid !== 'expired' && invalid !== 'capacity') cancelAttempt()
          if (!context.isCancelled()) {
            error.value = reason
            status.value = 'error'
          }
          done()
        },
      )
      .finally(() => inherited?.release())
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
