import {
  Color,
  GridLayout,
  isAndroid,
  isIOS,
  TabView,
  Utils,
  unsetValue,
  View,
  type EventData,
} from '@nativescript/core'
import {
  computed,
  defineComponent,
  Fragment,
  h,
  inject,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  provide,
  shallowRef,
  watch,
  type InjectionKey,
  type PropType,
  type VNode,
} from 'nativescript-vue'
import type { RouteLocation } from './types.js'
import { tabBarHidden } from './tab-visibility.js'
import { tabKey } from './injection.js'
import { onTabReselect, setSelectVeto, type TabLike } from './tabs.js'

export type TabLabelVisibility = 'auto' | 'selected' | 'labeled' | 'unlabeled'

type TabColors = {
  tabBackgroundColor?: Color
  tabTextColor?: Color
  selectedTabTextColor?: Color
}
const colorNames = ['tabBackgroundColor', 'tabTextColor', 'selectedTabTextColor'] as const

export type TabRole = 'search' | 'prominent'
export type TabMinimize = 'never' | 'onScrollDown' | 'onScrollUp'

export interface RouterTabDescriptor {
  name: string
  title: string
  /** An SF Symbol name on iOS. */
  icon?: string
  /** Android: a drawable name, or `sys://` followed by an `android.R.drawable` name. */
  androidIcon?: string
  badge?: string | number | null
  /** iOS: a search or prominent tab, when supported by NativeScript and UIKit. */
  role?: TabRole
}

interface TabsContext {
  select(name: string, source: 'app' | 'native' | 'reveal'): boolean
  selected(name: string): boolean
  present(name: string, route: RouteLocation | undefined): void
}
const tabsKey: InjectionKey<TabsContext> = Symbol(__DEV__ ? 'router tabs' : '')

/** One destination of `<RouterTabs>`: its stack goes in the default slot. */
export const RouterTab = defineComponent({
  name: 'RouterTab',
  props: {
    name: { type: String, required: true },
    title: { type: String, default: '' },
    icon: String,
    androidIcon: String,
    badge: [String, Number] as PropType<string | number | null>,
    role: String as PropType<TabRole>,
  },
  setup(props, { slots }) {
    const tabs = inject(tabsKey, null)
    // a navigation into a stack in this tab brings the tab forward first
    provide(tabKey, {
      reveal: () => void tabs?.select(props.name, 'reveal'),
      selected: () => tabs?.selected(props.name) ?? true,
      present: (route) => tabs?.present(props.name, route),
    })
    return () => slots.default?.()
  },
})

/** Material's bottom navigation and rail are optional on Android; without them the core `TabView` is used. */
export function supportsNativeTabs(): boolean {
  if (isIOS) return true
  if (!isAndroid || typeof com === 'undefined') return false
  try {
    return (
      typeof com.google.android.material.bottomnavigation.BottomNavigationView ===
      'function'
    )
  } catch {
    return false
  }
}

/**
 * A native tab bar around named stacks. iOS gets `UITabBarController` (with
 * `UITab`, badges, an optional sidebar on iPad and the iOS 26 minimizing bar);
 * Android gets Material's `BottomNavigationView`, or a `NavigationRailView`
 * from `rail` points of width. Navigating into a stack selects its tab;
 * tapping the selected tab again reaches `backToRootOnReselect`.
 */
