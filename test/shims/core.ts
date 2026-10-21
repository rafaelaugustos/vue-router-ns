/**
 * A small stand-in for @nativescript/core. Frame follows the real one where
 * the router cares: navigations queue and finish on a later tick, the back
 * stack is updated and dropped pages are disposed before `navigatedTo` fires,
 * and `backstackVisible: false` / `clearHistory` behave the same.
 */

type Listener = (data: any) => void

export interface EventData {
  eventName: string
  object?: unknown
  [key: string]: unknown
}

export class Observable {
  private listeners = new Map<string, Set<Listener>>()

  on(event: string, callback: Listener) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event)!.add(callback)
  }

  off(event: string, callback?: Listener) {
    if (callback) this.listeners.get(event)?.delete(callback)
    else this.listeners.delete(event)
  }

  notify(data: EventData) {
    for (const callback of [...(this.listeners.get(data.eventName) ?? [])]) callback(data)
  }

  listenerCount(event: string) {
    return this.listeners.get(event)?.size ?? 0
  }

  clear() {
    this.listeners.clear()
  }
}

export class Color {
  constructor(public value: string) {}
}

export class View extends Observable {
  accessibilityHidden = false
  visibility = 'visible'
  backgroundColor: unknown
  width = 400
  getActualSize() {
    return { width: this.width, height: 800 }
  }
  static presented: { view: View; options: any }[] = []

  parent: View | null = null
  children: View[] = []
  isLoaded = true
  ios: any = {
    controller: {},
    interactions: [] as any[],
    addInteraction(interaction: any) {
      this.interactions.push(interaction)
    },
    removeInteraction(interaction: any) {
      this.interactions = this.interactions.filter((other: any) => other !== interaction)
    },
  }
  android: any
  viewController: any
  measure(_width: number, _height: number) {}
  getMeasuredHeight() {
    return 600
  }
  /** On Android, the dialog a modal is shown in. */
  dialog: Dialog | SheetDialog | undefined
  private closeCallback: ((...args: unknown[]) => void) | undefined
  static nextDomId = 1
  /** The private members core's Android modal flow reads and writes. */
  _domId = View.nextDomId++
  _context: unknown = undefined
  _modalParent: View | null = null
  _modalOptions: any
  _dialogFragment: SheetFragment | null = null
  _isAddedToNativeVisualTree = false
  horizontalAlignment = 'stretch'
  verticalAlignment = 'stretch'
  height: number | string = 'auto'
  _setupAsRootView(_context: unknown) {}
  _getRootFragmentManager() {
    return {}
  }
  callLoaded() {
    this.onLoaded()
  }
  onLoaded() {
    this.isLoaded = true
  }
  callUnloaded() {
    this.isLoaded = false
  }
  _tearDownUI(_force?: boolean) {
    this.tearDown()
  }
  _raiseShowingModallyEvent() {}
  _raiseShownModallyEvent() {
    this.notify({ eventName: 'shownModally', object: this })
  }

  /** A stand-in for the platform view, for tests that need one. */
  native: any
  initNativeView() {}
  disposeNativeView() {}

  /** Lets the androidx stand-in find the dialog or activity a view lives in. */
  get nativeView() {
    return (
      this.native ?? {
        owner: this.dialog ?? Application.android.foregroundActivity,
        getContext: () => this._context ?? Application.android.foregroundActivity,
      }
    )
  }
  get nativeViewProtected() {
    return this.nativeView
  }

  showModal(view: View, options: any) {
    view.closeCallback = options.closeCallback
    view._modalParent = this
    view._modalOptions = options
    // a presenter of its own, like core's Android view lets a subclass have
    if (Object.hasOwn(view, '_showNativeModalView')) {
      ;(view as any)._showNativeModalView(this, options)
      return
    }
    if (isAndroid) view.dialog = new Dialog(view)
    View.presented.push({ view, options })
    void Promise.resolve().then(() => {
      ;(view as Partial<Frame>).load?.()
      view.notify({ eventName: 'shownModally', object: view })
    })
  }

  closeModal(...args: unknown[]) {
    const callback = this.closeCallback
    this.closeCallback = undefined
    this._modalParent = null
    View.presented = View.presented.filter((modal) => modal.view !== this)
    const fragment = this._dialogFragment
    this._dialogFragment = null
    fragment?.dismissAllowingStateLoss()
    callback?.(...args)
    // like core: the closed modal's UI is torn down after the callback
    this.tearDown()
  }

  tearDown() {}
}

export class TabViewItem extends View {
  get view() {
    return this.children[0]
  }
}

export class GridLayout extends View {
  createNativeView(): any {
    return this.nativeView
  }
  getChildIndex(view: View) {
    return this.children.indexOf(view)
  }
}

/** Core's layout container, as far as child bookkeeping goes. */
export class LayoutBase extends View {
  override initNativeView() {}
  override disposeNativeView() {}
  getChildrenCount() {
    return this.children.length
  }
  getChildAt(index: number) {
    return this.children[index]
  }
  getChildIndex(child: View) {
    return this.children.indexOf(child)
  }
  addChild(child: View) {
    this.insertChild(child, this.children.length)
  }
  insertChild(child: View, index: number) {
    this.children.splice(index, 0, child)
    child.parent = this
    return true
  }
  removeChild(child: View) {
    this.children = this.children.filter((item) => item !== child)
    child.parent = null
  }
}

