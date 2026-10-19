import { assertNativeLocation } from './navigation.js'
import type { NavigationGuard, RouteLocation } from './types.js'

/** The same arguments and return values as an existing native navigation guard. */
export type RouteMiddleware = NavigationGuard
export type RouteMiddlewareReference = string | RouteMiddleware

export interface RouteMiddlewareOptions {
  /** Run on every guarded navigation, before the destination's middleware. */
  global?: boolean
}

/** Type a middleware without registering it or creating application-global state. */
export function defineRouteMiddleware<T extends RouteMiddleware>(middleware: T): T {
  return middleware
}

/** One registry per router. The existing transaction executes the returned guards. */
export function createMiddlewareRegistry() {
  const registrations = new Map<string, { guard: RouteMiddleware; global: boolean }>()

  function add(
    name: string,
    guard: RouteMiddleware,
    options: RouteMiddlewareOptions = {},
  ): () => void {
    if (!name.trim()) throw new Error('Route middleware needs a non-empty name')
    if (registrations.has(name))
      throw new Error(`Route middleware "${name}" is already registered`)
    const registration = { guard: checked(guard), global: !!options.global }
    registrations.set(name, registration)
    return () => {
      // An old disposer must not remove a later registration of the same name.
      if (registrations.get(name) === registration) registrations.delete(name)
    }
  }

  function guards(to: RouteLocation): NavigationGuard[] {
    const result: NavigationGuard[] = []
    const seen = new Set<RouteMiddlewareReference>()
    for (const [name, registration] of registrations) {
      if (registration.global) {
        seen.add(name)
        result.push(registration.guard)
      }
    }
    const declared = to.meta.middleware
    const references =
      declared === undefined ? [] : Array.isArray(declared) ? declared : [declared]
    for (const reference of references) {
      if (seen.has(reference)) continue
      seen.add(reference)
      if (typeof reference === 'function') {
        result.push(checked(reference))
      } else if (typeof reference === 'string') {
        const registration = registrations.get(reference)
        if (!registration) throw new Error(`Unknown route middleware "${reference}"`)
        result.push(registration.guard)
      } else {
        throw new Error('Route middleware must be a registered name or a function')
      }
    }
    return result
  }

  return { add, guards }
}

function checked(guard: RouteMiddleware): RouteMiddleware {
  return async (to, from, info) => {
    const result = await guard(to, from, info)
    if (typeof result === 'string' || (result && typeof result === 'object'))
      assertNativeLocation(result)
    return result
  }
}
