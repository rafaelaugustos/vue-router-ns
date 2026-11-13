import { hasInjectionContext, inject, onScopeDispose, watch } from 'nativescript-vue'
import { entryKey } from './injection.js'
import { pageEffect } from './page-effects.js'
import { settledPreload, type RoutePreload } from './preload.js'
import type { RegisteredRouteMap, RouteLocationRawOf } from './typed.js'
import type { RouteLoader } from './route-data.js'
import type { Router } from './router.js'

/** Experimental. Capture in page setup; all leases end when that page/scope is disposed. */
export function useRoutePreload(): (
  to: RouteLocationRawOf<RegisteredRouteMap>,
) => RoutePreload {
  return pageOwned((router, to: RouteLocationRawOf<RegisteredRouteMap>) =>
    router.preload(to),
  )
}

/** Experimental. Capture in setup; prepare one explicitly opted-in declared loader. */
export function useRouteDataPreload(): (
  to: RouteLocationRawOf<RegisteredRouteMap>,
  loader: RouteLoader,
) => RoutePreload {
  return pageOwned(
    (router, to: RouteLocationRawOf<RegisteredRouteMap>, loader: RouteLoader) =>
      router.preloadData(to, loader),
  )
}

function pageOwned<A extends unknown[]>(
  prepare: (router: Router, ...args: A) => RoutePreload,
): (...args: A) => RoutePreload {
  const entry = hasInjectionContext() ? inject(entryKey, null) : null
  if (!entry) throw new Error('Route preload helpers must be used inside a routed page')
  const handles = new Set<RoutePreload>()
  let closed = false
  const dispose = () => {
    closed = true
    for (const handle of handles) handle.cancel()
    handles.clear()
  }
  const unregister = pageEffect(entry, () => dispose)
  onScopeDispose(() => {
    unregister()
    dispose()
  })
  return (...args) => {
    if (closed || entry.disposed)
      return settledPreload({ status: 'cancelled', reason: 'disposed' })
    const handle = prepare(entry.stack.router, ...args)
    handles.add(handle)
    const stop = watch(
      handle.state,
      (state) => {
        if (state.status === 'cancelled' || state.status === 'error') {
          handles.delete(handle)
          stop()
        }
      },
      { flush: 'sync' },
    )
    if (
      handle.state.value.status === 'cancelled' ||
      handle.state.value.status === 'error'
    ) {
      handles.delete(handle)
      stop()
    }
    return handle
  }
}
