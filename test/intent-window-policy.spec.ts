import { createApp, h } from 'nativescript-vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createRouter,
  RouterView,
  NavigationFailureType,
  type NavigationIntent,
  type Router,
  type SavedStacks,
} from '../src/index.js'
import {
  createWindowIntentPolicy,
  type IntentWindow,
  type WindowPorts,
} from '../examples/intent-windows/policy.js'
import { NativeWindow, resetNative, setPlatform } from './shims/core.js'
import { page, paths, settle } from './helpers.js'

const routes = [
  { path: '/', component: page('Home') },
  { path: '/saved', component: page('Saved') },
  { path: '/items/:id', component: page('Item') },
]
const apps: ReturnType<typeof createApp>[] = []
const owners = new Map<string, IntentWindow & { router: Router; window: NativeWindow }>()
function request(id = 'tap', extra: Partial<NavigationIntent> = {}): NavigationIntent {
  return {
    version: 1,
    source: 'internal',
    destination: { route: '/items/7' },
    delivery: { scope: 'account:a', id },
    ...extra,
  }
}
async function owner(key: string, restore = false) {
  const window = new NativeWindow(key)
  const router = createRouter({
    routes,
    window,
    restore: restore
      ? {
          key,
          save: () => {},
          load: async () =>
            ({
              version: 2,
              windowKey: key,
              savedAt: Date.now(),
              stacks: { default: ['/', '/saved'] },
            }) as SavedStacks,
        }
      : undefined,
  })
  const app = createApp({ render: () => h(RouterView) }).use(router)
  apps.push(app)
  const value = { key, router: router as Router, window }
  owners.set(key, value)
  window.setContent(app.start()!.$el.nativeView)
  await router.isReady()
  return value
}
async function setup(overrides: Partial<WindowPorts> = {}) {
  const first = await owner('a')
  const ports: WindowPorts = {
    resolve: (request) => first.router.resolveIntent(request),
    find: (key) => owners.get(key),
    open: vi.fn(async (key, restore) => owner(key, restore === 'saved')),
    focus: vi.fn(async () => {}),
    ...overrides,
  }
  return { first, ports, policy: createWindowIntentPolicy(ports) }
}
beforeEach(() => {
  resetNative()
  setPlatform('ios')
  owners.clear()
})
afterEach(() => {
  for (const app of apps.splice(0)) app.unmount()
  vi.useRealTimers()
})
const fresh = { mode: 'new', key: 'b', restore: 'fresh', history: 'append' } as const

