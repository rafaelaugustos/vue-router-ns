import {
  isAndroid,
  isIOS,
  TabView,
  TabViewItem,
  type Frame,
  type View,
} from '@nativescript/core'

type Callback = () => void

/** What the router reads from a tab container: core's `TabView` or `<RouterTabs>`' Android host. */
export interface TabLike {
  selectedIndex: number
  on(event: string, callback: (data: any) => void): void
  off(event: string, callback?: (data: any) => void): void
}
interface RouterTabsHostLike extends TabLike {
  routerTabsHost: true
  getChildIndex(view: View): number
}

interface Watched {
  callbacks: Map<number, Set<Callback>>
  detach: () => void
}

const watched = new WeakMap<TabLike, Watched>()
const vetoes = new WeakMap<TabView, (index: number) => boolean>()

/** The tab a frame sits in, if any. */
export function tabOf(frame: Frame): { tabView: TabLike; index: number } | undefined {
  for (let view = frame.parent; view; view = view.parent) {
    if (view instanceof TabViewItem && view.parent instanceof TabView) {
      const tabView = view.parent
      const index = tabView.items?.indexOf(view) ?? -1
      return index < 0 ? undefined : { tabView, index }
    }
    const host = view.parent as (View & Partial<RouterTabsHostLike>) | null
    if (host?.routerTabsHost) {
      const index = host.getChildIndex!(view as View)
      return index < 0 ? undefined : { tabView: host as RouterTabsHostLike, index }
    }
  }
  return undefined
}

/** `<RouterTabs>` answers a tap on another tab with this before the widget moves. */
export function setSelectVeto(
  tabView: TabView,
  veto: ((index: number) => boolean) | undefined,
) {
  if (veto) vetoes.set(tabView, veto)
  else vetoes.delete(tabView)
}

/** Runs `callback` when the tab at `index` is tapped while already selected. */
export function onTabReselect(
  tabView: TabLike,
  index: number,
  callback: Callback,
): () => void {
  let entry = watched.get(tabView)
  if (!entry) {
    entry = { callbacks: new Map(), detach: watchTabBar(tabView) }
    watched.set(tabView, entry)
  }
  const callbacks = entry.callbacks.get(index) ?? new Set()
  entry.callbacks.set(index, callbacks)
  callbacks.add(callback)

  return () => {
    callbacks.delete(callback)
    if (callbacks.size) return
    entry.callbacks.delete(index)
    if (entry.callbacks.size) return
    entry.detach()
    watched.delete(tabView)
  }
}

/** What the platform glue calls. Exported so tests can stand in for a tap. */
export function reselected(tabView: TabLike, index: number) {
  for (const callback of [...(watched.get(tabView)?.callbacks.get(index) ?? [])])
    callback()
}

function watchTabBar(tabView: TabLike): () => void {
  if ((tabView as Partial<RouterTabsHostLike>).routerTabsHost) {
    const onReselect = (data: { index: number }) => reselected(tabView, data.index)
    tabView.on('tabReselected', onReselect)
    return () => tabView.off('tabReselected', onReselect)
  }
  if (!(tabView instanceof TabView)) return () => {}
  if (isIOS && typeof NSObject !== 'undefined') return watchIOS(tabView)
  if (isAndroid && typeof android !== 'undefined') return watchAndroid(tabView)
  return () => {}
}

// -- iOS ----------------------------------------------------------------------

interface TabBarDelegate {
  tabBarControllerShouldSelectViewController(
    controller: any,
    viewController: any,
  ): boolean
  tabBarControllerDidSelectViewController(controller: any, viewController: any): void
  tabBarControllerShouldSelectTab(controller: any, tab: any): boolean
  tabBarControllerDidSelectTabPreviousTab(controller: any, tab: any, previous: any): void
}

interface Wrapper extends TabBarDelegate {
  _inner: TabBarDelegate | null
  _tabView: WeakRef<TabView>
  _selection?: { index: number; clear: ReturnType<typeof setTimeout> }
}

declare const NSObject: { extend(methods: object, options: object): { new (): Wrapper } }
declare const UITabBarControllerDelegate: unknown

let TabBarDelegateWrapper: { new (): Wrapper } | undefined

/**
 * Core's delegate answers "no" when the selected tab is tapped again and tells
 * no one. This one sits in front of it, notices, and forwards everything.
 * Core reinstalls its delegate after `loaded`, so the wrapper goes back on then.
 */
