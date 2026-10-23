import { createRouteData, disposeRouteData, type RouteLoader } from './route-data.js'
import {
  Application,
  isAndroid,
  isIOS,
  SharedTransition,
  View,
  type AndroidActivityBackPressedEventData,
  type AndroidActivityEventData,
  Frame,
  type Page,
} from '@nativescript/core'
import {
  $showModal,
  computed,
  hasInjectionContext,
  inject,
  nextTick,
  registerElement,
  shallowReactive,
  shallowRef,
  type App,
  type Ref,
} from 'nativescript-vue'
import {
  hasBackGestures,
  watchBackGestures,
  type BackGestureSession,
  type OnBackPressedDispatcherOwner,
} from './android.js'
import {
  claimWindow,
  hasNativeWindows,
  openRouteWindow,
  windowOf,
  type OpenWindowOptions,
  type RouterWindow,
} from './windows.js'
import { Deferred } from './components/Deferred.js'
import { DrawerLayoutView, RouterDrawer } from './drawer.js'
import { vRoutePreview } from './context-menu.js'
import {
  MaterialNavigationBar,
  RouterTab,
  RouterTabs,
  TabsHostView,
} from './tabs-host.js'
import { forgetPageRouter, registerPageRouter } from './page-router.js'
import { RouterLink } from './components/RouterLink.js'
import { RouterSplitView } from './components/RouterSplitView.js'
import { RouterUIKitSplitView } from './components/RouterUIKitSplitView.js'
import { uikitSplitViewClass } from './uikit-split.js'
import { RouterView } from './components/RouterView.js'
import {
  createNavigationFailure,
  NavigationFailureType,
  type NavigationFailure,
} from './errors.js'
import { routeKey, routerKey } from './injection.js'
import { INTERNAL, type RouterInternals } from './internal.js'
import {
  createDiagnostics,
  type DiagnosticsOptions,
  type NavigationTrace,
  type RouterDiagnostics,
} from './diagnostics.js'
import type { BackPreview } from './back-preview.js'
import {
  assertHostVersion,
  unsupportedOperation,
  type NativeHost,
  type NativeHostPart,
} from './host.js'
import {
  assertBottomSheetsAvailable,
  bottomSheetOptions,
  createBottomSheetPresenter,
} from './hosts/bottom-sheet.js'
import { createFrameHost } from './hosts/frame.js'
import { disposeFramePage } from './hosts/frame-page.js'
import { canZoom, configureSheet, viewOf } from './ios.js'
import { createMatcher } from './matcher.js'
import { createLayouts, type EntryLayout } from './layouts.js'
import {
  createMiddlewareRegistry,
  type RouteMiddleware,
  type RouteMiddlewareOptions,
} from './middleware.js'
import {
  installSystemLinks,
  parseLink,
  REPEAT_WINDOW,
  screen,
  type IncomingLink,
  type LinkIgnoredReason,
  type LinkListener,
  type LinkOptions,
  type LinkResult,
  type LinkSource,
  type LinksOptions,
} from './links.js'
import { createPage, ModalHost } from './page.js'
import {
  assertNativeDestination,
  disposeNativeDestination,
  nativeDestinationReady,
} from './native-destinations.js'
import { collectPageState, DEFAULT_STATE_LIMIT } from './page-state.js'
import {
  publishShortcuts,
  pinShortcut,
  shortcutURL,
  readShortcutURL,
  SHORTCUT_SCHEME,
  type RouteShortcut,
} from './shortcuts.js'
import { disconnectPageEffects } from './page-effects.js'
import {
  clearFocusOrigin,
  modalFocusOrigin,
  settleNavigationFocus,
} from './accessibility.js'
import { reduceMotion, type MotionPolicy } from './motion.js'
import { parseURL } from './query.js'
import {
  deferred,
  isBlocked,
  isGuardActive,
  topOf,
  type Deferred as Pending,
  type Entry,
  type Stack,
} from './stack.js'
import type {
  RouteLocationRawOf,
  RouteMapFrom,
  RouteMapGeneric,
  RouteMapLike,
} from './typed.js'
import type {
  AndroidModalOptions,
  BackOptions,
  ModalOptions,
  NavigationErrorHandler,
  NavigationGuard,
  NavigationHookAfter,
  NavigationInfo,
  NavigationOptions,
  NavigationType,
  RawRouteComponent,
  RouteComponent,
  RouteLocation,
  RouteLocationRaw,
  RouteRecord,
  RouteRecordName,
  RouteRecordRaw,
  RestoreOptions,
  SavedEntry,
  SavedStacks,
  RestoreContext,
  SavedState,
  SetStackOptions,
  TransitionOption,
} from './types.js'

export interface RouterOptions<
  R extends readonly RouteRecordRaw[] = readonly RouteRecordRaw[],
> {
  routes: R
  /** Experimental named data loaders, referenced by meta.loaders (including file routes). */
  loaders?: Readonly<Record<string, RouteLoader>>
  /** One router per NativeWindow. Otherwise inferred from the first mounted view. */
  window?: RouterWindow
  /** Optional native layouts. Each owns a Page and renders its destination through a slot. */
  layouts?: Readonly<Record<string, RawRouteComponent>>
  /** Applied when meta.layout is absent. No default layout is enabled unless explicitly set. */
  defaultLayout?: string | false
  /** Save the stacks as the user navigates, and rebuild them after the app was killed. */
  restore?: RestoreOptions
  /** Android 14+: preview the previous page. `core` opts into the experimental Core API with legacy fallback. Defaults to `true`. */
  backPreview?: boolean | 'core'
  /** Collect a bounded, redacted navigation timeline and native stack snapshots. */
  diagnostics?: boolean | DiagnosticsOptions
  /** Respect OS reduced motion by default; applications may explicitly override it. */
  motion?: MotionPolicy
  /**
   * Take links from the operating system: Android intents, iOS URLs and
   * Universal Links. `true` for the defaults, or a policy of schemes, hosts
   * and mapping. `openLink()` works without it.
   */
  links?: boolean | LinksOptions
}

const DEFAULT_MAX_AGE = 30 * 60 * 1000
/** How long a link waits for the `<RouterView>` it targets. */
const MOUNT_TIMEOUT = 10_000

export interface Router<M extends RouteMapLike = RouteMapGeneric> {
  /** Route of the page the user is looking at. */
  readonly currentRoute: Readonly<Ref<RouteLocation>>
  /** Routes of the stack this router navigates in, bottom to top. */
  readonly stack: Readonly<Ref<readonly RouteLocation[]>>
  readonly window: Readonly<Ref<RouterWindow | undefined>>
  /** Ask the OS to open a new window; its content resolver uses getWindowRoute(data). */
  openWindow(to: RouteLocationRawOf<M>, options?: OpenWindowOptions): void
  readonly options: RouterOptions
  readonly diagnostics: RouterDiagnostics | undefined

  push(
    to: RouteLocationRawOf<M>,
    options?: NavigationOptions,
  ): Promise<NavigationFailure | undefined>
  replace(
    to: RouteLocationRawOf<M>,
    options?: NavigationOptions,
  ): Promise<NavigationFailure | undefined>
  /** Pushes a page and resolves with what it passes to `back({ result })` once it closes. */
  pushForResult<T = unknown>(
    to: RouteLocationRawOf<M>,
    options?: NavigationOptions,
  ): Promise<T | undefined>
  /** Closes the page on top. On the first page of a modal, closes the modal. */
  back(options?: BackOptions): Promise<NavigationFailure | undefined>
  /** Negative values only: a native stack has no forward history. */
  go(delta: number): Promise<NavigationFailure | undefined>
  /** Goes back to the first page of the stack. */
  backToRoot(options?: BackOptions): Promise<NavigationFailure | undefined>
  /** Goes back to the closest page below that matches `to`. */
  backTo(
    to: RouteLocationRawOf<M>,
    options?: BackOptions,
  ): Promise<NavigationFailure | undefined>
  /**
   * Makes the stack match `to`: goes back to the last page both have, then
   * pushes the rest, animating only the last step. Guards run for every step.
   */
  setStack(
    to: readonly RouteLocationRawOf<M>[],
    options?: SetStackOptions,
  ): Promise<NavigationFailure | undefined>
  resolve(to: RouteLocationRawOf<M>): RouteLocation

  addRoute(route: RouteRecordRaw): () => void
  addRoute(parentName: RouteRecordName, route: RouteRecordRaw): () => void
  removeRoute(name: RouteRecordName): void
  hasRoute(name: RouteRecordName): boolean
  getRoutes(): RouteRecord[]

  beforeEach(guard: NavigationGuard): () => void
  beforeResolve(guard: NavigationGuard): () => void
  /** Optional named/global middleware, after beforeEach and before beforeEnter. */
  addRouteMiddleware(
    name: string,
    middleware: RouteMiddleware,
    options?: RouteMiddlewareOptions,
  ): () => void
  afterEach(hook: NavigationHookAfter): () => void
  onError(handler: NavigationErrorHandler): () => void
  /** Resolves once the first `<RouterView>` has shown its initial page. */
  isReady(): Promise<void>

