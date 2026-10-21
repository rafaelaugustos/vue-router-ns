import {
  isIOS,
  isAccessibilityServiceEnabled,
  type Page,
  type View,
} from '@nativescript/core'
import { inject, nextTick, onUnmounted } from 'nativescript-vue'
import { entryKey } from './injection.js'
import { viewOf } from './ios.js'
import { pageEffect, pageVisible, watchPageVisibility } from './page-effects.js'
import type { Entry, Stack } from './stack.js'
import type { ZoomSource } from './types.js'

export type NavigationFocusTarget =
  string | ZoomSource | (() => ZoomSource | null | undefined)
export interface NavigationFocusOptions {
  initial?: NavigationFocusTarget
  /** Explicit target on back or modal return; otherwise core restores its last focus. */
  return?: NavigationFocusTarget
}
export interface NavigationFocus {
  /** Remember an initiating element before opening a modal, including from a split list. */
  remember(target?: NavigationFocusTarget): void
  /** Explicit accessibility focus; never requests keyboard/input focus. */
  focus(kind?: 'initial' | 'return'): boolean
}

const settled = new WeakMap<Entry, (returning: boolean) => void>()
const owners = new WeakMap<Stack, Entry>()
declare const UIAccessibilityPostNotification: (
  notification: number,
  target: unknown,
) => void
declare const UIAccessibilityLayoutChangedNotification: number

/** Called only after the router has reconciled a successful native transition. */
export function settleNavigationFocus(entry: Entry | undefined, returning: boolean) {
  if (entry) settled.get(entry)?.(returning)
}
export function modalFocusOrigin(stack: Stack): Entry | undefined {
  const entry = owners.get(stack)
  owners.delete(stack)
  return entry?.page && pageVisible(entry, entry.page) ? entry : undefined
}
export function clearFocusOrigin(stack: Stack) {
  owners.delete(stack)
}

/** A keyboard callback also has a concrete initiating pane. */
export function commandFocusOrigin(entry: Entry): () => void {
  const previous = owners.get(entry.stack)
  owners.set(entry.stack, entry)
  return () => {
    if (owners.get(entry.stack) !== entry) return
    if (previous) owners.set(entry.stack, previous)
    else owners.delete(entry.stack)
  }
}

export function useNavigationFocus(options: NavigationFocusOptions): NavigationFocus {
  const entry = inject(entryKey, null)
  if (!entry) throw new Error('useNavigationFocus() must be used inside a routed page')
  let page: Page | undefined
  let remembered: NavigationFocusTarget | undefined
  const target = (value: NavigationFocusTarget | undefined) => {
    if (!page || value === undefined) return
    const source = typeof value === 'function' ? value() : value
    return typeof source === 'string' ? page.getViewById<View>(source) : viewOf(source)
  }
  const focus = (returning: boolean) => {
    if (!page || !pageVisible(entry, page) || !isAccessibilityServiceEnabled())
      return false
    const view = target(returning ? (remembered ?? options.return) : options.initial)
    if (!view?.isLoaded || !belongsTo(view, page)) return false
    for (
      let current: View | null = view;
      current;
      current = current.parent as View | null
    ) {
      if (current.accessibilityHidden || current.visibility !== 'visible') return false
      if (current === page) break
    }
    if (isIOS) {
      if (typeof UIAccessibilityPostNotification !== 'function' || !view.ios) return false
      UIAccessibilityPostNotification(UIAccessibilityLayoutChangedNotification, view.ios)
      return true
    }
    return !!view.nativeViewProtected?.performAccessibilityAction(64, null)
  }
  const unregister = pageEffect(entry, (view) => {
    if (settled.has(entry))
      throw new Error('Only one useNavigationFocus() may own a page')
    page = view
    let version = 0
    let disposed = false
    let pending: { returning: boolean } | undefined
    let queued = false
    const original = view.accessibilityScreenChanged
    const hidden = view.accessibilityHidden
    // Core announces Page.navigatedTo before Frame reconciliation. Hold that
    // announcement until sync confirms a changed entry; cancellation has none.
    const intercept = () => {}
    view.accessibilityScreenChanged = intercept
    const schedule = () => {
      if (queued || !pending) return
      queued = true
      const token = version
      void nextTick(() => {
        queued = false
        if (disposed) return
        if (token !== version) {
          schedule()
          return
        }
        // On Android a returned Page can load after the Frame completes.
        // Keep the confirmed request until loaded/tab visibility catches up.
        if (!pending || !pageVisible(entry, view)) return
        const { returning } = pending
        pending = undefined
        if (!view.accessibilityAnnouncePageEnabled) return
        if (!focus(returning)) original.call(view, returning)
      })
    }
    const stopVisibility = watchPageVisibility(entry, view, (visible) => {
      view.accessibilityHidden = hidden || !visible
      if (visible) schedule()
    })
    settled.set(entry, (returning) => {
      ++version
      pending = { returning }
      schedule()
    })
    return () => {
      disposed = true
      pending = undefined
      stopVisibility()
      settled.delete(entry)
      if (owners.get(entry.stack) === entry) owners.delete(entry.stack)
      if (view.accessibilityScreenChanged === intercept)
        view.accessibilityScreenChanged = original
      view.accessibilityHidden = hidden
      page = undefined
    }
  })
  onUnmounted(unregister)
  return {
    remember(value) {
      if (!page || !pageVisible(entry, page)) return
      remembered = value ?? options.return
      owners.set(entry.stack, entry)
    },
    focus: (kind = 'initial') => focus(kind === 'return'),
  }
}

function belongsTo(view: View, page: Page): boolean {
  for (let current: View | null = view; current; current = current.parent as View | null)
    if (current === page) return true
  return false
}
