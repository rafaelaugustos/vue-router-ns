import type { Frame } from '@nativescript/core'
import { shallowRef, watch } from 'nativescript-vue'
import type { NativeHost } from '../host.js'
import { visibleUIKitColumns, type UIKitSplitView } from '../uikit-split.js'
import { createSplitFrameHost, type SplitFrames } from './split.js'

export interface UIKitSplitFrames extends SplitFrames {
  readonly view: UIKitSplitView
}

/** Same pinned-list history as the adaptive host; UIKit owns column presentation. */
export function createUIKitSplitHost(
  view: UIKitSplitView,
  list: Frame,
  detail: Frame,
): NativeHost<UIKitSplitFrames> {
  const expanded = shallowRef(false)
  const detailVisible = shallowRef(false)
  const base = createSplitFrameHost(list, detail, { expanded, detailVisible })
  const native = { view, list, detail }
  const stop = watch(
    detailVisible,
    (visible) => {
      view.hasDetail = visible
      if (visible) view.showSecondary()
      else view.showPrimary()
    },
    { flush: 'sync' },
  )
  return {
    ...base,
    kind: 'uikit-split',
    get native() {
      return base.native ? native : null
    },
    get loaded() {
      return base.loaded
    },
    attach(delegate) {
      base.attach(delegate)
      view.columnsChanged = () => {
        expanded.value = !view.viewController.collapsed
        delegate.changed()
      }
    },
    visible() {
      const pages = base.pages()
      const visible = visibleUIKitColumns(view, list, detail)
      return pages.filter((_, index) =>
        index === 0 ? visible.list : index === pages.length - 1 && visible.detail,
      )
    },
    dispose() {
      stop()
      view.columnsChanged = undefined
      base.dispose()
    },
  }
}