/** The Android drawer layout the router wraps, opening and closing on request. */
export class DrawerLayoutStub extends LayoutBase {
  drawerWidth = 300
  opened = false
  openDrawer() {
    if (this.opened) return
    this.opened = true
    this.notify({ eventName: 'drawerOpened', object: this })
  }
  closeDrawer() {
    if (!this.opened) return
    this.opened = false
    this.notify({ eventName: 'drawerClosed', object: this })
  }
  get isDrawerOpen() {
    return this.opened
  }
  /** What a swipe from the edge does. */
  drag(open: boolean) {
    if (open) this.openDrawer()
    else this.closeDrawer()
  }
}

export class ListView extends View {}

export class TabView extends View {
  private index = 0
  get selectedIndex() {
    return this.index
  }
  set selectedIndex(value: number) {
    if (value === this.index) return
    this.index = value
    this.notify({ eventName: 'selectedIndexChanged', object: this })
  }

  get items() {
    return this.children.filter((child) => child instanceof TabViewItem)
  }
}

export class ActionBar extends View {
  title = ''
}

export class Page extends View {
  accessibilityAnnouncePageEnabled = true
  accessibilityScreenChanged(_refocus?: boolean) {}
  getViewById<T>(id: string): T | undefined {
    const find = (view: any): any =>
      view.id === id ? view : view.children.map(find).find(Boolean)
    return find(this)
  }
  frame?: Frame
  actionBarHidden = false
  enableSwipeBackNavigation = true
  disposed = false
  actionBar = { title: '', titleView: undefined as View | undefined }
  override ios: any = {
    controller: {},
    navigationItem: { backAction: null },
    presented: [] as any[],
    presentViewControllerAnimatedCompletion(controller: any) {
      controller.presentingViewController = this
      this.presented.push(controller)
    },
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.notify({ eventName: 'disposeNativeView', object: this })
  }
}

export interface NavigationEntry {
  create?: () => Page
  animated?: boolean
  transition?: unknown
  clearHistory?: boolean
  backstackVisible?: boolean
}

export interface BackstackEntry {
  entry: NavigationEntry
  resolvedPage: Page
}

type Operation =
  | { type: 'forward'; entry: BackstackEntry }
  | { type: 'back'; to: BackstackEntry | undefined }

export class Frame extends View {
  static navigatedToEvent = 'navigatedTo'
  override ios: any = { controller: { sheetPresentationController: {} } }
  static stack: Frame[] = []
  static navigations: NavigationEntry[] = []
  /** Whether each back navigation animated, read like core does: from the entry being popped. */
  static backs: (boolean | undefined)[] = []

  static topmost(): Frame | undefined {
    return Frame.stack.at(-1)
  }

  private back: BackstackEntry[] = []
  private current: BackstackEntry | undefined
  private queue: Operation[] = []
  private busy = false

  get backStack() {
    return this.back.slice()
  }

  get currentPage() {
    return this.current?.resolvedPage ?? null
  }

  get currentEntry() {
    return this.current?.entry ?? null
  }

  canGoBack() {
    return this.back.length > 0
  }

  load() {
    this.isLoaded = true
    this.process()
  }

  override callLoaded() {
    this.load()
  }

  navigate(entry: NavigationEntry) {
    Frame.navigations.push(entry)
    this.toTop()
    const resolvedPage = entry.create!()
    resolvedPage.frame = this
    this.queue.push({ type: 'forward', entry: { entry, resolvedPage } })
    this.process()
  }

  goBack(to?: BackstackEntry) {
    if (!this.canGoBack()) return
    Frame.backs.push(this.current?.entry.animated)
    this.queue.push({ type: 'back', to })
    this.process()
  }

  override tearDown() {
    for (const entry of [...this.back, ...(this.current ? [this.current] : [])]) {
      entry.resolvedPage.dispose()
    }
    Frame.stack = Frame.stack.filter((frame) => frame !== this)
  }

  /** What iOS does on a swipe or ActionBar back: pops natively, never calling goBack(). */
  popNatively() {
    if (!this.canGoBack()) throw new Error('nothing to pop')
    this.complete({ type: 'back', to: undefined })
  }

  private process() {
    if (!this.isLoaded || this.busy || !this.queue.length) return
    this.busy = true
    const operation = this.queue.shift()!

    // the transition
    setTimeout(() => {
      this.complete(operation)
      this.busy = false
      this.process()
    }, 0)
  }

  private complete(operation: Operation) {
    const current = this.current
    let entry: BackstackEntry

    if (operation.type === 'back') {
      entry = operation.to ?? this.back.at(-1)!
      const index = this.back.indexOf(entry)
      this.back.splice(index + 1).forEach((removed) => removed.resolvedPage.dispose())
      this.back.pop()
      current?.resolvedPage.dispose()
    } else {
      entry = operation.entry
      if (entry.entry.clearHistory) {
        this.back.forEach((removed) => removed.resolvedPage.dispose())
        this.back = []
        current?.resolvedPage.dispose()
      } else if (current) {
        if (current.entry.backstackVisible === false) current.resolvedPage.dispose()
        else this.back.push(current)
      }
    }

    this.current = entry
    this.toTop()
    entry.resolvedPage.notify({ eventName: 'navigatedTo', object: entry.resolvedPage })
    if (entry.resolvedPage.accessibilityAnnouncePageEnabled)
      entry.resolvedPage.accessibilityScreenChanged(operation.type === 'back')
    this.notify({
      eventName: 'navigatedTo',
      object: this,
      entry,
      isBack: operation.type === 'back',
    })
  }

  private toTop() {
    Frame.stack = [...Frame.stack.filter((frame) => frame !== this), this]
  }
}

export class SearchBar extends View {
  text = ''
  hint = ''
  override android: any = { clearFocus() {} }
  focus() {
    return true
  }
  dismissSoftInput() {}
}

export interface AndroidActivityBackPressedEventData extends EventData {
  cancel: boolean
}

export interface AndroidActivityEventData extends EventData {
  activity: Activity
}