  /**
   * Opens what an operating-system link, a notification or a widget points
   * at: a full URL or a bare path. Waits for the first page and for the
   * target stack, brings the parents along, and resolves with what happened.
   */
  openLink(
    href: string,
    options?: LinkOptions & { source?: LinkSource },
  ): Promise<LinkResult>
  /** The location a URL points at under `links`, or `undefined` when it isn't for this app. */
  resolveLink(href: string): RouteLocation | undefined
  /** Hears every link the router was handed, taken or not. */
  onLink(listener: LinkListener): () => void
  /**
   * Lets a native container take the Android system back while it owns it, a
   * drawer that is open for example, before any page pops. Returns what
   * releases the claim.
   */
  claimSystemBack(claimant: SystemBackClaimant): () => void
  /**
   * Replaces the app's home-screen shortcuts (Android dynamic shortcuts, iOS
   * quick actions) with these, within the platform's limit. Each opens its
   * route through `openLink` when tapped. Returns the ids that were published.
   */
  setShortcuts(shortcuts: readonly RouteShortcut<RouteLocationRawOf<M>>[]): string[]
  /** Versioned payload for static resources or an app-owned native launcher integration. */
  shortcutURL(id: string, to: RouteLocationRawOf<M>): string
  /** Requests Android pinning; true means requested, not user-confirmed. */
  pinShortcut(shortcut: RouteShortcut<RouteLocationRawOf<M>>): boolean

  install(app: App): void
}

/** Something other than a page that the system back should go to first. */
export interface SystemBackClaimant {
  /** Whether it wants the next back. Asked on every press and at the start of a swipe. */
  owns(): boolean
  /** Takes the press. */
  back(): void
}

export const START_LOCATION: RouteLocation = {
  path: '/',
  fullPath: '/',
  name: undefined,
  params: {},
  query: {},
  hash: '',
  meta: {},
  matched: [],
  redirectedFrom: undefined,
}

interface Request {
  layout?: EntryLayout
  type: NavigationType
  stack: Stack
  /** Push and replace: where to go. */
  to?: RouteLocation
  /** Back: the entry to return to, `null` to close the modal, `undefined` to do nothing. */
  pick?: (entries: readonly Entry[]) => Entry | null | undefined
  options: NavigationOptions
  force?: boolean
  result?: unknown
  onEntry?: (entry: Entry) => void
  /** Restoring: the identity and state the page had before, if it comes back at the same path. */
  saved?: { path: string; key: string; state?: Record<string, SavedState> }
  redirects: number
}

type GuardOutcome = { stop: 'aborted' | 'cancelled' } | { redirect: RouteLocationRaw }

const MAX_REDIRECTS = 20

