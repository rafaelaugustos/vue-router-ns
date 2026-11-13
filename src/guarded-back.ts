import { Device, type Page } from '@nativescript/core'
import { watch } from 'nativescript-vue'
import { isBlocked, type Entry } from './stack.js'
import { pageVisible, watchPageVisibility } from './page-effects.js'

declare const UIBarButtonItem: any
declare const UIAction: any
declare const UIImage: any
declare const UIMenu: any
declare const UIDeferredMenuElement: any
declare const UIContextMenuInteraction: any

/** Dismiss header context menus through public UIView/interaction APIs. */
export function dismissBarMenus(view: any): void {
  if (!view || typeof UIContextMenuInteraction === 'undefined') return
  for (const interaction of Array.from(view.interactions ?? []) as any[])
    if (interaction instanceof UIContextMenuInteraction) interaction.dismissMenu()
  for (const child of Array.from(view.subviews ?? [])) dismissBarMenus(child)
}

/** A native history menu can remove a guarded page below an unguarded top. */
export function hasGuardedHistory(entry: Entry): boolean {
  const entries = entry.stack.entries.value
  const index = entries.indexOf(entry)
  return index > 0 && entries.slice(1, index + 1).some(isBlocked)
}

/**
 * UIKit backAction only intercepts the short tap. While history can remove a
 * guarded page, use a public bar item with a primary action and an exact-entry
 * menu. ActionBar.update remains responsible for all app-owned header items.
 */
export function bindGuardedBack(entry: Entry, page: Page): () => void {
  if (parseFloat(Device.sdkVersion) < 16) return () => {}
  const bar = page.actionBar
  const item = page.ios?.navigationItem
  if (!item || typeof bar?.update !== 'function') return () => {}
  const original = bar.update
  let active = true,
    busy = false,
    guarded = false,
    version = 0
  let button: any
  let previous: { items: any; hidden: boolean; action: any } | undefined
  const available = () =>
    active && !busy && !entry.stack.pending && pageVisible(entry, page)
  const report = (error: unknown) =>
    console.error('[vue-router-ns] Guarded Back failed:', error)
  const run = (navigation: () => Promise<unknown>) => {
    if (!available()) return
    busy = true
    void navigation()
      .catch(report)
      .finally(() => {
        busy = false
      })
  }
  const restore = () => {
    version++
    if (!button) return
    button.menu = null
    button.enabled = false
    const items: any[] = Array.from(item.leftBarButtonItems ?? [])
    if (items.includes(button)) {
      item.setLeftBarButtonItemsAnimated(
        items.filter((candidate) => candidate !== button),
        false,
      )
      // Do not replace app-owned items added since this binding installed its item.
      if (item.hidesBackButton === true) item.hidesBackButton = previous?.hidden ?? false
      if (item.backAction == null) item.backAction = previous?.action ?? null
    }
    button = undefined
    previous = undefined
  }
  const apply = () => {
    if (
      !active ||
      !guarded ||
      !pageVisible(entry, page) ||
      item.hidesBackButton ||
      page.actionBarHidden
    )
      return
    const history = entry.stack.router.getHistory()
    if (
      !history ||
      history.entries.at(-1)?.key !== entry.key ||
      history.entries.length < 2
    )
      return
    const before = entry.stack.entries.value.at(-2)!
    const label =
      bar.navigationButton?.text ||
      before.page?.actionBar.title ||
      String(before.route.name ?? before.route.fullPath)
    const current = ++version
    const primary = UIAction.actionWithTitleImageIdentifierHandler(
      label,
      UIImage.systemImageNamed('chevron.backward'),
      null,
      () => {
        if (current === version) run(() => entry.stack.router.back())
      },
    )
    const deferred = UIDeferredMenuElement.elementWithUncachedProvider(
      (complete: (items: any[]) => void) => {
        if (current !== version || !available()) {
          complete([])
          return
        }
        const snapshot = entry.stack.router.getHistory()!
        const top = snapshot.entries.at(-1)!
        const actions = snapshot.entries
          .slice(0, -1)
          .map((target, index) => {
            const title =
              entry.stack.entries.value[index]?.page?.actionBar.title ||
              String(target.route.name ?? target.route.fullPath)
            return UIAction.actionWithTitleImageIdentifierHandler(
              `${title} (${index + 1})`,
              null,
              target.id,
              () => {
                if (
                  current !== version ||
                  entry.stack.router.getHistory()?.entries.at(-1)?.id !== top.id
                )
                  return
                run(() => entry.stack.router.backToEntry(target))
              },
            )
          })
          .reverse()
        complete(actions)
      },
    )
    button = UIBarButtonItem.alloc().initWithPrimaryActionMenu(
      primary,
      UIMenu.menuWithTitleChildren('', [deferred]),
    )
    button.accessibilityLabel = label
    button.accessibilityIdentifier = 'router-guarded-back'
    previous = {
      items: item.leftBarButtonItems,
      hidden: item.hidesBackButton,
      action: item.backAction,
    }
    item.backAction = null
    item.hidesBackButton = true
    item.setLeftBarButtonItemsAnimated(
      [button, ...Array.from(previous.items ?? [])],
      false,
    )
  }
  // ActionBar.update is public. Scope the extension to this Page and restore it
  // only while still owned; later app/plugin wrappers must not be overwritten.
  const update = function (this: typeof bar) {
    if (guarded || button) dismissBarMenus(page.ios?.navigationController?.navigationBar)
    restore()
    original.call(this)
    apply()
  }
  bar.update = update
  const stop = watch(
    () =>
      [
        entry.stack.entries.value.at(-1) === entry && hasGuardedHistory(entry),
        entry.stack.entries.value,
      ] as const,
    ([value]) => {
      guarded = value
      if (guarded || button) update.call(bar)
    },
    { immediate: true, flush: 'sync' },
  )
  const stopVisibility = watchPageVisibility(entry, page, () => {
    if (guarded || button) update.call(bar)
  })
  return () => {
    active = false
    stop()
    stopVisibility()
    if (button) dismissBarMenus(page.ios?.navigationController?.navigationBar)
    restore()
    if (bar.update === update) bar.update = original
  }
}