/**
 * androidx's OnBackPressedDispatcher: the last enabled callback gets the back
 * gesture and the press, and the owner's default runs when none is enabled.
 */
export class BackDispatcher {
  private callbacks: OnBackPressedCallback[] = []
  private inProgress: OnBackPressedCallback | undefined

  constructor(private fallback: () => void) {}

  addCallback(_owner: unknown, callback: OnBackPressedCallback) {
    this.callbacks.push(callback)
    callback.dispatcher = this
  }

  remove(callback: OnBackPressedCallback) {
    this.callbacks = this.callbacks.filter((item) => item !== callback)
  }

  enabledCount() {
    return this.callbacks.filter((callback) => callback.isEnabled()).length
  }

  onBackPressed() {
    const callback = this.inProgress ?? this.top()
    this.inProgress = undefined
    if (callback) callback.handleOnBackPressed()
    else this.fallback()
  }

  startGesture(event: BackEvent) {
    this.inProgress = this.top()
    this.inProgress?.handleOnBackStarted(event)
  }

  progressGesture(event: BackEvent) {
    this.inProgress?.handleOnBackProgressed(event)
  }

  cancelGesture() {
    const callback = this.inProgress
    this.inProgress = undefined
    callback?.handleOnBackCancelled()
  }

  private top() {
    return this.callbacks.findLast((callback) => callback.isEnabled())
  }
}

export class OnBackPressedCallback {
  dispatcher: BackDispatcher | undefined

  constructor(private enabled: boolean) {}

  isEnabled() {
    return this.enabled
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled
  }

  remove() {
    this.dispatcher?.remove(this)
  }

  handleOnBackStarted(_event: BackEvent) {}
  handleOnBackProgressed(_event: BackEvent) {}
  handleOnBackCancelled() {}
  handleOnBackPressed() {}
}

interface BackEvent {
  getProgress(): number
  getSwipeEdge(): number
}

let lastBackPress: AndroidActivityBackPressedEventData | undefined

/** The callback core registers on every activity: it only hears the press. */
class CoreBackCallback extends OnBackPressedCallback {
  constructor(private press: () => void) {
    super(true)
  }

  override handleOnBackPressed() {
    this.press()
  }
}

export class ActivityResultRegistry {
  static nextCode = 0x10000
  keys = new Map<string, number>()
  callbacks = new Map<number, any>()
  pending = new Map<number, any>()
  constructor(readonly activity: Activity) {}
  restore(previous: ActivityResultRegistry) {
    this.keys = new Map(previous.keys)
  }
  register(key: string, _contract: unknown, callback: any) {
    const code = this.keys.get(key) ?? ActivityResultRegistry.nextCode++
    this.keys.set(key, code)
    this.callbacks.set(code, callback)
    if (this.pending.has(code)) {
      callback.onActivityResult(this.pending.get(code))
      this.pending.delete(code)
    }
    return {
      launch: (intent: any) =>
        Activity.launched.push({
          intent,
          requestCode: code,
          activity: this.activity,
          key,
        }),
      unregister: () => {
        this.callbacks.delete(code)
      },
    }
  }
  dispatchResult(code: number, resultCode: number, intent: any) {
    if (![...this.keys.values()].includes(code)) return false
    const value = { getResultCode: () => resultCode, getData: () => intent }
    const callback = this.callbacks.get(code)
    if (callback) callback.onActivityResult(value)
    else this.pending.set(code, value)
    return true
  }
}

export class Activity {
  finished = false
  private dispatcher = new BackDispatcher(() => (this.finished = true))

  constructor() {
    this.dispatcher.addCallback(this, new CoreBackCallback(() => this.press()))
  }

  getOnBackPressedDispatcher() {
    return this.dispatcher
  }

  getWindow() {
    return { getAttributes: () => ({ softInputMode: 16 }) }
  }

  isChangingConfigurations() {
    return false
  }

  getClass() {
    return { getName: () => 'com.tns.NativeScriptActivity' }
  }

  /** What was launched for a result, by request code. */
  static launched: {
    intent: any
    requestCode: number
    activity?: Activity
    key?: string
  }[] = []
  private registry = new ActivityResultRegistry(this)
  getActivityResultRegistry() {
    return this.registry
  }

  startActivityForResult(intent: unknown, requestCode: number) {
    Activity.launched.push({ intent, requestCode })
  }

  getPackageName() {
    return 'org.nativescript.demo'
  }

  getResources() {
    return { getIdentifier: (name: string) => (name === 'ic_compose' ? 42 : 0) }
  }

  private press() {
    const args = { eventName: 'activityBackPressed', cancel: false }
    lastBackPress = args
    Application.android.notify(args)
    if (args.cancel) return

    const frame = Frame.topmost()
    if (frame?.canGoBack()) frame.goBack()
    else this.finished = true
  }
}

export class Dialog {
  private dispatcher = new BackDispatcher(() => this.view.closeModal())

  constructor(private view: View) {
    this.dispatcher.addCallback(this, new CoreBackCallback(() => this.press()))
  }

  getOnBackPressedDispatcher() {
    return this.dispatcher
  }

  private press() {
    const args = { eventName: 'activityBackPressed', object: this.view, cancel: false }
    lastBackPress = args
    // NativeScript's dialog notifies the app before the modal Frame.
    Application.android.notify(args)
    if (args.cancel) return
    this.view.notify(args)
    if (args.cancel) return

    const frame = this.view as Frame
    if (frame.canGoBack?.()) frame.goBack()
    else this.view.closeModal()
  }
}

const EDGES = ['left', 'right'] as const

