import { createApp, h, ref, watch } from 'nativescript-vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createRouter,
  NavigationFailureType,
  RouterView,
  type IntentResumePolicy,
  type NavigationIntent,
  type SuspendedIntent,
} from '../src/index.js'
import { mount, page, paths, settle } from './helpers.js'
import { resetNative } from './shims/core.js'

const routes = [
  { path: '/', component: page('Home') },
  { path: '/login', component: page('Login') },
  { path: '/private/:id', name: 'private', component: page('Private') },
  { path: '/other', name: 'other', component: page('Other') },
  { path: '/modal', component: page('Modal'), modal: true },
] as const
const request = (id = '1', extra: Partial<NavigationIntent> = {}): NavigationIntent => ({
  version: 1,
  source: 'internal',
  destination: { route: { name: 'private', params: { id } } },
  ...extra,
})
const pending = (
  result: ReturnType<ReturnType<typeof createRouter>['suspendIntent']>,
): SuspendedIntent => {
  expect(result.status).toBe('suspended')
  if (result.status !== 'suspended') throw new Error(result.reason)
  return result
}
function auth() {
  let identity: object | null = {},
    allowed = false
  const policy: IntentResumePolicy = { scope: () => identity, authorize: () => allowed }
  return {
    policy,
    login: () => {
      allowed = true
    },
    logout: () => {
      allowed = false
      identity = {}
    },
    switchAccount: () => {
      identity = {}
    },
    revoke: () => {
      allowed = false
    },
  }
}
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('explicit intent authentication resumption', () => {
  it('suspends without native work, keeps unauthenticated attempts pending and replaces app-owned login exactly once', async () => {
    const { router } = await mount(routes),
      session = auth()
    const guards = vi.fn()
    router.beforeEach(guards)
    const handle = pending(
      router.suspendIntent(request('1', { options: { replace: true } }), session.policy),
    )
    expect(paths(router.stack.value)).toEqual(['/'])
    expect(guards).not.toHaveBeenCalled()
    expect(await handle.resume()).toEqual({ status: 'ignored', reason: 'unauthorized' })
    expect(handle.state.value.status).toBe('pending')
    await router.push('/login')
    session.login()
    const first = handle.resume(),
      second = handle.resume()
    expect(second).toBe(first)
    expect(await first).toMatchObject({ status: 'handled', failure: undefined })
    expect(handle.resume()).toBe(first)
    expect(paths(router.stack.value)).toEqual(['/', '/private/1'])
    expect(handle.state.value.status).toBe('settled')
  })

  it('installs the shared promise before synchronous state observers can reenter', async () => {
    const { router } = await mount(routes),
      session = auth()
    session.login()
    const handle = pending(router.suspendIntent(request(), session.policy))
    let observed: Promise<unknown> | undefined
    const stop = watch(
      handle.state,
      (state) => {
        if (state.status === 'resuming') observed = handle.resume()
      },
      { flush: 'sync' },
    )
    const first = handle.resume()
    expect(observed).toBe(first)
    await first
    stop()
    expect(paths(router.stack.value)).toEqual(['/', '/private/1'])
  })

  it('reserves provider identity across suspension, login cancellation and the resumed attempt', async () => {
    const { router } = await mount(routes),
      session = auth()
    const input = request('1', { delivery: { scope: 'flow', id: 'tap' } })
    const handle = pending(router.suspendIntent(input, session.policy))
    expect(router.suspendIntent(input, session.policy)).toEqual({
      status: 'ignored',
      reason: 'repeat',
    })
    expect(await router.openIntent(input)).toEqual({
      status: 'ignored',
      reason: 'repeat',
    })
    expect(handle.state.value.status).toBe('pending')
    handle.cancel()
    handle.cancel()
    session.login()
    expect(await handle.resume()).toEqual({ status: 'ignored', reason: 'cancelled' })
    expect(await router.openIntent(input)).toEqual({
      status: 'ignored',
      reason: 'repeat',
    })
    expect(paths(router.stack.value)).toEqual(['/'])
  })

  it('supersedes only with a valid accepted new suspension or intent', async () => {
    const { router } = await mount(routes),
      session = auth()
    const first = pending(router.suspendIntent(request('1'), session.policy))
    await router.openIntent({ version: 8 })
    expect(first.state.value.status).toBe('pending')
    const second = pending(router.suspendIntent(request('2'), session.policy))
    expect(await first.resume()).toEqual({ status: 'ignored', reason: 'superseded' })
    await router.openIntent(request('3'))
    expect(await second.resume()).toEqual({ status: 'ignored', reason: 'superseded' })
    expect(paths(router.stack.value)).toEqual(['/', '/private/3'])
  })

  it.each(['logout', 'switchAccount'] as const)(
    'invalidates %s even if permission later returns',
    async (action) => {
      const { router } = await mount(routes),
        session = auth()
      const handle = pending(router.suspendIntent(request(), session.policy))
      session[action]()
      session.login()
      expect(await handle.resume()).toEqual({
        status: 'ignored',
        reason: 'scope-changed',
      })
      expect(handle.state.value).toEqual({ status: 'cancelled', reason: 'scope-changed' })
      expect(paths(router.stack.value)).toEqual(['/'])
    },
  )

  it('expires automatically with bounded timers and honors an earlier request deadline', async () => {
    const { router } = await mount(routes),
      session = auth()
    vi.useFakeTimers()
    const handle = pending(
      router.suspendIntent(request('1', { expiresAt: Date.now() + 50 }), {
        ...session.policy,
        maxAge: 100,
      }),
    )
    await vi.advanceTimersByTimeAsync(50)
    expect(handle.state.value).toEqual({ status: 'cancelled', reason: 'expired' })
    session.login()
    expect(await handle.resume()).toEqual({ status: 'ignored', reason: 'expired' })
    expect(vi.getTimerCount()).toBe(0)
    for (const maxAge of [0, -1, 300001, Infinity, 1.5])
      expect(router.suspendIntent(request(), { ...session.policy, maxAge })).toEqual({
        status: 'ignored',
        reason: 'invalid',
      })
  })

  it('includes its generated expiry in the retained JSON budget before reserving a delivery', async () => {
    const { router } = await mount(routes),
      session = auth()
    const input = {
      ...request(),
      destination: {
        route: { path: '/private/1', query: { a: 'x'.repeat(8192), b: '' } },
      },
    }
    input.destination.route.query.b = 'x'.repeat(
      16380 - Buffer.byteLength(JSON.stringify(input)),
    )
    expect(router.resolveIntent(input).status).toBe('resolved')
    expect(router.suspendIntent(input, session.policy)).toEqual({
      status: 'ignored',
      reason: 'invalid',
    })
  })

  it('revalidates removed destinations and URL mapping when login completes', async () => {
    let target = '1'
    const { router } = await mount(routes, {
        links: { map: () => ({ name: 'private', params: { id: target } }) },
      }),
      session = auth()
    const handle = pending(
      router.suspendIntent(
        { ...request(), destination: { url: 'app://original' } },
        session.policy,
      ),
    )
    target = '2'
    session.login()
    await handle.resume()
    expect(router.currentRoute.value.path).toBe('/private/2')
    const removed = pending(router.suspendIntent(request(), session.policy))
    router.removeRoute('private')
    expect(await removed.resume()).toEqual({ status: 'ignored', reason: 'unmatched' })
  })

  it('rechecks authentication after a delayed target mount', async () => {
    const show = ref(false)
    const { router } = await mount(routes, {
        render: () => [
          h(RouterView),
          ...(show.value ? [h(RouterView, { name: 'late' })] : []),
        ],
      }),
      session = auth()
    session.login()
    const handle = pending(
      router.suspendIntent(request('1', { target: { frame: 'late' } }), session.policy),
    )
    const result = handle.resume()
    await settle()
    session.switchAccount()
    show.value = true
    expect(await result).toEqual({ status: 'ignored', reason: 'scope-changed' })
    expect(router.getHistory({ frame: 'late' })?.entries).toHaveLength(1)
  })

  it.each(['logout', 'revoke', 'cancel', 'supersede', 'expire', 'remove'] as const)(
    'prevents presentation when %s happens during an asynchronous guard',
    async (action) => {
      const { router, frame } = await mount(routes),
        session = auth()
      session.login()
      let release!: () => void
      router.beforeEach((to) =>
        to.params.id === 'slow'
          ? new Promise<void>((resolve) => {
              release = resolve
            })
          : undefined,
      )
      const handle = pending(
        router.suspendIntent(request('slow'), { ...session.policy, maxAge: 10000 }),
      )
      const result = handle.resume()
      await settle()
      const original = frame().currentPage
      if (action === 'logout') session.logout()
      if (action === 'revoke') session.revoke()
      if (action === 'cancel') handle.cancel()
      if (action === 'supersede') {
        const next = pending(router.suspendIntent(request('new'), session.policy))
        next.cancel()
      }
      if (action === 'expire')
        vi.spyOn(Date, 'now').mockReturnValue(handle.intent.expiresAt! + 1)
      if (action === 'remove') router.removeRoute('private')
      release()
      expect(await result).toMatchObject({
        status: 'handled',
        failure: { type: NavigationFailureType.cancelled },
      })
      expect(frame().currentPage).toBe(original)
      expect(paths(router.stack.value)).toEqual(['/'])
    },
  )

  it('carries admission checks through guard redirects and checks the redirected destination permission', async () => {
    const { router } = await mount(routes),
      session = auth()
    session.login()
    router.beforeEach((to) => (to.path === '/private/1' ? '/other' : undefined))
    const permission = vi.fn((to: { path: string }) => to.path !== '/other')
    const handle = pending(
      router.suspendIntent(request(), { ...session.policy, authorize: permission }),
    )
    expect(await handle.resume()).toMatchObject({
      status: 'handled',
      failure: { type: NavigationFailureType.cancelled },
    })
    expect(permission.mock.calls.some(([to]) => to.path === '/other')).toBe(true)
    expect(paths(router.stack.value)).toEqual(['/'])
  })

  it('rechecks the session after lazy code resolves without allocating its Page', async () => {
    let release!: (value: ReturnType<typeof page>) => void
    const { router, frame } = await mount([
      ...routes,
      {
        path: '/lazy',
        component: () =>
          new Promise<ReturnType<typeof page>>((resolve) => {
            release = resolve
          }),
      },
    ])
    const session = auth()
    session.login()
    const handle = pending(
      router.suspendIntent(
        { ...request(), destination: { route: '/lazy' } },
        session.policy,
      ),
    )
    const original = frame().currentPage,
      attempt = handle.resume()
    await settle()
    session.logout()
    release(page('Lazy'))
    expect(await attempt).toMatchObject({
      status: 'handled',
      failure: { type: NavigationFailureType.cancelled },
    })
    expect(frame().currentPage).toBe(original)
    expect(paths(router.stack.value)).toEqual(['/'])
  })

  it('still runs normal guards and keeps their failures and errors observable once', async () => {
    const { router } = await mount(routes),
      session = auth()
    session.login()
    router.beforeEach((to) => {
      if (to.params.id === 'blocked') return false
      if (to.params.id === 'throw') throw new Error('guard error')
    })
    const blocked = pending(router.suspendIntent(request('blocked'), session.policy))
    expect(await blocked.resume()).toMatchObject({
      status: 'handled',
      failure: { type: NavigationFailureType.aborted },
    })
    const errors = vi.fn()
    router.onError(errors)
    const broken = pending(router.suspendIntent(request('throw'), session.policy))
    const result = broken.resume()
    await expect(result).rejects.toThrow('guard error')
    expect(broken.resume()).toBe(result)
    expect(errors).toHaveBeenCalledOnce()
    expect(broken.state.value.status).toBe('settled')
  })

  it('invalidates pending and cold-start resumptions on router closure', async () => {
    const warm = await mount(routes),
      session = auth()
    const pendingLogin = pending(warm.router.suspendIntent(request(), session.policy))
    warm.app.unmount()
    session.login()
    expect(await pendingLogin.resume()).toEqual({
      status: 'ignored',
      reason: 'owner-closed',
    })
    resetNative()
    const router = createRouter({ routes }),
      app = createApp({ render: () => h('GridLayout') }).use(router)
    app.start()
    const cold = pending(router.suspendIntent(request(), session.policy)),
      result = cold.resume()
    await settle()
    app.unmount()
    expect(await result).toEqual({ status: 'ignored', reason: 'owner-closed' })
  })

  it('rejects async or throwing policies without unhandled rejections and keeps diagnostic data redacted', async () => {
    const { router } = await mount(routes, { diagnostics: true }),
      session = auth()
    expect(
      router.suspendIntent(request(), {
        ...session.policy,
        scope: (() => Promise.reject(new Error('async scope'))) as any,
      }),
    ).toEqual({ status: 'ignored', reason: 'unauthorized' })
    const handle = pending(
      router.suspendIntent(
        request('secret-id', {
          source: 'secret-source',
          delivery: { scope: 'secret-account', id: 'secret-delivery' },
        }),
        {
          ...session.policy,
          authorize: (async () => {
            throw new Error('secret-permission')
          }) as any,
        },
      ),
    )
    expect(await handle.resume()).toEqual({ status: 'ignored', reason: 'unauthorized' })
    handle.cancel()
    await settle()
    expect(router.diagnostics!.export()).not.toContain('secret-')
  })
})
