import { Frame, isIOS, type ViewBase } from '@nativescript/core'
import type { RouterWindow } from './windows.js'

/**
 * Core 9.1.3 retains Frame entries when a scene disconnects, but recreates an
 * empty UINavigationController. Rebuild its native stack from the same Pages;
 * their Vue apps and the router's entries/results remain owned by the window.
 */
export function watchWindowSceneState(window: RouterWindow): () => void {
  if (!isIOS) return () => {}
  const pending = new Map<Frame, () => void>()
  const disconnect = () => {
    const visited = new Set<ViewBase>()
    const visit = (view: ViewBase) => {
      if (visited.has(view)) return
      visited.add(view)
      if (view instanceof Frame && view.currentPage && view.ios?.controller) {
        pending.get(view)?.()
        const pages = [
          ...view.backStack.map((entry) => entry.resolvedPage),
          view.currentPage,
        ]
        const records = pages.map((page) => ({
          page,
          // Core's Page controller uses these to finish back navigation and
          // deliver lifecycle callbacks. Keep metadata, not the old controller.
          entry: page.ios?._entry,
          transition: page.ios?._transition,
          delegate: page.ios?._delegate,
        }))
        const original = view.initNativeView
        const restore = () => {
          if (view.initNativeView === initialize) view.initNativeView = original
          pending.delete(view)
        }
        const initialize = () => {
          restore()
          original.call(view)
          const controller = view.ios?.controller
          if (!controller || controller.viewControllers.count) return
          const current = [
            ...view.backStack.map((entry) => entry.resolvedPage),
            view.currentPage,
          ]
          if (
            current.length !== pages.length ||
            current.some((page, index) => page !== pages[index])
          )
            return
          const controllers = records.map(({ page, entry, transition, delegate }) => {
            page._setupUI(view._context)
            page.ios._entry = entry
            page.ios._transition = transition
            page.ios._delegate = delegate
            return page.ios
          })
          controller.delegate = records.at(-1)?.delegate
          controller.setViewControllersAnimated(controllers, false)
        }
        view.initNativeView = initialize
        pending.set(view, restore)
        for (const page of pages) visit(page)
      }
      view.eachChild?.((child) => {
        visit(child)
        return true
      })
    }
    const root = (window as RouterWindow & { rootView?: ViewBase }).rootView
    if (root) visit(root)
  }
  window.on('sceneDidDisconnect', disconnect)
  return () => {
    window.off('sceneDidDisconnect', disconnect)
    for (const restore of pending.values()) restore()
    pending.clear()
  }
}