Object.assign(globalThis, {
  androidx: {
    activity: {
      OnBackPressedCallback: {
        extend: (_name: string, methods: object) => {
          const Extended = class extends OnBackPressedCallback {}
          Object.assign(Extended.prototype, methods)
          return Extended
        },
      },
      ViewTreeOnBackPressedDispatcherOwner: {
        get: (view: { owner?: unknown }) => view.owner ?? null,
      },
    },
  },
})

export const Device = { sdkVersion: '36' }
export const Utils = {
  android: {
    resources: { getDrawableId: (name: string) => (name === 'tab_inbox' ? 7 : 0) },
  },
  layout: {
    EXACTLY: 1073741824,
    UNSPECIFIED: 0,
    toDevicePixels: (dip: number) => dip * 3,
    toDeviceIndependentPixels: (px: number) => px / 3,
    makeMeasureSpec: (px: number, mode: number) => px + mode,
  },
}
export const IOSHelper = {
  UILayoutViewController: {
    initWithOwner: (owner: WeakRef<View>) => ({
      owner,
      preferredContentSize: undefined as unknown,
      view: {
        subviews: [] as unknown[],
        addSubview(view: unknown) {
          this.subviews.push(view)
        },
      },
    }),
  },
}

// -- Material bottom sheets ---------------------------------------------------

/** Material's `BottomSheetBehavior` state constants. */
export const SheetStates = { EXPANDED: 3, COLLAPSED: 4, HIDDEN: 5, HALF_EXPANDED: 6 }
const TOUCH_OUTSIDE = 7001

export class SheetBehavior {
  state = SheetStates.COLLAPSED
  peekHeight = -1
  maxHeight = -1
  hideable = true
  skipCollapsed = false
  fitToContents = true
  halfExpandedRatio = 0.5
  draggable = true

  constructor(private dialog: SheetDialog) {}

  setPeekHeight(px: number) {
    this.peekHeight = px
  }
  setMaxHeight(px: number) {
    this.maxHeight = px
  }
  setHideable(value: boolean) {
    this.hideable = value
  }
  isHideable() {
    return this.hideable
  }
  setSkipCollapsed(value: boolean) {
    this.skipCollapsed = value
  }
  setFitToContents(value: boolean) {
    this.fitToContents = value
  }
  setHalfExpandedRatio(value: number) {
    this.halfExpandedRatio = value
  }
  setDraggable(value: boolean) {
    this.draggable = value
  }
  getState() {
    return this.state
  }
  setState(state: number) {
    this.state = state
    if (state === SheetStates.HIDDEN) this.dialog.cancel()
  }

  /** What the user does: drags the sheet to `state`. Refused while it can't hide. */
  drag(state: number) {
    if (state === SheetStates.HIDDEN && !this.hideable) return false
    this.setState(state)
    return true
  }
}

class Bundle {
  private values = new Map<string, number>()
  putInt(key: string, value: number) {
    this.values.set(key, value)
  }
  getInt(key: string) {
    return this.values.get(key) ?? 0
  }
}

/** Material's `BottomSheetDialog`: a dialog with a behavior and a dimmed area to tap. */
export class SheetDialog {
  _domId = 0
  fragment: SheetFragment | undefined
  behavior = new SheetBehavior(this)
  cancelable = true
  canceledOnTouchOutside = true
  dismissWithAnimation = false
  showing = false
  content: unknown
  outside: { onClick(view: unknown): void } | undefined
  dispatcher = new BackDispatcher(() => this.onBackPressed())

  constructor(
    public context: unknown,
    public theme: number,
  ) {}

  static extend(_name: string, methods: object) {
    const Extended = class extends SheetDialog {}
    Object.assign(Extended.prototype, methods)
    return Extended
  }

  get super() {
    return { onBackPressed: () => SheetDialog.prototype.onBackPressed.call(this) }
  }

  onBackPressed() {
    this.cancel()
  }
  getOnBackPressedDispatcher() {
    return this.dispatcher
  }
  getBehavior() {
    return this.behavior
  }
  setContentView(view: unknown) {
    this.content = view
  }
  setCancelable(value: boolean) {
    this.cancelable = value
  }
  setCanceledOnTouchOutside(value: boolean) {
    this.canceledOnTouchOutside = value
  }
  setDismissWithAnimation(value: boolean) {
    this.dismissWithAnimation = value
  }
  isShowing() {
    return this.showing
  }
  getWindow() {
    return { setSoftInputMode(_mode: number) {} }
  }
  findViewById(id: number) {
    if (id !== TOUCH_OUTSIDE) return null
    return {
      setOnClickListener: (listener: { onClick(view: unknown): void }) => {
        this.outside = listener
      },
    }
  }
  cancel() {
    this.dismiss()
  }
  dismiss() {
    if (!this.showing) return
    this.showing = false
    this.fragment?.onDismiss(this)
    this.fragment?.onDestroy()
  }

  /** A tap on the dimmed area behind the sheet. */
  tapOutside() {
    this.outside?.onClick(null)
  }
}

/** Material's `BottomSheetDialogFragment`, run through its lifecycle synchronously. */
export class SheetFragment {
  owner: View | undefined
  presentation: unknown
  dialog: SheetDialog | undefined
  args: Bundle | undefined

  static extend(_name: string, methods: object) {
    const Extended = class extends SheetFragment {}
    Object.assign(Extended.prototype, methods)
    return Extended
  }

  get super() {
    return {
      onCreate(_saved: unknown) {},
      onStart() {},
      onDismiss(_dialog: unknown) {},
      onDestroy() {},
    }
  }

