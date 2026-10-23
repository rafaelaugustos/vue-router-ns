import { type EventData, type ScrollView } from '@nativescript/core'
import { usePageState } from 'vue-router-ns'

// Template events own the listener lifetime. Wait for measurement (and Deferred
// content) before restoring the offset saved for this particular route entry.
export function usePageScroll() {
  let offset = 0
  let pending: number | undefined
  let view: ScrollView | undefined
  function layout({ object }: EventData) {
    view = object as ScrollView
    if (pending === undefined || view.scrollableHeight < pending) return
    const target = pending
    pending = undefined
    view.scrollToVerticalOffset(target, false)
    offset = target
  }
  function scroll({ object }: EventData) {
    if (pending === undefined) offset = (object as ScrollView).verticalOffset
  }
  usePageState('scroll', {
    save: () => ({ offset: pending ?? offset }),
    restore(value) {
      if (!Number.isFinite(value.offset) || value.offset < 0) return
      pending = value.offset
      if (view) layout({ object: view, eventName: 'restore' })
    },
  })
  return { layout, scroll }
}
