import { createApp, defineComponent, h } from 'nativescript-vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createRouter,
  defineRouteLoader,
  NavigationFailureType,
  onBeforeRouteLeave,
  RouterView,
  useRoutePreload,
  useRouter,
  type RouteComponent,
  type RoutePreload,
  type Router,
} from '../src/index.js'
import { createFileRouteUpdater } from '../src/file-routing/index.js'
import { createRoutePreloader } from '../src/preload.js'
import { events, mount, page, settle } from './helpers.js'
import { Frame, NativeWindow, resetNative, setPlatform } from './shims/core.js'

const routers: Router<any>[] = []
const apps: ReturnType<typeof createApp>[] = []
const Detail = page('Detail')
const tick = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve()
}
function pending<T = RouteComponent>() {
  let resolve!: (value: T) => void, reject!: (error: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
function root(options: Parameters<typeof createRouter>[0]) {
  const router = createRouter(options)
  routers.push(router)
  return router
}
afterEach(() => {
  for (const router of routers.splice(0)) router.clearPreloads()
  for (const app of apps.splice(0)) app.unmount()
  vi.useRealTimers()
})

describe('code-only route preloading', () => {
  it('never executes a factory cancelled before its scheduled start', async () => {
    const factory = vi.fn(() => Detail)
    const router = root({ routes: [{ path: '/detail', component: factory }] })
    const handle = router.preload('/detail')
    handle.cancel()
    await tick()
    expect(factory).not.toHaveBeenCalled()
    expect(await handle.ready).toEqual({ status: 'cancelled', reason: 'cancelled' })
  })

  it('settles a joined navigation on window closure without starting a fallback factory', async () => {
    resetNative()
    setPlatform('ios')
    const work = pending(),
      factory = vi.fn(() => work.promise),
      error = vi.fn()
    const window = new NativeWindow('preload-close-navigation')
    const router = root({
      window: window as any,
      routes: [
        { path: '/', component: page('Home') },
        { path: '/detail', component: factory },
      ],
    })
    router.onError(error)
    const app = createApp(defineComponent({ render: () => h(RouterView) }))
    apps.push(app)
    app.use(router)
    app.start()
    await router.isReady()
    const handle = router.preload('/detail')
    await tick()
    const navigation = router.push('/detail')
    await tick()
    window.close()
    expect((await navigation)?.type).toBe(NavigationFailureType.cancelled)
    expect(await handle.ready).toEqual({ status: 'cancelled', reason: 'disposed' })
    work.resolve(Detail)
    await tick()
    expect(factory).toHaveBeenCalledOnce()
    expect(error).not.toHaveBeenCalled()
    expect(router.getHistory()).toBeUndefined()
  })

  it('does not consume ready code invalidated in the await boundary', async () => {
    const router = root({ routes: [{ path: '/detail', component: Detail }] })
    const record = router.getRoutes()[0]!
    const pool = createRoutePreloader(
      {},
      { load: async () => Detail, cached: () => undefined, current: () => true },
    )
    const lease = pool.preload(record, {})
    await lease.ready
    const consume = pool.consume(record)
    pool.clear()
    expect(await consume).toBeUndefined()
    expect(lease.state.value).toEqual({ status: 'cancelled', reason: 'invalidated' })
    pool.dispose()
  })

  it('joins a factory that normal navigation already started, without a dependency cycle', async () => {
    const work = pending(),
      factory = vi.fn(() => work.promise)
    const f = await mount([
      { path: '/', component: page('Home') },
      { path: '/detail', component: factory },
    ])
    apps.push(f.app)
    routers.push(f.router)
    const navigation = f.router.push('/detail')
    await vi.waitFor(() => expect(factory).toHaveBeenCalledOnce())
    const prepared = f.router.preload('/detail')
    await tick()
    expect(factory).toHaveBeenCalledOnce()
    work.resolve(Detail)
    expect(await navigation).toBeUndefined()
    expect(await prepared.ready).toEqual({ status: 'ready' })
    expect(events.filter((event) => event === 'mount Detail')).toHaveLength(1)
  })

  it('prepares a named leaf without guards, data, parent/layout factories or native/Vue allocation', async () => {
    const setup = vi.fn(),
      data = vi.fn(),
      parent = vi.fn(() => page('Parent'))
    const layout = vi.fn(() => page('Layout')),
      imported = vi.fn(() => page('Prepared', setup))
    const f = await mount(
      [
        { path: '/', component: page('Home') },
        {
          path: '/items',
          component: parent,
          children: [
            {
              path: ':id',
              name: 'item',
              component: imported,
              meta: { layout: 'shell', loaders: defineRouteLoader(data) },
            },
          ],
        },
      ],
      { layouts: { shell: layout } },
    )
    apps.push(f.app)
    routers.push(f.router)
    const before = f.router.getHistory(),
      native = f.frame().currentPage
    const count = Frame.navigations.length,
      vue = [...events]
    const beforeEach = vi.fn(() => false),
      beforeResolve = vi.fn(),
      after = vi.fn()
    f.router.beforeEach(beforeEach)
    f.router.beforeResolve(beforeResolve)
    f.router.afterEach(after)
    const handle = f.router.preload({ name: 'item', params: { id: 7 } })
    expect(await handle.ready).toEqual({ status: 'ready' })
    expect(imported).toHaveBeenCalledOnce()
    for (const fn of [setup, data, parent, layout, beforeEach, beforeResolve, after])
      expect(fn).not.toHaveBeenCalled()
    expect(Frame.navigations).toHaveLength(count)
    expect(events).toEqual(vue)
    expect(f.frame().currentPage).toBe(native)
    expect(f.router.getHistory()).toEqual(before)
    expect((await f.router.push('/items/7'))?.type).toBe(NavigationFailureType.aborted)
    expect(beforeEach).toHaveBeenCalledOnce()
    expect(setup).not.toHaveBeenCalled()
    expect(data).not.toHaveBeenCalled()
    expect(f.router.getHistory()).toEqual(before)
  })

  it('joins an in-flight import after authorization and retains normal result/Back behavior', async () => {
    const work = pending(),
      factory = vi.fn(() => work.promise),
      guard = vi.fn()
    const f = await mount([
      { path: '/', component: page('Home', () => onBeforeRouteLeave(guard)) },
      { path: '/detail', component: factory },
    ])
    apps.push(f.app)
    routers.push(f.router)
    f.router.beforeEach(guard)
    const handle = f.router.preload('/detail')
    await tick()
    const result = f.router.pushForResult<string>('/detail')
    await tick()
    // The navigation has its own interest; releasing the gesture cannot abort its import.
    handle.cancel()
    work.resolve(Detail)
    await settle()
    expect(factory).toHaveBeenCalledOnce()
    expect(guard).toHaveBeenCalledOnce()
    expect(f.router.currentRoute.value.path).toBe('/detail')
    await f.router.back({ result: 'selected' })
    expect(await result).toBe('selected')
    expect(f.router.currentRoute.value.path).toBe('/')
    expect(f.router.getHistory()!.entries).toHaveLength(1)
  })

  it('deduplicates different params of the same code without sharing consumer cancellation', async () => {
    const work = pending(),
      factory = vi.fn(() => work.promise)
    const router = root({ routes: [{ path: '/item/:id', component: factory }] })
    const a = router.preload('/item/1'),
      b = router.preload('/item/2')
    await tick()
    a.cancel()
    expect(await a.ready).toEqual({ status: 'cancelled', reason: 'cancelled' })
    work.resolve(Detail)
    expect(await b.ready).toEqual({ status: 'ready' })
    expect(factory).toHaveBeenCalledOnce()
    expect(a.state.value.status).toBe('cancelled')
    b.cancel()
    expect(b.state.value.status).toBe('cancelled')
    expect(await b.ready).toEqual({ status: 'ready' }) // First settlement remains immutable.
  })

  it('drops abandoned late work and does not poison a later navigation cache', async () => {
    const work = pending(),
      old = page('Old'),
      fresh = page('Fresh')
    const factory = vi
      .fn()
      .mockImplementationOnce(() => work.promise)
      .mockResolvedValue(fresh)
    const f = await mount([
      { path: '/', component: page('Home') },
      { path: '/detail', component: factory },
    ])
    apps.push(f.app)
    routers.push(f.router)
    const handle = f.router.preload('/detail')
    await tick()
    handle.cancel()
    work.resolve(old)
    await tick()
    expect(handle.state.value.status).toBe('cancelled')
    await f.router.push('/detail')
    expect(factory).toHaveBeenCalledTimes(2)
    expect(events).toContain('mount Fresh')
    expect(events).not.toContain('mount Old')
  })

  it('bounds speculative concurrency and rejects overflow without executing cancelled queued code', async () => {
    const a = pending(),
      b = pending(),
      first = vi.fn(() => a.promise),
      second = vi.fn(() => b.promise),
      third = vi.fn(() => Detail)
    const router = root({
      preload: { concurrency: 1, maxEntries: 2 },
      routes: [
        { path: '/a', component: first },
        { path: '/b', component: second },
        { path: '/c', component: third },
      ],
    })
    const one = router.preload('/a'),
      two = router.preload('/b'),
      full = router.preload('/c')
    await tick()
    expect(one.state.value.status).toBe('loading')
    expect(two.state.value.status).toBe('queued')
    expect(await full.ready).toEqual({ status: 'cancelled', reason: 'capacity' })
    one.cancel()
    await tick()
    expect(second).not.toHaveBeenCalled() // Import A still occupies its native/module work slot.
    two.cancel()
    a.resolve(Detail)
    await tick()
    expect(second).not.toHaveBeenCalled()
    const next = router.preload('/c')
    expect(await next.ready).toEqual({ status: 'ready' })
    expect(third).toHaveBeenCalledOnce()
  })

  it('lets actual navigation promote queued work past unrelated speculative imports', async () => {
    const work = pending(),
      first = vi.fn(() => work.promise),
      target = vi.fn(() => Detail)
    const f = await mount(
      [
        { path: '/', component: page('Home') },
        { path: '/a', component: first },
        { path: '/detail', component: target },
      ],
      { preload: { concurrency: 1 } },
    )
    apps.push(f.app)
    routers.push(f.router)
    f.router.preload('/a')
    const queued = f.router.preload('/detail')
    await tick()
    expect(queued.state.value.status).toBe('queued')
    await f.router.push('/detail')
    expect(target).toHaveBeenCalledOnce()
    expect(await queued.ready).toEqual({ status: 'ready' })
    work.resolve(Detail)
  })

  it('expires pending and ready leases and evicts the least recently used prepared record', async () => {
    vi.useFakeTimers()
    const slow = pending(),
      factory = vi.fn(() => Detail)
    const router = root({
      preload: { concurrency: 1, maxEntries: 2, ttl: 100 },
      routes: [
        { path: '/a', component: factory },
        { path: '/b', component: factory },
        { path: '/c', component: factory },
        { path: '/slow', component: () => slow.promise },
      ],
    })
    const a = router.preload('/a')
    await a.ready
    const b = router.preload('/b')
    await b.ready
    const a2 = router.preload('/a')
    await a2.ready
    const c = router.preload('/c')
    await c.ready
    expect(b.state.value).toEqual({ status: 'cancelled', reason: 'capacity' })
    expect(a.state.value.status).toBe('ready')
    await vi.advanceTimersByTimeAsync(100)
    for (const handle of [a, a2, c])
      expect(handle.state.value).toEqual({ status: 'cancelled', reason: 'expired' })
    const pendingLease = router.preload('/slow')
    await tick()
    await vi.advanceTimersByTimeAsync(100)
    expect(await pendingLease.ready).toEqual({ status: 'cancelled', reason: 'expired' })
    slow.resolve(Detail)
    await tick()
    expect(pendingLease.state.value.status).toBe('cancelled')
  })

  it('invalidates removal, replacement, generated-table HMR and changed factory identities', async () => {
    const work = pending(),
      factory = vi.fn(() => work.promise),
      fresh = vi.fn(() => Detail)
    const initial = [{ path: '/detail', name: 'detail', component: factory }]
    const router = root({ routes: initial })
    const updater = createFileRouteUpdater(router, initial)
    const old = router.preload('/detail')
    await tick()
    updater.update([{ path: '/detail', name: 'detail', component: fresh }])
    expect(await old.ready).toEqual({ status: 'cancelled', reason: 'invalidated' })
    work.resolve(page('Stale'))
    await tick()
    const next = router.preload('/detail')
    await next.ready
    expect(fresh).toHaveBeenCalledOnce()
    const record = router.getRoutes()[0]!
    const changed = vi.fn(() => Detail)
    record.component = changed
    const afterChange = router.preload('/detail')
    await afterChange.ready
    expect(next.state.value).toEqual({ status: 'cancelled', reason: 'invalidated' })
    expect(changed).toHaveBeenCalledOnce()
    router.removeRoute('detail')
    expect(afterChange.state.value.status).toBe('cancelled')
    expect((await router.preload('/detail').ready).status).toBe('error')
    const remove = router.addRoute({ path: '/temp', component: () => Detail })
    const temporary = router.preload('/temp')
    await temporary.ready
    remove()
    expect(temporary.state.value.status).toBe('cancelled')
  })

  it('clears pending work on app invalidation and never reuses the old completion', async () => {
    const old = pending(),
      fresh = pending(),
      factory = vi
        .fn()
        .mockImplementationOnce(() => old.promise)
        .mockImplementationOnce(() => fresh.promise)
    const router = root({ routes: [{ path: '/detail', component: factory }] })
    const first = router.preload('/detail')
    await tick()
    router.clearPreloads()
    expect(await first.ready).toEqual({ status: 'cancelled', reason: 'invalidated' })
    const second = router.preload('/detail')
    await tick()
    old.resolve(Detail)
    await tick()
    expect(second.state.value.status).toBe('loading')
    fresh.resolve(Detail)
    expect(await second.ready).toEqual({ status: 'ready' })
    expect(factory).toHaveBeenCalledTimes(2)
  })

  it('reports speculative errors locally and retries through normal navigation', async () => {
    const error = new Error('chunk unavailable'),
      onError = vi.fn()
    const factory = vi.fn().mockRejectedValueOnce(error).mockResolvedValue(Detail)
    const f = await mount([
      { path: '/', component: page('Home') },
      { path: '/detail', component: factory },
    ])
    apps.push(f.app)
    routers.push(f.router)
    f.router.onError(onError)
    const bad = f.router.preload('/detail')
    expect(await bad.ready).toEqual({ status: 'error', error })
    expect(onError).not.toHaveBeenCalled()
    await f.router.push('/detail')
    expect(factory).toHaveBeenCalledTimes(2)
    expect(f.router.currentRoute.value.path).toBe('/detail')
  })

  it('returns resolution/invalid-component failures without rejecting or changing navigation', async () => {
    const router = root({ routes: [{ path: '/bad', component: () => undefined as any }] })
    expect((await router.preload('/missing').ready).status).toBe('error')
    const result = await router.preload('/bad').ready
    expect(result.status).toBe('error')
    if (result.status === 'error')
      expect(String(result.error)).toMatch(/did not load a component/)
  })

  it('reuses prepared code but still runs data loaders only after navigation is authorized', async () => {
    const data = vi.fn(),
      imported = vi.fn(() => Detail)
    const f = await mount([
      { path: '/', component: page('Home') },
      {
        path: '/detail',
        component: imported,
        meta: { loaders: defineRouteLoader(data) },
      },
    ])
    apps.push(f.app)
    routers.push(f.router)
    const handle = f.router.preload('/detail')
    await handle.ready
    expect(data).not.toHaveBeenCalled()
    await f.router.push('/detail')
    expect(imported).toHaveBeenCalledOnce()
    expect(data).toHaveBeenCalledOnce()
    handle.cancel()
    await f.router.back()
    await f.router.push('/detail')
    expect(imported).toHaveBeenCalledOnce() // Normal component caching is separate from lease lifetime.
    expect(data).toHaveBeenCalledTimes(2)
  })

  it('resolves redirects and relative params in the owning stack without revealing it', async () => {
    let bound!: Router
    const factory = vi.fn(() => Detail)
    const f = await mount(
      [
        {
          path: '/item/:id',
          name: 'item',
          component: page('Owner', () => {
            bound = useRouter()
          }),
        },
        { path: '/other', component: page('Other') },
        { path: '/detail/:id', name: 'detail', component: factory },
        { path: '/alias/:id', redirect: (to) => ({ name: 'detail', params: to.params }) },
      ],
      {
        render: () =>
          h('GridLayout', [
            h(RouterView, { name: 'a', initial: '/item/7' }),
            h(RouterView, { name: 'b', initial: '/other' }),
          ]),
      },
    )
    apps.push(f.app)
    routers.push(f.router)
    await settle()
    await f.router.push('/other', { frame: 'b' })
    const a = f.router.getHistory({ frame: 'a' }),
      b = f.router.getHistory({ frame: 'b' })
    await bound.preload({ name: 'detail' }).ready
    await bound.preload('/alias/8').ready
    expect(factory).toHaveBeenCalledOnce()
    expect(f.router.getHistory({ frame: 'a' })).toEqual(a)
    expect(f.router.getHistory({ frame: 'b' })).toEqual(b)
    expect(f.router.currentRoute.value.path).toBe('/other')
  })

  it('cancels page-owned interest on disposal and rejects calls from the retired scope', async () => {
    const work = pending(),
      factory = vi.fn(() => work.promise)
    let preload!: ReturnType<typeof useRoutePreload>
    const f = await mount([
      { path: '/', component: page('Home') },
      {
        path: '/owner',
        component: page('Owner', () => {
          preload = useRoutePreload()
        }),
      },
      { path: '/detail', component: factory },
    ])
    apps.push(f.app)
    routers.push(f.router)
    await f.router.push('/owner')
    const old = preload('/detail')
    await tick()
    await f.router.back()
    expect((await old.ready).status).toBe('cancelled')
    expect(await preload('/detail').ready).toEqual({
      status: 'cancelled',
      reason: 'disposed',
    })
    work.resolve(Detail)
    await tick()
    expect(f.router.getHistory()!.entries).toHaveLength(1)
  })

  it('keeps two routers independent and invalidates one window without affecting the other', async () => {
    resetNative()
    setPlatform('ios')
    const first = pending(),
      second = pending(),
      factory = vi
        .fn()
        .mockImplementationOnce(() => first.promise)
        .mockImplementationOnce(() => second.promise)
    const aWindow = new NativeWindow('preload-a'),
      bWindow = new NativeWindow('preload-b')
    const a = root({
      window: aWindow as any,
      routes: [
        { path: '/', component: page('Home') },
        { path: '/detail', component: factory },
      ],
    })
    const b = root({
      window: bWindow as any,
      routes: [
        { path: '/', component: page('Home') },
        { path: '/detail', component: factory },
      ],
    })
    for (const router of [a, b]) {
      const app = createApp(defineComponent({ render: () => h(RouterView) }))
      apps.push(app)
      app.use(router)
      app.start()
      await router.isReady()
    }
    const old = a.preload('/detail'),
      survivor = b.preload('/detail')
    await tick()
    aWindow.close()
    expect(await old.ready).toEqual({ status: 'cancelled', reason: 'disposed' })
    expect(await a.preload('/detail').ready).toEqual({
      status: 'cancelled',
      reason: 'disposed',
    })
    first.resolve(Detail)
    second.resolve(Detail)
    expect(await survivor.ready).toEqual({ status: 'ready' })
    expect(factory).toHaveBeenCalledTimes(2)
  })

  it('rejects unbounded budgets and a composable outside page setup', () => {
    for (const preload of [{ ttl: Infinity }, { concurrency: 0 }, { maxEntries: -1 }])
      expect(() => createRouter({ routes: [], preload })).toThrow(
        /positive finite integer/,
      )
    expect(() => useRoutePreload()).toThrow(/inside a routed page/)
  })
})
