import { Color, Frame, Page } from '@nativescript/core'
import { nextTick, type Ref } from 'nativescript-vue'
import { previewBack } from '../back-preview.js'
import {
  NATIVE_HOST_VERSION,
  type NativeHost,
  type NativeHostDelegate,
  type NativeHostPart,
} from '../host.js'
import { framePages, navigateFrame, popFrame } from './frame.js'

export interface SplitFrameHostOptions {
  /** Both panes are on screen. */
  expanded: Readonly<Ref<boolean>>
  /** Set by the host: the detail pane has a page to show. */
  detailVisible: Ref<boolean>
  /** Controller-backed containers reveal only after the native detail root exists. */
  revealDetail?: () => void
}

export interface SplitFrames {
  readonly list: Frame
  readonly detail: Frame
}

/**
 * The host behind `<RouterSplitView>`: a pinned list frame and a detail
 * frame, combined into one logical stack. The detail frame keeps a
 * transparent root of its own, which the router never sees.
 */
export function createSplitFrameHost(
  list: Frame,
  detail: Frame,
  options: SplitFrameHostOptions,
): NativeHost<SplitFrames> {
  const placeholder = new Page()
  placeholder.actionBarHidden = true
  placeholder.backgroundColor = new Color('transparent')
  const native: SplitFrames = { list, detail }
  let delegate: NativeHostDelegate | undefined
  let disposed = false
  let resetting: (() => void) | undefined

  const detailPages = () => framePages(detail).filter((page) => page !== placeholder)
  const pages = () => [...framePages(list).slice(-1), ...detailPages()]

  const onListNavigated = () => delegate?.changed()
  const onDetailNavigated = () => {
    if (resetting) {
      resetting()
      return
    }
    options.detailVisible.value = detailPages().length > 0
    delegate?.changed()
  }

  /**
   * iOS does not finish presenting a page in a controller that was never
   * shown, so the detail root goes in only when the pane first opens, and
   * comes back to it before `clearHistory` starts over.
   */
  async function reset(clearHistory: boolean) {
    if (detail.currentPage && !(clearHistory && detail.canGoBack())) return
    await new Promise<void>((resolve) => {
      resetting = resolve
      if (!detail.currentPage)
        detail.navigate({ create: () => placeholder, animated: false })
      else {
        detail.currentEntry.animated = false
        detail.goBack(detail.backStack[0])
      }
    })
    resetting = undefined
  }

  const parts = (): NativeHostPart[] => [
    { role: 'list', native: list, loaded: !!list.isLoaded, pages: framePages(list) },
    { role: 'detail', native: detail, loaded: !!detail.isLoaded, pages: detailPages() },
  ]

  return {
    version: NATIVE_HOST_VERSION,
    kind: 'split-frame',
    capabilities: {
      replace: true,
      clearHistory: true,
      pinnedRoot: true,
      close: false,
      cancellableDismissal: false,
      multipleVisible: true,
    },
    get native() {
      return disposed ? null : native
    },
    get loaded() {
      return !!list.isLoaded && !!detail.isLoaded
    },
    attach(target) {
      delegate = target
      list.on(Frame.navigatedToEvent, onListNavigated)
      detail.on(Frame.navigatedToEvent, onDetailNavigated)
    },
    pages,
    visible() {
      const all = pages()
      const top = all.at(-1)
      if (!top) return []
      return options.expanded.value && all.length > 1 ? [all[0]!, top] : [top]
    },
    willAnimate: ({ clearHistory }) => !(detailPages().length === 0 || clearHistory),
    async push(component, pushOptions) {
      if (pushOptions.initial) {
        navigateFrame(list, component, pushOptions)
        return
      }
      options.detailVisible.value = true
      await nextTick()
      if (disposed) return
      const ready = reset(pushOptions.clearHistory)
      options.revealDetail?.()
      await ready
      if (disposed) return
      // the reset above already cleared the history
      navigateFrame(detail, component, { ...pushOptions, clearHistory: false })
    },
    back(target, backOptions) {
      if (!target) throw new Error('A split view cannot be closed')
      const page = target === list.currentPage ? placeholder : target
      popFrame(detail, page, backOptions)
    },
    previewBack: (top, below, commit, onDispose) =>
      previewBack(detail, top, below, commit, onDispose),
    ownsSystemBack: () => {
      const topmost = Frame.topmost()
      return topmost === detail || topmost === list
    },
    parts,
    dispose() {
      if (disposed) return
      disposed = true
      list.off(Frame.navigatedToEvent, onListNavigated)
      detail.off(Frame.navigatedToEvent, onDetailNavigated)
      resetting?.()
      resetting = undefined
      delegate = undefined
    },
  }
}
