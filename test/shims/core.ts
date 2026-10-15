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
  backgroundColor: unknown
  width = 400
  getActualSize() {
    return { width: this.width, height: 800 }
  }
  static presented: { view: View; options: any }[] = []

  parent: View | null = null
  children: View[] = []
  isLoaded = true
  ios: any = { controller: {} }
  /** On Android, the dialog a modal is shown in. */
  dialog: Dialog | undefined
  private closeCallback: ((...args: unknown[]) => void) | undefined

  /** A stand-in for the platform view, for tests that need one. */
  native: any

  /** Lets the androidx stand-in find the dialog or activity a view lives in. */
  get nativeView() {
    return this.native ?? { owner: this.dialog ?? Application.android.foregroundActivity }
  }

  showModal(view: View, options: any) {
    view.closeCallback = options.closeCallback
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
    View.presented = View.presented.filter((modal) => modal.view !== this)
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

export class TabView extends View {
  selectedIndex = 0

  get items() {
    return this.children.filter((child) => child instanceof TabViewItem)
  }
}

export class Page extends View {
  frame?: Frame
  actionBarHidden = false
  enableSwipeBackNavigation = true
  disposed = false
  override ios: any = { controller: {}, navigationItem: { backAction: null } }

  dispose() {
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

export class Activity {
  finished = false
  private dispatcher = new BackDispatcher(() => (this.finished = true))

  constructor() {
    this.dispatcher.addCallback(this, new CoreBackCallback(() => this.press()))
  }

  getOnBackPressedDispatcher() {
    return this.dispatcher
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
  android: createAndroidApplication(),
})

function createAndroidApplication() {
  return Object.assign(new Observable(), {
    foregroundActivity: undefined as Activity | undefined,
    startActivity: undefined as Activity | undefined,
  })
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
export function backOwner() {
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
  Frame.stack = []
  Frame.navigations = []
  Frame.backs = []
  SharedTransition.finished = []
  View.presented = []
  Application.android = createAndroidApplication()
  Application.clear()
  Device.sdkVersion = '36'
  setPlatform('ios')
}