function watchIOS(tabView: TabView): () => void {
  TabBarDelegateWrapper ??= NSObject.extend(
    {
      tabBarControllerShouldSelectViewController(
        this: Wrapper,
        controller: any,
        vc: any,
      ) {
        const index = controller.viewControllers.indexOfObject(vc)
        if (!beginSelection(this, index)) return false
        if (controller.selectedViewController === vc) notify(this, index)
        else if (!allowed(this, index)) return false
        return (
          this._inner?.tabBarControllerShouldSelectViewController(controller, vc) ?? true
        )
      },
      tabBarControllerDidSelectViewController(this: Wrapper, controller: any, vc: any) {
        this._inner?.tabBarControllerDidSelectViewController(controller, vc)
      },
      tabBarControllerShouldSelectTab(this: Wrapper, controller: any, tab: any) {
        if (!controller.viewControllers) {
          const index = controller.tabs.indexOfObject(tab)
          if (!beginSelection(this, index)) return false
          if (controller.selectedTab === tab) notify(this, index)
          else if (!allowed(this, index)) return false
        }
        return this._inner?.tabBarControllerShouldSelectTab(controller, tab) ?? true
      },
      tabBarControllerDidSelectTabPreviousTab(
        this: Wrapper,
        controller: any,
        tab: any,
        previous: any,
      ) {
        this._inner?.tabBarControllerDidSelectTabPreviousTab(controller, tab, previous)
      },
    },
    { protocols: [UITabBarControllerDelegate] },
  )

  // iOS 26 can deliver the same control action twice in one native event:
  // first through its gesture recognizer, then through touchesEnded. By the
  // second shouldSelect, UIKit already reports the target as selected. Coalesce
  // that event turn, not a time-based debounce that would swallow the next tap.
  const beginSelection = (wrapper: Wrapper, index: number) => {
    if (index < 0) return true
    if (wrapper._selection?.index === index) return false
    if (wrapper._selection) clearTimeout(wrapper._selection.clear)
    wrapper._selection = {
      index,
      clear: setTimeout(() => {
        wrapper._selection = undefined
      }, 0),
    }
    return true
  }

  const notify = (wrapper: Wrapper, index: number) => {
    const owner = wrapper._tabView.deref()
    if (owner && index >= 0) reselected(owner, index)
  }
  const allowed = (wrapper: Wrapper, index: number) => {
    const owner = wrapper._tabView.deref()
    const veto = owner && vetoes.get(owner)
    return !veto || index < 0 || veto(index)
  }

  let wrapper: Wrapper | undefined
  let detached = false
  const wrap = () => {
    if (detached) return
    const controller = tabView.ios
    if (!controller || controller.delegate === wrapper) return
    wrapper ??= Object.assign(new TabBarDelegateWrapper!(), {
      _tabView: new WeakRef(tabView),
    })
    wrapper._inner = controller.delegate ?? null
    controller.delegate = wrapper
  }
  const onLoaded = () => void Promise.resolve().then(wrap)

  tabView.on('loaded', onLoaded)
  if (tabView.isLoaded) onLoaded()

  return () => {
    detached = true
    tabView.off('loaded', onLoaded)
    if (wrapper?._selection) {
      clearTimeout(wrapper._selection.clear)
      wrapper._selection = undefined
    }
    const controller = tabView.ios
    if (wrapper && controller?.delegate === wrapper) controller.delegate = wrapper._inner
  }
}

// -- Android ------------------------------------------------------------------

declare const android: {
  view: {
    MotionEvent: { ACTION_UP: number }
    View: { OnTouchListener: new (methods: object) => object }
  }
}

/**
 * The tab strip's own click listener switches tabs, and nothing says when the
 * tap lands on the selected one. A touch listener sees the tap first, while
 * `selectedIndex` still holds the tab the finger is on, and leaves it to run.
 */
function watchAndroid(tabView: TabView): () => void {
  const ref = new WeakRef(tabView)
  const listeners = new Map<number, object>()
  const listenerFor = (index: number) =>
    new android.view.View.OnTouchListener({
      onTouch(view: any, event: any) {
        const owner = ref.deref()
        if (
          owner &&
          event.getAction() === android.view.MotionEvent.ACTION_UP &&
          owner.selectedIndex === index &&
          event.getX() >= 0 &&
          event.getY() >= 0 &&
          event.getX() <= view.getWidth() &&
          event.getY() <= view.getHeight()
        ) {
          reselected(owner, index)
        }
        return false
      },
    })

  const attach = () => {
    const tabLayout = (tabView as any)._tabLayout
    if (!tabLayout) return
    for (let index = 0; index < tabLayout.getItemCount(); index++) {
      const listener = listeners.get(index) ?? listenerFor(index)
      listeners.set(index, listener)
      tabLayout.getViewForItemAt(index)?.setOnTouchListener(listener)
    }
  }

  tabView.on('loaded', attach)
  if (tabView.isLoaded) attach()

  return () => {
    tabView.off('loaded', attach)
    const tabLayout = (tabView as any)._tabLayout
    for (const index of listeners.keys()) {
      tabLayout?.getViewForItemAt(index)?.setOnTouchListener(null)
    }
  }
}
