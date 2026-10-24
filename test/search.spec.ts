import { afterEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick, ref } from 'nativescript-vue'
import {
  RouterSplitView,
  RouterView,
  useNativeSearch,
  type NativeSearch,
  type SearchBarPlacement,
} from '../src/index.js'
import { dismissPageSearch } from '../src/search.js'
import { mount, page, settle } from './helpers.js'
import { SearchBar, TabView } from './shims/core.js'
import { views } from './shims/nativescript-vue.js'

afterEach(() => vi.unstubAllGlobals())

function stubUIKitSearch() {
  vi.stubGlobal('NSObject', {
    extend: (methods: object) => {
      class Delegate {}
      Object.assign(Delegate.prototype, methods)
      return Delegate
    },
  })
  for (const protocol of [
    'UISearchResultsUpdating',
    'UISearchControllerDelegate',
    'UISearchBarDelegate',
  ])
    vi.stubGlobal(protocol, {})
  vi.stubGlobal('UINavigationItemSearchBarPlacement', {
    Automatic: 0,
    Inline: 1,
    Stacked: 2,
    Integrated: 3,
  })
  const native: any = {
    searchBar: { text: '', becomeFirstResponder() {}, resignFirstResponder() {} },
  }
  vi.stubGlobal('UISearchController', {
    alloc: () => ({ initWithSearchResultsController: () => native }),
  })
  return native
}

