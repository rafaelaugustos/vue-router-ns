import { describe, expect, it, vi } from 'vitest'
import { createApp, h, ref } from 'nativescript-vue'
import {
  createRouter,
  mountNativeHost,
  defineRouteLoader,
  useRouteData,
  RouterTabs,
  RouterTab,
  RouterView,
  type RouteData,
  type RouteLoaderContext,
  type SavedStacks,
} from '../src/index.js'
import { mount, page, settle, paths } from './helpers.js'
import { deferred } from '../src/stack.js'
import { Application, Frame } from './shims/core.js'
import { views } from './shims/nativescript-vue.js'
import { createMemoryHost } from './hosts/memory.js'

const Home = page('Home')
const home = { path: '/', component: Home }

describe('route data', () => {
  it('starts after all authorization and code loading, without waiting for data to present', async () => {
    const order: string[] = []
    const result = deferred<string>()
    let state!: RouteData<string>
    const loader = defineRouteLoader(() => {
      order.push('data')
      return result.promise
    })
    const detail = page('Detail', () => {
      order.push('setup')
      state = useRouteData(loader)
    })
    const { router, app } = await mount(
      [
        home,
        {
          path: '/detail',
          meta: { loaders: loader },
          beforeEnter: () => {
            order.push('enter')
          },
          component: async () => {
            order.push('import')
            return detail
          },
        },
      ],
      {
        before: (router) => {
          router.beforeEach((to) => {
            if (to.path !== '/') order.push('before')
          })
          router.beforeResolve((to) => {
            if (to.path !== '/') order.push('resolve')
          })
        },
      },
    )
    await router.push('/detail')
    expect(order.slice(0, 3)).toEqual(['before', 'enter', 'import'])
    expect(order.indexOf('data')).toBeGreaterThan(order.indexOf('resolve'))
    expect(router.currentRoute.value.path).toBe('/detail')
    expect(state.status.value).toBe('pending')
    result.resolve('Product')
    await state.ready
    expect(state.data.value).toBe('Product')
    expect(state.status.value).toBe('success')
    app.unmount()
  })
  it('does not load a guarded, redirected, code-failed or superseded destination', async () => {
    const load = vi.fn(() => 'secret')
    const loader = defineRouteLoader(load)
    const held = deferred<boolean>()
    const { router, app } = await mount(
      [
        home,
        ...['blocked', 'redirect', 'slow', 'broken'].map((path) => ({
          path: `/${path}`,
          meta: { loaders: loader },
          component:
            path === 'broken'
              ? async () => {
                  throw new Error('bad import')
                }
              : Home,
        })),
      ],
      {
        before: (router) =>
          router.beforeResolve((to) => {
            if (to.path === '/blocked') return false
            if (to.path === '/redirect') return '/'
            if (to.path === '/slow') return held.promise
          }),
      },
    )
    await router.push('/blocked')
    await router.push('/redirect')
    await expect(router.push('/broken')).rejects.toThrow('bad import')
    const pending = router.push('/slow')
    await settle()
    await router.push({ path: '/', force: true })
    held.resolve(true)
    await pending
    expect(load).not.toHaveBeenCalled()
    app.unmount()
  })
  it.each(['throw', 'reject'])(
    'observes %s as data error and retries without changing native history',
    async (mode) => {
      let state!: RouteData<number>
      let failed = true
      const error = new Error('network')
      const loader = defineRouteLoader(() => {
        if (!failed) return 42
        if (mode === 'throw') throw error
        return Promise.reject(error)
      })
      const onError = vi.fn()
      const { app, router, frame } = await mount(
        [
          home,
          {
            path: '/detail',
            meta: { loaders: loader },
            component: page('Detail', () => {
              state = useRouteData(loader)
            }),
          },
        ],
        {
          before: (router) => {
            router.onError(onError)
          },
        },
      )
      await expect(router.push('/detail')).resolves.toBeUndefined()
      await state.ready
      expect(state.status.value).toBe('error')
      expect(state.error.value).toBe(error)
      expect(onError).not.toHaveBeenCalled()
      const native = frame().currentPage
      failed = false
      await state.reload()
      expect(state.data.value).toBe(42)
      expect(state.error.value).toBeUndefined()
      expect(frame().currentPage).toBe(native)
      expect(paths(router.stack.value)).toEqual(['/', '/detail'])
      app.unmount()
    },
  )
  it('settles cancelled attempts promptly and ignores out-of-order responses after reload and disposal', async () => {
    const requests = [deferred<string>(), deferred<string>(), deferred<string>()]
    const cancelled = [vi.fn(), vi.fn(), vi.fn()]
    const contexts: RouteLoaderContext[] = []
    let state!: RouteData<string>,
      attempt = 0
    const loader = defineRouteLoader((context) => {
      const index = attempt++
      contexts.push(context)
      context.onCancel(cancelled[index]!)
      return requests[index]!.promise
    })
    const { router, app } = await mount([
      home,
      {
        path: '/detail',
        meta: { loaders: loader },
        component: page('Detail', () => {
          state = useRouteData(loader)
        }),
      },
    ])
    await router.push('/detail')
    const initial = state.ready
    const second = state.reload()
    await initial
    expect(cancelled[0]).toHaveBeenCalledOnce()
    expect(contexts[0]!.isCancelled()).toBe(true)
    requests[1]!.resolve('new')
    await second
    requests[0]!.resolve('stale')
    await settle()
    expect(state.data.value).toBe('new')
    const third = state.reload()
    await settle()
    await router.back()
    await third
    expect(cancelled[2]).toHaveBeenCalledOnce()
    requests[2]!.reject(new Error('late failure'))
    await settle()
    expect(state.status.value).toBe('cancelled')
    expect(state.error.value).toBeUndefined()
    expect(router.currentRoute.value.path).toBe('/')
    await state.reload()
    expect(attempt).toBe(3)
    app.unmount()
  })
  it('retains data on Back/duplicate navigation; creates new state on changed params/query and replace', async () => {
    const states: RouteData<string>[] = []
    const load = vi.fn(({ to }: RouteLoaderContext) => to.fullPath)
    const loader = defineRouteLoader(load)
    const { app, router } = await mount([
      home,
      {
        path: '/product/:id',
        meta: { loaders: loader },
        component: page('Product', () => {
          states.push(useRouteData(loader))
        }),
      },
    ])
    await router.push('/product/1')
    await router.push('/product/1')
    expect(load).toHaveBeenCalledTimes(1)
    await router.push('/product/2?q=a')
    expect(load).toHaveBeenCalledTimes(2)
    expect(states[0]!.status.value).toBe('success')
    await router.back()
    expect(load).toHaveBeenCalledTimes(2)
    expect(states[0]!.data.value).toBe('/product/1')
    await router.replace('/product/1?q=b')
    expect(load).toHaveBeenCalledTimes(3)
    expect(states[0]!.status.value).toBe('cancelled')
    expect(states[2]!.data.value).toBe('/product/1?q=b')
    app.unmount()
  })
  it('isolates simultaneous tab requests and modal disposal with context from the target stack', async () => {
    const requests = [deferred<string>(), deferred<string>(), deferred<string>()]
    const states: RouteData<string>[] = [],
      contexts: RouteLoaderContext[] = []
    const loader = defineRouteLoader((context) => {
      contexts.push(context)
      return requests[contexts.length - 1]!.promise
    })
    const selected = ref('a')
    const { router, app } = await mount(
      [
        home,
        {
          path: '/detail',
          meta: { loaders: loader },
          component: page('Detail', () => {
            states.push(useRouteData(loader))
          }),
        },
      ],
      {
        render: () =>
          h(RouterTabs, { selected: selected.value }, () =>
            ['a', 'b'].map((name) =>
              h(RouterTab, { name }, () => h(RouterView, { name, initial: '/' })),
            ),
          ),
      },
    )
    await router.push('/detail', { frame: 'a' })
    await router.push('/detail', { frame: 'b' })
    expect(states.map((s) => s.status.value)).toEqual(['pending', 'pending'])
    expect(contexts.map((c) => c.from.path)).toEqual(['/', '/'])
    await router.push({ path: '/detail', force: true }, { frame: 'b', modal: true })
    expect(contexts[2]!.from.path).toBe('/detail')
    await router.back()
    expect(states[2]!.status.value).toBe('cancelled')
    requests[0]!.resolve('A')
    requests[1]!.resolve('B')
    requests[2]!.resolve('modal stale')
    await Promise.all(states.map((s) => s.ready))
    expect(states[0]!.data.value).toBe('A')
    expect(states[1]!.data.value).toBe('B')
    expect(states[2]!.data.value).toBeUndefined()
    app.unmount()
  })
  it('deduplicates named/inline definitions across matched parents, and shares consumers only inside an entry', async () => {
    const load = vi.fn(() => 7),
      loader = defineRouteLoader(load)
    const consumers: RouteData<number>[] = []
    const { app } = await mount(
      [
        {
          path: '/group',
          meta: { loaders: ['product', loader] },
          children: [
            {
              path: 'item',
              meta: { loaders: loader },
              component: page('Item', () => {
                consumers.push(useRouteData(loader), useRouteData(loader))
              }),
            },
          ],
        },
      ],
      { loaders: { product: loader }, initial: '/group/item' },
    )
    await consumers[0]!.ready
    expect(load).toHaveBeenCalledOnce()
    expect(consumers[0]).toBe(consumers[1])
    app.unmount()
    const another = await mount([
      {
        path: '/',
        meta: { loaders: loader },
        component: page('Another', () => {
          consumers.push(useRouteData(loader))
        }),
      },
    ])
    expect(consumers[2]).not.toBe(consumers[0])
    expect(consumers[2]!.data.value).toBe(7)
    another.app.unmount()
  })
  it('reruns after saved-stack reconstruction without serializing results', async () => {
    let saved: SavedStacks | null = null
    const restore = {
      save: (state: SavedStacks | null) => {
        saved = state
      },
      load: () => saved,
    }
    const load = vi.fn(() => ({ secret: 'not persisted' })),
      loader = defineRouteLoader(load)
    const routes = [home, { path: '/detail', component: Home, meta: { loaders: loader } }]
    const first = await mount(routes, { restore })
    await first.router.push('/detail')
    Application.notify({ eventName: 'suspend' })
    const snapshot = JSON.parse(JSON.stringify(saved)) as SavedStacks
    expect(JSON.stringify(snapshot)).not.toContain('not persisted')
    first.app.unmount()
    saved = snapshot
    const second = await mount(routes, { restore })
    await settle()
    expect(load).toHaveBeenCalledTimes(2)
    expect(paths(second.router.stack.value)).toEqual(['/', '/detail'])
    second.app.unmount()
  })
  it('leaves shared cache work alive when only one consuming entry disappears', async () => {
    const pending = deferred<string>()
    const cache = new Map<string, Promise<string>>()
    const fetch = vi.fn(() => pending.promise)
    const loader = defineRouteLoader(({ to }) => {
      if (!cache.has(to.path)) cache.set(to.path, fetch())
      return cache.get(to.path)!
    })
    const states: RouteData<string>[] = []
    const { app, router } = await mount([
      home,
      {
        path: '/detail',
        meta: { loaders: loader },
        component: page('Detail', () => {
          states.push(useRouteData(loader))
        }),
      },
    ])
    await router.push('/detail')
    await router.push({ path: '/detail', force: true })
    await router.back()
    expect(fetch).toHaveBeenCalledOnce()
    expect(states[1]!.status.value).toBe('cancelled')
    pending.resolve('cached product')
    await states[0]!.ready
    expect(states[0]!.data.value).toBe('cached product')
    expect(states[1]!.data.value).toBeUndefined()
    app.unmount()
  })
  it('rejects unknown definitions before starting valid siblings or mutating history', async () => {
    const load = vi.fn(() => 1),
      loader = defineRouteLoader(load)
    const { app, router } = await mount([
      home,
      { path: '/bad', component: Home, meta: { loaders: [loader, 'missing'] } },
    ])
    await expect(router.push('/bad')).rejects.toThrow('Unknown or invalid route loader')
    expect(load).not.toHaveBeenCalled()
    expect(paths(router.stack.value)).toEqual(['/'])
    app.unmount()
  })
  it('isolates pending results and disposal across simultaneously live routers', async () => {
    const requests = [deferred<string>(), deferred<string>()]
    const states: RouteData<string>[] = []
    let attempt = 0
    const loader = defineRouteLoader(() => requests[attempt++]!.promise)
    const routes = [
      {
        path: '/',
        meta: { loaders: loader },
        component: page('Independent', () => {
          states.push(useRouteData(loader))
        }),
      },
    ]
    const owners = []
    for (let i = 0; i < 2; i++) {
      const router = createRouter({ routes })
      const app = createApp({ render: () => h('GridLayout') })
      app.use(router)
      app.start()
      const stop = mountNativeHost(router, 'main', createMemoryHost(), '/')
      await router.isReady()
      owners.push({ app, stop })
    }
    expect(states.map((s) => s.status.value)).toEqual(['pending', 'pending'])
    owners[0]!.stop()
    await states[0]!.ready
    expect(states[0]!.status.value).toBe('cancelled')
    expect(states[1]!.status.value).toBe('pending')
    requests[0]!.resolve('closed owner')
    requests[1]!.resolve('live owner')
    await states[1]!.ready
    expect(states[0]!.data.value).toBeUndefined()
    expect(states[1]!.data.value).toBe('live owner')
    for (const owner of owners) {
      owner.stop()
      owner.app.unmount()
    }
  })
  it('cancels already-started data when native presentation fails', async () => {
    const pending = deferred<string>()
    const cancel = vi.fn()
    const loader = defineRouteLoader(({ onCancel }) => {
      onCancel(cancel)
      return pending.promise
    })
    const router = createRouter({
      routes: [home, { path: '/detail', component: Home, meta: { loaders: loader } }],
    })
    const app = createApp({ render: () => h('GridLayout') })
    app.use(router)
    app.start()
    const host = createMemoryHost()
    const stop = mountNativeHost(router, 'main', host, '/')
    await router.isReady()
    const push = vi.spyOn(host, 'push').mockImplementation(async () => {
      await settle()
      throw new Error('native presentation failed')
    })
    await expect(router.push('/detail')).rejects.toThrow('native presentation failed')
    expect(cancel).toHaveBeenCalledOnce()
    expect(paths(router.stack.value)).toEqual(['/'])
    pending.reject(new Error('late HTTP error'))
    await settle()
    push.mockRestore()
    stop()
    app.unmount()
  })
  it('cancels on a native pop and contains errors from cancellation callbacks', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    let state!: RouteData<string>
    const pending = deferred<string>()
    const loader = defineRouteLoader(({ onCancel }) => {
      onCancel(() => {
        throw new Error('cancel')
      })
      return pending.promise
    })
    const { app, router } = await mount([
      home,
      {
        path: '/detail',
        meta: { loaders: loader },
        component: page('Detail', () => {
          state = useRouteData(loader)
        }),
      },
    ])
    await router.push('/detail')
    const frame = views.get('Frame')!.at(-1) as Frame
    frame.popNatively()
    await settle()
    await state.ready
    expect(state.status.value).toBe('cancelled')
    expect(warn).toHaveBeenCalled()
    pending.resolve('late')
    await settle()
    expect(state.data.value).toBeUndefined()
    app.unmount()
    warn.mockRestore()
  })
})
