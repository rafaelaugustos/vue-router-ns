import { isIOS, SearchBar, type Page } from '@nativescript/core'
import {
  inject,
  onUnmounted,
  shallowRef,
  toValue,
  watch,
  type MaybeRefOrGetter,
  type Ref,
} from 'nativescript-vue'
import { entryKey } from './injection.js'
import { pageEffect, pageVisible, watchPageVisibility } from './page-effects.js'

export interface NativeSearchOptions {
  /** App-owned state. Typing never navigates or changes the route query. */
  query: Ref<string>
  placeholder?: MaybeRefOrGetter<string>
  onSubmit?: (query: string) => void
  ios?: { hidesWhenScrolling?: boolean }
}

export interface NativeSearch {
  readonly active: Readonly<Ref<boolean>>
  /** Returns false while this page is covered, unloaded, or in an unselected tab. */
  activate(): boolean
  /** Dismisses the keyboard/search UI, preserving the query. */
  dismiss(): boolean
}

interface SearchBinding {
  activate(): void
  dismiss(): void
  dispose(): void
}
const searches = new WeakMap<Page, NativeSearch>()

/** Used by keyboard Escape before considering a modal dismissal. */
export function dismissPageSearch(page: Page): boolean {
  return searches.get(page)?.dismiss() ?? false
}

/** Native search owned by this routed page, not a process-global navigation bar. */
export function useNativeSearch(options: NativeSearchOptions): NativeSearch {
  const entry = inject(entryKey, null)
  if (!entry) throw new Error('useNativeSearch() must be used inside a routed page')
  const active = shallowRef(false)
  let page: Page | undefined
  let binding: SearchBinding | undefined
  const search: NativeSearch = {
    active,
    activate() {
      if (!page || !binding || !pageVisible(entry, page)) return false
      active.value = true
      binding.activate()
      return true
    },
    dismiss() {
      if (!active.value) return false
      active.value = false
      binding?.dismiss()
      return true
    },
  }
  const unregister = pageEffect(entry, (nativePage) => {
    if (searches.has(nativePage))
      throw new Error('Only one useNativeSearch() may own a page')
    page = nativePage
    searches.set(page, search)
    binding = isIOS ? bindIOS(page, options, active) : bindAndroid(page, options, active)
    const stopVisibility = watchPageVisibility(entry, page, (visible) => {
      if (!visible) search.dismiss()
    })
    return () => {
      stopVisibility()
      search.dismiss()
      binding?.dispose()
      binding = undefined
      searches.delete(nativePage)
      page = undefined
    }
  })
  onUnmounted(unregister)
  return search
}

function bindAndroid(
  page: Page,
  options: NativeSearchOptions,
  active: Ref<boolean>,
): SearchBinding {
  const bar = page.actionBar
  const previous = bar.titleView
  const view = new SearchBar()
  const changed = () => {
    options.query.value = view.text ?? ''
  }
  const submitted = () => {
    view.dismissSoftInput()
    options.onSubmit?.(options.query.value)
  }
  view.on('textChange', changed)
  view.on('submit', submitted)
  const stop = watch(
    () => [options.query.value, toValue(options.placeholder)] as const,
    ([query, hint]) => {
      if (view.text !== query) view.text = query
      view.hint = hint ?? ''
    },
    { immediate: true },
  )
  const dismiss = () => {
    view.dismissSoftInput()
    view.android?.clearFocus()
    if (bar.titleView === view) bar.titleView = previous
    active.value = false
  }
  return {
    activate() {
      bar.titleView = view
      view.focus()
    },
    dismiss,
    dispose() {
      dismiss()
      stop()
      view.off('textChange', changed)
      view.off('submit', submitted)
    },
  }
}

declare const NSObject: { extend(methods: object, options: object): { new (): any } }
declare const UISearchController: {
  alloc(): { initWithSearchResultsController(value: null): any }
}
declare const UISearchResultsUpdating: unknown
declare const UISearchControllerDelegate: unknown
declare const UISearchBarDelegate: unknown
let SearchDelegate: { new (): any } | undefined

function bindIOS(
  page: Page,
  options: NativeSearchOptions,
  active: Ref<boolean>,
): SearchBinding | undefined {
  const controller = page.ios
  const item = controller?.navigationItem
  if (!item || typeof UISearchController === 'undefined') return
  if (item.searchController) {
    if (__DEV__) console.warn('[vue-router-ns] This page already owns a searchController')
    return
  }
  SearchDelegate ??= NSObject.extend(
    {
      updateSearchResultsForSearchController(this: any, search: any) {
        this.change?.(String(search.searchBar.text ?? ''))
      },
      didPresentSearchController(this: any) {
        this.present?.()
      },
      willDismissSearchController(this: any) {
        this.dismiss?.()
      },
      didDismissSearchController(this: any) {
        this.dismiss?.()
      },
      searchBarSearchButtonClicked(this: any, bar: any) {
        bar.resignFirstResponder()
        this.submit?.()
      },
    },
    {
      protocols: [
        UISearchResultsUpdating,
        UISearchControllerDelegate,
        UISearchBarDelegate,
      ],
    },
  )
  const native = UISearchController.alloc().initWithSearchResultsController(null)
  native.obscuresBackgroundDuringPresentation = false
  let writing = false
  const delegate = Object.assign(new SearchDelegate(), {
    change: (text: string) => {
      // UIKit clears its text during dismissal/activation. That is UI cleanup,
      // not an app request to discard the saved filter.
      if (!writing && native.active && active.value) options.query.value = text
    },
    present: () => {
      active.value = true
    },
    dismiss: () => {
      active.value = false
    },
    submit: () => options.onSubmit?.(options.query.value),
  })
  native.searchResultsUpdater = delegate
  native.delegate = delegate
  native.searchBar.delegate = delegate
  const previous = {
    context: controller.definesPresentationContext,
    hides: item.hidesSearchBarWhenScrolling,
  }
  controller.definesPresentationContext = true
  item.searchController = native
  item.hidesSearchBarWhenScrolling = options.ios?.hidesWhenScrolling ?? true
  const stop = watch(
    () => [options.query.value, toValue(options.placeholder)] as const,
    ([query, hint]) => {
      writing = true
      if (String(native.searchBar.text ?? '') !== query) native.searchBar.text = query
      native.searchBar.placeholder = hint ?? ''
      writing = false
    },
    { immediate: true },
  )
  const dismiss = () => {
    writing = true
    active.value = false
    native.searchBar.resignFirstResponder()
    native.active = false
    writing = false
  }
  return {
    activate() {
      writing = true
      native.active = true
      native.searchBar.text = options.query.value
      writing = false
      native.searchBar.becomeFirstResponder()
    },
    dismiss,
    dispose() {
      stop()
      dismiss()
      native.delegate = null
      native.searchResultsUpdater = null
      native.searchBar.delegate = null
      delegate.change = delegate.present = delegate.dismiss = delegate.submit = null
      if (item.searchController === native) {
        item.searchController = null
        item.hidesSearchBarWhenScrolling = previous.hides
        controller.definesPresentationContext = previous.context
      }
    },
  }
}
