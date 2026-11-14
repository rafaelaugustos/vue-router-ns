import { createApp, h } from 'nativescript-vue'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  createRouter,
  RouterView,
  NavigationFailureType,
  type Router,
  type SuspendedIntent,
} from '../src/index.js'
import {
  createDropPolicy,
  destinationType,
  type DropOwner,
} from '../examples/drag-drop/policy.js'
import { createDropLogin } from '../examples/drag-drop/login.js'
import { NativeWindow, resetNative, setPlatform } from './shims/core.js'
import { page, paths, settle } from './helpers.js'

const cleanups: (() => void)[] = []
beforeEach(() => {
  resetNative()
  setPlatform('ios')
})
afterEach(() => {
  cleanups
    .splice(0)
    .reverse()
    .forEach((f) => f())
  vi.useRealTimers()
})
const item = (id = 7) => ({
  type: destinationType,
  load: vi.fn(() => ({
    value: Promise.resolve(
      JSON.stringify({
        version: 1,
        destination: { route: { name: 'document', params: { id } } },
      }),
    ),
    cancel: vi.fn(),
  })),
})
async function setup(maxAge?: number) {
  const window = new NativeWindow('drop-login')
  const router = createRouter({
    window,
    routes: [
      { path: '/', component: page('Inbox') },
      { path: '/login', component: page('Login') },
      { path: '/documents/:id', name: 'document', component: page('Document') },
    ],
  }) as unknown as Router
  const app = createApp({ render: () => h(RouterView) }).use(router)
  const owner: DropOwner = {
    router,
    scope: 'account:a',
    windowId: window.id,
    frame: 'default',
  }
  let current: DropOwner | undefined = owner
  const state = { session: {} as object, signedIn: false, permitted: true }
  const presentLogin = vi.fn(async (_owner: DropOwner, _request: SuspendedIntent) => {
    if (router.currentRoute.value.path === '/login') return
    const failure = await router.push('/login')
    if (failure) throw new Error('Login presentation refused')
  })
  const login = createDropLogin({
    owner: () => current,
    session: () => state.session,
    authenticated: () => state.signedIn,
    authorize: () => state.permitted,
    presentLogin,
    maxAge,
  })
  const admit = vi.fn(() => true)
  const policy = createDropPolicy({
    owner: () => current,
    authorize: admit,
    handoff: login.handoff,
  })
  window.setContent(app.start()!.$el.nativeView)
  await router.isReady()
  cleanups.push(() => app.unmount(), login.dispose, policy.dispose)
  const drop = (id = 'one', document = 7) => policy.drop(id, [item(document)])
  const suspended = async (id = 'one', document = 7) => {
    const result = await drop(id, document)
    expect(result.status).toBe('settled')
    if (result.status !== 'settled' || result.navigation.status !== 'suspended')
      throw new Error(JSON.stringify(result))
    return result.navigation
  }
  return {
    window,
    router,
    owner,
    state,
    presentLogin,
    login,
    policy,
    admit,
    drop,
    suspended,
    replace: () => {
      current = { ...owner }
    },
    remove: () => {
      current = undefined
    },
  }
}
it('hands a validated async drop to login without consuming its identity, then replaces login once through normal guards', async () => {
  const s = await setup(),
    guard = vi.fn()
  s.router.beforeEach((to) => {
    if (to.name === 'document') guard()
  })
  const handle = await s.suspended()
  expect(paths(s.router.stack.value)).toEqual(['/', '/login'])
  expect(guard).not.toHaveBeenCalled()
  expect(handle.intent).toMatchObject({
    source: 'drag-drop',
    delivery: { scope: 'account:a', id: 'one' },
    target: { windowId: 'drop-login', frame: 'default' },
    options: { replace: true },
  })
  expect(await handle.resume()).toEqual({ status: 'ignored', reason: 'unauthorized' })
  expect(handle.state.value.status).toBe('pending')
  const repeated = item()
  expect(await s.policy.drop('one', [repeated])).toEqual({
    status: 'ignored',
    reason: 'repeat',
  })
  expect(repeated.load).not.toHaveBeenCalled()
  expect(s.presentLogin).toHaveBeenCalledOnce()
  s.state.signedIn = true
  const attempt = handle.resume()
  expect(handle.resume()).toBe(attempt)
  expect(await attempt).toMatchObject({ status: 'handled', failure: undefined })
  expect(paths(s.router.stack.value)).toEqual(['/', '/documents/7'])
  expect(guard).toHaveBeenCalledOnce()
  expect(handle.resume()).toBe(attempt)
  expect(s.login.pending).toBeUndefined()
})
it('uses the same admission checks for an already authenticated internal command without replacing Inbox', async () => {
  const s = await setup()
  s.state.signedIn = true
  expect(await s.policy.drop('command', [item()], 'internal')).toMatchObject({
    status: 'settled',
    navigation: { status: 'handled', intent: { source: 'internal' } },
  })
  expect(s.presentLogin).not.toHaveBeenCalled()
  expect(paths(s.router.stack.value)).toEqual(['/', '/documents/7'])
})
it('refuses admission and signed-in permission denial without displaying login', async () => {
  const s = await setup()
  s.admit.mockReturnValue(false)
  expect(await s.drop()).toEqual({ status: 'ignored', reason: 'unauthorized' })
  s.admit.mockReturnValue(true)
  s.state.signedIn = true
  s.state.permitted = false
  expect(await s.drop('two')).toMatchObject({
    status: 'settled',
    navigation: { status: 'ignored', reason: 'unauthorized' },
  })
  expect(s.presentLogin).not.toHaveBeenCalled()
  expect(paths(s.router.stack.value)).toEqual(['/'])
})
it.each([
  'cancel',
  'dispose',
  'account',
  'registration',
  'frame',
  'scope',
  'router',
  'remove',
] as const)('rejects a stale login completion after %s', async (change) => {
  const s = await setup(),
    handle = await s.suspended()
  if (change === 'cancel') s.login.cancel()
  if (change === 'dispose') s.login.dispose()
  if (change === 'account') s.state.session = {}
  if (change === 'registration') s.replace()
  if (change === 'frame') s.owner.frame = 'other'
  if (change === 'scope') s.owner.scope = 'account:b'
  if (change === 'router') s.owner.router = { ...s.router }
  if (change === 'remove') s.remove()
  s.state.signedIn = true
  expect(await handle.resume()).toEqual({
    status: 'ignored',
    reason: ['cancel', 'dispose'].includes(change) ? 'cancelled' : 'scope-changed',
  })
  expect(paths(s.router.stack.value)).toEqual(['/', '/login'])
})
it('supersedes the old delivery while retaining only one login Page', async () => {
  const s = await setup(),
    old = await s.suspended(),
    current = await s.suspended('two', 8)
  expect(paths(s.router.stack.value)).toEqual(['/', '/login'])
  s.state.signedIn = true
  expect(await old.resume()).toEqual({ status: 'ignored', reason: 'superseded' })
  await current.resume()
  expect(paths(s.router.stack.value)).toEqual(['/', '/documents/8'])
})
it('re-resolves a removed destination after login and expires an abandoned request', async () => {
  const s = await setup(),
    handle = await s.suspended()
  s.router.removeRoute('document')
  s.state.signedIn = true
  expect(await handle.resume()).toEqual({ status: 'ignored', reason: 'unmatched' })
  const other = await setup(10000)
  vi.useFakeTimers({ toFake: ['Date'] })
  const expired = await other.suspended()
  vi.setSystemTime(Date.now() + 10001)
  other.state.signedIn = true
  expect(await expired.resume()).toEqual({ status: 'ignored', reason: 'expired' })
  expect(paths(other.router.stack.value)).toEqual(['/', '/login'])
})
it.each(['logout', 'permission', 'dispose'] as const)(
  'blocks a protected Page when %s happens during an asynchronous guard',
  async (change) => {
    const s = await setup(),
      handle = await s.suspended()
    let release!: () => void
    s.router.beforeEach((to) => {
      if (to.name === 'document')
        return new Promise<void>((resolve) => {
          release = resolve
        })
    })
    s.state.signedIn = true
    const attempt = handle.resume()
    await settle()
    expect(release).toBeTypeOf('function')
    if (change === 'logout') {
      s.state.signedIn = false
      s.state.session = {}
    }
    if (change === 'permission') s.state.permitted = false
    if (change === 'dispose') s.login.dispose()
    release()
    expect(await attempt).toMatchObject({
      status: 'handled',
      failure: { type: NavigationFailureType.cancelled },
    })
    expect(paths(s.router.stack.value)).toEqual(['/', '/login'])
  },
)
it('cancels a reserved request when login presentation rejects or the owner changes during it', async () => {
  const s = await setup()
  let handle!: SuspendedIntent
  s.presentLogin.mockImplementationOnce(async (_owner, request) => {
    handle = request
    throw new Error('no login')
  })
  await expect(s.drop()).rejects.toThrow('no login')
  s.state.signedIn = true
  expect(await handle.resume()).toEqual({ status: 'ignored', reason: 'cancelled' })
  s.state.signedIn = false
  s.presentLogin.mockImplementationOnce(async (_owner, request) => {
    handle = request
    s.replace()
  })
  expect(await s.drop('two')).toMatchObject({
    navigation: { status: 'ignored', reason: 'cancelled' },
  })
  s.state.signedIn = true
  expect(await handle.resume()).toEqual({ status: 'ignored', reason: 'cancelled' })
})
it('freezes router ownership across an asynchronous provider before calling the handoff', async () => {
  const s = await setup()
  let deliver!: (value: string) => void
  const wait = s.policy.drop('one', [
    {
      type: destinationType,
      load: () => ({
        value: new Promise<string>((resolve) => {
          deliver = resolve
        }),
        cancel() {},
      }),
    },
  ])
  s.owner.router = { ...s.router }
  deliver(JSON.stringify({ version: 1, destination: { route: '/documents/7' } }))
  expect(await wait).toEqual({ status: 'ignored', reason: 'owner-changed' })
  expect(s.presentLogin).not.toHaveBeenCalled()
})
it('lets the app cancel a pending continuation when Back leaves Login', async () => {
  const s = await setup(),
    handle = await s.suspended()
  s.router.beforeEach((to, from) => {
    if (
      from.path === '/login' &&
      to.path === '/' &&
      handle.state.value.status === 'pending'
    )
      s.login.cancel()
  })
  await s.router.back()
  s.state.signedIn = true
  expect(await handle.resume()).toEqual({ status: 'ignored', reason: 'cancelled' })
  expect(paths(s.router.stack.value)).toEqual(['/'])
})