export const RouterTabs = defineComponent({
  name: 'RouterTabs',
  props: {
    /** `v-model:selected`, the name of the selected tab. Defaults to the first one. */
    selected: String,
    /** NativeScript tab colors; also template-icon tint where supported by UIKit/Material. */
    tabBackgroundColor: [String, Object] as PropType<string | Color>,
    tabTextColor: [String, Object] as PropType<string | Color>,
    selectedTabTextColor: [String, Object] as PropType<string | Color>,
    /** Material only. UIKit and core TabView keep their native title layout. */
    labelVisibility: String as PropType<TabLabelVisibility>,
    /** Decides a tap on another tab. Switching runs no route guard. */
    canSelect: Function as PropType<(name: string) => boolean>,
    /** iOS 18 and later: UIKit's sidebar on iPad, a tab bar elsewhere. */
    sidebar: Boolean,
    /** iOS 26 and later: the tab bar minimizes while scrolling. */
    minimize: { type: String as PropType<TabMinimize>, default: 'never' },
    /** Android: from this width in device-independent pixels, a navigation rail replaces the bottom bar. 0 keeps the bar. */
    rail: { type: Number, default: 600 },
  },
  emits: {
    'update:selected': (_name: string) => true,
    select: (_name: string) => true,
    reselect: (_name: string) => true,
  },
  setup(props, { slots, emit }) {
    const tabs = shallowRef<RouterTabDescriptor[]>([])
    const current = shallowRef<string | undefined>(props.selected)
    const policies = shallowRef(new Map<string, boolean>())
    const hidden = computed(() => policies.value.get(current.value ?? '') ?? false)
    let disposed = false
    const width = shallowRef(0)
    const tabView = shallowRef<{ nativeView: TabView }>()
    const host = shallowRef<{ nativeView: TabsHostView }>()
    const bar = shallowRef<{ nativeView: MaterialNavigationBar }>()
    const material = isAndroid && supportsNativeTabs()
    const stops: (() => void)[] = []

    const selectedIndex = computed(() =>
      Math.max(
        0,
        tabs.value.findIndex((tab) => tab.name === current.value),
      ),
    )
    const useRail = computed(
      () => material && props.rail > 0 && width.value >= props.rail,
    )

    const select: TabsContext['select'] = (name, source) => {
      if (!tabs.value.some((tab) => tab.name === name)) return false
      if (name === current.value) return true
      if (source === 'native' && props.canSelect && !props.canSelect(name)) return false
      current.value = name
      emit('update:selected', name)
      emit('select', name)
      return true
    }
    provide(tabsKey, {
      select,
      selected: (name) => current.value === name,
      present: (name, route) => {
        if (disposed) return
        if (!route) {
          const next = new Map(policies.value)
          next.delete(name)
          policies.value = next
        } else {
          const hide = tabBarHidden(route)
          if (policies.value.get(name) !== hide)
            policies.value = new Map(policies.value).set(name, hide)
        }
      },
    })
    // UIKit owns safe-area recalculation. Commit-only, without an extra
    // animation: a cancelled interactive pop never changes presentation.
    let visibilityController: any
    let originalVisibility = false
    const applyVisibility = () => {
      const view = tabView.value?.nativeView
      const controller = view?.ios
      if (
        !isIOS ||
        !view?.isLoaded ||
        typeof controller?.setTabBarHiddenAnimated !== 'function'
      )
        return
      if (visibilityController !== controller) {
        visibilityController = controller
        originalVisibility = !!controller.tabBarHidden
      }
      const hide = props.sidebar ? originalVisibility : hidden.value
      if (controller.tabBarHidden !== hide) {
        controller.setTabBarHiddenAnimated(hide, false)
        view.requestLayout()
      }
    }
    onMounted(applyVisibility)
    onUpdated(applyVisibility)
    watch(hidden, applyVisibility, { flush: 'post' })
    onBeforeUnmount(() => {
      disposed = true
      if (
        visibilityController &&
        visibilityController.tabBarHidden !== originalVisibility
      )
        visibilityController.setTabBarHiddenAnimated(originalVisibility, false)
    })
    watch(
      () => props.selected,
      (name) => name && select(name, 'app'),
    )

    const onNativeSelect = (index: number, checked = false) => {
      const tab = tabs.value[index]
      if (!tab || tab.name === current.value) return
      if (!select(tab.name, checked ? 'app' : 'native')) {
        // the native widget moved before asking; put it back
        const view = tabView.value?.nativeView
        if (view) view.selectedIndex = selectedIndex.value
        const bar = host.value?.nativeView
        if (bar) bar.selectedIndex = selectedIndex.value
      }
    }

    // Read resolved NativeScript styles, so CSS classes and inline/prop values
    // share the same cascade on both hosts. Styling never touches the tab menu.
    let stopAppearance: (() => void) | undefined
    let observed: View | undefined
    let originalUnselectedTint: unknown
    let tinted = false
    let originalIcons: unknown[] = []
    const applyAppearance = () => {
      const view = tabView.value?.nativeView ?? host.value?.nativeView
      if (!view) return
      if (view !== observed) {
        stopAppearance?.()
        observed = view
        for (const name of colorNames) view.style.on(`${name}Change`, applyAppearance)
        stopAppearance = () => {
          for (const name of colorNames) view.style.off(`${name}Change`, applyAppearance)
        }
      }
      if (material) {
        if (bar.value)
          bar.value.nativeView.appearance = {
            tabBackgroundColor: view.style.tabBackgroundColor,
            tabTextColor: view.style.tabTextColor,
            selectedTabTextColor: view.style.selectedTabTextColor,
          }
      } else if (isIOS && view.isLoaded && (view as TabView).ios?.tabBar) {
        const native = (view as TabView).ios.tabBar
        const color = view.style.tabTextColor
        const layouts = [
          'stackedLayoutAppearance',
          'inlineLayoutAppearance',
          'compactInlineLayoutAppearance',
        ]
        const appearance = native.standardAppearance?.copy()
        if (color && !tinted) {
          originalUnselectedTint = native.unselectedItemTintColor
          originalIcons = layouts.map((layout) => appearance?.[layout].normal.iconColor)
        }
        if (color || tinted) {
          native.unselectedItemTintColor = color?.ios ?? originalUnselectedTint
          if (appearance) {
            layouts.forEach(
              (layout, index) =>
                (appearance[layout].normal.iconColor =
                  color?.ios ?? originalIcons[index]),
            )
            native.standardAppearance = appearance
            native.scrollEdgeAppearance = appearance
          }
        }
        tinted = !!color
      }
    }
    let colorProps = new Set<string>()
    const refreshAppearance = () => {
      const view = tabView.value?.nativeView ?? host.value?.nativeView
      if (!view) return
      let reset = false
      for (const name of colorNames) {
        if (colorProps.has(name) && props[name] == null) {
          // NativeScript-Vue restores the attribute's original value, which
          // may belong to an old CSS class. Remove that local override and
          // re-evaluate the current cascade instead.
          view.style[name] = unsetValue
          reset = true
        }
      }
      colorProps = new Set(colorNames.filter((name) => props[name] != null))
      if (reset) view._onCssStateChange()
      applyAppearance()
    }
    onMounted(refreshAppearance)
    onUpdated(refreshAppearance)
    onBeforeUnmount(() => stopAppearance?.())

    // iOS: badges and the sidebar live on the controller, which exists once loaded
    const applyIOS = () => {
      const controller = tabView.value?.nativeView.ios
      // Apply controller appearance after core has loaded its tab views.
      if (!isIOS || !controller || !tabView.value?.nativeView.isLoaded) return
      tabs.value.forEach((tab, index) => {
        const value =
          tab.badge == null || tab.badge === 0 || tab.badge === ''
            ? null
            : String(tab.badge)
        const native =
          controller.tabs?.count > index
            ? controller.tabs.objectAtIndex(index)
            : controller.viewControllers?.count > index
              ? controller.viewControllers.objectAtIndex(index).tabBarItem
              : null
        if (native) native.badgeValue = value
      })
      if (typeof UITabBarControllerMode !== 'undefined') {
        const mode = props.sidebar
          ? UITabBarControllerMode.TabSidebar
          : UITabBarControllerMode.Automatic
        if (controller.mode !== mode) controller.mode = mode
      }
    }
    const watchReselects = () => {
      stops.splice(0).forEach((stop) => stop())
      const view: TabLike | undefined =
        tabView.value?.nativeView ?? host.value?.nativeView
      if (!view) return
      if (view instanceof TabView) {
        setSelectVeto(view, (index) => {
          const tab = tabs.value[index]
          return (
            !tab ||
            tab.name === current.value ||
            !props.canSelect ||
            props.canSelect(tab.name)
          )
        })
        stops.push(() => setSelectVeto(view, undefined))
      }
      tabs.value.forEach((tab, index) =>
        stops.push(onTabReselect(view, index, () => emit('reselect', tab.name))),
      )
    }
    // the descriptors settle during render; the native side catches up right after
    let dirty = false
    const refresh = () => {
      if (!dirty) return
      dirty = false
      applyIOS()
      watchReselects()
    }
    onMounted(refresh)
    onUpdated(refresh)
    watch(
      () => props.sidebar,
      () => {
        applyIOS()
        applyVisibility()
      },
    )
    onBeforeUnmount(() => stops.splice(0).forEach((stop) => stop()))

    const descriptor = (vnode: VNode): RouterTabDescriptor => {
      const p = (vnode.props ?? {}) as Record<string, unknown>
      return {
        name: String(p.name),
        title: String(p.title ?? ''),
        icon: p.icon as string | undefined,
        androidIcon: (p.androidIcon ?? p['android-icon']) as string | undefined,
        badge: p.badge as string | number | null | undefined,
        role: p.role as TabRole | undefined,
      }
    }

    return () => {
      // Vue wraps v-for (and template groups) in fragments.
      const collect = (nodes: VNode[]): VNode[] =>
        nodes.flatMap((vnode) =>
          vnode.type === Fragment
            ? collect((vnode.children ?? []) as VNode[])
            : vnode.type === RouterTab
              ? [vnode]
              : [],
        )
      const items = collect(slots.default?.() ?? [])
      const next = items.map(descriptor)
      const names = new Set<string>()
      for (const tab of next) {
        if (names.has(tab.name))
          throw new Error(`Two router tabs are named "${tab.name}"`)
        names.add(tab.name)
      }
      if (
        next.length !== tabs.value.length ||
        next.some((tab, index) => {
          const previous = tabs.value[index]!
          return (
            tab.name !== previous.name ||
            tab.title !== previous.title ||
            tab.icon !== previous.icon ||
            tab.androidIcon !== previous.androidIcon ||
            tab.badge !== previous.badge ||
            tab.role !== previous.role
          )
        })
      ) {
        tabs.value = next
        dirty = true
      }
      if (!next.some((tab) => tab.name === current.value)) current.value = next[0]?.name
      const index = selectedIndex.value
      const colors = Object.fromEntries(
        colorNames
          .filter((name) => props[name] != null)
          .map((name) => [name, props[name]]),
      )

      if (!material) {
        return h(
          'TabView',
          {
            ...colors,
            ref: tabView,
            selectedIndex: index,
            androidTabsPosition: 'bottom',
            iosTabBarMinimizeBehavior: props.minimize,
            onSelectedIndexChanged: (args: EventData) =>
              onNativeSelect((args.object as TabView).selectedIndex, isIOS),
            onLoaded: () => {
              applyIOS()
              applyVisibility()
              applyAppearance()
              watchReselects()
            },
          },
          items.map((vnode, position) =>
            h(
              'TabViewItem',
              {
                key: next[position]!.name,
                title: next[position]!.title,
                iconSource: isAndroid
                  ? next[position]!.androidIcon
                  : next[position]!.icon
                    ? `sys://${next[position]!.icon}`
                    : undefined,
                role: next[position]!.role,
              },
              // UIKit's sidebar needs a content controller even while a lazy
              // Frame has no first Page. A layout supplies that stable view.
              [h('GridLayout', null, [vnode])],
            ),
          ),
        )
      }

      const rail = useRail.value
      return h(
        'RouterTabsHost',
        {
          ...colors,
          ref: host,
          onLoaded: applyAppearance,
          selectedIndex: index,
          rows: rail ? '*' : '*, auto',
          columns: rail ? 'auto, *' : '*',
          onLayoutChanged: (args: EventData) => {
            width.value = (args.object as View).getActualSize().width
          },
        },
        [
          ...items.map((vnode, position) =>
            h(
              'GridLayout',
              {
                key: next[position]!.name,
                row: 0,
                col: rail ? 1 : 0,
                visibility: position === index ? 'visible' : 'collapse',
              },
              [vnode],
            ),
          ),
          h('RouterNavigationBar', {
            ref: bar,
            onLoaded: applyAppearance,
            labelVisibility: props.labelVisibility,
            visibility: hidden.value ? 'collapse' : 'visible',
            accessibilityHidden: hidden.value,
            key: rail ? 'rail' : 'bar',
            row: rail ? 0 : 1,
            col: 0,
            rail,
            items: next,
            selectedIndex: index,
            veto: (position: number) => {
              const tab = next[position]
              return (
                !!tab &&
                tab.name !== current.value &&
                !!props.canSelect &&
                !props.canSelect(tab.name)
              )
            },
            onSelect: (args: { index: number }) => onNativeSelect(args.index, true),
            onReselect: (args: { index: number }) =>
              host.value?.nativeView.reselect(args.index),
          }),
        ],
      )
    }
  },
})

