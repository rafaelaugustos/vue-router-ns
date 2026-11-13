import { hasInjectionContext, inject, onScopeDispose, watch } from 'nativescript-vue'
import { entryKey } from './injection.js'
import { pageEffect } from './page-effects.js'
import { settledPreload, type RoutePreload } from './preload.js'
import type { RegisteredRouteMap, RouteLocationRawOf } from './typed.js'

/** Experimental. Capture in page setup; all leases end when that page/scope is disposed. */
export function useRoutePreload(): (
  to: RouteLocationRawOf<RegisteredRouteMap>,
) => RoutePreload {
  const entry = hasInjectionContext() ? inject(entryKey, null) : null
  if (!entry) throw new Error('useRoutePreload() must be used inside a routed page')
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
  return (to) => {
    if (closed || entry.disposed)
      return settledPreload({ status: 'cancelled', reason: 'disposed' })
    const handle = entry.stack.router.preload(to)
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
