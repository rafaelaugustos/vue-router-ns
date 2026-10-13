import type { RouteLocation } from './types.js'

/** Same values as Vue Router, so checks written against it keep working. */
export const NavigationFailureType = {
  /** A guard returned `false`. */
  aborted: 4,
  /** A newer navigation started before this one finished. */
  cancelled: 8,
  /** The target is already the page on top. */
  duplicated: 16,
} as const

export type NavigationFailureType =
  (typeof NavigationFailureType)[keyof typeof NavigationFailureType]

export interface NavigationFailure extends Error {
  type: NavigationFailureType
  to: RouteLocation
  from: RouteLocation
}

const FAILURE = Symbol('navigation failure')

const messages: Record<NavigationFailureType, (to: string, from: string) => string> = {
  [NavigationFailureType.aborted]: (to, from) =>
    `Navigation aborted from "${from}" to "${to}" by a navigation guard.`,
  [NavigationFailureType.cancelled]: (to, from) =>
    `Navigation cancelled from "${from}" to "${to}" by a newer navigation.`,
  [NavigationFailureType.duplicated]: (to) =>
    `Avoided a redundant navigation to the current page: "${to}".`,
}

export function createNavigationFailure(
  type: NavigationFailureType,
  to: RouteLocation,
  from: RouteLocation,
): NavigationFailure {
  const failure = new Error(
    messages[type](to.fullPath, from.fullPath),
  ) as NavigationFailure
  failure.name = 'NavigationFailure'
  return Object.assign(failure, { type, to, from, [FAILURE]: true })
}

export function isNavigationFailure(
  error: unknown,
  type?: NavigationFailureType,
): error is NavigationFailure {
  return (
    error instanceof Error &&
    FAILURE in error &&
    (type === undefined || ((error as unknown as NavigationFailure).type & type) > 0)
  )
}