describe('application-owned intent window policy', () => {
  it('invalidates creation tokens on expiry and after a settled attempt', async () => {
    let release!: (value: undefined) => void, current!: () => boolean
    const { policy } = await setup({
      open: (_key, _restore, alive) => {
        current = alive
        return new Promise<undefined>((r) => {
          release = r
        })
      },
    })
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(1000)
    const pending = policy.dispatch(request('expires', { expiresAt: 2000 }), fresh)
    expect(current()).toBe(true)
    vi.setSystemTime(2000)
    expect(current()).toBe(false)
    release(undefined)
    expect(await pending).toEqual({ status: 'ignored', reason: 'expired' })
    const next = policy.dispatch(request('settled'), fresh)
    expect(current()).toBe(true)
    release(undefined)
    await next
    expect(current()).toBe(false)
  })
  it('bounds recent delivery identities instead of growing a permanent global ledger', async () => {
    const { policy, ports } = await setup({ open: vi.fn(async () => undefined) })
    for (let i = 0; i < 257; i++) await policy.dispatch(request(`id:${i}`), fresh)
    expect(await policy.dispatch(request('id:256'), fresh)).toEqual({
      status: 'ignored',
      reason: 'repeat',
    })
    expect(await policy.dispatch(request('id:0'), fresh)).toEqual({
      status: 'ignored',
      reason: 'target-unavailable',
    })
    expect(ports.open).toHaveBeenCalledTimes(258)
  })
  it('does not request a scene after synchronous policy disposal during preview', async () => {
    const { policy, ports, first } = await setup()
    ports.resolve = (input) => {
      policy.dispose()
      return first.router.resolveIntent(input)
    }
    expect(await policy.dispatch(request(), fresh)).toEqual({
      status: 'ignored',
      reason: 'scope-changed',
    })
    expect(ports.open).not.toHaveBeenCalled()
  })
  it('rejects invalid/expired/unmatched requests before native allocation or focus', async () => {
    const { policy, ports } = await setup()
    for (const input of [
      null,
      { ...request(), version: 2 },
      request('old', { expiresAt: 0 }),
      request('missing', { destination: { route: '/missing' } }),
    ])
      expect((await policy.dispatch(input, fresh)).status).toBe('ignored')
    expect(ports.open).not.toHaveBeenCalled()
    expect(ports.focus).not.toHaveBeenCalled()
  })
  it('reuses the explicitly selected background owner without focus or source changes', async () => {
    const { first, policy, ports } = await setup()
    const second = await owner('b')
    await first.router.push('/items/source')
    expect(
      (await policy.dispatch(request(), { mode: 'reuse', key: 'b', history: 'append' }))
        .status,
    ).toBe('handled')
    expect(paths(first.router.stack.value)).toEqual(['/', '/items/source'])
    expect(paths(second.router.stack.value)).toEqual(['/', '/items/7'])
    expect(ports.focus).not.toHaveBeenCalled()
    expect(ports.open).not.toHaveBeenCalled()
  })
  it('waits for explicit focus and snapshots policy before asynchronous work', async () => {
    let release!: () => void
    const { policy } = await setup({
      focus: () =>
        new Promise<void>((r) => {
          release = r
        }),
    })
    const second = await owner('b')
    const selection = { mode: 'focus' as const, key: 'b', history: 'append' as const }
    const pending = policy.dispatch(request(), selection)
    selection.key = 'a'
    await settle()
    expect(paths(second.router.stack.value)).toEqual(['/'])
    release()
    await pending
    expect(paths(second.router.stack.value)).toEqual(['/', '/items/7'])
  })
  it('restores the selected saved history before append, with fresh and reset alternatives', async () => {
    const { policy } = await setup()
    await policy.dispatch(request('saved'), { ...fresh, restore: 'saved' })
    expect(paths(owners.get('b')!.router.stack.value)).toEqual([
      '/',
      '/saved',
      '/items/7',
    ])
    await policy.dispatch(request('fresh'), { ...fresh, key: 'c' })
    expect(paths(owners.get('c')!.router.stack.value)).toEqual(['/', '/items/7'])
    await policy.dispatch(request('reset', { destination: { route: '/items/reset' } }), {
      mode: 'reuse',
      key: 'b',
      history: 'reset',
    })
    expect(paths(owners.get('b')!.router.stack.value)).toEqual(['/items/reset'])
    expect(paths(owners.get('c')!.router.stack.value)).toEqual(['/', '/items/7'])
  })
  it('reserves delivery before window creation and consumes refused/finished attempts', async () => {
    let release!: (value: IntentWindow) => void
    const { policy, ports } = await setup({
      open: vi.fn(
        () =>
          new Promise<IntentWindow>((r) => {
            release = r
          }),
      ),
    })
    const input = request()
    const pending = policy.dispatch(input, fresh)
    expect(await policy.dispatch(input, fresh)).toEqual({
      status: 'ignored',
      reason: 'repeat',
    })
    const second = await owner('b')
    release(second)
    await pending
    expect(await policy.dispatch(input, fresh)).toEqual({
      status: 'ignored',
      reason: 'repeat',
    })
    expect(ports.open).toHaveBeenCalledOnce()
    expect(ports.focus).toHaveBeenCalledOnce()
    const unavailable = request('missing')
    expect(
      await policy.dispatch(unavailable, {
        mode: 'focus',
        key: 'unknown',
        history: 'append',
      }),
    ).toEqual({ status: 'ignored', reason: 'target-unavailable' })
    expect(await policy.dispatch(unavailable, fresh)).toEqual({
      status: 'ignored',
      reason: 'repeat',
    })
  })
  it('does not guess another owner or create a fallback when selection is stale', async () => {
    const { policy, ports } = await setup()
    expect(
      await policy.dispatch(request(), { mode: 'focus', key: 'gone', history: 'append' }),
    ).toEqual({ status: 'ignored', reason: 'target-unavailable' })
    expect(
      await policy.dispatch(request('new-existing'), { ...fresh, key: 'a' }),
    ).toEqual({ status: 'ignored', reason: 'target-unavailable' })
    expect(ports.open).not.toHaveBeenCalled()
    expect(ports.focus).not.toHaveBeenCalled()
  })
  it('checks explicit native identity before focus and never rewrites an existing-owner assertion for new windows', async () => {
    const { policy, ports } = await setup()
    await owner('b')
    const input = request('wrong', { target: { windowId: 'a' } })
    expect(
      await policy.dispatch(input, { mode: 'focus', key: 'b', history: 'append' }),
    ).toEqual({ status: 'ignored', reason: 'wrong-window' })
    expect(await policy.dispatch(input, { ...fresh, key: 'c' })).toEqual({
      status: 'ignored',
      reason: 'wrong-window',
    })
    expect(ports.focus).not.toHaveBeenCalled()
    expect(ports.open).not.toHaveBeenCalled()
  })
  it.each(['dispose', 'closed', 'replaced', 'expired'] as const)(
    'revalidates %s after asynchronous focus',
    async (change) => {
      let release!: () => void
      const { policy } = await setup({
        focus: () =>
          new Promise<void>((r) => {
            release = r
          }),
      })
      const second = await owner('b')
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(1000)
      const pending = policy.dispatch(request('wait', { expiresAt: 2000 }), {
        mode: 'focus',
        key: 'b',
        history: 'append',
      })
      if (change === 'dispose') policy.dispose()
      if (change === 'closed') second.window.close()
      if (change === 'replaced') owners.set('b', { ...second })
      if (change === 'expired') vi.setSystemTime(2000)
      release()
      expect(await pending).toEqual({
        status: 'ignored',
        reason:
          change === 'dispose'
            ? 'scope-changed'
            : change === 'expired'
              ? 'expired'
              : 'owner-closed',
      })
      expect(paths(second.router.stack.value)).not.toContain('/items/7')
    },
  )
  it('invalidates delayed OS creation on account replacement without adopting its late owner', async () => {
    let release!: (value: IntentWindow) => void, current!: () => boolean
    const { policy, ports } = await setup({
      open: (_key, _restore, alive) => {
        current = alive
        return new Promise((r) => {
          release = r
        })
      },
    })
    const pending = policy.dispatch(request(), fresh)
    policy.dispose()
    expect(current()).toBe(false)
    const second = await owner('b')
    release(second)
    expect(await pending).toEqual({ status: 'ignored', reason: 'scope-changed' })
    expect(ports.focus).not.toHaveBeenCalled()
    expect(paths(second.router.stack.value)).toEqual(['/'])
    expect(await policy.dispatch(request('new'), fresh)).toEqual({
      status: 'ignored',
      reason: 'scope-changed',
    })
  })
  it('bounds pending work and prevents concurrent creation of the same application key', async () => {
    const releases: ((value: undefined) => void)[] = []
    const { policy, ports } = await setup({
      open: vi.fn(() => new Promise<IntentWindow | undefined>((r) => releases.push(r))),
    })
    const pending = Array.from({ length: 32 }, (_, i) =>
      policy.dispatch(request(`${i}`), { ...fresh, key: `new${i}` }),
    )
    expect(
      await policy.dispatch(request('overflow'), { ...fresh, key: 'overflow' }),
    ).toEqual({ status: 'ignored', reason: 'busy' })
    releases.forEach((r) => r(undefined))
    await Promise.all(pending)
    const one = policy.dispatch(request('again'), fresh)
    expect(await policy.dispatch(request('other'), fresh)).toEqual({
      status: 'ignored',
      reason: 'busy',
    })
    releases.at(-1)!(undefined)
    await one
    expect(ports.open).toHaveBeenCalledTimes(33)
  })
  it('propagates native focus errors and normal guard failures without clearing other histories', async () => {
    const { policy, ports, first } = await setup()
    const second = await owner('b')
    second.router.beforeEach(() => false)
    expect(
      await policy.dispatch(request(), { mode: 'reuse', key: 'b', history: 'reset' }),
    ).toMatchObject({
      status: 'handled',
      failure: { type: NavigationFailureType.aborted },
    })
    ports.focus = vi.fn(async () => {
      throw new Error('OS refused activation')
    })
    await expect(
      policy.dispatch(request('focus'), { mode: 'focus', key: 'b', history: 'append' }),
    ).rejects.toThrow('OS refused activation')
    expect(paths(first.router.stack.value)).toEqual(['/'])
    expect(paths(second.router.stack.value)).toEqual(['/'])
  })
})