export function createRouter<const R extends readonly RouteRecordRaw[]>(
  options: RouterOptions<R>,
): Router<RouteMapFrom<R>> {
  if (options.window && !hasNativeWindows())
    throw new Error('Window-scoped routers require NativeScript core 9.1 or later')
  const owner = {}
  const nativeWindow = shallowRef<RouterWindow>()
  let windowKey: string | undefined
  const attached = shallowRef(true)
  let stopped = false
  let stopPlatform: (() => void) | undefined
  let stopWindow: (() => void) | undefined
  let stopLinks: (() => void) | undefined
  let platformInstalled = false
  const matcher = createMatcher(options.routes)
  const layouts = createLayouts(options.layouts, options.defaultLayout)

  const beforeGuards = callbacks<NavigationGuard>()
  const middleware = createMiddlewareRegistry()
  const resolveGuards = callbacks<NavigationGuard>()
  const afterHooks = callbacks<NavigationHookAfter>()
  const startRouteData = createRouteData(options.loaders)
  const errorHandlers = callbacks<NavigationErrorHandler>()
  const backClaimants = callbacks<SystemBackClaimant>()
  const claimedBack = () => backClaimants.list().find((claimant) => claimant.owns())

  const frames = shallowReactive(new Map<string, Stack>())
  const modals = shallowRef<readonly Stack[]>([])
  const lastFrame = shallowRef<Stack>()
  const entriesByPage = new WeakMap<Page, Entry>()
  const detachers = new WeakMap<Stack, () => void>()
  const presentations = new WeakMap<Stack, (route: RouteLocation | undefined) => void>()
  const initializing = new WeakMap<Stack, Promise<void>>()
  const windowWaiters = new Map<Stack, () => void>()
  const previews = new Map<Stack, BackPreview>()
  const modalOrigins = new WeakMap<Stack, Entry>()
  const components = new WeakMap<RouteRecord, RouteComponent>()
  const shouldReduceMotion = (stack?: Stack) =>
    reduceMotion(options.motion, hostView(stack))
  const diagnostics = options.diagnostics
    ? createDiagnostics(
        options.diagnostics === true ? {} : options.diagnostics,
        () =>
          [...frames.values(), ...modals.value].map((stack) => ({
            stack,
            hosts: hostParts(stack.host),
          })),
        (page) => entriesByPage.get(page),
      )
    : undefined

  const ready = deferred<void>()
  ready.promise.catch(() => {})
  let isReady = false
  let entryId = 0
  const keySeed = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  let modalId = 0
  /** Native transitions in flight. Navigations wait for them, so they always start from a settled screen. */
  let settled: Promise<unknown> = Promise.resolve()

  const focusedFrame = (): Stack | undefined => {
    const last = lastFrame.value
    if (last && !last.closed && last.selected?.() !== false) return last
    return (
      [...frames.values()].find((stack) => stack.selected?.()) ??
      frames.get('default') ??
      frames.values().next().value
    )
  }

  // a modal still being presented has no page yet: the one below stays current
  const focused = (): Stack | undefined =>
    modals.value.findLast((modal) => modal.entries.value.length) ?? focusedFrame()

  const currentRoute = computed(() => topOf(focused())?.route ?? START_LOCATION)

  const reactiveRoute = {} as RouteLocation
  for (const key of Object.keys(START_LOCATION) as (keyof RouteLocation)[]) {
    Object.defineProperty(reactiveRoute, key, {
      enumerable: true,
      get: () => currentRoute.value[key],
    })
  }

  // -- stacks -----------------------------------------------------------------

  function createStack(
    name: string,
    modal: ModalOptions | false,
    initial: RouteLocationRaw,
  ): Stack {
    const stack = {
      name,
      modal,
      initial,
      entries: shallowRef<readonly Entry[]>([]),
      host: null,
      reveal: undefined,
      selected: undefined,
      attempt: undefined,
      pending: undefined,
      settled: Promise.resolve(),
      closed: false,
    } as Omit<Stack, 'router'> as Stack

    return Object.assign(stack, { router: navigation(stack) })
  }

  function attach(stack: Stack, host: NativeHost) {
    assertHostVersion(host)
    const views = hostParts(host)
      .map((part) => part.native)
      .filter((view): view is View => view instanceof View)
    const discover = () => {
      for (const view of views) {
        const window = windowOf(view)
        if (window) bindWindow(window)
      }
    }
    discover()
    for (const view of views) view.on('loaded', discover)
    detachers.set(stack, () => {
      for (const view of views) view.off('loaded', discover)
    })
    stack.host = host
    diagnostics?.event('host', stack, 'attach')
    host.attach({
      changed: () => sync(stack),
      closed: () => onHostClosed(stack),
      dismissAttempted: () => onDismissAttempt(stack),
      backPressed: () => onHostBackPressed(stack),
      backGesture: () => gestureSession(stack),
    })
  }

  function close(stack: Stack) {
    diagnostics?.event('host', stack, 'dispose')
    previews.get(stack)?.dispose()
    stack.closed = true
    presentations.get(stack)?.(undefined)
    presentations.delete(stack)
    windowWaiters.get(stack)?.()
    detachers.get(stack)?.()
    stack.host?.dispose()
    stack.host = null
    for (const entry of stack.entries.value) dispose(entry)
    stack.entries.value = []
    // A queued destination may own SDK resources before its Page joins the
    // visible native history (for example an unloaded tab closed by its owner).
    if (stack.pending?.entry) dispose(stack.pending.entry)
    stack.pending?.resolve()
    stack.pending = undefined
  }

  /** Mirrors the host into the stack after every native navigation. */
  function sync(stack: Stack) {
    const host = stack.host
    if (!host || stack.closed) return

    const pages = host.pages()
    const mounting = stack.pending?.entry
    // A native completion can precede Vue's mounted hooks. Keep the previous
    // stack and pending navigation until the destination Page has been linked.
    if (mounting && (!mounting.page || !pages.includes(mounting.page))) {
      stack.pending!.nativeCompleted = true
      return
    }

    const before = stack.entries.value
    const initiated = !!stack.pending
    const after = pages
      .map((page) => entriesByPage.get(page))
      .filter((entry): entry is Entry => !!entry)

    stack.entries.value = after
    presentations.get(stack)?.(after.at(-1)?.route)
    if (before.at(-1) !== after.at(-1)) previews.get(stack)?.dispose()
    for (const entry of before) {
      if (!after.includes(entry)) dispose(entry)
    }
    if (before.at(-1) !== after.at(-1))
      settleNavigationFocus(after.at(-1), after.length < before.length)
    if (!stack.modal) persist()
    diagnostics?.event(
      'native',
      stack,
      initiated ? 'completion' : after.length < before.length ? 'pop' : 'sync',
    )

    if (stack.pending) {
      stack.pending.resolve()
      stack.pending = undefined
      diagnostics?.audit()
      return
    }

    // the platform went back without asking: iOS swipe or ActionBar back button
    const from = before.at(-1)
    const to = after.at(-1)
    if (from && to && from !== to) {
      lastFrame.value = stack
      notifyAfter(to.route, from.route)
    }
    diagnostics?.audit()
  }

  function onModalClosed(stack: Stack) {
    if (stack.closed) return

    const from = topOf(stack)?.route
    const initiated = !!stack.pending
    modals.value = modals.value.filter((modal) => modal !== stack)
    close(stack)
    settleNavigationFocus(modalOrigins.get(stack), true)

    // swiped down, tapped outside or closed by the Android back button
    if (!initiated && from) notifyAfter(currentRoute.value, from)
  }

  function dispose(entry: Entry) {
    if (entry.disposed) return
    entry.disposed = true
    disposeRouteData(entry)
    try {
      disposeNativeDestination(entry)
    } catch (error) {
      reportError(error, entry.route, entry.route)
    }
    disposeFramePage(entry.page)
    disconnectPageEffects(entry)
    entry.settle?.(entry.result)
    entry.settle = undefined
  }

  function createEntry(
    stack: Stack,
    route: RouteLocation,
    props: Record<string, unknown>,
    zoomFrom?: Entry['zoomFrom'],
    saved?: Request['saved'],
    layout?: EntryLayout,
    from: RouteLocation = topOf(stack)?.route ?? START_LOCATION,
  ) {
    const entry: Entry = {
      id: ++entryId,
      key: saved?.key ?? `${keySeed}-${entryId}`,
      route,
      stack,
      component: components.get(route.matched.at(-1)!)!,
      layout,
      props,
      leaveGuards: shallowReactive(new Set()),
      backGesture: shallowRef(null),
      zoomFrom,
      isActive: () =>
        attached.value &&
        (topOf(stack) === entry || isVisible(entry)) &&
        (stack.modal ? modals.value.at(-1) === stack : !modals.value.length),
      page: null,
      state: new Map(),
      saved: saved?.state,
      result: undefined,
      settle: undefined,
      disposed: false,
    }
    startRouteData(entry, from)
    return entry
  }

  /** On screen next to the page on top, in a host that shows more than one page. */
  function isVisible(entry: Entry): boolean {
    const host = entry.stack.host
    if (!host?.visible || !entry.page) return false
    return host.visible().includes(entry.page)
  }

  const pageLink = {
    link(page: Page, entry: Entry) {
      diagnostics?.event(
        entry.page && entry.page !== page ? 'hmr' : 'page',
        entry.stack,
        entry.page && entry.page !== page ? 'relink' : 'link',
        entry,
      )
      entry.page = page
      entriesByPage.set(page, entry)
      registerPageRouter(page, entry.stack.router)
      const pending = entry.stack.pending
      // Finish the mounted hook first: focus, state and other page effects must
      // be connected before activation and navigation completion are delivered.
      if (pending?.entry === entry && pending.nativeCompleted)
        void nextTick(() => sync(entry.stack))
    },
    unlink(page: Page) {
      const entry = diagnostics && entriesByPage.get(page)
      if (entry) diagnostics?.event('page', entry.stack, 'unlink', entry)
      entriesByPage.delete(page)
      forgetPageRouter(page)
    },
    reload: diagnostics
      ? (entry: Entry, state: string) =>
          diagnostics.event('hmr', entry.stack, state, entry)
      : undefined,
  }

  function stackFor(origin: Stack | undefined, frame?: string): Stack {
    if (frame !== undefined) {
      const named = frames.get(frame)
      if (!named) throw new Error(`No <RouterView name="${frame}"> is mounted`)
      return named
    }
    const stack = origin && !origin.closed ? origin : focused()
    if (!stack) throw new Error('No <RouterView> is mounted')
    return stack
  }

  /** The stack whose host holds the window's system back right now. */
  function topmostStack(): Stack | undefined {
    for (const stack of [...modals.value, ...frames.values()]) {
      if (stack.selected?.() === false) continue
      if (!stack.closed && stack.selected?.()) return stack
      if (!stack.closed && stack.host?.ownsSystemBack?.()) return stack
    }
    // Core temporarily prioritizes a new, unbound Frame globally. Keep back
    // with the last visible stack in this window until that Frame attaches.
    const window = nativeWindow.value
    if (window) {
      const frame = Frame.topmost(window as never)
      const stack = focused()
      const view = hostView(stack)
      if ((!frame || !windowOf(frame)) && view && windowOf(view) === window) return stack
    }
    return undefined
  }

  /** The page a back swipe in `stack` would simply close, if there is one. */
  function gestureSession(stack: Stack | undefined): BackGestureSession | undefined {
    const top = topOf(stack)
    if (!stack || stack.closed || stack.pending || !top || isBlocked(top))
      return undefined
    previews.get(stack)?.dispose()
    const isRoot = stack.entries.value.length < 2
    if (isRoot && (!stack.modal || stack.modal.cancelable === false)) return undefined

    const below = stack.entries.value.at(-2)
    let preview: BackPreview | undefined
    if (
      options.backPreview !== false &&
      below?.page &&
      top.page &&
      stack.host?.previewBack &&
      !shouldReduceMotion(stack)
    ) {
      preview = stack.host.previewBack(
        top.page,
        below.page,
        () =>
          run(
            {
              type: 'back',
              stack,
              pick: (entries) => entries.at(-2),
              options: { animated: false },
              redirects: 0,
            },
            preview,
          ),
        () => {
          top.backGesture.value = null
          if (previews.get(stack) === preview) previews.delete(stack)
        },
        { preferCore: options.backPreview === 'core' },
      )
      if (preview) previews.set(stack, preview)
    }
    return { gesture: top.backGesture, preview }
  }

  /**
   * Makes `stack` match `targets`: back to the last page both share, then
   * push the rest. `saved`, aligned with `targets`, gives restored pages back
   * their identity and state.
   */
  async function applyStack(
    stack: Stack,
    targets: readonly RouteLocation[],
    options: Pick<SetStackOptions, 'animated' | 'transition'>,
    saved?: readonly SavedEntry[],
  ): Promise<NavigationFailure | undefined> {
    if (stack.host?.capabilities.pinnedRoot) {
      const root =
        stack.entries.value[0]?.route ?? resolveTarget(stack.initial, START_LOCATION)
      if (targets[0]?.fullPath !== root.fullPath) targets = [root, ...targets]
    }
    const entries = stack.entries.value
    let shared = 0
    while (
      shared < entries.length &&
      shared < targets.length &&
      entries[shared]!.route.fullPath === targets[shared]!.fullPath
    ) {
      shared++
    }

    const pushes = targets.slice(shared)
    const step = (
      type: 'push' | 'back',
      to: RouteLocation | undefined,
      last: boolean,
      extra: NavigationOptions = {},
    ) => {
      const memory = to && saved?.[targets.indexOf(to)]
      return run({
        type,
        stack,
        to,
        pick: () => entries[shared - 1],
        options: {
          ...extra,
          modal: false,
          animated: last ? options.animated : false,
          transition: last ? options.transition : undefined,
        },
        force: true,
        saved: memory && to ? { path: to.fullPath, ...memory } : undefined,
        redirects: 0,
      })
    }

    let failure: NavigationFailure | undefined
    if (shared === 0) {
      // nothing in common: the first page goes in with the whole stack cleared
      failure = await step('push', pushes.shift(), !pushes.length, { clearHistory: true })
    } else if (shared < entries.length) {
      failure = await step('back', undefined, !pushes.length)
    }
    for (const [index, to] of pushes.entries()) {
      if (failure) break
      failure = await step('push', to, index === pushes.length - 1)
    }
    return failure
  }

  // -- restoring --------------------------------------------------------------

  const restore = options.restore
  let loaded: Promise<SavedStacks | null | undefined> | undefined
  let restoreLoaded = false
  let restoring = false

  function persist() {
    // Native layout callbacks can fire before the window is bound or while an
    // async restore is loading. Do not overwrite its snapshot with empty stacks.
    if (stopped || !restore || !restoreLoaded || restoring) return
    const limit = restore.stateLimit ?? DEFAULT_STATE_LIMIT
    const stacks: Record<string, string[]> = {}
    const entries: Record<string, SavedEntry[]> = {}
    for (const [name, stack] of frames) {
      stacks[name] = stack.entries.value.map((entry) => entry.route.fullPath)
      entries[name] = stack.entries.value.map((entry) => {
        const state = collectPageState(entry, limit)
        return state ? { key: entry.key, state } : { key: entry.key }
      })
    }
    const context = restoreContext()
    const state: SavedStacks = { version: 2, savedAt: Date.now(), stacks, entries }
    if (context) state.windowKey = context.key
    if (context) restore.save(state, context)
    else restore.save(state)
  }

  function restoreContext(): RestoreContext | undefined {
    const window = nativeWindow.value
    return window ? { windowId: window.id, key: windowKey! } : undefined
  }

  interface SavedStack {
    targets: RouteLocation[]
    /** Aligned with `targets`; absent for a path-only save. */
    entries: SavedEntry[] | undefined
  }

  /** The saved stack for a `<RouterView>`, if there is one worth restoring. */
  async function savedStackFor(name: string): Promise<SavedStack | undefined> {
    if (!restore) return undefined
    loaded ??= Promise.resolve()
      .then(() => {
        const context = restoreContext()
        return context ? restore.load(context) : restore.load()
      })
      .catch((error) => {
        if (__DEV__) console.warn('[vue-router-ns] restore.load() failed:', error)
        return undefined
      })
      .then((state) => {
        restoreLoaded = true
        return state
      })
    const state = await loaded
    if (state?.windowKey !== undefined && state.windowKey !== restoreContext()?.key)
      return undefined
    const paths = state?.stacks[name]
    if (!paths?.length) return undefined
    if (Date.now() - state!.savedAt > (restore.maxAge ?? DEFAULT_MAX_AGE))
      return undefined

    try {
      const targets: RouteLocation[] = []
      for (const path of paths)
        targets.push(resolveTarget(path, targets.at(-1) ?? START_LOCATION))
      const entries = state!.entries?.[name]
      return {
        targets,
        entries: entries?.length === paths.length ? entries : undefined,
      }
    } catch (error) {
      if (__DEV__) {
        console.warn(`[vue-router-ns] Not restoring <RouterView name="${name}">:`, error)
      }
      return undefined
    }
  }

  /** The route revealed when a modal closes. */
  function routeBelow(stack: Stack): RouteLocation {
    const index = modals.value.indexOf(stack)
    const below = index > 0 ? modals.value[index - 1] : focusedFrame()
    return topOf(below)?.route ?? START_LOCATION
  }

  // -- navigation -------------------------------------------------------------

  function run(
    request: Request,
    keepPreview?: BackPreview,
    parentNavigationId?: number,
  ): Promise<NavigationFailure | undefined> {
    const trace =
      diagnostics && !diagnostics.api.stopped
        ? diagnostics.begin(request.stack, request.type, request.to, parentNavigationId)
        : undefined
    const navigation = runNavigation(request, keepPreview, trace)
    if (!trace) return navigation
    return navigation.then(
      (failure) => {
        trace.end(
          failure
            ? failure.type === NavigationFailureType.aborted
              ? 'aborted'
              : failure.type === NavigationFailureType.cancelled
                ? 'cancelled'
                : 'duplicated'
            : 'success',
        )
        return failure
      },
      (error) => {
        trace.end('error')
        throw error
      },
    )
  }

  async function runNavigation(
    request: Request,
    keepPreview?: BackPreview,
    trace?: NavigationTrace,
  ): Promise<NavigationFailure | undefined> {
    for (const preview of previews.values()) {
      if (preview !== keepPreview) preview.dispose()
    }
    const stack = request.stack
    const pinned = !!stack.host?.capabilities.pinnedRoot
    const root = stack.entries.value[0]
    if (
      pinned &&
      root &&
      request.type !== 'back' &&
      request.to?.fullPath === root.route.fullPath
    ) {
      request = {
        ...request,
        type: 'back',
        pick: (entries) => (entries.length > 1 ? entries[0] : undefined),
      }
    }
    const { type } = request
    const attempt = (stack.attempt = {})
    const isCancelled = () =>
      stack.closed ||
      stack.attempt !== attempt ||
      (keepPreview !== undefined && !keepPreview.active)
    const release = () => {
      if (stack.attempt === attempt) stack.attempt = undefined
    }
    const queued = trace?.span('queue')
    await Promise.all([settled, stack.settled])
    queued?.end()

    const entries = stack.entries.value
    const from = topOf(stack)?.route ?? START_LOCATION

    let to: RouteLocation
    let target: Entry | null | undefined
    if (type === 'back') {
      target = request.pick!(entries)
      if (target === undefined) {
        trace?.end('noop')
        return undefined
      }
      to = target?.route ?? routeBelow(stack)
    } else {
      to = request.to!
    }
    trace?.route(to)

    const fail = (kind: keyof typeof NavigationFailureType) => {
      const failure = createNavigationFailure(NavigationFailureType[kind], to, from)
      notifyAfter(to, from, failure)
      return failure
    }

    if (isCancelled()) return fail('cancelled')

    const initial = type !== 'back' && !entries.length
    const modal = type !== 'back' && !initial && modalOptionsFor(to, request.options)

    if (type !== 'back' && !initial && !request.force) {
      // a double tap that opens a modal finds it already on screen
      const visible = modal ? currentRoute.value : from
      if (to.fullPath === from.fullPath || to.fullPath === visible.fullPath) {
        return fail('duplicated')
      }
    }
    if (type !== 'back' && !initial && !modal && stack.host) {
      const { capabilities } = stack.host
      if (request.options.clearHistory && !capabilities.clearHistory)
        throw unsupportedOperation(stack.host, 'clearHistory')
      if (
        type === 'replace' &&
        !capabilities.replace &&
        !(pinned && entries.length === 1)
      )
        throw unsupportedOperation(stack.host, 'replace')
    }
    if (modal && isAndroid && modal.android?.sheet) assertBottomSheetsAvailable()

    // pages that get destroyed: a push keeps the current page alive underneath
    const leaving =
      type === 'back'
        ? entries.slice(target ? entries.indexOf(target) + 1 : 0)
        : modal
          ? []
          : request.options.clearHistory
            ? entries.slice(pinned ? 1 : 0)
            : type === 'replace'
              ? pinned && entries.length === 1
                ? []
                : entries.slice(-1)
              : []

    let outcome: GuardOutcome | undefined
    try {
      const info: NavigationInfo = { type }
      const check = (guards: NavigationGuard[], kind: string) =>
        runGuards(guards, to, from, info, isCancelled, trace, kind)

      outcome = await check(
        leaving
          .reverse()
          .flatMap((entry) => [...entry.leaveGuards].filter(isGuardActive))
          .map(({ guard }) => guard),
        'leave',
      )
      outcome ??= await check(beforeGuards.list(), 'beforeEach')
      if (!outcome) {
        const guards = middleware.guards(to)
        if (guards.length) outcome = await check(guards, 'middleware')
      }
      if (type !== 'back') {
        outcome ??= await check(
          to.matched
            .filter((record) => !from.matched.includes(record))
            .flatMap((record) => record.beforeEnter),
          'beforeEnter',
        )
        if (!outcome) {
          const loading = trace?.span(
            'load',
            components.has(to.matched.at(-1)!) ? 'cached' : 'component',
          )
          try {
            await loadComponent(to.matched.at(-1)!)
            const layout = layouts.select(to)
            request.layout = layout === undefined ? undefined : await layouts.load(layout)
            loading?.end()
          } catch (error) {
            loading?.end('error')
            throw error
          }
        }
      }
      outcome ??= await check(resolveGuards.list(), 'beforeResolve')
    } catch (error) {
      release()
      reportError(error, to, from)
      throw error
    }
    // the guards are done either way: the next dismissal the platform asks about is a new request
    const cancelled = isCancelled()
    release()

    if (outcome && 'redirect' in outcome) {
      if (request.redirects >= MAX_REDIRECTS) {
        throw new Error(`Detected an infinite redirect navigating to "${to.fullPath}"`)
      }
      const raw = outcome.redirect
      const flags = typeof raw === 'object' ? raw : {}
      trace?.end('redirected')
      return run(
        {
          ...request,
          type: type === 'replace' || flags.replace ? 'replace' : 'push',
          to: { ...resolveTarget(raw, from), redirectedFrom: to.redirectedFrom ?? to },
          pick: undefined,
          force: flags.force,
          redirects: request.redirects + 1,
        },
        undefined,
        trace?.id,
      )
    }
    if (outcome) return fail(outcome.stop)
    if (cancelled) return fail('cancelled')

    const transition = trace?.span('transition')
    const commit =
      type === 'back'
        ? commitBack(stack, target ?? null, request.result, request.options.animated)
        : modal
          ? commitModal(request, to, modal, trace)
          : commitPage(request, to, initial, trace)

    stack.settled = Promise.allSettled([stack.settled, commit])
    // a frame that isn't loaded, like a tab iOS hasn't shown yet, navigates once it shows up
    if (modal || stack.host?.loaded) {
      settled = Promise.allSettled([settled, commit])
    }
    try {
      await commit
      transition?.end()
    } catch (error) {
      transition?.end('error')
      reportError(error, to, from)
      throw error
    }

    if (stack.closed && !(type === 'back' && target === null)) return fail('cancelled')
    if (!stack.modal) lastFrame.value = stack
    notifyAfter(to, from)
    diagnostics?.audit()
    return undefined
  }

  async function runGuards(
    guards: NavigationGuard[],
    to: RouteLocation,
    from: RouteLocation,
    info: NavigationInfo,
    isCancelled: () => boolean,
    trace?: NavigationTrace,
    kind?: string,
  ): Promise<GuardOutcome | undefined> {
    for (const guard of guards) {
      const checking = trace?.span('guard', kind)
      let result: Awaited<ReturnType<NavigationGuard>>
      try {
        result = await guard(to, from, info)
      } catch (error) {
        checking?.end('error')
        throw error
      }
      checking?.end(
        isCancelled()
          ? 'cancelled'
          : result === false
            ? 'aborted'
            : typeof result === 'string' || (result && typeof result === 'object')
              ? 'redirected'
              : 'success',
      )
      if (isCancelled()) return { stop: 'cancelled' }
      if (result === false) return { stop: 'aborted' }
      if (typeof result === 'string' || (result && typeof result === 'object')) {
        return { redirect: result }
      }
    }
    return undefined
  }

  async function commitPage(
    request: Request,
    to: RouteLocation,
    initial: boolean,
    trace?: NavigationTrace,
  ) {
    const { stack, options } = request
    const host = stack.host!
    clearFocusOrigin(stack)
    const record = to.matched.at(-1)!
    const reduced = shouldReduceMotion(stack)
    const clearHistory = !!options.clearHistory
    // a pane that isn't on screen yet, like a split's first detail, can't carry a zoom or a shared element
    const hidden = !initial && host.willAnimate?.({ clearHistory }) === false
    const zoom =
      !reduced && !initial && !hidden && options.animated !== false && canZoom()
        ? viewOf(options.zoomFrom)
        : undefined
    const entry = createEntry(
      stack,
      to,
      pageProps(to, record, options.props),
      zoom,
      request.saved?.path === to.fullPath ? request.saved : undefined,
      request.layout,
    )
    request.onEntry?.(entry)

    // a transition of the frame's own would take the animation away from UIKit's zoom
    const requested = toTransition(options.transition ?? record.transition)
    const transition =
      reduced || zoom || (hidden && requested?.instance) ? undefined : requested
    // a shared transition left unused would keep its state in core forever
    if ((reduced || zoom || hidden) && requested?.instance)
      SharedTransition.finishState(requested.instance.id)

    const shown = expect(stack, entry)
    const mounting = trace?.span('mount', 'page')
    try {
      await host.push(createPage(entry, pageLink), {
        initial,
        animated: initial || reduced ? false : options.animated,
        transition,
        replace: request.type === 'replace' && !clearHistory && !hidden,
        clearHistory,
      })
      mounting?.end()
    } catch (error) {
      mounting?.end('error')
      entry.settle = undefined
      dispose(entry)
      stack.pending = undefined
      throw error
    }
    await shown
    await finishNativeDestination(entry)
  }

  async function commitModal(
    request: Request,
    to: RouteLocation,
    modal: ModalOptions,
    trace?: NavigationTrace,
  ) {
    const stack = createStack(`modal-${++modalId}`, modal, to.fullPath)
    const origin = modalFocusOrigin(request.stack) ?? topOf(request.stack)
    if (origin) modalOrigins.set(stack, origin)
    const entry = createEntry(
      stack,
      to,
      pageProps(to, to.matched.at(-1)!, request.options.props),
      undefined,
      undefined,
      request.layout,
      topOf(request.stack)?.route ?? START_LOCATION,
    )
    request.onEntry?.(entry)

    modals.value = [...modals.value, stack]
    const shown = expect(stack, entry)

    const animated = !shouldReduceMotion(request.stack) && modal.animated !== false
    const sheet =
      isAndroid && modal.android?.sheet
        ? createBottomSheetPresenter({
            sheet: bottomSheetOptions(modal.android.sheet),
            animated,
            cancelable: modal.cancelable !== false,
            windowSoftInputMode: modal.android.windowSoftInputMode,
            onDismissAttempt: () => onDismissAttempt(stack),
          })
        : undefined
    // A command originating in another native window must present there.
    const target = topOf(request.stack)?.page ?? hostView(request.stack)
    const props = {
      onReady(frame: Frame) {
        const host = createFrameHost(frame, {
          modal: true,
          kind: sheet ? 'bottom-sheet' : undefined,
          holdDismissal: sheet?.hold,
        })
        attach(stack, host)
        if (isIOS && modal.ios) configureSheet(frame, modal.ios)
        const pageMount = trace?.span('mount', 'page')
        try {
          host.push(createPage(entry, pageLink), {
            initial: true,
            animated: false,
            transition: undefined,
            replace: false,
            clearHistory: false,
          })
          pageMount?.end()
        } catch (error) {
          pageMount?.end('error')
          entry.settle = undefined
          dispose(entry)
          stack.pending?.reject(error)
          stack.pending = undefined
          frame.closeModal()
        }
      },
    }
    const mounting = trace?.span('mount', 'modal-host')
    const presented = sheet
      ? sheet.present(ModalHost, props, target)
      : $showModal(ModalHost, {
          ...modal,
          ...(animated ? {} : { animated: false }),
          target,
          props,
        })
    mounting?.end()
    presented.then(
      () => onModalClosed(stack),
      (error) => {
        stack.pending?.reject(error)
        stack.pending = undefined
        onModalClosed(stack)
      },
    )

    await shown
    await finishNativeDestination(entry)
  }

  async function finishNativeDestination(entry: Entry) {
    const ready = nativeDestinationReady(entry)
    if (!ready) return
    try {
      await ready
    } catch (error) {
      // Let pushForResult reject with the mount error instead of settling as a
      // successful user cancellation when rollback disposes the failed entry.
      entry.settle = undefined
      // A failing SDK attachment must not leave a dead Page above the caller.
      // This is rollback of a failed mount, not a user navigation/leave guard.
      const stack = entry.stack
      if (!entry.disposed && topOf(stack) === entry) {
        const previous = stack.entries.value.at(-2)
        if (previous || stack.modal)
          await commitBack(stack, previous ?? null, undefined, false)
      }
      dispose(entry)
      throw error
    }
  }

  async function commitBack(
    stack: Stack,
    target: Entry | null,
    result: unknown,
    animated: boolean | undefined,
  ) {
    const top = topOf(stack)
    if (top && result !== undefined) top.result = result

    const host = stack.host!
    if (shouldReduceMotion(stack)) {
      animated = false
      if (top?.zoomFrom && top.page?.ios) top.page.ios.preferredTransition = null
    }
    if (target && (!target.page || !host.pages().includes(target.page))) {
      throw new Error(`"${target.route.fullPath}" is no longer in the native stack`)
    }
    if (!target && !host.capabilities.close) throw unsupportedOperation(host, 'closing')

    const done = expect(stack)
    try {
      await host.back(target?.page ?? null, { animated })
    } catch (error) {
      stack.pending = undefined
      throw error
    }
    await done
  }

  function expect(stack: Stack, entry?: Entry): Promise<void> {
    stack.pending = { ...deferred<void>(), entry }
    return stack.pending.promise
  }

  async function loadComponent(record: RouteRecord): Promise<RouteComponent> {
    const cached = components.get(record)
    if (cached) {
      assertNativeDestination(cached)
      return cached
    }

    const raw = record.component
    if (!raw) throw new Error(`Route "${record.path}" has no component`)

    let component: RouteComponent = raw
    if (isLazy(raw)) {
      const loaded = await raw()
      component =
        loaded && typeof loaded === 'object' && 'default' in loaded
          ? loaded.default
          : loaded
    }
    assertNativeDestination(component)
    components.set(record, component)
    return component
  }

  function resolveTarget(raw: RouteLocationRaw, current: RouteLocation): RouteLocation {
    let to = matcher.resolve(raw, current)

    for (let i = 0; i < MAX_REDIRECTS; i++) {
      const record = to.matched.at(-1)
      if (!record?.redirect) {
        if (!to.matched.length) throw new Error(`No route matches "${to.fullPath}"`)
        return to
      }
      const redirect =
        typeof record.redirect === 'function' ? record.redirect(to) : record.redirect
      to = {
        ...matcher.resolve(keepQueryAndHash(redirect, to), to),
        redirectedFrom: to.redirectedFrom ?? to,
      }
    }
    throw new Error(`Detected an infinite redirect resolving "${to.fullPath}"`)
  }

  function notifyAfter(
    to: RouteLocation,
    from: RouteLocation,
    failure?: NavigationFailure,
  ) {
    for (const hook of afterHooks.list()) hook(to, from, failure)
  }

  function reportError(error: unknown, to: RouteLocation, from: RouteLocation) {
    const handlers = errorHandlers.list()
    if (__DEV__ && !handlers.length) {
      console.error(
        `[vue-router-ns] Uncaught error navigating to "${to.fullPath}":`,
        error,
      )
    }
    for (const handler of handlers) handler(error, to, from)
  }

  function markReady() {
    if (isReady) return
    isReady = true
    ready.resolve()
  }

  // -- window ownership -------------------------------------------------------

  async function waitForWindow(stack: Stack, frame: View | undefined) {
    if (stopped) throw new Error('The router window is closed')
    if (!nativeWindow.value && hasNativeWindows() && frame && frame.isLoaded !== true) {
      await new Promise<void>((resolve) => {
        const loaded = () => {
          frame.off('loaded', loaded)
          windowWaiters.delete(stack)
          resolve()
        }
        windowWaiters.set(stack, loaded)
        frame.on('loaded', loaded)
      })
    }
    const window = frame && windowOf(frame)
    if (window) bindWindow(window)
    if (stopped || stack.closed) throw new Error('The router view is closed')
  }

  function bindWindow(window: RouterWindow) {
    if (nativeWindow.value === window) return
    if (stopped) throw new Error('The router window is closed')
    if (nativeWindow.value)
      throw new Error('A router cannot own views in more than one NativeWindow')
    const release = claimWindow(window, owner)
    nativeWindow.value = window
    // Existing single-window stores must survive Android's new random window
    // ID after process death. Explicit document windows supply their own key.
    // Capture once: promoting a secondary window must not change its store.
    windowKey =
      restore?.key ?? (!options.window && window.isPrimary ? 'primary' : window.id)
    attached.value = window.state === 'attached'
    const detach = () => {
      try {
        persist()
      } finally {
        attached.value = false
        stopPlatform?.()
        stopPlatform = undefined
        for (const preview of previews.values()) preview.dispose()
      }
    }
    const attach = () => {
      attached.value = true
      installPlatform()
    }
    const closeWindow = () => {
      try {
        const context = restoreContext()
        if (restore && context) restore.save(null, context)
      } finally {
        shutdown()
      }
    }
    window.on('detached', detach)
    window.on('attached', attach)
    window.on('close', closeWindow)
    stopWindow = () => {
      window.off('detached', detach)
      window.off('attached', attach)
      window.off('close', closeWindow)
      release()
    }
    if (platformInstalled) installPlatform()
  }

  function installPlatform() {
    stopPlatform?.()
    stopPlatform = undefined
    if (stopped) return
    const window = nativeWindow.value
    const stops: (() => void)[] = []
    if (restore) {
      const onExit = () => {
        // A process exit is not an explicit close of every native window.
        if (nativeWindow.value) persist()
        else restore.save(null)
      }
      const onSuspend = () => persist()
      Application.on('suspend', onSuspend)
      stops.push(() => Application.off('suspend', onSuspend))
      Application.on('exit', onExit)
      stops.push(() => Application.off('exit', onExit))
    }
    if (isAndroid && (!window || window.state === 'attached')) {
      const android = Application.android
      const events = window ?? android
      const activities = new Map<OnBackPressedDispatcherOwner, () => void>()
      const watchActivity = (activity: OnBackPressedDispatcherOwner) => {
        if (typeof activity.getOnBackPressedDispatcher !== 'function') return
        if (!activities.has(activity))
          activities.set(
            activity,
            watchBackGestures(activity, () =>
              claimedBack() ? undefined : gestureSession(topmostStack()),
            ),
          )
      }
      const onCreated = ({ activity }: AndroidActivityEventData) =>
        watchActivity(activity)
      const onDestroyed = ({ activity }: AndroidActivityEventData) => {
        activities.get(activity)?.()
        activities.delete(activity)
      }
      // Core 9.1 forwards a copy to NativeWindow: cancelling that copy does
      // not cancel the native press. Filter the original event by its owner.
      android.on('activityBackPressed', onActivityBackPressed)
      stops.push(() => android.off('activityBackPressed', onActivityBackPressed))
      if (hasBackGestures()) {
        const activity =
          window?.android?.activity ??
          (!window ? (android.foregroundActivity ?? android.startActivity) : undefined)
        if (activity) watchActivity(activity as OnBackPressedDispatcherOwner)
        events.on('activityCreated', onCreated)
        events.on('activityDestroyed', onDestroyed)
        stops.push(() => {
          events.off('activityCreated', onCreated)
          events.off('activityDestroyed', onDestroyed)
          for (const stop of activities.values()) stop()
        })
      }
    }
    stopPlatform = () => stops.forEach((stop) => stop())
  }

  function shutdown() {
    if (stopped) return
    stopped = true
    for (const wake of windowWaiters.values()) wake()
    attached.value = false
    stopPlatform?.()
    stopWindow?.()
    stopLinks?.()
    for (const waiter of mountWaiters.values())
      waiter.reject(new Error('The router window is closed'))
    mountWaiters.clear()
    for (const stack of [...modals.value].reverse()) {
      void stack.host?.back(null, { animated: false })
      close(stack)
    }
    modals.value = []
    for (const stack of frames.values()) close(stack)
    frames.clear()
    if (!isReady) ready.reject(new Error('The router window closed before it was ready'))
  }

  // -- system back ------------------------------------------------------------

  function onActivityBackPressed(args: AndroidActivityBackPressedEventData) {
    const window = nativeWindow.value
    if (
      window &&
      (window.state !== 'attached' ||
        (!args.activity && !args.window) ||
        (args.activity && args.activity !== window.android?.activity) ||
        (args.window && args.window !== window))
    )
      return
    const stack = topmostStack()
    // Core also emits this global event from dialogs, before the modal
    // Frame's event. Let that host handle its guards, result and dismissal.
    if (stack?.modal) return
    const owner = claimedBack()
    if (owner) {
      args.cancel = true
      owner.back()
      return
    }
    if (!stack || stack.closed || stack.entries.value.length < 2) return

    // go back through the router, so leave guards get a say
    args.cancel = true
    stack.router.back().catch(() => {})
  }

  /** A swipe down or outside tap held off by `modalInPresentation`: the leave guards decide. */
  function onDismissAttempt(stack: Stack) {
    if (stack.closed || stack.attempt) return
    stack.router.go(-stack.entries.value.length).catch(() => {})
  }

  /** The system back a host claimed as its own: the Android back inside a modal dialog. */
  function onHostBackPressed(stack: Stack) {
    if (stack.closed) return
    const isRoot = stack.entries.value.length < 2
    if (isRoot && stack.modal && stack.modal.cancelable === false) return
    stack.router.back().catch(() => {})
  }

  /** A host that went away on its own, before the router closed it. */
  function onHostClosed(stack: Stack) {
    if (stack.closed) return
    if (stack.modal) {
      onModalClosed(stack)
      return
    }
    frames.delete(stack.name)
    close(stack)
    if (lastFrame.value === stack) lastFrame.value = undefined
  }

  // -- links ------------------------------------------------------------------

  const linkPolicy: LinksOptions = typeof options.links === 'object' ? options.links : {}
  const linkListeners = callbacks<LinkListener>()
  const mountWaiters = new Map<string, Pending<void>>()
  let lastLaunchLink: { href: string; at: number } | undefined
  const deliveries = new Set<string>()

  interface EvaluatedLink {
    link: IncomingLink
    location?: RouteLocation
    ignored?: LinkIgnoredReason
  }

  /** Resolves once `<RouterView name>` is mounted, or rejects after a while. */
  function stackMounted(name: string): Promise<void> {
    if (frames.has(name)) return Promise.resolve()
    let waiter = mountWaiters.get(name)
    if (!waiter) {
      const pending = deferred<void>()
      waiter = pending
      mountWaiters.set(name, pending)
      setTimeout(() => {
        if (mountWaiters.get(name) !== pending) return
        mountWaiters.delete(name)
        pending.reject(
          new Error(`No <RouterView name="${name}"> mounted within ${MOUNT_TIMEOUT}ms`),
        )
      }, MOUNT_TIMEOUT)
    }
    return waiter.promise
  }

  function evaluateLink(href: string, source: LinkSource): EvaluatedLink {
    let link = parseLink(href, source)
    if (!link) {
      return {
        link: { href, scheme: '', host: '', path: '', query: {}, hash: '', source },
        ignored: 'malformed',
      }
    }
    const shortcut = readShortcutURL(link)
    if (!shortcut && link.scheme === SHORTCUT_SCHEME)
      return { link, ignored: 'malformed' }
    const screened = shortcut ? undefined : screen(linkPolicy, link)
    if (screened) return { link, ignored: screened }
    try {
      const raw = shortcut
        ? shortcut.to
        : linkPolicy.map
          ? linkPolicy.map(link)
          : { path: link.path, query: link.query, hash: link.hash }
      if (shortcut) link = { ...link, shortcut: shortcut.id }
      if (raw === null || raw === undefined) return { link, ignored: 'unmatched' }
      return { link, location: resolveTarget(raw, START_LOCATION) }
    } catch {
      return { link, ignored: 'unmatched' }
    }
  }

  async function takeLink(
    evaluated: EvaluatedLink,
    options: LinkOptions & { source?: LinkSource },
  ): Promise<LinkResult> {
    const { link, location } = evaluated
    const done = (result: LinkResult) => {
      for (const listener of linkListeners.list()) listener(result)
      return result
    }
    if (!location) return done({ link, ignored: evaluated.ignored })
    const policy =
      typeof linkPolicy.options === 'function'
        ? linkPolicy.options(location, link)
        : linkPolicy.options
    const deliveryId = options.deliveryId ?? policy?.deliveryId
    if (deliveryId !== undefined) {
      if (deliveries.has(deliveryId)) return done({ link, location, ignored: 'repeat' })
      deliveries.add(deliveryId)
      // Bound memory for long-lived apps. Providers should use an id per user tap.
      if (deliveries.size > 256) deliveries.delete(deliveries.values().next().value!)
    }
    if (link.source === 'launch') {
      if (
        lastLaunchLink?.href === link.href &&
        Date.now() - lastLaunchLink.at < REPEAT_WINDOW
      )
        return done({ link, location, ignored: 'repeat' })
      lastLaunchLink = { href: link.href, at: Date.now() }
    } else if (link.source === 'resume' && lastLaunchLink?.href === link.href) {
      const repeat = Date.now() - lastLaunchLink.at < REPEAT_WINDOW
      lastLaunchLink = undefined
      if (repeat) return done({ link, location, ignored: 'repeat' })
    }
    const frame = options.frame ?? linkPolicy.frame?.(location, link) ?? policy?.frame
    const settings = { withParents: true, ...policy, ...options, frame }
    if (!isReady) await ready.promise
    if (frame !== undefined) await stackMounted(frame)
    const target = { path: location.path, query: location.query, hash: location.hash }
    const navigation: NavigationOptions = {
      withParents: settings.withParents,
      clearHistory: settings.clearHistory,
      frame,
    }
    const failure = settings.replace
      ? await router.replace(target, navigation)
      : await router.push(target, navigation)
    return done({ link, location, failure })
  }

  // -- public API -------------------------------------------------------------

  /** Navigation methods bound to a stack (what pages get), or to the focused one. */
  function navigation(origin?: Stack): Router {
    const scope = () => stackFor(origin)

    async function navigate(
      type: 'push' | 'replace',
      raw: RouteLocationRaw,
      options: NavigationOptions = {},
      onEntry?: Request['onEntry'],
    ) {
      // called before the first page is up, e.g. while handling a deep link on launch
      if (!isReady) await ready.promise

      const stack = stackFor(origin, options.frame)
      const flags = typeof raw === 'object' ? raw : {}
      const to = resolveTarget(raw, topOf(stack)?.route ?? START_LOCATION)
      // An unopened iOS tab must load before its pending initial navigation can
      // settle. Reveal at the public boundary, including duplicates and modals;
      // restoring a stack internally must not change the selected tab.
      stack.reveal?.()
      await initializing.get(stack)
      const request: Request = {
        type: type === 'replace' || flags.replace ? 'replace' : 'push',
        stack,
        to,
        options,
        force: flags.force,
        onEntry,
        redirects: 0,
      }
      if (!options.withParents) return run(request)

      // the chain picks up after the deepest parent already on top, unless the stack goes anyway
      const chain = [...matcher.parents(to), to]
      const top = options.clearHistory ? undefined : topOf(stack)?.route.fullPath
      const start = chain.findLastIndex((location) => location.fullPath === top) + 1
      const steps = start < chain.length ? chain.slice(start) : [to]

      let failure: NavigationFailure | undefined
      for (const [index, location] of steps.entries()) {
        const last = index === steps.length - 1
        failure = await run({
          ...request,
          type: index === 0 ? request.type : 'push',
          to: location,
          options: last
            ? { ...options, clearHistory: index === 0 && options.clearHistory }
            : {
                frame: options.frame,
                clearHistory: index === 0 && options.clearHistory,
                animated: false,
                modal: false,
              },
          force: last ? flags.force : true,
          onEntry: last ? onEntry : undefined,
        })
        if (failure) break
      }
      return failure
    }

    function goBack(pick: NonNullable<Request['pick']>, options: BackOptions = {}) {
      const stack = stackFor(origin, options.frame)
      stack.reveal?.()
      return run({
        type: 'back',
        stack,
        pick,
        options: { animated: options.animated },
        result: options.result,
        redirects: 0,
      })
    }

    async function setStack(
      raw: readonly RouteLocationRaw[],
      options: SetStackOptions = {},
    ) {
      if (!raw.length) throw new Error('setStack() needs at least one location')
      if (!isReady) await ready.promise

      const stack = stackFor(origin, options.frame)
      await initializing.get(stack)
      const targets: RouteLocation[] = []
      for (const location of raw) {
        const from = targets.at(-1) ?? topOf(stack)?.route ?? START_LOCATION
        targets.push(resolveTarget(location, from))
      }
      stack.reveal?.()
      return applyStack(stack, targets, options)
    }

    const methods: Partial<Router> = {
      openWindow(raw, options) {
        if (stopped) throw new Error('The router window is closed')
        const from =
          topOf(origin && !origin.closed ? origin : focused())?.route ?? START_LOCATION
        openRouteWindow(resolveTarget(raw, from).fullPath, options, nativeWindow.value)
      },
      stack: computed(() => {
        const stack = origin && !origin.closed ? origin : focused()
        return stack?.entries.value.map((entry) => entry.route) ?? []
      }),

      push: (to, options) => navigate('push', to, options),
      replace: (to, options) => navigate('replace', to, options),

      pushForResult<T>(to: RouteLocationRaw, options?: NavigationOptions) {
        return new Promise<T | undefined>((resolve, reject) => {
          const settle = (entry: Entry) => {
            entry.settle = diagnostics
              ? (result) => {
                  diagnostics.result(entry)
                  resolve(result as T | undefined)
                }
              : (resolve as (result: unknown) => void)
          }
          navigate('push', to, options, settle).then(
            (failure) => failure && resolve(undefined),
            reject,
          )
        })
      },

      back: (options) =>
        goBack(
          (entries) =>
            entries.at(-2) ?? (scope().modal && entries.length === 1 ? null : undefined),
          options,
        ),

      go(delta) {
        if (__DEV__ && delta > 0) {
          console.warn(
            '[vue-router-ns] go() only goes back: native stacks have no forward history',
          )
        }
        if (delta >= 0) return Promise.resolve(undefined)

        return goBack((entries) => {
          if (-delta < entries.length) return entries.at(delta - 1)
          return scope().modal && -delta === entries.length ? null : undefined
        })
      },

      backToRoot: (options) =>
        goBack((entries) => (entries.length > 1 ? entries[0] : undefined), options),

      backTo(to, options) {
        return goBack((entries) => {
          const location = matcher.resolve(to, entries.at(-1)?.route ?? START_LOCATION)
          const target = entries
            .slice(0, -1)
            .findLast((entry) => matches(entry.route, location, to))
          if (!target) {
            throw new Error(`No page matching "${location.fullPath}" in the stack`)
          }
          return target
        }, options)
      },

      setStack,

      resolve: (to) => resolveTarget(to, topOf(scope())?.route ?? START_LOCATION),
    }

    return origin ? Object.assign(Object.create(router), methods) : (methods as Router)
  }

  const internals: RouterInternals = {
    mount(name, host, initial, reveal, selected, present) {
      if (frames.has(name)) throw new Error(`Two router views are named "${name}"`)

      const stack = createStack(name, false, initial)
      stack.reveal = reveal
      stack.selected = selected
      if (present) presentations.set(stack, present)
      attach(stack, host)
      frames.set(name, stack)

      const show = async () => {
        await waitForWindow(stack, hostView(stack))
        const saved = await savedStackFor(name)
        if (!saved && !host.capabilities.pinnedRoot) {
          return run({
            type: 'push',
            stack,
            to: resolveTarget(initial, START_LOCATION),
            options: {},
            redirects: 0,
          })
        }
        // the saved pages go in without animating, and without saving every step
        restoring = !!saved
        try {
          return await applyStack(
            stack,
            saved?.targets ?? [resolveTarget(initial, START_LOCATION)],
            { animated: false },
            saved?.entries,
          )
        } finally {
          restoring = false
          persist()
        }
      }

      const mounted = show().then(
        (failure) => {
          if (failure && __DEV__) {
            console.warn(
              `[vue-router-ns] <RouterView name="${name}"> has no page: ${failure.message}`,
            )
          }
          markReady()
          // links waiting for this stack go in on top of its first page
          mountWaiters.get(name)?.resolve()
          mountWaiters.delete(name)
        },
        (error) => {
          ready.reject(error)
          mountWaiters.get(name)?.reject(error)
          mountWaiters.delete(name)
        },
      )
      initializing.set(stack, mounted)
      void mounted.then(() => initializing.delete(stack))
      return mounted
    },

    unmount(name) {
      const stack = frames.get(name)
      if (!stack) return
      frames.delete(name)
      close(stack)
      if (lastFrame.value === stack) lastFrame.value = undefined
    },
  }

  const router: Router = Object.assign(navigation(), {
    currentRoute,
    window: nativeWindow,
    diagnostics: diagnostics?.api,
    options: options as RouterOptions,

    addRoute(parentOrRoute: RouteRecordName | RouteRecordRaw, route?: RouteRecordRaw) {
      return route
        ? matcher.addRoute(route, parentOrRoute as RouteRecordName)
        : matcher.addRoute(parentOrRoute as RouteRecordRaw)
    },
    removeRoute: matcher.removeRoute,
    hasRoute: matcher.hasRoute,
    getRoutes: matcher.getRoutes,

    beforeEach: beforeGuards.add,
    beforeResolve: resolveGuards.add,
    addRouteMiddleware: middleware.add,
    afterEach: afterHooks.add,
    onError: errorHandlers.add,
    isReady: () => ready.promise,

    openLink: (href: string, options: LinkOptions & { source?: LinkSource } = {}) =>
      takeLink(evaluateLink(href, options.source ?? 'app'), options),
    resolveLink: (href: string) => evaluateLink(href, 'app').location,
    onLink: linkListeners.add,
    claimSystemBack: backClaimants.add,
    shortcutURL: (id: string, to: RouteLocationRaw) =>
      shortcutURL(id, resolveTarget(to, START_LOCATION)),
    pinShortcut(shortcut: RouteShortcut) {
      return pinShortcut({
        ...shortcut,
        location: resolveTarget(shortcut.to, START_LOCATION),
      })
    },
    setShortcuts(shortcuts: readonly RouteShortcut[]) {
      const seen = new Set<string>()
      const published = shortcuts.map((shortcut) => {
        if (seen.has(shortcut.id))
          throw new Error(`Two shortcuts are named "${shortcut.id}"`)
        seen.add(shortcut.id)
        return { ...shortcut, location: resolveTarget(shortcut.to, START_LOCATION) }
      })
      return publishShortcuts(published)
    },

    install(app: App) {
      const route = shallowReactive(reactiveRoute)

      app.provide(routerKey, router)
      app.provide(routeKey, route)
      app.config.globalProperties.$router = router
      Object.defineProperty(app.config.globalProperties, '$route', {
        enumerable: true,
        // inside a page, templates get that page's own route
        get: () => (hasInjectionContext() ? inject(routeKey, route) : route),
      })
      app.component('RouterView', RouterView)
      app.component('RouterSplitView', RouterSplitView)
      app.component('RouterUIKitSplitView', RouterUIKitSplitView)
      app.component('RouterLink', RouterLink)
      app.component('Deferred', Deferred)
      app.component('RouterDrawer', RouterDrawer)
      app.component('RouterTabs', RouterTabs)
      app.component('RouterTab', RouterTab)
      app.directive('route-preview', vRoutePreview)
      // NativeScript-Vue's element registry is process-wide, unlike Vue apps.
      registerElement('RouterUIKitSplitHost', uikitSplitViewClass, {
        viewFlags: 4,
        overwriteExisting: true,
      })
      registerElement('RouterTabsHost', () => TabsHostView, {
        viewFlags: 4,
        overwriteExisting: true,
      })
      if (isAndroid)
        registerElement('RouterNavigationBar', () => MaterialNavigationBar, {
          overwriteExisting: true,
        })
      if (isAndroid) {
        registerElement('RouterDrawerLayout', () => DrawerLayoutView, {
          viewFlags: 4,
          overwriteExisting: true,
        })
      }
      if (diagnostics) app.onUnmount(() => diagnostics.api.stop())

      if (options.window) bindWindow(options.window)
      if (options.links && (linkPolicy.system !== false || linkPolicy.initial)) {
        stopLinks = installSystemLinks({
          policy: linkPolicy,
          window: () => nativeWindow.value,
          deliver(href, source) {
            const evaluated = evaluateLink(href, source)
            takeLink(evaluated, { source }).catch((error) => {
              if (__DEV__)
                console.warn(`[vue-router-ns] Opening "${href}" failed:`, error)
            })
            return !!evaluated.location
          },
        })
      }

      platformInstalled = true
      installPlatform()
      app.onUnmount(shutdown)
    },
  })

  Object.defineProperty(router, INTERNAL, { value: internals })

  return router as unknown as Router<RouteMapFrom<R>>
}

