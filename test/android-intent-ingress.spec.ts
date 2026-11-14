import { createApp, h } from 'nativescript-vue'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  createRouter,
  RouterView,
  type Router,
  type SuspendedIntent,
} from '../src/index.js'
import {
  installAndroidIntentIngress,
  type AndroidEntryOwner,
  type AndroidEntryReceipt,
} from '../examples/intent-entrypoints/android.js'
import { Application, NativeWindow, resetNative, setPlatform } from './shims/core.js'
import { page, paths, settle } from './helpers.js'

const cleanup: (() => void)[] = []
beforeEach(() => {
  resetNative()
  setPlatform('android')
})
afterEach(() => {
  cleanup
    .splice(0)
    .reverse()
    .forEach((stop) => stop())
  vi.useRealTimers()
})
function setup(ready = true, receive?: (receipt: AndroidEntryReceipt) => Promise<void>) {
  const window = new NativeWindow('a')
  const router = createRouter({
    window,
    links: { system: false, schemes: ['routerentries'] },
    routes: [
      { path: '/', component: page('Home') },
      { path: '/login', component: page('Login') },
      { path: '/messages/:id', name: 'message', component: page('Message') },
    ],
  }) as unknown as Router
  const app = createApp({ render: () => h(RouterView) }).use(router)
  const owner: AndroidEntryOwner = { router, scope: 'account:a', frame: 'default' }
  let current: AndroidEntryOwner | undefined = owner,
    count = 0
  const received: AndroidEntryReceipt[] = [],
    error = vi.fn()
  const stop = installAndroidIntentIngress({
    owner: (id) => (id === 'a' ? current : undefined),
    notification: { action: 'app.OPEN', extra: 'navigation' },
    nextId: () => `action:${++count}`,
    error,
    receive: async (receipt) => {
      received.push(receipt)
      await receive?.(receipt)
    },
  })
  cleanup.push(() => app.unmount(), stop)
  const start = () => window.setContent(app.start()!.$el.nativeView)
  if (ready) start()
  return {
    window,
    router,
    owner,
    received,
    error,
    stop,
    start,
    replace: () => {
      current = { ...owner }
    },
    count: () => count,
  }
}
function nativeIntent(
  href = 'routerentries://messages/7',
  flags = 0,
  action = 'android.intent.action.VIEW',
  json?: string,
) {
  return {
    getAction: () => action,
    getFlags: () => flags,
    getData: () => ({ toString: () => href }),
    getStringExtra: () => json,
  }
}
function warm(intent = nativeIntent(), windowId = 'a') {
  Application.android.notify({
    eventName: 'activityNewIntent',
    window: { id: windowId },
    intent,
  })
}
function cold(intent = nativeIntent(), savedInstanceState?: unknown) {
  const activity = {},
    window = { id: 'a' }
  Application.android.notify({ eventName: 'activityCreated', activity, window })
  Application.android.notify({ eventName: 'activityNewIntent', activity, window, intent })
  Application.notify({
    eventName: Application.launchEvent,
    activity,
    intent,
    savedInstanceState,
  })
}
it('consumes a cold Core launch once, after readiness, without holding its mutable native Intent', async () => {
  const s = setup(false)
  const intent = nativeIntent()
  cold(intent)
  intent.getData = () => ({ toString: () => '/login' })
  await settle()
  expect(s.received).toHaveLength(0)
  s.start()
  await s.router.isReady()
  await settle()
  expect(s.received).toHaveLength(1)
  expect(s.received[0]!.request).toMatchObject({
    source: 'url',
    delivery: { scope: 'account:a', id: 'action:1' },
    target: { windowId: 'a', frame: 'default' },
  })
  expect(s.router.resolveIntent(s.received[0]!.request)).toMatchObject({
    location: { path: '/messages/7' },
  })
  expect(Object.isFrozen(s.received[0]!.request)).toBe(true)
})
it('does not replay recreation, Recents history, MAIN or foreign-window deliveries', async () => {
  const s = setup()
  await s.router.isReady()
  cold(nativeIntent(), {})
  cold(nativeIntent(undefined, 0x00100000))
  warm(nativeIntent(undefined, 0x00100000))
  warm(nativeIntent(undefined, 0, 'android.intent.action.MAIN'))
  warm(nativeIntent(), 'foreign')
  await settle()
  expect(s.received).toHaveLength(0)
  warm()
  await settle()
  expect(s.received).toHaveLength(1)
})
it.each(['different-intent', 'later-turn'] as const)(
  'does not lend a captured cold window to a %s launch',
  async (change) => {
    const s = setup()
    await s.router.isReady()
    const activity = {},
      intent = nativeIntent()
    Application.android.notify({ eventName: 'activityCreated', activity })
    Application.android.notify({
      eventName: 'activityNewIntent',
      activity,
      intent,
      window: { id: 'a' },
    })
    if (change === 'later-turn') await settle()
    Application.notify({
      eventName: Application.launchEvent,
      intent: change === 'different-intent' ? nativeIntent() : intent,
    })
    await settle()
    expect(s.received).toHaveLength(0)
    expect(s.count()).toBe(0)
  },
)
it('drops a warm action when its native owner closes before handoff', async () => {
  const s = setup()
  await s.router.isReady()
  warm()
  s.window.close()
  await settle()
  expect(s.received).toHaveLength(0)
})
it('normalizes all three native transports through ordinary guards and current named routes', async () => {
  const s = setup(true, async ({ owner, request }) => {
    await owner.router.openIntent(request)
  })
  await s.router.isReady()
  const guard = vi.fn(() => false)
  s.router.beforeEach(guard)
  const shortcut = s.router.shortcutURL('message', { name: 'message', params: { id: 7 } })
  s.router.removeRoute('message')
  s.router.addRoute({
    path: '/articles/:id',
    name: 'message',
    component: page('Article'),
  })
  warm(nativeIntent('routerentries://articles/7'))
  await settle()
  warm(nativeIntent(shortcut))
  await settle()
  warm(
    nativeIntent(
      undefined,
      0,
      'app.OPEN',
      JSON.stringify({
        version: 1,
        destination: { route: { name: 'message', params: { id: 7 } } },
      }),
    ),
  )
  await settle()
  expect(s.received.map((r) => r.source)).toEqual(['url', 'shortcut', 'notification'])
  expect(s.received.map((r) => s.router.resolveIntent(r.request))).toEqual(
    Array(3).fill(
      expect.objectContaining({
        location: expect.objectContaining({ path: '/articles/7' }),
      }),
    ),
  )
  expect(guard).toHaveBeenCalledTimes(3)
  expect(paths(s.router.stack.value)).toEqual(['/'])
})
it.each([
  ['{broken', 'invalid'],
  ['x'.repeat(8193), 'invalid'],
  [JSON.stringify({ version: 2, destination: { url: '/messages/7' } }), 'version'],
  [
    JSON.stringify({ version: 1, destination: { url: '/messages/7' }, expiresAt: 1 }),
    'expired',
  ],
  [JSON.stringify({ version: 1, destination: { url: '/gone' } }), 'unmatched'],
  [
    JSON.stringify({
      version: 1,
      destination: { url: '/messages/7' },
      target: { windowId: 'b' },
    }),
    'invalid',
  ],
])('rejects notification payload %s with %s before navigation', async (json, reason) => {
  const s = setup()
  await s.router.isReady()
  warm(nativeIntent(undefined, 0, 'app.OPEN', json))
  await settle()
  expect(s.received[0]!.request).toEqual({ status: 'ignored', reason })
  expect(paths(s.router.stack.value)).toEqual(['/'])
})
it('resumes one captured receipt after login and gives intentional repeats new delivery ids', async () => {
  let signedIn = false,
    handle: SuspendedIntent | undefined
  const scope = {}
  const s = setup(true, async ({ owner, request }) => {
    if (signedIn) {
      await owner.router.openIntent(request)
      return
    }
    const pending = owner.router.suspendIntent(request, {
      scope: () => scope,
      authorize: () => signedIn,
    })
    expect(pending.status).toBe('suspended')
    handle = pending as SuspendedIntent
    await owner.router.push('/login')
  })
  await s.router.isReady()
  s.router.beforeEach((to) => (to.name === 'message' && !signedIn ? false : undefined))
  warm()
  await settle()
  signedIn = true
  const resumed = handle!.resume()
  expect(handle!.resume()).toBe(resumed)
  await resumed
  expect(paths(s.router.stack.value)).toEqual(['/', '/messages/7'])
  expect(await s.router.openIntent(s.received[0]!.request)).toEqual({
    status: 'ignored',
    reason: 'repeat',
  })
  warm()
  await settle()
  expect(s.received[1]!.request).toMatchObject({ delivery: { id: 'action:2' } })
})
it.each(['dispose', 'replace', 'scope', 'close'] as const)(
  'drops delayed Android receipts after %s',
  async (change) => {
    const s = setup(false)
    warm()
    if (change === 'dispose') s.stop()
    if (change === 'replace') s.replace()
    if (change === 'scope') s.owner.scope = 'account:b'
    if (change === 'close') s.window.close()
    else {
      s.start()
      await s.router.isReady()
    }
    await settle()
    expect(s.received).toHaveLength(0)
  },
)
it('bounds waiting receipts and expires a missing host', async () => {
  vi.useFakeTimers()
  const s = setup(false)
  for (let i = 0; i < 17; i++) warm()
  expect(s.count()).toBe(16)
  await vi.advanceTimersByTimeAsync(15001)
  expect(s.error).toHaveBeenCalledTimes(16)
  warm()
  expect(s.count()).toBe(17)
  s.stop()
})