describe('page-owned native search', () => {
  it('dismisses under a modal and preserves the query when it closes', async () => {
    let search!: NativeSearch
    const query = ref('keep')
    const { router, app } = await mount(
      [
        {
          path: '/',
          component: page('List', () => {
            search = useNativeSearch({ query })
          }),
        },
        { path: '/modal', component: page('Modal'), modal: true },
      ],
      { platform: 'android' },
    )
    search.activate()
    await router.push('/modal')
    expect(search.active.value).toBe(false)
    expect(search.activate()).toBe(false)
    await router.back()
    expect(search.activate()).toBe(true)
    expect(query.value).toBe('keep')
    app.unmount()
  })

  it('does not activate a page in another tab', async () => {
    const searches: NativeSearch[] = []
    const Page = page('List', () => {
      searches.push(useNativeSearch({ query: ref('') }))
    })
    const { app } = await mount([{ path: '/', component: Page }], {
      platform: 'android',
      render: () =>
        h('TabView', {}, [
          h('TabViewItem', {}, [h(RouterView, { name: 'a' })]),
          h('TabViewItem', {}, [h(RouterView, { name: 'b' })]),
        ]),
    })
    await settle()
    expect(searches[0]!.activate()).toBe(true)
    expect(searches[1]!.activate()).toBe(false)
    const tab = views.get('TabView')!.at(-1) as TabView
    tab.selectedIndex = 1
    tab.notify({ eventName: 'selectedIndexChanged' })
    expect(searches[0]!.active.value).toBe(false)
    expect(searches[1]!.activate()).toBe(true)
    app.unmount()
  })

  it('keeps search available in a visible split list, and dismisses on collapse', async () => {
    let search!: NativeSearch
    const { app, router } = await mount(
      [
        {
          path: '/',
          component: page('List', () => {
            search = useNativeSearch({ query: ref('') })
          }),
        },
        { path: '/detail', component: page('Detail') },
      ],
      { platform: 'android', render: () => h(RouterSplitView, { list: '/' }) },
    )
    const layout = views.get('Frame')!.at(-2)!.parent!
    layout.width = 1000
    layout.notify({ eventName: 'layoutChanged' })
    await nextTick()
    await router.push('/detail')
    expect(search.activate()).toBe(true)
    layout.width = 400
    layout.notify({ eventName: 'layoutChanged' })
    await nextTick()
    expect(search.active.value).toBe(false)
    app.unmount()
  })
  it('preserves app query through a push/back and never changes route history while typing', async () => {
    const query = ref('initial')
    let search!: NativeSearch
    const { app, router, frame } = await mount(
      [
        {
          path: '/',
          component: page('List', () => {
            search = useNativeSearch({ query })
          }),
        },
        { path: '/detail', component: page('Detail') },
      ],
      { platform: 'android' },
    )
    const list = frame().currentPage!
    expect(search.activate()).toBe(true)
    const native = list.actionBar.titleView as SearchBar
    expect(native.text).toBe('initial')
    native.text = 'query'
    native.notify({ eventName: 'textChange' })
    expect(query.value).toBe('query')
    expect(router.stack.value).toHaveLength(1)
    await router.push('/detail')
    expect(search.active.value).toBe(false)
    expect(list.actionBar.titleView).toBeUndefined()
    expect(search.activate()).toBe(false)
    await router.back()
    expect(search.activate()).toBe(true)
    expect((list.actionBar.titleView as SearchBar).text).toBe('query')
    expect(dismissPageSearch(list as any)).toBe(true)
    expect(dismissPageSearch(list as any)).toBe(false)
    app.unmount()
    expect(native.listenerCount('textChange')).toBe(0)
  })

  it('does not dismiss the search when a leave guard aborts', async () => {
    const { onBeforeRouteLeave } = await import('../src/index.js')
    let search!: NativeSearch
    const { app, router } = await mount(
      [
        {
          path: '/',
          component: page('List', () => {
            search = useNativeSearch({ query: ref('saved') })
            onBeforeRouteLeave(() => false)
          }),
        },
        { path: '/detail', component: page('Detail') },
      ],
      { platform: 'android' },
    )
    search.activate()
    await router.replace('/detail')
    expect(search.active.value).toBe(true)
    app.unmount()
  })

  it('uses a page-local UISearchController without touching core delegates or backAction', async () => {
    const native = stubUIKitSearch()
    let search!: NativeSearch
    const query = ref('before')
    const { app, router, frame } = await mount([
      {
        path: '/',
        component: page('List', () => {
          search = useNativeSearch({ query })
        }),
      },
      { path: '/detail', component: page('Detail') },
    ])
    const item = frame().currentPage!.ios.navigationItem
    const controller = frame().currentPage!.ios
    expect(item.searchController).toBe(native)
    expect(item.backAction).toBeNull()
    search.activate()
    native.searchBar.text = 'native query'
    native.searchResultsUpdater.updateSearchResultsForSearchController(native)
    expect(query.value).toBe('native query')
    native.delegate.willDismissSearchController(native)
    native.active = false
    native.searchBar.text = ''
    native.searchResultsUpdater.updateSearchResultsForSearchController(native)
    expect(query.value).toBe('native query')
    search.activate()
    expect(native.searchBar.text).toBe('native query')
    query.value = 'app query'
    await settle()
    expect(native.searchBar.text).toBe('app query')
    await router.push('/detail')
    expect(native.active).toBe(false)
    expect(item.searchController).toBe(native)
    await router.back()
    search.activate()
    expect(native.searchBar.text).toBe('app query')
    app.unmount()
    expect(item.searchController).toBeNull()
    expect(native.searchResultsUpdater).toBeNull()
    expect(controller.definesPresentationContext).toBeUndefined()
  })

  it('releases only the completed search presentation cached by Core during push', async () => {
    const native = stubUIKitSearch()
    let search!: NativeSearch
    const { app, frame } = await mount([
      {
        path: '/',
        component: page('List', () => {
          search = useNativeSearch({ query: ref('retained') })
        }),
      },
    ])
    const owner = frame().currentPage! as any
    search.activate()
    owner._presentedViewController = native
    owner.ios.presentedViewController = native
    native.delegate.didDismissSearchController(native)
    expect(owner._presentedViewController).toBe(native)
    native.active = false
    native.delegate.didDismissSearchController(native)
    expect(owner._presentedViewController).toBe(native)
    owner.ios.presentedViewController = null
    native.delegate.didDismissSearchController(native)
    expect(owner._presentedViewController).toBeNull()
    const modal = {}
    owner._presentedViewController = modal
    native.delegate.didDismissSearchController(native)
    expect(owner._presentedViewController).toBe(modal)
    app.unmount()
  })

  it('stacks the iOS search bar under the title inside a TabView, and only there', async () => {
    stubUIKitSearch()
    const List = (placement?: SearchBarPlacement) =>
      page('List', () => {
        useNativeSearch({ query: ref(''), ios: placement ? { placement } : undefined })
      })
    const tabbed = await mount([{ path: '/', component: List() }], {
      render: () => h('TabView', {}, [h('TabViewItem', {}, [h(RouterView)])]),
    })
    const item = tabbed.frame().currentPage!.ios.navigationItem
    expect(item.preferredSearchBarPlacement).toBe(2)
    tabbed.app.unmount()
    expect(item.preferredSearchBarPlacement).toBeUndefined()

    const plain = await mount([{ path: '/', component: List() }])
    expect(
      plain.frame().currentPage!.ios.navigationItem.preferredSearchBarPlacement,
    ).toBeUndefined()
    plain.app.unmount()

    const explicit = await mount([{ path: '/', component: List('integrated') }])
    expect(
      explicit.frame().currentPage!.ios.navigationItem.preferredSearchBarPlacement,
    ).toBe(3)
    explicit.app.unmount()

    vi.stubGlobal('UINavigationItemSearchBarPlacement', {
      Automatic: 0,
      Inline: 1,
      Stacked: 2,
    })
    const older = await mount([{ path: '/', component: List('integrated') }])
    expect(
      older.frame().currentPage!.ios.navigationItem.preferredSearchBarPlacement,
    ).toBeUndefined()
    older.app.unmount()
  })
})