  setArguments(args: Bundle) {
    this.args = args
  }
  getArguments() {
    return this.args!
  }
  getActivity() {
    return Application.android.foregroundActivity
  }
  getTheme() {
    return 0
  }
  getDialog() {
    return this.dialog!
  }
  getFragmentManager() {
    return {}
  }
  onCreate(_saved: unknown) {}
  onCreateDialog(_saved: unknown): SheetDialog {
    return new SheetDialog(this.getActivity(), 0)
  }
  onCreateView(): unknown {
    return null
  }
  onStart() {}
  onDismiss(_dialog: unknown) {}
  onDestroy() {}

  show(_manager: unknown, _tag: string) {
    this.onCreate(null)
    this.dialog = this.onCreateDialog(null)
    this.dialog.fragment = this
    this.dialog.setContentView(this.onCreateView())
    const owner = this.owner!
    owner.dialog = this.dialog
    View.presented.push({ view: owner, options: owner._modalOptions })
    this.dialog.showing = true
    this.onStart()
  }

  dismissAllowingStateLoss() {
    this.dialog?.dismiss()
  }
}

/** Material's bottom navigation and rail, as far as menu items, selection and badges go. */
export class NavigationBarStub {
  static created: NavigationBarStub[] = []
  items: { id: number; title: string; icon: number }[] = []
  badges = new Map<number, { number?: number; text?: string; visible: boolean }>()
  selected = -1
  onSelected: any
  onReselected: any
  layoutListener: any
  addOnLayoutChangeListener(listener: any) {
    this.layoutListener = listener
  }
  removeOnLayoutChangeListener(_listener: any) {
    this.layoutListener = undefined
  }
  constructor(public context: unknown) {
    NavigationBarStub.created.push(this)
  }
  getMinimumHeight() {
    return 56
  }
  getMinimumWidth() {
    return 72
  }
  getPaddingTop() {
    return 0
  }
  getPaddingBottom() {
    return 24
  }
  getPaddingLeft() {
    return 0
  }
  getPaddingRight() {
    return 0
  }
  getMenu() {
    const items = this.items
    return {
      size: () => items.length,
      getItem: (index: number) => items[index],
      clear: () => void items.splice(0),
      add: (_group: number, id: number, _order: number, title: string) => {
        const item = {
          id,
          title,
          icon: 0,
          setTitle: (title: string) => void (item.title = title),
          setIcon: (icon: number) => void (item.icon = icon),
        }
        items.push(item)
        return item
      },
    }
  }
  setOnItemSelectedListener(listener: any) {
    this.onSelected = listener
  }
  setOnItemReselectedListener(listener: any) {
    this.onReselected = listener
  }
  getSelectedItemId() {
    return this.selected
  }
  setSelectedItemId(id: number) {
    if (this.selected === id) return
    if (this.onSelected?.onNavigationItemSelected({ getItemId: () => id }) !== false)
      this.selected = id
  }
  /** A finger on the bar. */
  tap(id: number) {
    if (id === this.selected)
      this.onReselected?.onNavigationItemReselected({ getItemId: () => id })
    else this.setSelectedItemId(id)
  }
  getOrCreateBadge(id: number) {
    const badge = this.badges.get(id) ?? { visible: false }
    this.badges.set(id, badge)
    return {
      setNumber: (value: number) => void (badge.number = value),
      setText: (value: string) => void (badge.text = value),
      clearNumber: () => void delete badge.number,
      clearText: () => void delete badge.text,
      setVisible: (value: boolean) => void (badge.visible = value),
    }
  }
  removeBadge(id: number) {
    this.badges.delete(id)
  }
}

/** Puts Material's classes in the build, the way an app's Gradle dependency does. */
export function installMaterial(): () => void {
  const g = globalThis as any
  const previous = { com: g.com, android: g.android }
  g.com = {
    google: {
      android: {
        material: {
          R: {
            id: { touch_outside: TOUCH_OUTSIDE },
            attr: { colorPrimaryVariant: 1 },
            style: { Theme_MaterialComponents_DayNight_NoActionBar: 2 },
          },
          navigation: {
            NavigationBarView: {
              OnItemSelectedListener: class {
                constructor(impl: object) {
                  Object.assign(this, impl)
                }
              },
              OnItemReselectedListener: class {
                constructor(impl: object) {
                  Object.assign(this, impl)
                }
              },
            },
          },
          bottomnavigation: { BottomNavigationView: NavigationBarStub },
          navigationrail: {
            NavigationRailView: class extends NavigationBarStub {
              rail = true
            },
          },
          bottomsheet: {
            BottomSheetDialog: SheetDialog,
            BottomSheetDialogFragment: SheetFragment,
            BottomSheetBehavior: {
              STATE_COLLAPSED: SheetStates.COLLAPSED,
              STATE_HALF_EXPANDED: SheetStates.HALF_EXPANDED,
              STATE_EXPANDED: SheetStates.EXPANDED,
              STATE_HIDDEN: SheetStates.HIDDEN,
            },
          },
        },
      },
    },
  }
  g.android = {
    animation: { ValueAnimator: { areAnimatorsEnabled: () => true } },
    ...(g.android ?? {}),
    os: { ...(g.android?.os ?? {}), Bundle },
    util: { ...(g.android?.util ?? {}), TypedValue: class {} },
    view: {
      ...(g.android?.view ?? {}),
      ContextThemeWrapper: class {
        constructor(
          public base: unknown,
          public theme: number,
        ) {}
      },
      MotionEvent: { ACTION_UP: 1 },
      View: {
        ...(g.android?.view?.View ?? {}),
        OnClickListener: class {
          constructor(impl: object) {
            Object.assign(this, impl)
          }
        },
        OnTouchListener: class {
          constructor(impl: object) {
            Object.assign(this, impl)
          }
        },
        OnLayoutChangeListener: class {
          constructor(impl: object) {
            Object.assign(this, impl)
          }
        },
      },
    },
  }
  return () => {
    if (previous.com === undefined) delete g.com
    else g.com = previous.com
    if (previous.android === undefined) delete g.android
    else g.android = previous.android
  }
}
export let screenReaderEnabled = false
export function isAccessibilityServiceEnabled() {
  return screenReaderEnabled
}
export function setScreenReaderEnabled(value: boolean) {
  screenReaderEnabled = value
}

