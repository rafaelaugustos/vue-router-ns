import { createApp, h } from 'nativescript-vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createRouter,
  defineRouteLoader,
  useRouteData,
  useRouteDataPreload,
  RouterView,
  NavigationFailureType,
  type RouteLoaderContext,
  type RouteData,
  type Router,
} from '../src/index.js'
import { createFileRouteUpdater } from '../src/file-routing/index.js'
import { page, mount, settle, events } from './helpers.js'
import { NativeWindow, resetNative, setPlatform } from './shims/core.js'

const apps: ReturnType<typeof createApp>[] = [],
  routers: Router<any>[] = []
const Home = page('Home'),
  home = { path: '/', component: Home }
const tick = async () => {
  for (let i = 0; i < 16; i++) await Promise.resolve()
}
function deferred<T = string>() {
  let resolve!: (value: T) => void, reject!: (error: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
const scope = {},
  allowed = { scope: () => scope, authorize: () => true }
function root(options: Parameters<typeof createRouter>[0]) {
  const router = createRouter(options)
  routers.push(router)
  return router
}
function track(f: Awaited<ReturnType<typeof mount>>) {
  apps.push(f.app)
  routers.push(f.router)
  return f
}
afterEach(() => {
  for (const app of apps.splice(0)) app.unmount()
  for (const router of routers.splice(0)) router.clearPreloads()
  vi.useRealTimers()
})

describe('explicit data preparation', () => {
  it('requires declaration, explicit opt-in, a session scope and strict synchronous permission', async () => {
    const load = vi.fn(() => 'secret')
    const plain = defineRouteLoader(load),
      denied = defineRouteLoader(load, {
        preload: { ...allowed, authorize: () => false },
      })
    const anonymous = defineRouteLoader(load, {
      preload: { ...allowed, scope: () => null },
    })
    const asynchronous = defineRouteLoader(load, {
      preload: { ...allowed, authorize: (() => Promise.resolve(true)) as any },
    })
    const router = root({
      routes: [
        {
          path: '/',
          component: Home,
          meta: { loaders: [plain, denied, anonymous, asynchronous] },
        },
      ],
    })
    expect((await router.preloadData('/', plain).ready).status).toBe('error')
    for (const loader of [denied, anonymous, asynchronous])
      expect(await router.preloadData('/', loader).ready).toEqual({
        status: 'cancelled',
        reason: 'unauthorized',
      })
    expect(
      (await router.preloadData('/', defineRouteLoader(load, { preload: allowed })).ready)
        .status,
    ).toBe('error')
    expect((await router.preloadData('/missing', denied).ready).status).toBe('error')
    expect(load).not.toHaveBeenCalled()
  })

  it('prepares only the requested loader without code, guards, native/Vue mounting or history changes', async () => {
    const work = vi.fn(() => 'prepared'),
      other = vi.fn(() => 'other'),
      factory = vi.fn(() => Home)
    const loader = defineRouteLoader(work, { preload: allowed }),
      sibling = defineRouteLoader(other)
    const f = track(
      await mount([
        home,
        { path: '/detail', component: factory, meta: { loaders: [loader, sibling] } },
      ]),
    )
    const guard = vi.fn(() => false),
      after = vi.fn()
    f.router.beforeEach(guard)
    f.router.beforeResolve(guard)
    f.router.afterEach(after)
    const history = f.router.getHistory(),
      native = f.frame().currentPage,
      mounted = [...events]
    const handle = f.router.preloadData('/detail', loader)
    expect(await handle.ready).toEqual({ status: 'ready' })
    for (const fn of [other, factory, guard, after]) expect(fn).not.toHaveBeenCalled()
    expect(f.router.getHistory()).toEqual(history)
    expect(f.frame().currentPage).toBe(native)
    expect(events).toEqual(mounted)
    expect((await f.router.push('/detail'))?.type).toBe(NavigationFailureType.aborted)
    expect(f.router.getHistory()).toEqual(history)
  })

  it('consumes prepared data after all guards, preserving nonblocking presentation and explicit reload', async () => {
    let state!: RouteData<string>,
      sawBeforeResolve = false
    const load = vi.fn(({ preloading }: RouteLoaderContext) =>
      preloading ? 'warm' : 'fresh',
    )
    const loader = defineRouteLoader(load, { preload: allowed })
    const f = track(
      await mount([
        home,
        {
          path: '/detail',
          meta: { loaders: loader },
          component: page('Detail', () => {
            expect(sawBeforeResolve).toBe(true)
            state = useRouteData(loader)
          }),
        },
      ]),
    )
    f.router.beforeResolve((to) => {
      if (to.path === '/detail') sawBeforeResolve = true
    })
    const handle = f.router.preloadData('/detail', loader)
    await handle.ready
    expect(await f.router.push('/detail')).toBeUndefined()
    await state.ready
    expect(state.data.value).toBe('warm')
    expect(load).toHaveBeenCalledOnce()
    const native = f.frame().currentPage
    await state.reload()
    expect(state.data.value).toBe('fresh')
    expect(load).toHaveBeenCalledTimes(2)
    expect(f.frame().currentPage).toBe(native)
  })

  it('shares pending work across interests and authorized entries; one cancellation cannot abort the others', async () => {
    const work = deferred(),
      cancel = vi.fn(),
      states: RouteData<string>[] = []
    const load = vi.fn((context: RouteLoaderContext) => {
      context.onCancel(cancel)
      return work.promise
    })
    const loader = defineRouteLoader(load, { preload: allowed })
    const f = track(
      await mount(
        [
          home,
          {
            path: '/detail',
            meta: { loaders: loader },
            component: page('Detail', () => states.push(useRouteData(loader))),
          },
        ],
        {
          render: () =>
            h('GridLayout', [h(RouterView, { name: 'a' }), h(RouterView, { name: 'b' })]),
        },
      ),
    )
    await settle()
    const first = f.router.preloadData('/detail', loader),
      second = f.router.preloadData('/detail', loader)
    await tick()
    first.cancel()
    expect(cancel).not.toHaveBeenCalled()
    await f.router.push('/detail', { frame: 'a' })
    await f.router.push('/detail', { frame: 'b' })
    second.cancel()
    await f.router.back({ frame: 'a' })
    expect(states[0]!.status.value).toBe('cancelled')
    expect(states[1]!.status.value).toBe('pending')
    expect(cancel).not.toHaveBeenCalled()
    expect(load).toHaveBeenCalledOnce()
    work.resolve('shared')
    await states[1]!.ready
    expect(states[1]!.data.value).toBe('shared')
    expect(states[0]!.data.value).toBeUndefined()
  })

  it('cancels the underlying invocation only after its last pending consumer releases', async () => {
    const work = deferred(),
      cancel = vi.fn(),
      contexts: RouteLoaderContext[] = []
    const loader = defineRouteLoader(
      (context) => {
        contexts.push(context)
        context.onCancel(cancel)
        return work.promise
      },
      { preload: allowed },
    )
    const router = root({
      routes: [{ path: '/', component: Home, meta: { loaders: loader } }],
    })
    const a = router.preloadData('/', loader),
      b = router.preloadData('/', loader)
    await tick()
    a.cancel()
    expect(cancel).not.toHaveBeenCalled()
    b.cancel()
    expect(cancel).toHaveBeenCalledOnce()
    expect(contexts[0]!.isCancelled()).toBe(true)
    work.resolve('late')
    await tick()
    expect(b.state.value.status).toBe('cancelled')
  })

  it('matches full destination and origin plus loader, route and account identity', async () => {
    let account: object = {}
    const load = vi.fn(({ to }: RouteLoaderContext) => to.fullPath)
    const loader = defineRouteLoader(load, {
      preload: { ...allowed, scope: () => account },
    })
    const f = track(
      await mount([
        home,
        { path: '/other', component: Home },
        { path: '/item/:id', name: 'item', component: Home, meta: { loaders: loader } },
      ]),
    )
    const a = f.router.preloadData({ name: 'item', params: { id: 1 } }, loader)
    await a.ready
    await f.router.preloadData('/item/1', loader).ready
    await f.router.preloadData('/item/2', loader).ready
    await f.router.preloadData('/item/1?q=a', loader).ready
    expect(load).toHaveBeenCalledTimes(3)
    await f.router.push('/other')
    await f.router.preloadData('/item/1', loader).ready
    expect(load).toHaveBeenCalledTimes(4)
    account = {}
    await f.router.preloadData('/item/1', loader).ready
    expect(load).toHaveBeenCalledTimes(5)
    expect(a.state.value).toEqual({ status: 'cancelled', reason: 'invalidated' })
  })

  it('never publishes a prior account response into an entry, even without an explicit clear', async () => {
    let account: object = {},
      state!: RouteData<string>
    const old = deferred(),
      loader = defineRouteLoader(() => old.promise, {
        preload: { ...allowed, scope: () => account },
      })
    const f = track(
      await mount([
        home,
        {
          path: '/detail',
          component: page('Detail', () => {
            state = useRouteData(loader)
          }),
          meta: { loaders: loader },
        },
      ]),
    )
    const interest = f.router.preloadData('/detail', loader)
    await tick()
    await f.router.push('/detail')
    account = {}
    old.resolve('old account secret')
    await state.ready
    expect(state.status.value).toBe('cancelled')
    expect(state.data.value).toBeUndefined()
    expect(interest.state.value).toEqual({ status: 'cancelled', reason: 'invalidated' })
  })

  it('rechecks permission before execution, reuse and publication without running navigation guards', async () => {
    let permit = true
    const work = deferred(),
      load = vi.fn(() => work.promise)
    const loader = defineRouteLoader(load, {
      preload: { ...allowed, authorize: () => permit },
    })
    const router = root({
      routes: [{ path: '/', component: Home, meta: { loaders: loader } }],
    })
    const queued = router.preloadData('/', loader)
    permit = false
    await queued.ready
    expect(load).not.toHaveBeenCalled()
    expect(queued.state.value).toEqual({ status: 'cancelled', reason: 'unauthorized' })
    permit = true
    const running = router.preloadData('/', loader)
    await tick()
    permit = false
    work.resolve('secret')
    await running.ready
    expect(running.state.value).toEqual({ status: 'cancelled', reason: 'unauthorized' })
  })

  it('clear settles joined entries promptly and ignores late success without an unauthorized retry', async () => {
    const work = deferred(),
      cancel = vi.fn()
    let state!: RouteData<string>
    const load = vi.fn(({ onCancel }: RouteLoaderContext) => {
      onCancel(cancel)
      return work.promise
    })
    const loader = defineRouteLoader(load, { preload: allowed })
    const f = track(
      await mount([
        home,
        {
          path: '/detail',
          component: page('Detail', () => {
            state = useRouteData(loader)
          }),
          meta: { loaders: loader },
        },
      ]),
    )
    const interest = f.router.preloadData('/detail', loader)
    await tick()
    await f.router.push('/detail')
    f.router.clearPreloads()
    await state.ready
    expect(state.status.value).toBe('cancelled')
    expect(cancel).toHaveBeenCalledOnce()
    work.resolve('late')
    await tick()
    expect(state.data.value).toBeUndefined()
    expect(load).toHaveBeenCalledOnce()
    expect(interest.state.value).toEqual({ status: 'cancelled', reason: 'invalidated' })
  })

  it('falls back once after speculative error and preserves ordinary data error/retry semantics', async () => {
    let state!: RouteData<string>
    const work = deferred(),
      load = vi
        .fn()
        .mockImplementationOnce(() => work.promise)
        .mockResolvedValue('normal')
    const loader = defineRouteLoader<string>(load, { preload: allowed }),
      error = vi.fn()
    const f = track(
      await mount([
        home,
        {
          path: '/detail',
          meta: { loaders: loader },
          component: page('Detail', () => {
            state = useRouteData(loader)
          }),
        },
      ]),
    )
    f.router.onError(error)
    const prepared = f.router.preloadData('/detail', loader)
    await tick()
    await f.router.push('/detail')
    work.reject(new Error('offline during preparation'))
    await state.ready
    expect((await prepared.ready).status).toBe('error')
    expect(state.data.value).toBe('normal')
    expect(load).toHaveBeenCalledTimes(2)
    expect(error).not.toHaveBeenCalled()
  })

  it('does not let an invalidated old prepared attempt cancel a newer ordinary reload', async () => {
    const old = deferred(),
      fresh = deferred()
    let state!: RouteData<string>
    const load = vi.fn(({ preloading }: RouteLoaderContext) =>
      preloading ? old.promise : fresh.promise,
    )
    const loader = defineRouteLoader(load, { preload: allowed })
    const f = track(
      await mount([
        home,
        {
          path: '/detail',
          meta: { loaders: loader },
          component: page('Detail', () => {
            state = useRouteData(loader)
          }),
        },
      ]),
    )
    f.router.preloadData('/detail', loader)
    await tick()
    await f.router.push('/detail')
    const reloaded = state.reload()
    await tick()
    f.router.clearPreloads()
    await tick()
    expect(state.status.value).toBe('pending')
    fresh.resolve('new attempt')
    await reloaded
    old.resolve('stale')
    await tick()
    expect(state.status.value).toBe('success')
    expect(state.data.value).toBe('new attempt')
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('bounds speculative work, counts noncooperative cancellation and never executes abandoned queued requests', async () => {
    const work = deferred(),
      load = vi.fn(() => work.promise),
      loader = defineRouteLoader(load, { preload: allowed })
    const router = root({
      preloadData: { concurrency: 1, maxEntries: 2 },
      routes: [{ path: '/:id', component: Home, meta: { loaders: loader } }],
    })
    const a = router.preloadData('/a', loader),
      b = router.preloadData('/b', loader)
    expect(await router.preloadData('/c', loader).ready).toEqual({
      status: 'cancelled',
      reason: 'capacity',
    })
    await tick()
    a.cancel()
    await tick()
    expect(load).toHaveBeenCalledOnce()
    b.cancel()
    work.resolve('late')
    await tick()
    expect(load).toHaveBeenCalledOnce()
    const immediate = router.preloadData('/d', loader)
    immediate.cancel()
    await tick()
    expect(load).toHaveBeenCalledOnce()
  })

  it('promotes a queued destination for authorized navigation without awaiting unrelated speculative requests', async () => {
    const work = deferred(),
      states: RouteData<string>[] = []
    const loader = defineRouteLoader(
      ({ to }) => (to.path === '/a' ? work.promise : 'b'),
      { preload: allowed },
    )
    const f = track(
      await mount(
        [
          home,
          {
            path: '/:id',
            component: page('Detail', () => states.push(useRouteData(loader))),
            meta: { loaders: loader },
          },
        ],
        { preloadData: { concurrency: 1 } },
      ),
    )
    f.router.preloadData('/a', loader)
    const b = f.router.preloadData('/b', loader)
    await tick()
    expect(b.state.value.status).toBe('queued')
    await f.router.push('/b')
    await states[0]!.ready
    expect(states[0]!.data.value).toBe('b')
    expect(await b.ready).toEqual({ status: 'ready' })
    work.resolve('a')
  })

  it('uses fixed TTL and ready LRU; expiry of joined work falls back to normal loading', async () => {
    const slow = deferred(),
      load = vi.fn(({ to, preloading }: RouteLoaderContext) =>
        to.path === '/slow' && preloading ? slow.promise : to.path,
      )
    const loader = defineRouteLoader(load, { preload: allowed })
    let state!: RouteData<string>
    const f = track(
      await mount(
        [
          home,
          {
            path: '/:id',
            component: page('Detail', () => {
              state = useRouteData(loader)
            }),
            meta: { loaders: loader },
          },
        ],
        { preloadData: { ttl: 100, maxEntries: 2 } },
      ),
    )
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
    const a = f.router.preloadData('/a', loader)
    await a.ready
    const b = f.router.preloadData('/b', loader)
    await b.ready
    await f.router.preloadData('/a', loader).ready
    await f.router.preloadData('/c', loader).ready
    expect(b.state.value).toEqual({ status: 'cancelled', reason: 'capacity' })
    await vi.advanceTimersByTimeAsync(100)
    expect(a.state.value).toEqual({ status: 'cancelled', reason: 'expired' })
    const pending = f.router.preloadData('/slow', loader)
    await tick()
    const navigation = f.router.push('/slow')
    await vi.advanceTimersByTimeAsync(0)
    await navigation
    await vi.advanceTimersByTimeAsync(100)
    await state.ready
    expect(state.data.value).toBe('/slow')
    expect(pending.state.value).toEqual({ status: 'cancelled', reason: 'expired' })
    slow.resolve('stale')
    await tick()
    expect(state.data.value).toBe('/slow')
  })

  it('invalidates generated route changes, loader metadata, factories and removal callbacks', async () => {
    const loader = defineRouteLoader(() => 'ready', { preload: allowed })
    const routes = [
      { path: '/detail', name: 'detail', component: Home, meta: { loaders: loader } },
    ]
    const router = root({ routes }),
      updater = createFileRouteUpdater(router, routes)
    const a = router.preloadData('/detail', loader)
    await a.ready
    updater.update([{ ...routes[0]!, component: page('New') }])
    expect(a.state.value.status).toBe('cancelled')
    const b = router.preloadData('/detail', loader)
    await b.ready
    router.getRoutes()[0]!.component = page('Newer')
    await router.preloadData('/detail', loader).ready
    expect(b.state.value.status).toBe('cancelled')
    const c = router.preloadData('/detail', loader)
    await c.ready
    router.getRoutes()[0]!.meta.loaders = []
    expect((await router.preloadData('/detail', loader).ready).status).toBe('error')
    expect(c.state.value.status).toBe('cancelled')
    const remove = router.addRoute({
      path: '/temp',
      component: Home,
      meta: { loaders: loader },
    })
    const d = router.preloadData('/temp', loader)
    await d.ready
    remove()
    expect(d.state.value.status).toBe('cancelled')
  })

  it('supports parent/named declarations and declarative redirects without starting sibling loaders', async () => {
    const load = vi.fn(() => 'one'),
      other = vi.fn(),
      loader = defineRouteLoader(load, { preload: allowed })
    const router = root({
      loaders: { product: loader },
      routes: [
        {
          path: '/parent',
          meta: { loaders: ['product', defineRouteLoader(other)] },
          children: [{ path: ':id', component: Home, meta: { loaders: loader } }],
        },
        { path: '/alias', redirect: '/parent/1' },
      ],
    })
    await router.preloadData('/alias', loader).ready
    await router.preloadData('/parent/1', loader).ready
    expect(load).toHaveBeenCalledOnce()
    expect(other).not.toHaveBeenCalled()
  })

  it('releases page-owned preparation on disposal and rejects stale helper calls', async () => {
    let prepare!: ReturnType<typeof useRouteDataPreload>
    const work = deferred(),
      cancel = vi.fn(),
      loader = defineRouteLoader(
        ({ onCancel }) => {
          onCancel(cancel)
          return work.promise
        },
        { preload: allowed },
      )
    const f = track(
      await mount([
        home,
        {
          path: '/owner',
          component: page('Owner', () => {
            prepare = useRouteDataPreload()
          }),
        },
        { path: '/detail', component: Home, meta: { loaders: loader } },
      ]),
    )
    await f.router.push('/owner')
    const handle = prepare('/detail', loader)
    await tick()
    await f.router.back()
    expect((await handle.ready).status).toBe('cancelled')
    expect(cancel).toHaveBeenCalledOnce()
    expect(await prepare('/detail', loader).ready).toEqual({
      status: 'cancelled',
      reason: 'disposed',
    })
    work.resolve('late')
  })

  it('isolates routers and settles a closed window without cancelling another consumer', async () => {
    resetNative()
    setPlatform('ios')
    const a = deferred(),
      b = deferred(),
      load = vi
        .fn()
        .mockImplementationOnce(() => a.promise)
        .mockImplementationOnce(() => b.promise)
    const loader = defineRouteLoader<string>(load, { preload: allowed })
    const window = new NativeWindow('prepared-data'),
      first = root({
        window: window as any,
        routes: [home, { path: '/detail', component: Home, meta: { loaders: loader } }],
      })
    const app = createApp({ render: () => h(RouterView) })
    apps.push(app)
    app.use(first)
    app.start()
    await first.isReady()
    const second = root({
      routes: [{ path: '/detail', component: Home, meta: { loaders: loader } }],
    })
    const old = first.preloadData('/detail', loader),
      survivor = second.preloadData('/detail', loader)
    await tick()
    window.close()
    expect(await old.ready).toEqual({ status: 'cancelled', reason: 'disposed' })
    expect(await first.preloadData('/detail', loader).ready).toEqual({
      status: 'cancelled',
      reason: 'disposed',
    })
    a.resolve('old')
    b.resolve('live')
    expect(await survivor.ready).toEqual({ status: 'ready' })
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('contains cancellation callback failures and does not call completed callbacks', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {}),
      callback = vi.fn(() => {
        throw new Error('cancel')
      })
    const work = deferred(),
      loader = defineRouteLoader(
        ({ onCancel }) => {
          onCancel(callback)
          return work.promise
        },
        { preload: allowed },
      )
    const router = root({
      routes: [{ path: '/:id', component: Home, meta: { loaders: loader } }],
    })
    const a = router.preloadData('/a', loader)
    await tick()
    a.cancel()
    expect(warn).toHaveBeenCalledOnce()
    work.resolve('ready')
    const b = router.preloadData('/b', loader)
    await b.ready
    b.cancel()
    expect(callback).toHaveBeenCalledOnce()
    warn.mockRestore()
  })

  it('rejects unbounded data budgets and helpers outside page setup', () => {
    for (const preloadData of [{ ttl: Infinity }, { concurrency: 0 }, { maxEntries: -1 }])
      expect(() => createRouter({ routes: [], preloadData })).toThrow(
        /positive finite integer/,
      )
    expect(() => useRouteDataPreload()).toThrow(/inside a routed page/)
  })
})