/**
 * The Android host: a grid with one cell per tab in front of the bar. It
 * reports its selection the way a `TabView` does, so pages in hidden tabs
 * count as covered and `backToRootOnReselect` hears the repeated tap.
 */
export class TabsHostView extends GridLayout {
  static readonly selectedIndexChangedEvent = 'selectedIndexChanged'
  static readonly tabReselectedEvent = 'tabReselected'
  readonly routerTabsHost = true
  private index = 0

  get tabBackgroundColor() {
    return this.style.tabBackgroundColor
  }
  set tabBackgroundColor(value: Color) {
    this.style.tabBackgroundColor = value
  }
  get tabTextColor() {
    return this.style.tabTextColor
  }
  set tabTextColor(value: Color) {
    this.style.tabTextColor = value
  }
  get selectedTabTextColor() {
    return this.style.selectedTabTextColor
  }
  set selectedTabTextColor(value: Color) {
    this.style.selectedTabTextColor = value
  }

  get selectedIndex() {
    return this.index
  }
  set selectedIndex(value: number) {
    if (value === this.index) return
    this.index = value
    this.notify({ eventName: TabsHostView.selectedIndexChangedEvent, object: this })
  }

  reselect(index: number) {
    this.notify({
      eventName: TabsHostView.tabReselectedEvent,
      object: this,
      index,
    } as EventData)
  }
}

