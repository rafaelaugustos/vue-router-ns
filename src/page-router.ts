import { Page, type View } from '@nativescript/core'
import type { Router } from './router.js'

const routers = new WeakMap<Page, Router>()

export function registerPageRouter(page: Page, router: Router) {
  routers.set(page, router)
}

export function forgetPageRouter(page: Page) {
  routers.delete(page)
}

/** The router of the routed page a view sits in, once it is in the tree. */
export function routerOf(view: View): Router | undefined {
  for (let current: View | null = view; current; current = current.parent as View | null)
    if (current instanceof Page) return routers.get(current)
  return undefined
}
