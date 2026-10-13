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
}

export class View extends Observable {
  static presented: { view: View; options: any }[] = []

  ios: any = { controller: {} }
  private closeCallback: ((...args: unknown[]) => void) | undefined

  showModal(view: View, options: any) {
    view.closeCallback = options.closeCallback
    View.presented.push({ view, options })
    void Promise.resolve().then(() => (view as Partial<Frame>).load?.())
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

export class Page extends View {
  enableSwipeBackNavigation = true
  disposed = false

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
  static stack: Frame[] = []
  static navigations: NavigationEntry[] = []

  static topmost(): Frame | undefined {
    return Frame.stack.at(-1)
  }

  isLoaded = true
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
    this.queue.push({ type: 'forward', entry: { entry, resolvedPage: entry.create!() } })
    this.process()
  }

  goBack(to?: BackstackEntry) {
    if (!this.canGoBack()) return
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

export const Application = {
  android: new Observable(),
}

export let isAndroid = false
export let isIOS = true

export function setPlatform(platform: 'ios' | 'android') {
  isAndroid = platform === 'android'
  isIOS = !isAndroid
}

/** What the Android back button does, including the router's chance to cancel it. */
export function pressAndroidBack() {
  const modal = View.presented.at(-1)
  if (modal) {
    const args = { eventName: 'activityBackPressed', object: modal.view, cancel: false }
    modal.view.notify(args)
    if (!args.cancel) {
      const frame = modal.view as Frame
      if (frame.canGoBack?.()) frame.goBack()
      else modal.view.closeModal()
    }
    return args
  }

  const args = { eventName: 'activityBackPressed', cancel: false }
  Application.android.notify(args)
  if (!args.cancel) Frame.topmost()?.goBack()
  return args
}

export function resetNative() {
  Frame.stack = []
  Frame.navigations = []
  View.presented = []
  Application.android = new Observable()
  setPlatform('ios')
}