declare const com: any
declare const android: any
declare const UITabBarControllerMode:
  { Automatic: number; TabSidebar: number } | undefined

/** Material's bottom navigation or rail as a NativeScript view, items from `RouterTabs`. */
export class MaterialNavigationBar extends View {
  static readonly selectEvent = 'select'
  static readonly reselectEvent = 'reselect'
  rail = false
  veto: ((index: number) => boolean) | undefined
  private tabItems: RouterTabDescriptor[] = []
  private appliedItems: RouterTabDescriptor[] = []
  private index = 0
  private updating = false
  private layoutListener: any
  private colors: TabColors = {}
  private labels: TabLabelVisibility | undefined
  private defaults: { icons: any; text: any; background: any; labels: number } | undefined

  get appearance() {
    return this.colors
  }
  set appearance(value: TabColors) {
    if (
      colorNames.every((name) => {
        const a = this.colors[name],
          b = value[name]
        return a === b || (!!a && !!b && Color.equals(a, b))
      })
    )
      return
    this.colors = value
    this.applyAppearance()
  }
  get labelVisibility() {
    return this.labels
  }
  set labelVisibility(value: TabLabelVisibility | undefined) {
    this.labels = value
    this.applyAppearance()
  }
  private applyAppearance() {
    const native = this.nativeViewProtected
    const defaults = this.defaults
    if (!defaults) return
    const {
      tabTextColor: normal,
      selectedTabTextColor: selected,
      tabBackgroundColor: background,
    } = this.colors
    const states = android.R.attr
    const tint = (original: any) => {
      if (!normal && !selected) return original
      const fallback = original?.getDefaultColor() ?? 0
      // NativeScript cannot marshal a nested JS array to Java int[][].
      const arrays = Array as unknown as { create(type: string, length: number): any }
      const stateList = arrays.create('[I', 3)
      for (const [index, values] of [
        [-states.state_enabled],
        [states.state_checked],
        [],
      ].entries()) {
        const nativeState = arrays.create('int', values.length)
        values.forEach((value, position) => (nativeState[position] = value))
        stateList[index] = nativeState
      }
      const nativeColors = arrays.create('int', 3)
      ;[
        original?.getColorForState([-states.state_enabled], fallback) ?? fallback,
        selected?.android ??
          original?.getColorForState(
            [states.state_enabled, states.state_checked],
            fallback,
          ) ??
          fallback,
        normal?.android ?? fallback,
      ].forEach((value, index) => (nativeColors[index] = value))
      return new android.content.res.ColorStateList(stateList, nativeColors)
    }
    native.setItemIconTintList(tint(defaults.icons))
    native.setItemTextColor(tint(defaults.text))
    native.setBackgroundTintList(
      background
        ? android.content.res.ColorStateList.valueOf(background.android)
        : defaults.background,
    )
    const modes = { auto: -1, selected: 0, labeled: 1, unlabeled: 2 }
    native.setLabelVisibilityMode(
      this.labels ? (modes[this.labels] ?? defaults.labels) : defaults.labels,
    )
    this.updateSize()
  }

