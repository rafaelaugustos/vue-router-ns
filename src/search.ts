import { Frame, isIOS, SearchBar, type Page } from '@nativescript/core'
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
import type { Entry } from './stack.js'
import { tabOf } from './tabs.js'

/** Where UIKit puts the search bar: `UINavigationItem.preferredSearchBarPlacement`. */
export type SearchBarPlacement = 'automatic' | 'stacked' | 'inline' | 'integrated'

export interface NativeSearchOptions {
  /** App-owned state. Typing never navigates or changes the route query. */
  query: Ref<string>
  placeholder?: MaybeRefOrGetter<string>
  onSubmit?: (query: string) => void
  ios?: {
    hidesWhenScrolling?: boolean
    /**
     * iOS 16+. Defaults to `stacked` under the title inside a `TabView`,
     * where iOS 26's automatic bottom placement sits behind the tab bar, and
     * to `automatic` elsewhere. `integrated` needs iOS 26 and is otherwise
     * ignored.
     */
    placement?: SearchBarPlacement
  }
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
    binding = isIOS
      ? bindIOS(entry, page, options, active)
      : bindAndroid(page, options, active)
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

declare const UINavigationItemSearchBarPlacement:
  Record<string, number | undefined> | undefined
const PLACEMENTS: Record<Exclude<SearchBarPlacement, 'automatic'>, string> = {
  stacked: 'Stacked',
  inline: 'Inline',
  integrated: 'Integrated',
}

function placementValue(placement: SearchBarPlacement): number | undefined {
  if (
    placement === 'automatic' ||
    typeof UINavigationItemSearchBarPlacement === 'undefined'
  )
    return undefined
  return UINavigationItemSearchBarPlacement[PLACEMENTS[placement]]
}

/** The page binds before its Frame adopts it; the stack's host already knows the Frame. */
function frameOf(entry: Entry, page: Page): Frame | undefined {
  if (page.frame) return page.frame
  const host = entry.stack.host
  const native = host?.parts?.()[0]?.native ?? host?.native
  return native instanceof Frame ? native : undefined
}

function bindIOS(
  entry: Entry,
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
        this.dismissed?.()
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
    dismissed: () => {
      // Core 9.1.3 captures the presented controller in Page.viewWillDisappear.
      // When search is dismissed under a pushed Page, that cached search can
      // survive until Back and make Core skip setCurrent/unload for one return.
      // Release only our completed presentation; never clear a real modal or
      // another owner's controller, and never replace a navigation delegate.
      const owner = page as unknown as { _presentedViewController?: unknown }
      if (
        !native.active &&
        controller.presentedViewController !== native &&
        owner._presentedViewController === native
      )
        owner._presentedViewController = null
    },
    submit: () => options.onSubmit?.(options.query.value),
  })
  native.searchResultsUpdater = delegate
  native.delegate = delegate
  native.searchBar.delegate = delegate
  const previous = {
    context: controller.definesPresentationContext,
    hides: item.hidesSearchBarWhenScrolling,
    placement: item.preferredSearchBarPlacement,
  }
  controller.definesPresentationContext = true
  item.searchController = native
  item.hidesSearchBarWhenScrolling = options.ios?.hidesWhenScrolling ?? true
  const frame = frameOf(entry, page)
  const placement = placementValue(
    options.ios?.placement ?? (frame && tabOf(frame) ? 'stacked' : 'automatic'),
  )
  if (placement !== undefined) item.preferredSearchBarPlacement = placement
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
      delegate.change =
        delegate.present =
        delegate.dismiss =
        delegate.dismissed =
        delegate.submit =
          null
      if (item.searchController === native) {
        item.searchController = null
        item.hidesSearchBarWhenScrolling = previous.hides
        if (placement !== undefined) item.preferredSearchBarPlacement = previous.placement
        controller.definesPresentationContext = previous.context
      }
    },
  }
}