export const SharedTransition = {
  getSharedElements(_from: View, _to: View) {
    return { presenting: [] as View[] }
  },
  finished: [] as number[],
  finishState(id: number) {
    SharedTransition.finished.push(id)
  },
}

export const Application = Object.assign(new Observable(), {
  launchEvent: 'launch',
  android: createAndroidApplication(),
  ios: createIOSApplication(),
  inBackground: false,
  getRootView: () => new View(),
})

type DelegateHandler = (...args: any[]) => unknown

/** `Application.ios`: an Observable with core's `addDelegateHandler`, run the way UIKit would. */
function createIOSApplication() {
  const handlers = new Map<string, DelegateHandler[]>()
  const delegate = { prototype: {} as Record<string, DelegateHandler> }
  return Object.assign(new Observable(), {
    delegate,
    addDelegateHandler(method: string, handler: DelegateHandler) {
      if (!handlers.has(method)) {
        const original = delegate.prototype[method]
        handlers.set(method, original ? [original] : [])
        delegate.prototype[method] = (...args) => {
          let result: unknown
          for (const callback of handlers.get(method)!) result = callback(...args)
          return result
        }
      }
      handlers.get(method)!.push(handler)
    },
    call(method: string, ...args: unknown[]) {
      return delegate.prototype[method]?.(...args)
    },
  })
}

const nsurl = (href: string) => ({ absoluteString: href })
const nsset = (items: unknown[]) => ({
  allObjects: { count: items.length, objectAtIndex: (index: number) => items[index] },
})
const browsing = (href: string) => ({
  activityType: 'NSUserActivityTypeBrowsingWeb',
  webpageURL: nsurl(href),
})

/** What iOS does with a URL, a Universal Link or a scene connection. */
export const iosLinks = {
  launch(href?: string, activityHref?: string, shortcutItem?: unknown) {
    return Application.ios.call(
      'applicationDidFinishLaunchingWithOptions',
      {},
      {
        objectForKey(key: string) {
          if (key === 'UIApplicationLaunchOptionsShortcutItemKey') return shortcutItem
          if (key === 'UIApplicationLaunchOptionsURLKey') return href ? nsurl(href) : null
          if (key === 'UIApplicationLaunchOptionsUserActivityDictionaryKey')
            return { objectForKey: () => (activityHref ? browsing(activityHref) : null) }
          return null
        },
      },
    )
  },
  openURL: (href: string) =>
    Application.ios.call('applicationOpenURLOptions', {}, nsurl(href), {}),
  continueUserActivity: (href: string) =>
    Application.ios.call(
      'applicationContinueUserActivityRestorationHandler',
      {},
      browsing(href),
      () => {},
    ),
  connectScene(hrefs: string[], activityHrefs: string[] = [], shortcutItem?: unknown) {
    Application.ios.notify({
      eventName: 'sceneWillConnect',
      object: Application.ios,
      connectionOptions: {
        URLContexts: nsset(hrefs.map((href) => ({ URL: nsurl(href) }))),
        userActivities: nsset(activityHrefs.map(browsing)),
        shortcutItem,
      },
    })
  },
  /** A tap on a quick action. Resolves with what the completion handler was told. */
  performShortcut(item: unknown) {
    let completed: boolean | undefined
    const returned = Application.ios.call(
      'applicationPerformActionForShortcutItemCompletionHandler',
      {},
      item,
      (taken: boolean) => (completed = taken),
    )
    return { returned, completed }
  },
}

export const FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY = 0x00100000

/** What each platform was told to show on the home screen. */
export const shortcuts = {
  android: [] as {
    id: string
    shortLabel: string
    longLabel: string
    url: string
    icon?: number
  }[],
  ios: [] as {
    type: string
    title: string
    subtitle: string | null
    icon: unknown
    url: string
  }[],
  androidLimit: 4,
  androidStatic: [] as string[],
  androidPinned: [] as { id: string; url: string }[],
  androidDisabled: [] as string[],
  androidAcceptUpdates: true,
  androidCanPin: true,
}