  get items() {
    return this.tabItems
  }
  set items(value: RouterTabDescriptor[]) {
    this.tabItems = value
    this.rebuild()
  }
  get selectedIndex() {
    return this.index
  }
  set selectedIndex(value: number) {
    this.index = value
    this.applySelection()
  }

  override createNativeView() {
    const material = com.google.android.material
    // NativeScript's default theme is AppCompat. BadgeDrawable requires a
    // Material theme, even when the navigation bar itself accepts AppCompat.
    // Scope the fallback to this widget and preserve an app's Material theme.
    const value = new android.util.TypedValue()
    const context = this._context
      .getTheme()
      .resolveAttribute(material.R.attr.colorPrimaryVariant, value, true)
      ? this._context
      : new android.view.ContextThemeWrapper(
          this._context,
          material.R.style.Theme_MaterialComponents_DayNight_NoActionBar,
        )
    return this.rail
      ? new material.navigationrail.NavigationRailView(context)
      : new material.bottomnavigation.BottomNavigationView(context)
  }

  override initNativeView() {
    super.initNativeView()
    this.defaults = {
      icons: this.nativeViewProtected.getItemIconTintList(),
      text: this.nativeViewProtected.getItemTextColor(),
      background: this.nativeViewProtected.getBackgroundTintList(),
      labels: this.nativeViewProtected.getLabelVisibilityMode(),
    }
    this.applyAppearance()
    const owner = new WeakRef(this)
    this.layoutListener = new android.view.View.OnLayoutChangeListener({
      onLayoutChange() {
        owner.deref()?.updateSize()
      },
    })
    this.nativeViewProtected.addOnLayoutChangeListener(this.layoutListener)
    const navigation = com.google.android.material.navigation.NavigationBarView
    this.nativeViewProtected.setOnItemSelectedListener(
      new navigation.OnItemSelectedListener({
        onNavigationItemSelected(item: { getItemId(): number }) {
          const bar = owner.deref()
          if (!bar) return false
          if (bar.updating) return true
          const index = item.getItemId()
          if (bar.veto?.(index)) return false
          bar.index = index
          bar.notify({
            eventName: MaterialNavigationBar.selectEvent,
            object: bar,
            index,
          } as EventData)
          return true
        },
      }),
    )
    this.nativeViewProtected.setOnItemReselectedListener(
      new navigation.OnItemReselectedListener({
        onNavigationItemReselected(item: { getItemId(): number }) {
          const bar = owner.deref()
          if (bar?.updating) return
          bar?.notify({
            eventName: MaterialNavigationBar.reselectEvent,
            object: bar,
            index: item.getItemId(),
          } as EventData)
        },
      }),
    )
    this.rebuild()
  }