/** The containers a host reports, or one empty part while a modal host is still presenting. */
function hostParts(host: NativeHost | null): NativeHostPart[] {
  if (!host) return [{ role: 'main', native: null, loaded: false, pages: [] }]
  if (host.parts) return [...host.parts()]
  return [{ role: 'main', native: host.native, loaded: host.loaded, pages: host.pages() }]
}

/** A view inside the stack's host, for platform lookups that need a window or context. */
function hostView(stack: Stack | undefined): View | undefined {
  const native = stack?.host?.parts?.()[0]?.native ?? stack?.host?.native
  return native instanceof View ? native : undefined
}

function modalOptionsFor(
  to: RouteLocation,
  options: NavigationOptions,
): ModalOptions | false {
  const fromRecord = to.matched.at(-1)?.modal ?? false
  if (options.modal === undefined) return fromRecord
  if (options.modal === false) return false
  const extra = options.modal === true ? {} : options.modal
  const merged: ModalOptions = { ...(fromRecord || {}), ...extra }
  if (fromRecord && fromRecord.ios && extra.ios)
    merged.ios = { ...fromRecord.ios, ...extra.ios }
  if (fromRecord && fromRecord.android && extra.android) {
    merged.android = {
      ...fromRecord.android,
      ...extra.android,
      sheet: mergeSheet(fromRecord.android.sheet, extra.android.sheet),
    }
  }
  return merged
}

