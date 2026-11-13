import { Frame, Page, isIOS } from '@nativescript/core'
import { createNativeView } from 'nativescript-vue'
import {
  NATIVE_HOST_VERSION,
  type NativeHost,
  type NativeHostDelegate,
} from 'vue-router-ns'

/** Reference package: iOS Frame presentation, independent of router internals. */
export function createExternalFrameHost(container: Frame): NativeHost<Frame> {
  if (!isIOS) throw new Error('The example Frame adapter is validated for iOS only')
  let frame: Frame | null = container
  const views = new Map<Page, { unmount(): void }>()
  let delegate: NativeHostDelegate | undefined
  let disposed = false
  let attached = false
  const pages = () =>
    !frame
      ? []
      : [...frame.backStack.map((entry) => entry.resolvedPage), frame.currentPage].filter(
          (page): page is Page => !!page,
        )
  const release = (page: Page) => {
    const view = views.get(page)
    views.delete(page)
    view?.unmount()
  }
  const changed = () => {
    if (disposed) return
    const current = pages()
    delegate?.changed()
    for (const page of views.keys()) if (!current.includes(page)) release(page)
  }
  return {
    version: NATIVE_HOST_VERSION,
    kind: 'external-ios-frame',
    capabilities: {
      replace: true,
      clearHistory: true,
      pinnedRoot: false,
      close: false,
      cancellableDismissal: false,
      multipleVisible: false,
    },
    get native() {
      return disposed ? null : frame
    },
    get loaded() {
      return !!frame?.isLoaded
    },
    attach(target) {
      if (attached || !frame) throw new Error('Create a fresh adapter for each owner')
      attached = true
      delegate = target
      frame.on(Frame.navigatedToEvent, changed)
    },
    pages,
    push(component, options) {
      if (!frame) throw new Error('Adapter disposed')
      // This example deliberately does not claim script-HMR page replacement.
      const view = createNativeView<Page>(component)
      let page: Page | undefined
      const previous = frame.currentEntry
      const previousVisibility = previous?.backstackVisible
      try {
        view.mount()
        page = view.nativeView
        if (!(page instanceof Page))
          throw new Error('Host destinations must render a Page')
        views.set(page, view)
        if (options.replace && previous) previous.backstackVisible = false
        frame.navigate({
          create: () => page!,
          animated: options.initial ? false : options.animated,
          transition: options.transition,
          clearHistory: options.clearHistory,
        })
      } catch (error) {
        if (previous) previous.backstackVisible = previousVisibility
        if (page) release(page)
        else view.unmount()
        throw error
      }
    },
    back(target, options) {
      if (!frame) throw new Error('Adapter disposed')
      if (!target) throw new Error('This adapter cannot close its owner')
      const entry = frame.backStack.find((entry) => entry.resolvedPage === target)
      if (!entry) throw new Error('Target is absent from native history')
      const current = frame.currentEntry
      const animated = current?.animated
      try {
        if (current && options.animated !== undefined) current.animated = options.animated
        frame.goBack(entry)
      } catch (error) {
        if (current) current.animated = animated
        throw error
      }
    },
    dispose() {
      if (disposed) return
      disposed = true
      frame?.off(Frame.navigatedToEvent, changed)
      frame = null
      delegate = undefined
      for (const page of views.keys()) release(page)
    },
  }
}
