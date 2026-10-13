import {
  Application,
  Frame,
  isAndroid,
  type AndroidActivityBackPressedEventData,
  type EventData,
  type NavigationEntry,
  type Page,
} from '@nativescript/core'
import {
  $navigateTo,
  $showModal,
  computed,
  hasInjectionContext,
  inject,
  shallowReactive,
  shallowRef,
  type App,
  type Ref,
} from 'nativescript-vue'
import { RouterLink } from './components/RouterLink.js'
import { RouterView } from './components/RouterView.js'
import {
  createNavigationFailure,
  NavigationFailureType,
  type NavigationFailure,
} from './errors.js'
import { routeKey, routerKey } from './injection.js'
import { INTERNAL, type RouterInternals } from './internal.js'
import { createMatcher } from './matcher.js'
import { createPage, ModalHost } from './page.js'
import { parseURL } from './query.js'
import { deferred, isGuardActive, topOf, type Entry, type Stack } from './stack.js'
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
  TransitionOption,
} from './types.js'

export interface RouterOptions<
  R extends readonly RouteRecordRaw[] = readonly RouteRecordRaw[],
> {
  routes: R
}

export interface Router<M extends RouteMapLike = RouteMapGeneric> {
  /** Route of the page the user is looking at. */
  readonly currentRoute: Readonly<Ref<RouteLocation>>
  /** Routes of the stack this router navigates in, bottom to top. */
  readonly stack: Readonly<Ref<readonly RouteLocation[]>>
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
  /** Goes back to the closest page below that matches `to`. */
  backTo(
    to: RouteLocationRawOf<M>,
    options?: BackOptions,
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
  const components = new WeakMap<RouteRecord, RouteComponent>()

  const ready = deferred<void>()
  ready.promise.catch(() => {})
  let isReady = false
  let entryId = 0
  let modalId = 0
  /** Native work in flight. Navigations wait for it, so they always start from a settled stack. */
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
      closed: false,
    } as Omit<Stack, 'router'> as Stack

    return Object.assign(stack, { router: navigation(stack) })
  }

  function attach(stack: Stack, frame: Frame) {
    const onNavigated = () => sync(stack)
    const onBackPressed = (args: EventData) =>
      onModalBackPressed(stack, args as AndroidActivityBackPressedEventData)

    stack.frame = frame
    stacksByFrame.set(frame, stack)
    frame.on(Frame.navigatedToEvent, onNavigated)
    if (isAndroid && stack.modal) frame.on('activityBackPressed', onBackPressed)

    detachers.set(stack, () => {
      frame.off(Frame.navigatedToEvent, onNavigated)
      frame.off('activityBackPressed', onBackPressed)
    })
  }

  function close(stack: Stack) {
    stack.closed = true
    detachers.get(stack)?.()
    for (const entry of stack.entries.value) dispose(entry)
    stack.entries.value = []
    stack.pending?.resolve()
    stack.pending = undefined
  }

  /** Mirrors the frame into the stack after every native navigation. */
  function sync(stack: Stack) {
    const frame = stack.frame
    if (!frame || stack.closed) return

    const before = stack.entries.value
    const after = [
      ...frame.backStack.map((entry) => entry.resolvedPage),
      frame.currentPage,
    ]
      .map((page) => page && entriesByPage.get(page))
      .filter((entry): entry is Entry => !!entry)

    stack.entries.value = after
    for (const entry of before) {
      if (!after.includes(entry)) dispose(entry)
    }

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
  ) {
    const entry: Entry = {
      id: ++entryId,
      route,
      stack,
      component: components.get(route.matched.at(-1)!)!,
      props,
      leaveGuards: shallowReactive(new Set()),
      isActive: () =>
        topOf(stack) === entry &&
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

  /** The route revealed when a modal closes. */
  function routeBelow(stack: Stack): RouteLocation {
    const index = modals.value.indexOf(stack)
    const below = index > 0 ? modals.value[index - 1] : focusedFrame()
    return topOf(below)?.route ?? START_LOCATION
  }

  // -- navigation -------------------------------------------------------------

  async function run(request: Request): Promise<NavigationFailure | undefined> {
    const { stack, type } = request
    const attempt = (stack.attempt = {})
    const isCancelled = () => stack.attempt !== attempt
    await settled

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
            ? [...entries]
            : type === 'replace'
              ? entries.slice(-1)
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
        ? commitBack(stack, target ?? null, request.result)
        : modal
          ? commitModal(request, to, modal)
          : commitPage(request, to, initial)

    settled = Promise.allSettled([settled, commit])
    try {
      await commit
    } catch (error) {
      reportError(error, to, from)
      throw error
    }

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
    const frame = stack.frame!
    const record = to.matched.at(-1)!
    const entry = createEntry(stack, to, pageProps(to, record, options.props))
    request.onEntry?.(entry)

    // the frame drops the current page from its back stack once we navigate away
    if (request.type === 'replace' && frame.currentEntry) {
      frame.currentEntry.backstackVisible = false
    }

    const navigation: NavigationEntry & { frame: Frame } = { frame }
    const transition = toTransition(options.transition ?? record.transition)
    if (transition) navigation.transition = transition
    if (initial) navigation.animated = false
    else if (options.animated !== undefined) navigation.animated = options.animated
    if (options.clearHistory) navigation.clearHistory = true

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
      props: {
        onReady(frame: Frame) {
          attach(stack, frame)
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

  async function commitBack(stack: Stack, target: Entry | null, result: unknown) {
    const top = topOf(stack)
    if (top && result !== undefined) top.result = result

    const frame = stack.frame!
    if (!target) {
      const closed = expect(stack)
      frame.closeModal()
      return closed
    }

    const entry = frame.backStack.find(
      (candidate) => candidate.resolvedPage === target.page,
    )
    if (!entry) {
      throw new Error(`"${target.route.fullPath}" is no longer in the native stack`)
    }

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

  // -- system back ------------------------------------------------------------

  function onActivityBackPressed(args: AndroidActivityBackPressedEventData) {
    const frame = Frame.topmost()
    const stack = frame && stacksByFrame.get(frame)
    if (!stack || stack.closed || stack.entries.value.length < 2) return

    // go back through the router, so leave guards get a say
    args.cancel = true
    stack.router.back().catch(() => {})
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
      const flags = typeof raw === 'object' ? raw : {}

      return run({
        type: type === 'replace' || flags.replace ? 'replace' : 'push',
        stack,
        to: resolveTarget(raw, topOf(stack)?.route ?? START_LOCATION),
        options,
        force: flags.force,
        onEntry,
        redirects: 0,
      })
    }

    function goBack(pick: NonNullable<Request['pick']>, options: BackOptions = {}) {
      const stack = stackFor(origin, options.frame)
      return run({
        type: 'back',
        stack,
        pick,
        options: {},
        result: options.result,
        redirects: 0,
      })
    }

    const methods: Partial<Router> = {
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

      return run({
        type: 'push',
        stack,
        to: resolveTarget(initial, START_LOCATION),
        options: {},
        redirects: 0,
      }).then(
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
      app.component('RouterLink', RouterLink)

      if (isAndroid) {
        Application.android.on('activityBackPressed', onActivityBackPressed)
        app.onUnmount(() =>
          Application.android.off('activityBackPressed', onActivityBackPressed),
        )
      }
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
  return { ...(fromRecord || {}), ...(options.modal === true ? {} : options.modal) }
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
