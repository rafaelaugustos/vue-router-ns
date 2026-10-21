import {
  computed,
  inject,
  onUnmounted,
  shallowRef,
  watch,
  type MaybeRefOrGetter,
  type ShallowRef,
} from 'nativescript-vue'
import type { BackGesture } from './android.js'
import type { NativeHostHandle } from './host.js'
import { entryKey, routeKey, routerKey } from './injection.js'
import type { LeaveGuard } from './stack.js'
import type {
  RegisteredRouteMap,
  RegisteredRouter,
  RouteLocationOf,
  RouteNames,
} from './typed.js'
import type { NavigationGuard } from './types.js'

export function useRouter(): RegisteredRouter {
  const router = inject(routerKey, null)
  if (!router) {
    throw new Error('useRouter() was called outside of an app using the router')
  }
  return router as RegisteredRouter
}

/**
 * Inside a page, the route of that page: it never changes, even while other
 * pages are pushed on top. Elsewhere, the current route.
 *
 * Pass the route name to narrow the params when the router is registered.
 */
export function useRoute<N extends RouteNames = RouteNames>(
  name?: N,
): RouteLocationOf<RegisteredRouteMap, N> {
  const route = inject(routeKey, null)
  if (!route) throw new Error('useRoute() was called outside of an app using the router')
  if (__DEV__ && name !== undefined && route.name !== name) {
    console.warn(
      `[vue-router-ns] useRoute("${String(name)}") was called in "${String(route.name)}"`,
    )
  }
  return route as RouteLocationOf<RegisteredRouteMap, N>
}

export interface LeaveGuardOptions {
  /**
   * Only guard while this is true. On iOS, swipe-back stays enabled the rest
   * of the time, since a swipe can't wait for an async guard.
   */
  when?: MaybeRefOrGetter<boolean>
}

/**
 * Runs before this page is removed from its stack: back, replace or
 * `clearHistory`, including the Android back button. Pushing another page on
 * top keeps this one alive, so it does not run then.
 */
export function onBeforeRouteLeave(
  guard: NavigationGuard,
  options: LeaveGuardOptions = {},
) {
  const entry = inject(entryKey, null)
  if (!entry) {
    if (__DEV__) {
      console.warn(
        '[vue-router-ns] onBeforeRouteLeave() must be used inside a routed page',
      )
    }
    return
  }

  const record: LeaveGuard = { guard, when: options.when }
  entry.leaveGuards.add(record)
  onUnmounted(() => entry.leaveGuards.delete(record))
}

/**
 * Runs when this page becomes the one on screen: once it is shown, and again
 * whenever the user comes back to it, from a page above or a modal.
 */
export function onPageActivated(hook: () => unknown) {
  watchActivity((active) => active && hook(), 'onPageActivated')
}

/**
 * Runs when another page or a modal covers this one. A page that leaves the
 * stack is unmounted instead, so use `onUnmounted` for cleanup.
 */
export function onPageDeactivated(hook: () => unknown) {
  watchActivity((active) => !active && hook(), 'onPageDeactivated')
}

/**
 * The Android predictive back swipe (Android 14+) that would close this page,
 * while the user drags it, and `null` the rest of the time. It stays `null` on
 * iOS, and while a leave guard is active.
 */
export function useBackGesture(): Readonly<ShallowRef<BackGesture | null>> {
  const entry = inject(entryKey, null)
  if (!entry) {
    if (__DEV__) {
      console.warn('[vue-router-ns] useBackGesture() must be used inside a routed page')
    }
    return shallowRef(null)
  }
  return entry.backGesture
}

/**
 * The native host this page's stack lives in: its kind, what it can do, and
 * its native container, typed by the caller. `native` is `null` once the page
 * has left its stack. Read it when needed instead of keeping it.
 *
 * Experimental, like the host contract itself.
 */
export function useNativeHost<
  TNative extends object = object,
>(): NativeHostHandle<TNative> {
  const entry = inject(entryKey, null)
  if (!entry) throw new Error('useNativeHost() must be used inside a routed page')
  const host = entry.stack.host
  if (!host) throw new Error('useNativeHost() was called before the page had a host')
  return {
    kind: host.kind,
    capabilities: host.capabilities,
    get native() {
      return entry.disposed || entry.stack.host !== host
        ? null
        : (host.native as TNative | null)
    },
  }
}

function watchActivity(callback: (active: boolean) => unknown, name: string) {
  const entry = inject(entryKey, null)
  if (!entry) {
    if (__DEV__) {
      console.warn(`[vue-router-ns] ${name}() must be used inside a routed page`)
    }
    return
  }

  // sync: a covered page must hear about it before the next page renders
  watch(
    computed(entry.isActive),
    (active) => {
      // Native UI disposal may defer Vue unmount until after the Frame syncs.
      // Removing a page is cleanup, not a covered-page deactivation.
      if (entry.stack.entries.value.includes(entry)) callback(active)
    },
    { flush: 'sync' },
  )
}
