import { Frame, type NavigationEntry, type Page } from '@nativescript/core'
import { createNativeView, nextTick, type Component } from 'nativescript-vue'

const mounted = new WeakMap<Page, () => void>()

/** Vue apps belong to router entries, not to an Activity's native view instance. */
export function disposeFramePage(page: Page | null | undefined) {
  if (page) mounted.get(page)?.()
}

export function mountFramePage(
  frame: Frame,
  component: Component,
  navigation: NavigationEntry,
) {
  let disposed = false
  let reloading = false
  let stopReload: (() => void) | undefined
  let view: ReturnType<typeof createNativeView<Page>> | undefined =
    createNativeView<Page>(component, undefined, { reload })
  let page: Page | undefined

  function dispose() {
    if (disposed) return
    disposed = true
    stopReload?.()
    stopReload = undefined
    if (page) mounted.delete(page)
    // Core can retain a completed NavigationEntry/create closure until the next
    // transition. Do not let that closure keep the Vue app or native Page alive.
    const previous = view
    view = undefined
    page = undefined
    previous?.unmount()
  }

  function reload() {
    if (disposed || reloading || !view) return
    if (frame.currentPage !== page) {
      if (stopReload) return
      const returned = () => {
        if (frame.currentPage !== page) return
        stopReload?.()
        stopReload = undefined
        void nextTick(reload)
      }
      frame.on(Frame.navigatedToEvent, returned)
      stopReload = () => frame.off(Frame.navigatedToEvent, returned)
      return
    }
    reloading = true
    const transition = frame.currentEntry.transition
    if (page) mounted.delete(page)
    view.unmount()
    try {
      view.mount()
      page = view.nativeView
      mounted.set(page, dispose)
      const completed = () => {
        if (frame.currentPage !== page) return
        stopReload?.()
        stopReload = undefined
        frame.currentEntry.transition = transition
        reloading = false
      }
      frame.on(Frame.navigatedToEvent, completed)
      stopReload = () => frame.off(Frame.navigatedToEvent, completed)
      frame.replacePage({
        ...navigation,
        clearHistory: false,
        transition: { name: 'fade', duration: 10 },
        create: () => page!,
      })
    } catch (error) {
      dispose()
      throw error
    }
  }

  try {
    view.mount()
    page = view.nativeView
    mounted.set(page, dispose)
    frame.navigate({ ...navigation, create: () => page! })
  } catch (error) {
    dispose()
    throw error
  }
}
