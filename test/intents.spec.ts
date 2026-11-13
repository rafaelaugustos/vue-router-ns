import { createApp, h, ref } from 'nativescript-vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createRouter,
  NavigationFailureType,
  RouterView,
  type NavigationIntent,
  type RouterWindow,
} from '../src/index.js'
import { mount, page, paths, settle } from './helpers.js'
import { Frame, NativeWindow, resetNative } from './shims/core.js'

const routes = [
  { path: '/', component: page('Home') },
  { path: '/items/:id', name: 'item', component: page('Item') },
  {
    path: '/settings',
    component: page('Settings'),
    children: [{ path: 'account', component: page('Account') }],
  },
  { path: '/modal', component: page('Modal'), modal: true },
  { path: '/login', component: page('Login') },
] as const
const request = (
  route: NavigationIntent['destination'] = {
    route: { name: 'item', params: { id: '7' } },
  },
  extra: Partial<NavigationIntent> = {},
): NavigationIntent => ({ version: 1, source: 'internal', destination: route, ...extra })
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('transport-neutral navigation intents', () => {
  it('resolves named routes and URLs without guards, lazy loading, tab selection or delivery consumption', async () => {
    const select = vi.fn(() => 'default'),
      guard = vi.fn(),
      factory = vi.fn(() => page('Lazy'))
    const { router } = await mount(
      [...routes, { path: '/lazy', name: 'lazy', component: factory }],
      { links: { schemes: ['app'], frame: select } },
    )
    router.beforeEach(guard)
    const route = request({
      route: {
        name: 'item',
        params: { id: 7 },
        query: { tag: ['a', 'b'], empty: null },
        hash: '#top',
      },
    })
    expect(router.resolveIntent(route)).toMatchObject({
      status: 'resolved',
      location: { fullPath: '/items/7?tag=a&tag=b&empty#top' },
    })
    expect(router.resolveIntent(request({ url: 'app://items/7' }))).toMatchObject({
      status: 'resolved',
      location: { fullPath: '/items/7' },
    })
    const lazy = request(
      { route: '/lazy' },
      { delivery: { scope: 'account:a', id: 'tap' } },
    )
    router.resolveIntent(lazy)
    expect(factory).not.toHaveBeenCalled()
    expect(select).not.toHaveBeenCalled()
    expect(guard).not.toHaveBeenCalled()
    expect(paths(router.stack.value)).toEqual(['/'])
    expect((await router.openIntent(lazy)).status).toBe('handled')
    expect(factory).toHaveBeenCalledOnce()
  })

  it('copies and freezes requests before an asynchronous wait', async () => {
    const show = ref(false)
    const { router } = await mount(routes, {
      render: () => [
        h(RouterView),
        ...(show.value ? [h(RouterView, { name: 'other' })] : []),
      ],
    })
    const input = {
      version: 1,
      source: 'test',
      destination: { route: { name: 'item', params: { id: 1 } } },
      target: { frame: 'other' },
    }
    const pending = router.openIntent(input)
    input.destination.route.params.id = 99
    input.target.frame = 'default'
    show.value = true
    const result = await pending
    expect(result).toMatchObject({ status: 'handled', location: { path: '/items/1' } })
    if (result.status === 'handled') {
      expect(Object.isFrozen(result.intent.destination)).toBe(true)
      expect(Object.isFrozen((result.intent.destination as any).route.params)).toBe(true)
    }
    expect(router.getHistory({ frame: 'default' })?.entries).toHaveLength(1)
  })

  it('rejects unsupported versions, hostile/non-JSON values, unknown fields and bounded oversized inputs before callbacks', async () => {
    const mapping = vi.fn()
    const { router } = await mount(routes, { links: { map: mapping } })
    const getter = vi.fn(() => 'internal')
    const circular: any = request()
    circular.destination = circular
    const samples = [
      null,
      [],
      'json text',
      request(undefined, { source: '' }),
      { ...request(), version: 2 },
      { ...request(), extra: 'no' },
      { ...request(), options: { props: {} } },
      { ...request(), destination: { route: '/items/1', url: 'app://items/2' } },
      request({ route: 'relative' }),
      request({ route: { name: 'item', params: { id: Infinity } } }),
      { ...request(), source: new String('internal') },
      Object.defineProperty({ ...request() }, 'source', { get: getter }),
      request(undefined, { expiresAt: NaN }),
      circular,
      request({ route: { path: '/items/1', query: { big: '🧭'.repeat(4500) } } }),
      request({
        route: {
          path: '/items/1',
          query: { a: '🧭'.repeat(2500), b: '🧭'.repeat(2500) },
        },
      }),
      request({ route: { path: '/items/1', query: { tags: Array(65).fill('x') } } }),
      JSON.parse(
        '{"version":1,"source":"test","destination":{"route":{"path":"/","query":{"__proto__":"bad"}}}}',
      ),
      { ...request(), delivery: { scope: 'a', id: 'b', token: 'secret' } },
    ]
    for (const input of samples)
      expect((await router.openIntent(input)).status).toBe('ignored')
    expect(getter).not.toHaveBeenCalled()
    expect(mapping).not.toHaveBeenCalled()
    expect(router.resolveIntent({ ...request(), version: 2 })).toEqual({
      status: 'ignored',
      reason: 'version',
    })
    expect(paths(router.stack.value)).toEqual(['/'])
  })

  it('uses existing URL screening, mapping and explicit outcomes', async () => {
    const { router } = await mount(routes, {
      links: {
        schemes: ['app', 'https'],
        hosts: ['example.com'],
        map: (link) =>
          link.path === '/mapped'
            ? { name: 'item', params: { id: 42 } }
            : { path: link.path },
      },
    })
    for (const [url, reason] of [
      ['ftp://items/1', 'scheme'],
      ['https://other.com/items/1', 'host'],
      ['app://missing', 'unmatched'],
      ['app://items/%ZZ', 'invalid'],
    ]) {
      expect(await router.openIntent(request({ url: url! }))).toEqual({
        status: 'ignored',
        reason,
      })
    }
    expect(
      (router.resolveIntent(request({ url: 'app://mapped' })) as any).location.fullPath,
    ).toBe(router.resolveLink('app://mapped')?.fullPath)
    expect((await router.openIntent(request({ url: 'app://mapped' }))).status).toBe(
      'handled',
    )
    expect(router.currentRoute.value.fullPath).toBe('/items/42')
  })

  it('preserves legacy listeners, policy options, parent history and scoped intent delivery identities', async () => {
    const heard = vi.fn()
    const { router } = await mount(routes, {
      links: { options: { deliveryId: 'legacy', withParents: false } },
    })
    router.onLink(heard)
    await router.openLink('app://settings/account')
    expect(paths(router.stack.value)).toEqual(['/', '/settings/account'])
    expect(heard).toHaveBeenCalledOnce()
    const input = request(
      { url: 'app://items/1' },
      { delivery: { scope: 'a', id: 'legacy' } },
    )
    expect((await router.openIntent(input)).status).toBe('handled')
    expect(await router.openIntent({ ...input, source: 'notification' })).toEqual({
      status: 'ignored',
      reason: 'repeat',
    })
    expect((await router.openLink('app://items/2')).ignored).toBe('repeat')
    expect(heard).toHaveBeenCalledTimes(2)
    expect(
      (await router.openIntent({ ...input, delivery: { scope: 'b', id: 'legacy' } }))
        .status,
    ).toBe('handled')
  })

  it('runs guards, redirects, parent history, modal results and errors through normal navigation', async () => {
    const { router } = await mount(routes)
    router.beforeEach((to) => {
      if (to.params.id === 'blocked') return false
      if (to.params.id === 'private') return '/login'
      if (to.params.id === 'error') throw new Error('guard failed')
    })
    await router.openIntent(request({ route: '/settings/account' }))
    expect(paths(router.stack.value)).toEqual(['/', '/settings', '/settings/account'])
    expect(await router.openIntent(request({ route: '/items/blocked' }))).toMatchObject({
      status: 'handled',
      failure: { type: NavigationFailureType.aborted },
    })
    expect(await router.openIntent(request({ route: '/items/private' }))).toMatchObject({
      status: 'handled',
      location: { path: '/items/private' },
      failure: undefined,
    })
    expect(router.currentRoute.value.path).toBe('/login')
    const errors = vi.fn()
    router.onError(errors)
    await expect(router.openIntent(request({ route: '/items/error' }))).rejects.toThrow(
      'guard failed',
    )
    expect(errors).toHaveBeenCalledOnce()
    const result = router.pushForResult('/modal')
    await settle()
    await router.back({ result: 'unchanged-result' })
    expect(await result).toBe('unchanged-result')
    await router.openIntent(request({ route: '/modal' }))
    expect(router.currentRoute.value.path).toBe('/modal')
    await router.back()
    expect(router.currentRoute.value.path).toBe('/login')
  })

  it('deduplicates in-flight deliveries while preserving latest-request guard cancellation and deliberate repeats', async () => {
    let release!: () => void
    const { router } = await mount(routes)
    router.beforeEach((to) =>
      to.params.id === 'slow'
        ? new Promise<void>((resolve) => {
            release = resolve
          })
        : undefined,
    )
    const input = request({ route: '/items/slow' }, { delivery: { scope: 'a', id: '1' } })
    const pending = router.openIntent(input)
    await settle()
    expect(await router.openIntent(input)).toEqual({
      status: 'ignored',
      reason: 'repeat',
    })
    await router.openIntent(request({ route: '/items/fast' }))
    release()
    expect(await pending).toMatchObject({
      status: 'handled',
      failure: { type: NavigationFailureType.cancelled },
    })
    expect(router.currentRoute.value.path).toBe('/items/fast')
    await router.back()
    expect((await router.openIntent(request({ route: '/items/fast' }))).status).toBe(
      'handled',
    )
    expect(router.currentRoute.value.path).toBe('/items/fast')
  })

  it('rechecks expiry and route removal after waiting for a target, without navigating elsewhere', async () => {
    let now = 1000
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    const show = ref(false)
    const { router } = await mount(routes, {
      render: () => [
        h(RouterView),
        ...(show.value ? [h(RouterView, { name: 'late' })] : []),
      ],
    })
    expect(router.resolveIntent(request(undefined, { expiresAt: 1000 }))).toEqual({
      status: 'ignored',
      reason: 'expired',
    })
    const expired = router.openIntent(
      request(undefined, { expiresAt: 1001, target: { frame: 'late' } }),
    )
    const removed = router.openIntent(request(undefined, { target: { frame: 'late' } }))
    now = 2000
    router.removeRoute('item')
    show.value = true
    expect(await expired).toEqual({ status: 'ignored', reason: 'expired' })
    expect(await removed).toEqual({ status: 'ignored', reason: 'unmatched' })
    expect(router.getHistory({ frame: 'late' })?.entries).toHaveLength(1)
  })

  it('waits for cold readiness and restoration without mutating the preview or claiming FIFO ordering', async () => {
    let pending: Promise<unknown>
    const { router } = await mount(routes, {
      restore: {
        load: () => ({ savedAt: Date.now(), stacks: { default: ['/', '/items/1'] } }),
        save() {},
      },
      before: (router) => {
        pending = router.openIntent(request())
      },
    })
    expect(await pending!).toMatchObject({ status: 'handled' })
    expect(paths(router.stack.value)).toEqual(['/', '/items/1', '/items/7'])
  })

  it('reports closure during readiness or target waits and rejects later requests', async () => {
    resetNative()
    const cold = createRouter({ routes })
    const app = createApp({ render: () => h('GridLayout') }).use(cold)
    app.start()
    const pending = cold.openIntent(request())
    app.unmount()
    expect(await pending).toEqual({ status: 'ignored', reason: 'owner-closed' })
    const warm = await mount(routes)
    const late = warm.router.openIntent(
      request(undefined, { target: { frame: 'absent' } }),
    )
    await settle()
    warm.app.unmount()
    expect(await late).toEqual({ status: 'ignored', reason: 'owner-closed' })
    expect(await warm.router.openIntent(request())).toEqual({
      status: 'ignored',
      reason: 'owner-closed',
    })
  })

  it('bounds pending deliveries without evicting active identities', async () => {
    const { router, app } = await mount(routes)
    const input = request(undefined, { target: { frame: 'late' } })
    const pending = Array.from({ length: 256 }, (_, i) =>
      router.openIntent({ ...input, delivery: { scope: 'a', id: String(i) } }),
    )
    expect(
      await router.openIntent({ ...input, delivery: { scope: 'a', id: '256' } }),
    ).toEqual({ status: 'ignored', reason: 'busy' })
    expect(
      await router.openIntent({ ...input, delivery: { scope: 'a', id: '0' } }),
    ).toEqual({ status: 'ignored', reason: 'repeat' })
    app.unmount()
    expect((await Promise.all(pending)).every((r) => r.status === 'ignored')).toBe(true)
  })

  it('scopes owner, stacks and delivery IDs to explicit router instances', async () => {
    resetNative()
    const make = async (id: string) => {
      const window = new NativeWindow(id)
      const router = createRouter({ routes, window: window as unknown as RouterWindow })
      const app = createApp({ render: () => h(RouterView) }).use(router)
      window.setContent(app.start()!.$el.nativeView as Frame)
      await router.isReady()
      return { router, app, window }
    }
    const first = await make('a'),
      second = await make('b')
    try {
      const input = request(undefined, {
        target: { windowId: 'a' },
        delivery: { scope: 'account', id: '1' },
      })
      expect(await second.router.openIntent(input)).toEqual({
        status: 'ignored',
        reason: 'wrong-window',
      })
      expect((await first.router.openIntent(input)).status).toBe('handled')
      expect(paths(second.router.stack.value)).toEqual(['/'])
      expect(
        (await second.router.openIntent({ ...input, target: { windowId: 'b' } })).status,
      ).toBe('handled')
      first.window.close()
      expect(await first.router.openIntent(request())).toEqual({
        status: 'ignored',
        reason: 'owner-closed',
      })
    } finally {
      first.app.unmount()
      second.app.unmount()
    }
  })

  it('keeps payloads and delivery identities out of diagnostics', async () => {
    const { router } = await mount(routes, { diagnostics: true })
    await router.openIntent(
      request(
        {
          route: {
            name: 'item',
            params: { id: 'secret-id' },
            query: { token: 'secret-token' },
          },
        },
        {
          source: 'secret-source',
          delivery: { scope: 'secret-account', id: 'secret-delivery' },
        },
      ),
    )
    expect(router.diagnostics!.export()).not.toContain('secret-')
  })

  it('defaults to the receiving router default stack even when another stack has focus, and honors replacement options', async () => {
    const { router } = await mount(routes, {
      render: () => [h(RouterView), h(RouterView, { name: 'other' })],
    })
    await router.push('/items/other', { frame: 'other' })
    await router.openIntent(
      request(
        { route: '/settings/account' },
        { options: { withParents: false, clearHistory: true } },
      ),
    )
    expect(
      router.getHistory({ frame: 'default' })?.entries.map((e) => e.route.path),
    ).toEqual(['/settings/account'])
    expect(
      router.getHistory({ frame: 'other' })?.entries.map((e) => e.route.path),
    ).toEqual(['/', '/items/other'])
    await router.openIntent(
      request({ route: '/items/replacement' }, { options: { replace: true } }),
    )
    expect(
      router.getHistory({ frame: 'default' })?.entries.map((e) => e.route.path),
    ).toEqual(['/items/replacement'])
  })

  it('reports an unavailable target at the existing mount deadline and never falls back to another stack', async () => {
    const { router, app } = await mount(routes)
    vi.useFakeTimers()
    const pending = router.openIntent(
      request(undefined, { target: { frame: 'missing' } }),
    )
    await vi.advanceTimersByTimeAsync(10000)
    expect(await pending).toEqual({ status: 'ignored', reason: 'target-unavailable' })
    expect(paths(router.stack.value)).toEqual(['/'])
    app.unmount()
  })

  it('bounds settled delivery retention and accepts Unicode within the actual UTF-8 budget', async () => {
    const { router } = await mount(routes)
    router.beforeEach(() => false)
    expect(
      router.resolveIntent(
        request({ route: { path: '/items/1', query: { value: '🧭'.repeat(4000) } } }),
      ).status,
    ).toBe('resolved')
    const input = request(undefined, { delivery: { scope: 'session', id: '0' } })
    for (let i = 0; i < 257; i++)
      await router.openIntent({ ...input, delivery: { scope: 'session', id: String(i) } })
    expect(
      await router.openIntent({ ...input, delivery: { scope: 'session', id: '1' } }),
    ).toEqual({ status: 'ignored', reason: 'repeat' })
    expect(await router.openIntent(input)).toMatchObject({
      status: 'handled',
      failure: { type: NavigationFailureType.aborted },
    })
  })
})
