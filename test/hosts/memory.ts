import type { Page } from '@nativescript/core'
import { createNativeView, type Component } from 'nativescript-vue'
import {
  NATIVE_HOST_VERSION,
  type NativeHost,
  type NativeHostDelegate,
} from '../../src/index.js'
import type { Page as ShimPage } from '../shims/core.js'

export interface MemoryHostOptions {
  /** Declare `replace` support. Defaults to `true`. */
  replace?: boolean
  /** Declare `clearHistory` support. Defaults to `true`. */
  clearHistory?: boolean
}

export interface MemoryHost extends NativeHost<{ readonly pages: readonly Page[] }> {
  /** What a platform does on its own: drops the page on top and tells the router. */
  popNatively(): void
}

/**
 * The example adapter: a host with no native container at all. Pages are
 * mounted without a frame and kept in an array; changes land on a later tick,
 * like a transition would. It exists to show the smallest complete host and to
 * run the contract suite against something that isn't a Frame.
 */
export function createMemoryHost(options: MemoryHostOptions = {}): MemoryHost {
  const pages: ShimPage[] = []
  const unmounts = new WeakMap<ShimPage, () => void>()
  const native = { pages: pages as unknown as readonly Page[] }
  let delegate: NativeHostDelegate | undefined
  let disposed = false

  const transition = () => new Promise<void>((resolve) => setTimeout(resolve, 0))
  const drop = (page: ShimPage) => {
    unmounts.get(page)?.()
    page.dispose()
  }

  return {
    version: NATIVE_HOST_VERSION,
    kind: 'memory',
    capabilities: {
      replace: options.replace ?? true,
      clearHistory: options.clearHistory ?? true,
      pinnedRoot: false,
      close: false,
      cancellableDismissal: false,
      multipleVisible: false,
    },
    get native() {
      return disposed ? null : native
    },
    loaded: true,
    attach(target) {
      delegate = target
    },
    pages: () => [...pages] as unknown as Page[],
    async push(component: Component, pushOptions) {
      const view = createNativeView(component)
      const page = view.mount() as unknown as ShimPage
      unmounts.set(page, () => view.unmount())
      await transition()
      if (disposed) {
        drop(page)
        return
      }
      if (pushOptions.clearHistory) pages.splice(0).reverse().forEach(drop)
      else if (pushOptions.replace) {
        const top = pages.pop()
        if (top) drop(top)
      }
      pages.push(page)
      page.notify({ eventName: 'navigatedTo', object: page })
      delegate?.changed()
    },
    async back(target) {
      if (!target) throw new Error('A memory host cannot be closed')
      await transition()
      if (disposed) return
      const index = pages.indexOf(target as unknown as ShimPage)
      if (index < 0) throw new Error('The page is no longer in the native stack')
      pages
        .splice(index + 1)
        .reverse()
        .forEach(drop)
      delegate?.changed()
    },
    popNatively() {
      const top = pages.pop()
      if (top) drop(top)
      delegate?.changed()
    },
    dispose() {
      if (disposed) return
      disposed = true
      pages.splice(0).reverse().forEach(drop)
      delegate = undefined
    },
  }
}
