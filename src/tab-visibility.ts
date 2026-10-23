import type { RouteLocation } from './types.js'

/** A route's explicit policy wins; inherit/omission walks matched parents, then visible. */
export function tabBarHidden(route: RouteLocation): boolean {
  for (let index = route.matched.length - 1; index >= 0; index--) {
    const value = route.matched[index]!.meta.tabBarVisibility
    if (value === 'hidden') return true
    if (value === 'visible') return false
  }
  return false
}
