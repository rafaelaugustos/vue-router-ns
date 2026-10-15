import {
  Application,
  Color,
  Frame,
  isAndroid,
  isIOS,
  SharedTransition,
  type AndroidActivityBackPressedEventData,
  type AndroidActivityEventData,
  type EventData,
  type NavigationEntry,
  Page,
} from '@nativescript/core'
import {
  $navigateTo,
  $showModal,
  computed,
  hasInjectionContext,
  inject,
  nextTick,
  shallowReactive,
  shallowRef,
  type App,
  type Ref,
} from 'nativescript-vue'
import {
  backOwnerOf,
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
import { RouterLink } from './components/RouterLink.js'
import { RouterSplitView } from './components/RouterSplitView.js'
import { RouterView } from './components/RouterView.js'
import {
  createNavigationFailure,
  NavigationFailureType,
  type NavigationFailure,
} from './errors.js'
import { routeKey, routerKey } from './injection.js'
import { INTERNAL, type RouterInternals } from './internal.js'
import { previewBack, type BackPreview } from './back-preview.js'
import { canZoom, configureSheet, viewOf, watchDismissAttempts } from './ios.js'
import { createMatcher } from './matcher.js'
import { createPage, ModalHost } from './page.js'
import { parseURL } from './query.js'
import {
  deferred,
  isBlocked,
  isGuardActive,
  topOf,
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
  SavedStacks,
  RestoreContext,
  SetStackOptions,
  TransitionOption,
} from './types.js'

export interface RouterOptions<
  R extends readonly RouteRecordRaw[] = readonly RouteRecordRaw[],
> {
  routes: R
  /** One router per NativeWindow. Otherwise inferred from the first mounted view. */
  window?: RouterWindow
  /** Save the stacks as the user navigates, and rebuild them after the app was killed. */
  restore?: RestoreOptions
  /** Android 14 and later: show the page below while the back swipe moves. Defaults to `true`. */
  backPreview?: boolean
}

interface SplitStack {
  listFrame: Frame
  placeholder: Page
  list: RouteLocationRaw
  expanded: Readonly<Ref<boolean>>
  detailVisible: Ref<boolean>
  resetting: boolean
}

const DEFAULT_MAX_AGE = 30 * 60 * 1000

export interface Router<M extends RouteMapLike = RouteMapGeneric> {
  /** Route of the page the user is looking at. */
  readonly currentRoute: Readonly<Ref<RouteLocation>>
  /** Routes of the stack this router navigates in, bottom to top. */
  readonly stack: Readonly<Ref<readonly RouteLocation[]>>
  readonly window: Readonly<Ref<RouterWindow | undefined>>
  /** Ask the OS to open a new window; its content resolver uses getWindowRoute(data). */
  openWindow(to: RouteLocationRawOf<M>, options?: OpenWindowOptions): void
  readonly options: RouterOptions

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
  afterEach(hook: NavigationHookAfter): () => void
  onError(handler: NavigationErrorHandler): () => void
  /** Resolves once the first `<RouterView>` has shown its initial page. */
  isReady(): Promise<void>

  install(app: App): void
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
  const attached = shallowRef(true)
  let stopped = false
  let stopPlatform: (() => void) | undefined
  let stopWindow: (() => void) | undefined
  let platformInstalled = false
  const matcher = createMatcher(options.routes)

  const beforeGuards = callbacks<NavigationGuard>()
  const resolveGuards = callbacks<NavigationGuard>()
  const afterHooks = callbacks<NavigationHookAfter>()
  const errorHandlers = callbacks<NavigationErrorHandler>()

  const frames = shallowReactive(new Map<string, Stack>())
  const modals = shallowRef<readonly Stack[]>([])
  const lastFrame = shallowRef<Stack>()
  const stacksByFrame = new WeakMap<Frame, Stack>()
  const entriesByPage = new WeakMap<Page, Entry>()
  const detachers = new WeakMap<Stack, () => void>()
  const initializing = new WeakMap<Stack, Promise<void>>()
  const windowWaiters = new Map<Stack, () => void>()
  const splits = new Map<Stack, SplitStack>()
  const previews = new Map<Stack, BackPreview>()
  const components = new WeakMap<RouteRecord, RouteComponent>()

  const ready = deferred<void>()
  ready.promise.catch(() => {})
  let isReady = false
  let entryId = 0
  let modalId = 0
  /** Native transitions in flight. Navigations wait for them, so they always start from a settled screen. */
  let settled: Promise<unknown> = Promise.resolve()

  const focusedFrame = (): Stack | undefined =>
    (lastFrame.value?.closed ? undefined : lastFrame.value) ??
    frames.get('default') ??
    frames.values().next().value

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

  function createStack(name: string, modal: ModalOptions | false): Stack {
    const stack = {
      name,
      modal,
      entries: shallowRef<readonly Entry[]>([]),
      frame: null,
      attempt: undefined,
      pending: undefined,
      settled: Promise.resolve(),
      closed: false,
    } as Omit<Stack, 'router'> as Stack

    return Object.assign(stack, { router: navigation(stack) })
  }

  function attach(stack: Stack, frame: Frame) {
    const discover = () => {
      const window = windowOf(frame)
      if (window) bindWindow(window)
    }
    discover()
    frame.on('loaded', discover)
    const onNavigated = () => sync(stack)
    const onBackPressed = (args: EventData) =>
      onModalBackPressed(stack, args as AndroidActivityBackPressedEventData)

    let stopGestures: (() => void) | undefined
    const onShown = () => {
      stopGestures?.()
      const dialog = backOwnerOf(frame.nativeView)
      stopGestures = dialog
        ? watchBackGestures(dialog, () => gestureSession(stack))
        : undefined
    }

    let stopDismiss: (() => void) | undefined
    const onPresented = () => {
      stopDismiss?.()
      stopDismiss = watchDismissAttempts(frame, () => onDismissAttempt(stack))
    }

    stack.frame = frame
    stacksByFrame.set(frame, stack)
    frame.on(Frame.navigatedToEvent, onNavigated)
    if (isAndroid && stack.modal) {
      frame.on('activityBackPressed', onBackPressed)
      if (hasBackGestures()) frame.on('shownModally', onShown)
    }
    if (isIOS && stack.modal) frame.on('shownModally', onPresented)

    detachers.set(stack, () => {
      frame.off('loaded', discover)
      frame.off(Frame.navigatedToEvent, onNavigated)
      frame.off('activityBackPressed', onBackPressed)
      frame.off('shownModally', onShown)
      frame.off('shownModally', onPresented)
      stopGestures?.()
      stopDismiss?.()
    })
  }

  function close(stack: Stack) {
    previews.get(stack)?.dispose()
    stack.closed = true
    windowWaiters.get(stack)?.()
    detachers.get(stack)?.()
    splits.delete(stack)
    for (const entry of stack.entries.value) dispose(entry)
    stack.entries.value = []
    stack.pending?.resolve()
    stack.pending = undefined
  }

  /** Mirrors the frame into the stack after every native navigation. */
  function sync(stack: Stack) {
    const frame = stack.frame
    if (!frame || stack.closed) return

    const split = splits.get(stack)
    if (split?.resetting) {
      stack.pending?.resolve()
      stack.pending = undefined
      return
    }
    const before = stack.entries.value
    const after = [
      ...(split ? [split.listFrame.currentPage] : []),
      ...frame.backStack.map((entry) => entry.resolvedPage),
      frame.currentPage,
    ]
      .map((page) => page && entriesByPage.get(page))
      .filter((entry): entry is Entry => !!entry)

    stack.entries.value = after
    if (split) split.detailVisible.value = after.length > 1
    if (before.at(-1) !== after.at(-1)) previews.get(stack)?.dispose()
    for (const entry of before) {
      if (!after.includes(entry)) dispose(entry)
    }
    if (!stack.modal) persist()

    if (stack.pending) {
      stack.pending.resolve()
      stack.pending = undefined
      return
    }

    // the platform went back without asking: iOS swipe or ActionBar back button
    const from = before.at(-1)
    const to = after.at(-1)
    if (from && to && from !== to) {
      lastFrame.value = stack
      notifyAfter(to.route, from.route)
    }
  }

  function onModalClosed(stack: Stack) {
    if (stack.closed) return

    const from = topOf(stack)?.route
    const initiated = !!stack.pending
    modals.value = modals.value.filter((modal) => modal !== stack)
    close(stack)

    // swiped down, tapped outside or closed by the Android back button
    if (!initiated && from) notifyAfter(currentRoute.value, from)
  }

  function dispose(entry: Entry) {
    if (entry.disposed) return
    entry.disposed = true
    entry.settle?.(entry.result)
    entry.settle = undefined
  }

  function createEntry(
    stack: Stack,
    route: RouteLocation,
    props: Record<string, unknown>,
    zoomFrom?: Entry['zoomFrom'],
  ) {
    const entry: Entry = {
      id: ++entryId,
      route,
      stack,
      component: components.get(route.matched.at(-1)!)!,
      props,
      leaveGuards: shallowReactive(new Set()),
      backGesture: shallowRef(null),
      zoomFrom,
      isActive: () =>
        attached.value &&
        (topOf(stack) === entry ||
          (!!splits.get(stack)?.expanded.value && stack.entries.value[0] === entry)) &&
        (stack.modal ? modals.value.at(-1) === stack : !modals.value.length),
      page: null,
      result: undefined,
      settle: undefined,
      disposed: false,
    }
    return entry
  }

  const pageLink = {
    link(page: Page, entry: Entry) {
      entry.page = page
      entriesByPage.set(page, entry)
    },
    unlink(page: Page) {
      entriesByPage.delete(page)
    },
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

  function topmostStack(): Stack | undefined {
    const window = nativeWindow.value
    const frame = Frame.topmost(window as never)
    // Core prioritizes a newly created, unbound Frame even for another window.
    // Until it attaches, keep input with this router's visible owning stack.
    if (window && (!frame || windowOf(frame) !== window)) {
      const stack = focused()
      return stack?.frame && windowOf(stack.frame) === window ? stack : undefined
    }
    return frame && stacksByFrame.get(frame)
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
    if (options.backPreview !== false && below?.page && top.page && stack.frame) {
      preview = previewBack(
        stack.frame,
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
      )
      if (preview) previews.set(stack, preview)
    }
    return { gesture: top.backGesture, preview }
  }

  /** Makes `stack` match `targets`: back to the last page both share, then push the rest. */
  async function applyStack(
    stack: Stack,
    targets: readonly RouteLocation[],
    options: Pick<SetStackOptions, 'animated' | 'transition'>,
  ): Promise<NavigationFailure | undefined> {
    const split = splits.get(stack)
    if (split) {
      const list =
        stack.entries.value[0]?.route ?? resolveTarget(split.list, START_LOCATION)
      if (targets[0]?.fullPath !== list.fullPath) targets = [list, ...targets]
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
    ) =>
      run({
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
        redirects: 0,
      })

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
  let restoring = false

  function persist() {
    if (!restore || restoring) return
    const stacks: Record<string, string[]> = {}
    for (const [name, stack] of frames) {
      stacks[name] = stack.entries.value.map((entry) => entry.route.fullPath)
    }
    const context = restoreContext()
    const state: SavedStacks = { savedAt: Date.now(), stacks }
    if (context) state.windowKey = context.key
    if (context) restore.save(state, context)
    else restore.save(state)
  }

  function restoreContext(): RestoreContext | undefined {
    const window = nativeWindow.value
    return window ? { windowId: window.id, key: restore?.key ?? window.id } : undefined
  }

  /** The saved stack for a `<RouterView>`, if there is one worth restoring. */
  async function savedStackFor(name: string): Promise<RouteLocation[] | undefined> {
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
      return targets
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

  async function run(
    request: Request,
    keepPreview?: BackPreview,
  ): Promise<NavigationFailure | undefined> {
    for (const preview of previews.values()) {
      if (preview !== keepPreview) preview.dispose()
    }
    const stack = request.stack
    const split = splits.get(stack)
    const root = stack.entries.value[0]
    if (
      split &&
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
    await Promise.all([settled, stack.settled])

    const entries = stack.entries.value
    const from = topOf(stack)?.route ?? START_LOCATION

    let to: RouteLocation
    let target: Entry | null | undefined
    if (type === 'back') {
      target = request.pick!(entries)
      if (target === undefined) return undefined
      to = target?.route ?? routeBelow(stack)
    } else {
      to = request.to!
    }

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

    // pages that get destroyed: a push keeps the current page alive underneath
    const leaving =
      type === 'back'
        ? entries.slice(target ? entries.indexOf(target) + 1 : 0)
        : modal
          ? []
          : request.options.clearHistory
            ? entries.slice(split ? 1 : 0)
            : type === 'replace'
              ? split && entries.length === 1
                ? []
                : entries.slice(-1)
              : []

    let outcome: GuardOutcome | undefined
    try {
      const info: NavigationInfo = { type }
      const check = (guards: NavigationGuard[]) =>
        runGuards(guards, to, from, info, isCancelled)

      outcome = await check(
        leaving
          .reverse()
          .flatMap((entry) => [...entry.leaveGuards].filter(isGuardActive))
          .map(({ guard }) => guard),
      )
      outcome ??= await check(beforeGuards.list())
      if (type !== 'back') {
        outcome ??= await check(
          to.matched
            .filter((record) => !from.matched.includes(record))
            .flatMap((record) => record.beforeEnter),
        )
        if (!outcome) await loadComponent(to.matched.at(-1)!)
      }
      outcome ??= await check(resolveGuards.list())
    } catch (error) {
      reportError(error, to, from)
      throw error
    }

    if (outcome && 'redirect' in outcome) {
      if (request.redirects >= MAX_REDIRECTS) {
        throw new Error(`Detected an infinite redirect navigating to "${to.fullPath}"`)
      }
      const raw = outcome.redirect
      const flags = typeof raw === 'object' ? raw : {}
      return run({
        ...request,
        type: type === 'replace' || flags.replace ? 'replace' : 'push',
        to: { ...resolveTarget(raw, from), redirectedFrom: to.redirectedFrom ?? to },
        pick: undefined,
        force: flags.force,
        redirects: request.redirects + 1,
      })
    }
    if (outcome) return fail(outcome.stop)
    if (isCancelled()) return fail('cancelled')
    stack.attempt = undefined

    const commit =
      type === 'back'
        ? commitBack(stack, target ?? null, request.result, request.options.animated)
        : modal
          ? commitModal(request, to, modal)
          : commitPage(request, to, initial)

    stack.settled = Promise.allSettled([stack.settled, commit])
    // a frame that isn't loaded, like a tab iOS hasn't shown yet, navigates once it shows up
    if (modal || stack.frame?.isLoaded) {
      settled = Promise.allSettled([settled, commit])
    }
    try {
      await commit
    } catch (error) {
      reportError(error, to, from)
      throw error
    }

    if (stack.closed && !(type === 'back' && target === null)) return fail('cancelled')
    if (!stack.modal) lastFrame.value = stack
    notifyAfter(to, from)
    return undefined
  }

  async function runGuards(
    guards: NavigationGuard[],
    to: RouteLocation,
    from: RouteLocation,
    info: NavigationInfo,
    isCancelled: () => boolean,
  ): Promise<GuardOutcome | undefined> {
    for (const guard of guards) {
      const result = await guard(to, from, info)
      if (isCancelled()) return { stop: 'cancelled' }
      if (result === false) return { stop: 'aborted' }
      if (typeof result === 'string' || (result && typeof result === 'object')) {
        return { redirect: result }
      }
    }
    return undefined
  }

  async function commitPage(request: Request, to: RouteLocation, initial: boolean) {
    const { stack, options } = request
    const split = splits.get(stack)
    const frame = split && initial ? split.listFrame : stack.frame!
    const firstDetail =
      !!split && !initial && (stack.entries.value.length === 1 || !!options.clearHistory)
    if (split && !initial) {
      split.detailVisible.value = true
      await nextTick()
      if (stack.closed) return
      // iOS does not finish presenting a page in an invisible controller.
      // Initialize the native detail root only when its pane first opens.
      if (!frame.currentPage || (options.clearHistory && frame.canGoBack())) {
        split.resetting = true
        try {
          const ready = expect(stack)
          if (!frame.currentPage)
            frame.navigate({ create: () => split.placeholder, animated: false })
          else {
            frame.currentEntry.animated = false
            frame.goBack(frame.backStack[0])
          }
          await ready
        } finally {
          split.resetting = false
        }
      }
    }
    if (stack.closed) return
    const record = to.matched.at(-1)!
    const zoom =
      !initial && !firstDetail && options.animated !== false && canZoom()
        ? viewOf(options.zoomFrom)
        : undefined
    const entry = createEntry(stack, to, pageProps(to, record, options.props), zoom)
    request.onEntry?.(entry)

    // the frame drops the current page from its back stack once we navigate away
    if (
      request.type === 'replace' &&
      frame.currentEntry &&
      !firstDetail &&
      !options.clearHistory
    ) {
      frame.currentEntry.backstackVisible = false
    }

    const navigation: NavigationEntry & { frame: Frame } = { frame }
    // a transition of the frame's own would take the animation away from UIKit's zoom
    const requested = toTransition(options.transition ?? record.transition)
    const transition =
      zoom || (firstDetail && requested?.instance) ? undefined : requested
    if (transition) navigation.transition = transition
    // a shared transition left unused would keep its state in core forever
    if ((zoom || firstDetail) && requested?.instance)
      SharedTransition.finishState(requested.instance.id)
    if (initial) navigation.animated = false
    else if (options.animated !== undefined) navigation.animated = options.animated
    if (options.clearHistory && !split) navigation.clearHistory = true

    const shown = expect(stack)
    try {
      $navigateTo(createPage(entry, pageLink), navigation)
    } catch (error) {
      stack.pending = undefined
      throw error
    }
    await shown
  }

  async function commitModal(request: Request, to: RouteLocation, modal: ModalOptions) {
    const stack = createStack(`modal-${++modalId}`, modal)
    const entry = createEntry(
      stack,
      to,
      pageProps(to, to.matched.at(-1)!, request.options.props),
    )
    request.onEntry?.(entry)

    modals.value = [...modals.value, stack]
    const shown = expect(stack)

    $showModal(ModalHost, {
      ...modal,
      // NativeScript-Vue's default modal target is process-global.
      target: request.stack.frame!.currentPage ?? request.stack.frame!,
      props: {
        onReady(frame: Frame) {
          attach(stack, frame)
          if (isIOS && modal.ios) configureSheet(frame, modal.ios)
          try {
            $navigateTo(createPage(entry, pageLink), { frame, animated: false })
          } catch (error) {
            stack.pending?.reject(error)
            stack.pending = undefined
            frame.closeModal()
          }
        },
      },
    }).then(
      () => onModalClosed(stack),
      (error) => {
        stack.pending?.reject(error)
        stack.pending = undefined
        onModalClosed(stack)
      },
    )

    await shown
  }

  async function commitBack(
    stack: Stack,
    target: Entry | null,
    result: unknown,
    animated: boolean | undefined,
  ) {
    const top = topOf(stack)
    if (top && result !== undefined) top.result = result

    const frame = stack.frame!
    if (!target) {
      const closed = expect(stack)
      frame.closeModal()
      return closed
    }

    const split = splits.get(stack)
    const targetPage =
      split && target === stack.entries.value[0] ? split.placeholder : target.page
    const entry = frame.backStack.find(
      (candidate) => candidate.resolvedPage === targetPage,
    )
    if (!entry) {
      throw new Error(`"${target.route.fullPath}" is no longer in the native stack`)
    }

    // the frame animates a pop the way the page being popped came in
    if (animated !== undefined && frame.currentEntry)
      frame.currentEntry.animated = animated

    const done = expect(stack)
    frame.goBack(entry)
    await done
  }

  function expect(stack: Stack): Promise<void> {
    stack.pending = deferred()
    return stack.pending.promise
  }

  async function loadComponent(record: RouteRecord): Promise<RouteComponent> {
    const cached = components.get(record)
    if (cached) return cached

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

  async function waitForWindow(stack: Stack, frame: Frame) {
    if (stopped) throw new Error('The router window is closed')
    if (!nativeWindow.value && hasNativeWindows() && frame.isLoaded !== true) {
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
    const window = windowOf(frame)
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
      Application.on('exit', onExit)
      stops.push(() => Application.off('exit', onExit))
    }
    if (isAndroid && (!window || window.state === 'attached')) {
      const android = Application.android
      const events = window ?? android
      const activities = new Map<OnBackPressedDispatcherOwner, () => void>()
      const watchActivity = (activity: OnBackPressedDispatcherOwner) => {
        if (!activities.has(activity))
          activities.set(
            activity,
            watchBackGestures(activity, () => gestureSession(topmostStack())),
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
    for (const stack of [...modals.value].reverse()) {
      stack.frame?.closeModal()
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

  function onModalBackPressed(stack: Stack, args: AndroidActivityBackPressedEventData) {
    args.cancel = true
    const isRoot = stack.entries.value.length < 2
    if (isRoot && stack.modal && stack.modal.cancelable === false) return
    stack.router.back().catch(() => {})
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
      await initializing.get(stack)
      const flags = typeof raw === 'object' ? raw : {}
      const to = resolveTarget(raw, topOf(stack)?.route ?? START_LOCATION)
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
      return applyStack(stack, targets, options)
    }

    const methods: Partial<Router> = {
      openWindow(raw, options) {
        if (stopped) throw new Error('The router window is closed')
        const from =
          topOf(origin && !origin.closed ? origin : focused())?.route ?? START_LOCATION
        openRouteWindow(resolveTarget(raw, from).fullPath, options)
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
            entry.settle = resolve as (result: unknown) => void
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
    mount(name, frame, initial) {
      if (frames.has(name)) throw new Error(`Two <RouterView>s are named "${name}"`)

      const stack = createStack(name, false)
      frames.set(name, stack)
      attach(stack, frame)

      const show = async () => {
        await waitForWindow(stack, frame)
        const saved = await savedStackFor(name)
        if (!saved) {
          return run({
            type: 'push',
            stack,
            to: resolveTarget(initial, START_LOCATION),
            options: {},
            redirects: 0,
          })
        }
        // the saved pages go in without animating, and without saving every step
        restoring = true
        try {
          return await applyStack(stack, saved, { animated: false })
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
        },
        (error) => ready.reject(error),
      )
      initializing.set(stack, mounted)
      void mounted.then(() => initializing.delete(stack))
      return mounted
    },

    mountSplit(name, listFrame, detailFrame, list, expanded, detailVisible) {
      if (frames.has(name)) throw new Error(`Two router views are named "${name}"`)
      const stack = createStack(name, false)
      const placeholder = new Page()
      placeholder.actionBarHidden = true
      placeholder.backgroundColor = new Color('transparent')
      const split: SplitStack = {
        listFrame,
        placeholder,
        list,
        expanded,
        detailVisible,
        resetting: false,
      }
      splits.set(stack, split)
      frames.set(name, stack)
      attach(stack, detailFrame)
      stacksByFrame.set(listFrame, stack)
      const syncList = () => sync(stack)
      listFrame.on(Frame.navigatedToEvent, syncList)
      const detach = detachers.get(stack)!
      detachers.set(stack, () => {
        detach()
        listFrame.off(Frame.navigatedToEvent, syncList)
      })
      const mounted = (async () => {
        try {
          await waitForWindow(stack, listFrame)
          const saved = await savedStackFor(name)
          restoring = !!saved
          try {
            await applyStack(stack, saved ?? [resolveTarget(list, START_LOCATION)], {
              animated: false,
            })
          } finally {
            restoring = false
            persist()
          }
          markReady()
        } catch (error) {
          ready.reject(error)
        }
      })()
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
    afterEach: afterHooks.add,
    onError: errorHandlers.add,
    isReady: () => ready.promise,

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
      app.component('RouterLink', RouterLink)
      app.component('Deferred', Deferred)

      if (options.window) bindWindow(options.window)
      platformInstalled = true
      installPlatform()
      app.onUnmount(shutdown)
    },
  })

  Object.defineProperty(router, INTERNAL, { value: internals })

  return router as unknown as Router<RouteMapFrom<R>>
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
  return merged
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
