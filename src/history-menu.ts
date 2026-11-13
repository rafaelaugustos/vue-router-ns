import type { Page, View } from '@nativescript/core'
import {
  inject,
  onUnmounted,
  readonly,
  shallowRef,
  toValue,
  watch,
  type MaybeRefOrGetter,
  type Ref,
} from 'nativescript-vue'
import { entryKey } from './injection.js'
import type { NavigationHistory, NavigationHistoryEntry } from './history.js'
import { pageEffect, pageVisible, watchPageVisibility } from './page-effects.js'
import { presentHistoryMenu } from './history-menu-native.js'

export interface BackHistoryMenuOptions {
  /** iOS action-sheet heading and cancellation label; read when opening. */
  title?: MaybeRefOrGetter<string>
  cancelTitle?: MaybeRefOrGetter<string>
  /** Root-based index; include enough context to distinguish duplicate locations. */
  label?: (
    entry: NavigationHistoryEntry,
    index: number,
    history: NavigationHistory,
  ) => string
  onError?: (error: unknown) => void
}

export interface BackHistoryMenu {
  readonly active: Readonly<Ref<boolean>>
  /** Open from long press, an accessible button or a command. Idempotent while open; never navigates. */
  show(source: View): boolean
  dismiss(): boolean
}

const openMenus = new WeakMap<Page, BackHistoryMenu>()

/** Escape closes transient history UI before considering a route/modal dismissal. */
export function dismissPageHistoryMenu(page: Page): boolean {
  return openMenus.get(page)?.dismiss() ?? false
}

/** Optional menu for app-owned controls. Leaves the system Back button untouched. */
export function useBackHistoryMenu(
  options: BackHistoryMenuOptions = {},
): BackHistoryMenu {
  const entry = inject(entryKey, null)
  if (!entry) throw new Error('useBackHistoryMenu() must be used inside a routed page')
  const active = shallowRef(false)
  let page: Page | undefined
  let release: (() => void) | undefined
  let version = 0
  let disposed = false
  const available = () =>
    !disposed &&
    !!page &&
    !entry.stack.closed &&
    !entry.stack.pending &&
    pageVisible(entry, page)
  const owns = (source: View) => {
    let owner: View | null = source
    while (owner && owner !== page) owner = owner.parent as View | null
    return !!page && owner === page
  }
  const report = (error: unknown) => {
    if (options.onError) {
      try {
        options.onError(error)
      } catch (reportError) {
        console.error(
          '[vue-router-ns] History menu error handler failed:',
          reportError,
          'Original error:',
          error,
        )
      }
    } else console.error('[vue-router-ns] History menu failed:', error)
  }
  const menu: BackHistoryMenu = {
    active: readonly(active),
    show(source) {
      if (!available() || !source?.isLoaded) return false
      if (!owns(source)) return false
      // NativeScript longPress reports began/ended (and cancellation on presentation).
      // Repeated show calls must not dismiss the menu that just opened.
      if (active.value) return true
      const history = entry.stack.router.getHistory()
      if (!history || history.entries.length < 2) return false
      const top = history.entries.at(-1)!
      const choices = history.entries
        .slice(0, -1)
        .map((target, index) => ({
          target,
          title:
            options.label?.(target, index, history) ||
            `${String(target.route.name ?? target.route.fullPath)} (${index + 1})`,
        }))
        .reverse()
      dismissPageHistoryMenu(page!)
      menu.dismiss()
      const current = ++version
      const binding = presentHistoryMenu(source, {
        title: toValue(options.title) ?? 'Back history',
        cancelTitle: toValue(options.cancelTitle) ?? 'Cancel',
        labels: choices.map((choice) => choice.title),
        close: () => {
          if (current === version) menu.dismiss()
        },
        select: (index) => {
          if (current !== version) return
          const target = choices[index]?.target
          const latest = entry.stack.router.getHistory()
          const valid =
            available() &&
            source.isLoaded &&
            owns(source) &&
            target &&
            latest?.entries.at(-1)?.id === top.id &&
            latest.entries.some((candidate) => candidate.id === target.id)
          menu.dismiss()
          if (valid) void entry.stack.router.backToEntry(target).catch(report)
        },
      })
      if (!binding) return false
      active.value = true
      openMenus.set(page!, menu)
      source.on('unloaded', menu.dismiss)
      release = () => {
        source.off('unloaded', menu.dismiss)
        binding.dismiss()
      }
      return true
    },
    dismiss() {
      const wasOpen = active.value
      version++
      active.value = false
      if (page && openMenus.get(page) === menu) openMenus.delete(page)
      const stop = release
      release = undefined
      stop?.()
      return wasOpen
    },
  }
  const unregister = pageEffect(entry, (nativePage) => {
    page = nativePage
    const stopVisibility = watchPageVisibility(entry, page, (visible) => {
      if (!visible) menu.dismiss()
    })
    const stopHistory = watch(entry.stack.entries, () => menu.dismiss(), {
      flush: 'sync',
    })
    return () => {
      stopVisibility()
      stopHistory()
      menu.dismiss()
      page = undefined
    }
  })
  onUnmounted(() => {
    disposed = true
    menu.dismiss()
    unregister()
  })
  return menu
}