/** The Android picker intent and result plumbing, and iOS's document picker, as stand-ins. */
export function installDocumentPicker(): () => void {
  const g = globalThis as any
  const previous = {
    android: g.android,
    androidx: g.androidx,
    NSObject: g.NSObject,
    UIDocumentPickerDelegate: g.UIDocumentPickerDelegate,
    UIDocumentPickerViewController: g.UIDocumentPickerViewController,
    UTType: g.UTType,
    NSArray: g.NSArray,
  }
  class Intent {
    static ACTION_OPEN_DOCUMENT = 'android.intent.action.OPEN_DOCUMENT'
    static CATEGORY_OPENABLE = 'android.intent.category.OPENABLE'
    static EXTRA_MIME_TYPES = 'android.intent.extra.MIME_TYPES'
    static EXTRA_ALLOW_MULTIPLE = 'android.intent.extra.ALLOW_MULTIPLE'
    categories: string[] = []
    type = ''
    extras: Record<string, unknown> = {}
    constructor(public action: string) {}
    addCategory(category: string) {
      this.categories.push(category)
      return this
    }
    setType(type: string) {
      this.type = type
      return this
    }
    putExtra(name: string, value: unknown) {
      this.extras[name] = value
      return this
    }
  }
  g.android = {
    animation: { ValueAnimator: { areAnimatorsEnabled: () => true } },
    ...(g.android ?? {}),
    content: { ...(g.android?.content ?? {}), Intent },
    app: { ...(g.android?.app ?? {}), Activity: { RESULT_OK: -1 } },
  }
  class Callback {
    constructor(methods: object) {
      Object.assign(this, methods)
    }
  }
  g.androidx = {
    ...g.androidx,
    activity: {
      ...g.androidx?.activity,
      result: {
        ActivityResultCallback: Callback,
        contract: { ActivityResultContracts: { StartActivityForResult: class {} } },
      },
    },
  }
  g.NSObject = {
    extend(methods: object) {
      return class {
        constructor() {
          Object.assign(this, methods)
        }
      }
    },
  }
  g.UIDocumentPickerDelegate = {}
  g.UTType = {
    typeWithMIMEType: (mime: string) => `uttype:${mime}`,
    typeWithIdentifier: (id: string) => `uttype:${id}`,
  }
  g.NSArray = { arrayWithArray: (items: unknown[]) => items }
  g.UIDocumentPickerViewController = {
    alloc: () => ({
      initForOpeningContentTypes(types: unknown) {
        const picker = {
          types,
          allowsMultipleSelection: false,
          delegate: null as any,
          presentingViewController: null as unknown,
          dismissViewControllerAnimatedCompletion() {
            picker.presentingViewController = null
          },
        }
        return picker
      },
    }),
  }
  Activity.launched = []
  return () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete g[key]
      else g[key] = value
    }
  }
}

/** What Android does when the picked activity finishes. */
export const activityResults = {
  deliver(requestCode: number, uris: string[] | null) {
    const intent =
      uris === null
        ? null
        : {
            getData: () => (uris.length === 1 ? { toString: () => uris[0] } : null),
            getClipData: () =>
              uris.length > 1
                ? {
                    getItemCount: () => uris.length,
                    getItemAt: (index: number) => ({
                      getUri: () => ({ toString: () => uris[index] }),
                    }),
                  }
                : null,
          }
    const activity = Application.android.foregroundActivity!
    if (
      !activity
        .getActivityResultRegistry()
        .dispatchResult(requestCode, uris === null ? 0 : -1, intent)
    )
      Application.android.notify({
        eventName: 'activityResult',
        object: Application.android,
        activity,
        requestCode,
        resultCode: uris === null ? 0 : -1,
        intent,
      })
  },
}

/** The native shortcut APIs, recording what they are given. */
export function installShortcuts(): () => void {
  shortcuts.androidStatic = []
  shortcuts.androidPinned = []
  shortcuts.androidDisabled = []
  shortcuts.androidAcceptUpdates = true
  shortcuts.androidCanPin = true
  const g = globalThis as any
  const previous = {
    androidx: g.androidx,
    android: g.android,
    java: g.java,
    UIApplicationShortcutItem: g.UIApplicationShortcutItem,
    UIApplicationShortcutIcon: g.UIApplicationShortcutIcon,
    UIApplication: g.UIApplication,
    NSDictionary: g.NSDictionary,
    NSArray: g.NSArray,
  }
  class Builder {
    private record: (typeof shortcuts.android)[number]
    constructor(_context: unknown, id: string) {
      this.record = { id, shortLabel: '', longLabel: '', url: '' }
    }
    setShortLabel(label: string) {
      this.record.shortLabel = label
      return this
    }
    setLongLabel(label: string) {
      this.record.longLabel = label
      return this
    }
    setIcon(icon: number) {
      this.record.icon = icon
      return this
    }
    setIntent(intent: { url: string }) {
      this.record.url = intent.url
      return this
    }
    build() {
      return this.record
    }
  }
  g.androidx = {
    ...(g.androidx ?? {}),
    core: {
      content: {
        pm: {
          ShortcutManagerCompat: {
            getMaxShortcutCountPerActivity: () => shortcuts.androidLimit,
            getShortcuts(_context: unknown, flags: number) {
              const items =
                flags === 1
                  ? shortcuts.androidStatic.map((id) => ({ id, url: '', manifest: true }))
                  : [...shortcuts.android, ...shortcuts.androidPinned].map((item) => ({
                      ...item,
                      manifest: false,
                    }))
              return {
                size: () => items.length,
                get: (index: number) => ({
                  getId: () => items[index]!.id,
                  getIntent: () => ({
                    getData: () => ({ toString: () => items[index]!.url }),
                  }),
                  isDeclaredInManifest: () => items[index]!.manifest,
                }),
              }
            },
            disableShortcuts(_context: unknown, ids: { items: string[] }) {
              shortcuts.androidDisabled.push(...ids.items)
            },
            enableShortcuts(
              _context: unknown,
              shortcutsToEnable: { items: { id: string }[] },
            ) {
              shortcuts.androidDisabled = shortcuts.androidDisabled.filter(
                (id) => !shortcutsToEnable.items.some((item) => item.id === id),
              )
            },
            isRequestPinShortcutSupported: () => shortcuts.androidCanPin,
            requestPinShortcut(_context: unknown, item: { id: string; url: string }) {
              shortcuts.androidPinned.push(item)
              return true
            },
            setDynamicShortcuts(_context: unknown, list: { items: unknown[] }) {
              if (!shortcuts.androidAcceptUpdates) return false
              shortcuts.android = list.items as typeof shortcuts.android
              return true
            },
            removeAllDynamicShortcuts() {
              shortcuts.android = []
            },
          },
          ShortcutInfoCompat: { Builder },
        },
      },
      graphics: {
        drawable: {
          IconCompat: { createWithResource: (_context: unknown, id: number) => id },
        },
      },
    },
  }
  g.android = {
    animation: { ValueAnimator: { areAnimatorsEnabled: () => true } },
    ...(g.android ?? {}),
    content: {
      ...(g.android?.content ?? {}),
      Intent: class {
        url: string
        constructor(_action: string, data: { url: string }) {
          this.url = data.url
        }
        setComponent() {
          return this
        }
        addFlags() {
          return this
        }
      },
      ComponentName: class {
        constructor(
          public context: unknown,
          public className: string,
        ) {}
      },
    },
    net: { ...(g.android?.net ?? {}), Uri: { parse: (url: string) => ({ url }) } },
  }
  g.java = {
    ...(g.java ?? {}),
    util: {
      ...(g.java?.util ?? {}),
      ArrayList: class {
        items: unknown[] = []
        add(item: unknown) {
          this.items.push(item)
        }
      },
    },
  }
  g.UIApplicationShortcutItem = {
    alloc: () => ({
      initWithTypeLocalizedTitleLocalizedSubtitleIconUserInfo(
        type: string,
        title: string,
        subtitle: string | null,
        icon: unknown,
        userInfo: { objectForKey(key: string): unknown },
      ) {
        return {
          type,
          title,
          subtitle,
          icon,
          url: userInfo.objectForKey('url'),
          userInfo,
        }
      },
    }),
  }
  g.UIApplicationShortcutIcon = {
    iconWithSystemImageName: (name: string) => `symbol:${name}`,
  }
  g.UIApplication = { sharedApplication: { shortcutItems: null as unknown } }
  g.NSDictionary = {
    dictionaryWithObjectsForKeys(objects: unknown[], keys: string[]) {
      const map = new Map(keys.map((key, index) => [key, objects[index]]))
      return { objectForKey: (key: string) => map.get(key) ?? null }
    },
  }
  g.NSArray = { arrayWithArray: (items: unknown[]) => items }
  Object.defineProperty(g.UIApplication.sharedApplication, 'shortcutItems', {
    get: () => shortcuts.ios,
    set: (items: typeof shortcuts.ios) => {
      shortcuts.ios = items
    },
  })
  shortcuts.android = []
  shortcuts.ios = []
  return () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete g[key]
      else g[key] = value
    }
  }
}

