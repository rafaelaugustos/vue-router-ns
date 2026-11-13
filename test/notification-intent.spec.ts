import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h } from 'nativescript-vue'
import {
  createRouter,
  notificationIntent,
  NavigationFailureType,
  RouterView,
  type NavigationIntent,
} from '../src/index.js'
import { mount, page, paths } from './helpers.js'
import { resetNative } from './shims/core.js'

const payload = (
  destination: NavigationIntent['destination'] = { route: '/items/7' },
) => ({
  version: 1,
  destination,
})
const delivery = { scope: 'account:a', id: 'tap:1' }
const routes = [
  { path: '/', component: page('Home') },
  { path: '/items/:id', name: 'item', component: page('Item') },
  { path: '/login', component: page('Login') },
] as const
afterEach(() => vi.useRealTimers())

describe('notification destinations', () => {
  it('normalizes only destination data; context supplies ownership and delivery identity', () => {
    const input = payload({ route: { name: 'item', params: { id: 7 } } })
    const context = {
      delivery: { ...delivery },
      target: { frame: 'inbox' },
      options: { replace: true },
    }
    const result = notificationIntent(input, context)
    expect(result).toEqual({ ...input, source: 'notification', ...context })
    input.destination = { route: '/login' }
    context.delivery.scope = 'account:b'
    context.target.frame = 'other'
    expect(result).toMatchObject({
      destination: { route: { name: 'item', params: { id: 7 } } },
      delivery,
      target: { frame: 'inbox' },
    })
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen((result as NavigationIntent).destination)).toBe(true)
    expect(Object.isFrozen((result as NavigationIntent).delivery)).toBe(true)
  })

  it('rejects envelope authority and provider extras instead of silently trusting them', () => {
    for (const extra of [
      { source: 'trusted' },
      { delivery },
      { target: { windowId: 'another' } },
      { options: { clearHistory: true } },
      { token: 'secret' },
      { aps: {} },
    ])
      expect(notificationIntent({ ...payload(), ...extra })).toEqual({
        status: 'ignored',
        reason: 'invalid',
      })
    for (const extra of [
      { source: 'spoofed' },
      { destination: { route: '/login' } },
      { expiresAt: 9 },
      { version: 2 },
    ])
      expect(notificationIntent(payload(), extra as any)).toEqual({
        status: 'ignored',
        reason: 'invalid',
      })
    expect(notificationIntent({ ...payload(), version: 2 })).toEqual({
      status: 'ignored',
      reason: 'version',
    })
  })

  it('never invokes accessors/toJSON and rejects non-JSON, pollution, oversized and malformed inputs', () => {
    const getter = vi.fn(() => ({ route: '/items/7' }))
    const toJSON = vi.fn(() => payload())
    const circular: any = payload()
    circular.destination = circular
    const inputs = [
      null,
      [],
      'JSON text',
      new Date(),
      circular,
      { ...payload(), toJSON },
      Object.defineProperty({ version: 1 }, 'destination', {
        get: getter,
        enumerable: true,
      }),
      { ...payload(), destination: { route: '/items/7', url: 'app://items/7' } },
      payload({ route: { path: '/items/7', query: { q: '🧭'.repeat(4096) } } }),
      payload({ route: { path: '/items/7', query: { q: Array(65).fill('a') } } }),
      JSON.parse(
        '{"version":1,"destination":{"route":{"path":"/","query":{"__proto__":"x"}}}}',
      ),
    ]
    for (const input of inputs)
      expect(notificationIntent(input)).toEqual({ status: 'ignored', reason: 'invalid' })
    expect(
      notificationIntent(
        payload(),
        Object.defineProperty({}, 'delivery', { get: getter, enumerable: true }),
      ),
    ).toEqual({ status: 'ignored', reason: 'invalid' })
    expect(getter).not.toHaveBeenCalled()
    expect(toJSON).not.toHaveBeenCalled()
  })

  it('applies the byte bound again after adding app context', () => {
    const input = payload({
      route: { path: '/items/7', query: { a: 'a'.repeat(8100), b: 'b'.repeat(8100) } },
    })
    expect(notificationIntent(input)).toHaveProperty('source', 'notification')
    expect(
      notificationIntent(input, {
        delivery: { scope: 's'.repeat(256), id: 'i'.repeat(256) },
      }),
    ).toEqual({ status: 'ignored', reason: 'invalid' })
  })

  it('rejects expired/invalid deadlines and keeps future expiry for execution revalidation', async () => {
    const { router } = await mount(routes)
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(1000)
    for (const expiresAt of [0, 999, 1000])
      expect(notificationIntent({ ...payload(), expiresAt })).toEqual({
        status: 'ignored',
        reason: 'expired',
      })
    for (const expiresAt of [-1, 1.5, Infinity, 'later'])
      expect(notificationIntent({ ...payload(), expiresAt })).toEqual({
        status: 'ignored',
        reason: 'invalid',
      })
    const intent = notificationIntent({ ...payload(), expiresAt: 1100 })
    vi.setSystemTime(1100)
    expect(await router.openIntent(intent)).toEqual({
      status: 'ignored',
      reason: 'expired',
    })
    expect(paths(router.stack.value)).toEqual(['/'])
  })

  it('resolves consistently with URLs, stable shortcuts and internal actions without side effects', async () => {
    const map = vi.fn((link) => ({ path: link.path }))
    const guard = vi.fn()
    const { router } = await mount(routes, { links: { schemes: ['app'], map } })
    router.beforeEach(guard)
    const shortcut = router.shortcutURL('item-7', { name: 'item', params: { id: 7 } })
    for (const destination of [
      { route: { name: 'item', params: { id: 7 } } },
      { url: 'app://items/7' },
      { url: shortcut },
    ]) {
      const intent = notificationIntent(payload(destination))
      expect(router.resolveIntent(intent)).toMatchObject({
        status: 'resolved',
        location: { path: '/items/7' },
      })
    }
    expect(guard).not.toHaveBeenCalled()
    expect(paths(router.stack.value)).toEqual(['/'])
    expect(map).toHaveBeenCalledOnce()
    expect(
      await router.openIntent(notificationIntent(payload({ url: 'other://items/7' }))),
    ).toEqual({ status: 'ignored', reason: 'scheme' })
    router.removeRoute('item')
    expect(router.resolveIntent(notificationIntent(payload({ url: shortcut })))).toEqual({
      status: 'ignored',
      reason: 'unmatched',
    })
  })

  it('reserves app-scoped delivery once across callbacks and allows fresh taps or account scopes', async () => {
    const guard = vi.fn()
    const { router } = await mount(routes)
    router.beforeEach(guard)
    const input = notificationIntent(payload(), { delivery })
    expect((await router.openIntent(input)).status).toBe('handled')
    expect(await router.openIntent(input)).toEqual({
      status: 'ignored',
      reason: 'repeat',
    })
    const next = await router.openIntent(
      notificationIntent(payload(), { delivery: { ...delivery, id: 'tap:2' } }),
    )
    expect(next).toMatchObject({
      status: 'handled',
      failure: { type: NavigationFailureType.duplicated },
    })
    await router.back()
    expect(
      (
        await router.openIntent(
          notificationIntent(payload(), {
            delivery: { ...delivery, scope: 'account:b' },
          }),
        )
      ).status,
    ).toBe('handled')
    expect(guard).toHaveBeenCalledTimes(3)
  })

  it('preserves guards and explicit outcomes for refused, missing and wrong-owner destinations', async () => {
    const { router } = await mount(routes)
    router.beforeEach(() => false)
    expect(await router.openIntent(notificationIntent(payload()))).toMatchObject({
      status: 'handled',
      failure: { type: NavigationFailureType.aborted },
    })
    expect(
      await router.openIntent(notificationIntent(payload({ route: '/missing' }))),
    ).toEqual({ status: 'ignored', reason: 'unmatched' })
    expect(
      await router.openIntent(
        notificationIntent(payload(), { target: { windowId: 'other' } }),
      ),
    ).toEqual({ status: 'ignored', reason: 'wrong-window' })
    expect(paths(router.stack.value)).toEqual(['/'])
  })

  it('retains a notification through login, rejects duplicate callbacks and resumes once', async () => {
    const { router } = await mount(routes)
    let authorized = false
    const scope = {}
    router.beforeEach((to) =>
      to.path.startsWith('/items/') && !authorized ? '/login' : undefined,
    )
    const intent = notificationIntent(payload(), { delivery, options: { replace: true } })
    const handle = router.suspendIntent(intent, {
      scope: () => scope,
      authorize: () => authorized,
    })
    expect(handle.status).toBe('suspended')
    if (handle.status !== 'suspended') throw new Error('Expected suspension')
    await router.push('/login')
    expect(await router.openIntent(intent)).toEqual({
      status: 'ignored',
      reason: 'repeat',
    })
    expect(await handle.resume()).toEqual({ status: 'ignored', reason: 'unauthorized' })
    authorized = true
    const resumed = handle.resume()
    expect(handle.resume()).toBe(resumed)
    await resumed
    expect(paths(router.stack.value)).toEqual(['/', '/items/7'])
  })

  it('waits for cold mount and rejects later work after owner disposal', async () => {
    resetNative()
    const router = createRouter({ routes })
    const pending = router.openIntent(notificationIntent(payload(), { delivery }))
    const app = createApp({ render: () => h(RouterView) }).use(router)
    app.start()
    expect((await pending).status).toBe('handled')
    expect(paths(router.stack.value)).toEqual(['/', '/items/7'])
    app.unmount()
    expect(await router.openIntent(notificationIntent(payload()))).toEqual({
      status: 'ignored',
      reason: 'owner-closed',
    })
  })
})