  override disposeNativeView() {
    this.appliedItems = []
    this.defaults = undefined
    this.nativeViewProtected?.removeOnLayoutChangeListener(this.layoutListener)
    this.layoutListener = undefined
    this.nativeViewProtected?.setOnItemSelectedListener(null)
    this.nativeViewProtected?.setOnItemReselectedListener(null)
    super.disposeNativeView()
  }

  private updateSize() {
    const native = this.nativeViewProtected
    // NativeScript's GridLayout gives an auto row/column zero space for these
    // Android ViewGroups. Carry the widget's themed minimum and system insets
    // into its NativeScript dimension; keep the stack cells mounted on resize.
    if (this.rail) {
      this.width = Utils.layout.toDeviceIndependentPixels(
        native.getMinimumWidth() + native.getPaddingLeft() + native.getPaddingRight(),
      )
    } else {
      this.height = Utils.layout.toDeviceIndependentPixels(
        native.getMinimumHeight() + native.getPaddingTop() + native.getPaddingBottom(),
      )
    }
  }

  private rebuild() {
    const native = this.nativeViewProtected
    if (typeof native?.getMenu !== 'function') return
    const menu = native.getMenu()
    const previous = this.appliedItems
    const structureChanged =
      menu.size() !== this.tabItems.length ||
      this.tabItems.some((tab, index) => tab.name !== previous[index]?.name)
    this.updating = true
    try {
      if (structureChanged) {
        previous.forEach((_, index) => native.removeBadge(index))
        menu.clear()
      }
      this.tabItems.forEach((tab, index) => {
        // Recreating Material's menu also recreates its accessibility nodes,
        // which can steal TalkBack focus from the page after a Vue update.
        const item = structureChanged
          ? menu.add(0, index, index, tab.title)
          : menu.getItem(index)
        if (!structureChanged && tab.title !== previous[index]?.title)
          item.setTitle(tab.title)
        if (structureChanged || tab.androidIcon !== previous[index]?.androidIcon)
          item.setIcon(drawableId(tab.androidIcon))
      })
    } finally {
      this.updating = false
    }
    this.applySelection()
    this.tabItems.forEach((tab, index) => {
      if (!structureChanged && tab.badge === previous[index]?.badge) return
      const value = tab.badge
      if (value == null || value === 0 || value === '') {
        native.removeBadge(index)
        return
      }
      const badge = native.getOrCreateBadge(index)
      if (typeof value === 'number') {
        badge.clearText?.()
        badge.setNumber(value)
      } else {
        badge.clearNumber()
        // Older Material builds support a dot/count but not text badges.
        badge.setText?.(String(value))
      }
      badge.setVisible(true)
    })
    this.appliedItems = this.tabItems.map((tab) => ({ ...tab }))
  }

  private applySelection() {
    const native = this.nativeViewProtected
    if (typeof native?.getSelectedItemId !== 'function' || !this.tabItems.length) return
    if (native.getSelectedItemId() === this.index) return
    this.updating = true
    try {
      native.setSelectedItemId(this.index)
    } finally {
      this.updating = false
    }
  }
}

function drawableId(name: string | undefined): number {
  if (!name) return 0
  if (name.startsWith('sys://')) return android.R.drawable[name.slice(6)] ?? 0
  return Utils.android.resources.getDrawableId(name) || 0
}