const intent = (href: string | null, flags: number) => ({
  getData: () => (href ? { toString: () => href } : null),
  getFlags: () => flags,
})

/** What Android does with a launch or a new intent. */
export const androidLinks = {
  create(href: string | null, options: { bundle?: unknown; flags?: number } = {}) {
    const activity = Object.assign(new Activity(), {
      getIntent: () => intent(href, options.flags ?? 0),
    })
    Application.android.notify({
      eventName: 'activityCreated',
      object: Application.android,
      activity,
      // After process death, core deliberately passes null to super.onCreate.
      bundle: null,
    })
    Application.android.notify({
      eventName: 'activityNewIntent',
      object: Application.android,
      activity,
      intent: activity.getIntent(),
    })
    Application.notify({
      eventName: Application.launchEvent,
      object: Application,
      android: activity.getIntent(),
      intent: activity.getIntent(),
      savedInstanceState: options.bundle ?? null,
    })
  },
  newIntent(href: string, flags = 0) {
    Application.android.notify({
      eventName: 'activityNewIntent',
      object: Application.android,
      intent: intent(href, flags),
    })
  },
}

function createAndroidApplication() {
  const application = Object.assign(new Observable(), {
    foregroundActivity: undefined as Activity | undefined,
    startActivity: undefined as Activity | undefined,
  })
  const notify = application.notify.bind(application)
  // what a dialog of its own reports first, like core's does
  application.notify = (data) => {
    if (data.eventName === 'activityBackPressed')
      lastBackPress = data as AndroidActivityBackPressedEventData
    notify(data)
  }
  return application
}

export let isAndroid = false
export let isIOS = true

export function setPlatform(platform: 'ios' | 'android') {
  isAndroid = platform === 'android'
  isIOS = !isAndroid
  const activity = isAndroid ? new Activity() : undefined
  Application.android.foregroundActivity = activity
  Application.android.startActivity = activity
}

/** Where Android sends back right now: the dialog of the top modal, or the activity. */
export function backOwner(): Dialog | SheetDialog | Activity {
  return View.presented.at(-1)?.view.dialog ?? Application.android.foregroundActivity!
}

/**
 * What the Android back button does, or letting go of a back swipe, with the
 * router's chance to cancel it. Returns what core's own callback was told.
 */
export function pressAndroidBack() {
  lastBackPress = undefined
  backOwner().getOnBackPressedDispatcher().onBackPressed()
  return lastBackPress!
}

const backEvent = (progress: number, edge: 'left' | 'right'): BackEvent => ({
  getProgress: () => progress,
  getSwipeEdge: () => EDGES.indexOf(edge),
})

/** A predictive back swipe (Android 14+): start it, move it, then cancel or press. */
export function swipeAndroidBack(edge: 'left' | 'right' = 'left') {
  const dispatcher = backOwner().getOnBackPressedDispatcher()
  dispatcher.startGesture(backEvent(0, edge))
  return {
    move: (progress: number) => dispatcher.progressGesture(backEvent(progress, edge)),
    cancel: () => dispatcher.cancelGesture(),
    release: () => pressAndroidBack(),
  }
}

export function resetNative() {
  screenReaderEnabled = false
  Frame.stack = []
  Frame.navigations = []
  Frame.backs = []
  SharedTransition.finished = []
  View.presented = []
  Application.android = createAndroidApplication()
  Application.ios = createIOSApplication()
  Application.clear()
  Device.sdkVersion = '36'
  setPlatform('ios')
}