function mergeSheet(
  base: AndroidModalOptions['sheet'],
  extra: AndroidModalOptions['sheet'],
): AndroidModalOptions['sheet'] {
  if (extra === undefined) return base
  if (!extra || !base) return extra
  return { ...(base === true ? {} : base), ...(extra === true ? {} : extra) }
}

function pageProps(
  route: RouteLocation,
  record: RouteRecord,
  extra: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const { props } = record
  const base =
    props === true
      ? route.params
      : typeof props === 'function'
        ? props(route)
        : (props ?? {})
  return { ...base, ...extra }
}

function toTransition(transition: TransitionOption | undefined) {
  return typeof transition === 'string' ? { name: transition } : transition
}

function isLazy(component: RawRouteComponent): component is () => Promise<any> {
  return (
    typeof component === 'function' &&
    !('__vccOpts' in component) &&
    !('props' in component) &&
    !('emits' in component) &&
    !('displayName' in component)
  )
}

/** Like Vue Router, a redirect keeps the query and hash unless it sets its own. */
function keepQueryAndHash(
  redirect: RouteLocationRaw,
  to: RouteLocation,
): RouteLocationRaw {
  if (typeof redirect === 'string') {
    if (redirect.includes('?') || redirect.includes('#')) return redirect
    return { path: parseURL(redirect).path, query: to.query, hash: to.hash }
  }
  return { query: to.query, hash: to.hash, ...redirect } as RouteLocationRaw
}

function matches(
  route: RouteLocation,
  target: RouteLocation,
  raw: RouteLocationRaw,
): boolean {
  if (typeof raw === 'object' && raw.name !== undefined) {
    return (
      route.name === target.name &&
      Object.keys(raw.params ?? {}).every(
        (key) => String(route.params[key]) === String(target.params[key]),
      )
    )
  }
  return route.path.toLowerCase() === target.path.toLowerCase()
}

function callbacks<T>() {
  let list: T[] = []
  return {
    add(fn: T) {
      list = [...list, fn]
      return () => {
        list = list.filter((item) => item !== fn)
      }
    },
    list: () => list,
  }
}
