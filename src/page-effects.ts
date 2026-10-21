import { Frame, type Page } from '@nativescript/core'
import { computed, watch } from 'nativescript-vue'
import type { Entry } from './stack.js'
import { tabOf } from './tabs.js'

type Effect = (page: Page) => () => void
const effects = new WeakMap<Entry, Set<Effect>>()
const connected = new WeakMap<Entry, () => void>()

/** Features register during setup, before RouterPage links its native Page. */
export function pageEffect(entry: Entry, effect: Effect): () => void {
  let set = effects.get(entry)
  if (!set) effects.set(entry, (set = new Set()))
  set.add(effect)
  return () => set.delete(effect)
}

export function connectPageEffects(entry: Entry, page: Page): () => void {
  disconnectPageEffects(entry)
  const stops = [...(effects.get(entry) ?? [])].map((effect) => effect(page))
  let disposed = false
  const disconnect = () => {
    if (disposed) return
    disposed = true
    connected.delete(entry)
    stops.reverse().forEach((stop) => stop())
  }
  connected.set(entry, disconnect)
  return disconnect
}

export function disconnectPageEffects(entry: Entry) {
  connected.get(entry)?.()
}

/** Logical activity alone also includes pages in unselected tabs. */
export function pageVisible(entry: Entry, page: Page): boolean {
  if (entry.disposed || !entry.isActive() || !page.isLoaded) return false
  const frame = page.frame
  if (!frame || frame.currentPage !== page) return false
  const tab = tabOf(frame)
  return !tab || tab.tabView.selectedIndex === tab.index
}

export function watchPageVisibility(
  entry: Entry,
  page: Page,
  changed: (visible: boolean) => void,
): () => void {
  let frame: Frame | undefined
  let tab: ReturnType<typeof tabOf>
  let visible: boolean | undefined
  const update = () => {
    if (frame !== page.frame) {
      frame?.off(Frame.navigatedToEvent, update)
      tab?.tabView.off('selectedIndexChanged', update)
      frame = page.frame
      tab = frame && tabOf(frame)
      frame?.on(Frame.navigatedToEvent, update)
      tab?.tabView.on('selectedIndexChanged', update)
    }
    const value = pageVisible(entry, page)
    if (value !== visible) changed((visible = value))
  }
  const stop = watch(computed(entry.isActive), update, { flush: 'sync' })
  for (const event of ['loaded', 'unloaded', 'navigatedTo']) page.on(event, update)
  update()
  return () => {
    stop()
    for (const event of ['loaded', 'unloaded', 'navigatedTo']) page.off(event, update)
    frame?.off(Frame.navigatedToEvent, update)
    tab?.tabView.off('selectedIndexChanged', update)
  }
}
