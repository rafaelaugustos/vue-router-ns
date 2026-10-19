import { hasInjectionContext, inject, onUnmounted } from 'nativescript-vue'
import { entryKey } from './injection.js'
import type { NavigationFailure } from './errors.js'
import type { Router } from './router.js'
import type { RegisteredRouteMap, RouteLocationRawOf, RouteMapLike } from './typed.js'
import type { NavigationOptions } from './types.js'

export interface NavigateToOptions extends NavigationOptions {
  replace?: boolean
}

export type NavigateTo<M extends RouteMapLike = RegisteredRouteMap> = (
  to: RouteLocationRawOf<M>,
  options?: NavigateToOptions,
) => Promise<NavigationFailure | undefined>

/** Outside page setup, pass the owning router explicitly. */
export async function navigateTo<M extends RouteMapLike>(
  router: Router<M>,
  to: NoInfer<RouteLocationRawOf<M>>,
  options: NavigateToOptions = {},
): Promise<NavigationFailure | undefined> {
  assertNativeLocation(to)
  for (const key of ['external', 'open', 'redirectCode']) {
    if (key in options)
      throw new Error(`navigateTo() does not support Nuxt's "${key}" option`)
  }
  const { replace, ...navigation } = options
  return replace ? router.replace(to, navigation) : router.push(to, navigation)
}

/** Capture in page setup, then call from event handlers in that page's stack. */
export function useNavigateTo(): NavigateTo {
  const entry = hasInjectionContext() ? inject(entryKey, null) : null
  if (!entry) throw new Error('useNavigateTo() must be used inside a routed page')
  let unmounted = false
  onUnmounted(() => {
    unmounted = true
  })
  return async (to, options) => {
    if (unmounted || entry.disposed)
      throw new Error('Cannot navigate from an unmounted routed page')
    return navigateTo(entry.stack.router, to, options)
  }
}

/** System links belong to openLink(); native route helpers never open browsers. */
export function assertNativeLocation(to: string | { path?: string }): void {
  const path = typeof to === 'string' ? to : to.path
  if (path !== undefined && /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(path.trim()))
    throw new Error('Expected a native route location, received an external URL')
}
