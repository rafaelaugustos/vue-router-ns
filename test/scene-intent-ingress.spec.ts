import { createApp, h } from 'nativescript-vue'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  createRouter,
  RouterView,
  type Router,
  type SuspendedIntent,
} from '../src/index.js'
import {
  installSceneIntentIngress,
  type EntryOwner,
  type EntryReceipt,
} from '../examples/intent-entrypoints/ios.js'
import { Application, NativeWindow, resetNative, setPlatform } from './shims/core.js'
import { page, paths, settle } from './helpers.js'

const cleanup: (() => void)[] = []
beforeEach(() => {
  resetNative()
  setPlatform('ios')
})
afterEach(() => {
  cleanup
    .splice(0)
    .reverse()
    .forEach((stop) => stop())
  vi.useRealTimers()
})
function setup(ready = true, receive?: (receipt: EntryReceipt) => Promise<void>) {
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
  const owner: EntryOwner = { router, scope: 'account:a', frame: 'default' }
  let current: EntryOwner | undefined = owner,
    count = 0
  const received: EntryReceipt[] = [],
    error = vi.fn()
  const stop = installSceneIntentIngress({
    owner: (id) => (id === 'a' ? current : undefined),
    activity: () => '/messages/7',
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
function shortcut(href: unknown, windowId = 'a') {
  const completion = vi.fn()
  Application.ios.notify({
    eventName: 'scenePerformActionForShortcutItem',
    window: { id: windowId },
    shortcutItem: { userInfo: { objectForKey: () => href } },
    completionHandler: completion,
  })
  return completion
}
function activity(type = 'com.apple.corespotlightitem') {
  Application.ios.notify({
    eventName: 'sceneContinueUserActivity',
    window: { id: 'a' },
    userActivity: {
      activityType: type,
      webpageURL: { absoluteString: 'routerentries://messages/7' },
    },
  })
}
it('acknowledges cold scene payloads before readiness and ignores legacy delegate forwarding', async () => {
  const s = setup(false)
  const url = s.router.shortcutURL('message', { name: 'message', params: { id: 7 } })
  const completion = shortcut(url)
  expect(completion).toHaveBeenCalledExactlyOnceWith(true)
  Application.ios.call(
    'applicationPerformActionForShortcutItemCompletionHandler',
    {},
    { userInfo: { url } },
    () => {},
  )
  await settle()
  expect(s.received).toHaveLength(0)
  s.start()
  await s.router.isReady()
  await settle()
  expect(s.received).toHaveLength(1)
  expect(s.received[0]!.request).toMatchObject({
    source: 'shortcut',
    target: { windowId: 'a', frame: 'default' },
    delivery: { scope: 'account:a', id: 'action:1' },
  })
  expect(Object.isFrozen(s.received[0]!.request)).toBe(true)
  expect(s.error).not.toHaveBeenCalled()
})
it('resolves real shortcut payloads, Spotlight mapping and web activities into the same guarded destination', async () => {
  const s = setup(true, async ({ owner, request }) => {
    await owner.router.openIntent(request)
  })
  await s.router.isReady()
  const guarded = vi.fn(() => false)
  s.router.beforeEach(guarded)
  shortcut(s.router.shortcutURL('message', { name: 'message', params: { id: 7 } }))
  await settle()
  activity()
  await settle()
  activity('NSUserActivityTypeBrowsingWeb')
  await settle()
  expect(
    s.received.map((r) => ('status' in r.request ? 'ignored' : r.request.source)),
  ).toEqual(['shortcut', 'spotlight', 'url'])
  expect(
    s.received.map((r) => {
      const resolved = s.router.resolveIntent(r.request)
      return resolved.status === 'resolved' ? resolved.location.path : resolved.reason
    }),
  ).toEqual(['/messages/7', '/messages/7', '/messages/7'])
  expect(guarded).toHaveBeenCalledTimes(3)
  expect(paths(s.router.stack.value)).toEqual(['/'])
})
it('keeps stable named shortcuts after path changes and reports removal without fallback', async () => {
  const s = setup()
  await s.router.isReady()
  const url = s.router.shortcutURL('message', { name: 'message', params: { id: 7 } })
  s.router.removeRoute('message')
  s.router.addRoute({
    path: '/articles/:id',
    name: 'message',
    component: page('Article'),
  })
  shortcut(url)
  await settle()
  expect(s.router.resolveIntent(s.received[0]!.request)).toMatchObject({
    location: { path: '/articles/7' },
  })
  s.router.removeRoute('message')
  shortcut(url)
  await settle()
  expect(s.received[1]!.request).toEqual({ status: 'ignored', reason: 'unmatched' })
})
it('uses fresh identities for intentional taps and reserves one receipt through login and replay', async () => {
  let authorized = false,
    handle: SuspendedIntent | undefined
  const scope = {}
  const s = setup(true, async ({ owner, request }) => {
    const pending = owner.router.suspendIntent(request, {
      scope: () => scope,
      authorize: () => authorized,
    })
    expect(pending.status).toBe('suspended')
    handle = pending as SuspendedIntent
    await owner.router.push('/login')
  })
  await s.router.isReady()
  s.router.beforeEach((to) =>
    to.path.startsWith('/messages') && !authorized ? false : undefined,
  )
  const url = s.router.shortcutURL('message', { name: 'message', params: { id: 7 } })
  shortcut(url)
  await settle()
  authorized = true
  const resume = handle!.resume()
  expect(handle!.resume()).toBe(resume)
  await resume
  expect(paths(s.router.stack.value)).toEqual(['/', '/messages/7'])
  expect(await s.router.openIntent(s.received[0]!.request)).toEqual({
    status: 'ignored',
    reason: 'repeat',
  })
  shortcut(url)
  await settle()
  expect(s.received[1]!.request).toMatchObject({ delivery: { id: 'action:2' } })
  expect(s.count()).toBe(2)
})
it.each(['dispose', 'replace', 'scope', 'close'] as const)(
  'does not hand off delayed work after %s',
  async (change) => {
    const s = setup(false)
    shortcut(s.router.shortcutURL('message', { name: 'message', params: { id: 7 } }))
    if (change === 'dispose') s.stop()
    if (change === 'replace') s.replace()
    if (change === 'scope') s.owner.scope = 'account:b'
    if (change === 'close') s.window.close()
    if (change !== 'close') {
      s.start()
      await s.router.isReady()
    }
    await settle()
    expect(s.received).toHaveLength(0)
  },
)
it('bounds waiting receipts, acknowledges saturation and times out a missing host', async () => {
  vi.useFakeTimers()
  const s = setup(false),
    url = s.router.shortcutURL('message', { name: 'message', params: { id: 7 } })
  for (let i = 0; i < 16; i++) expect(shortcut(url)).toHaveBeenCalledWith(true)
  expect(shortcut(url)).toHaveBeenCalledWith(false)
  await vi.advanceTimersByTimeAsync(15001)
  expect(s.error).toHaveBeenCalledTimes(16)
  expect(s.received).toHaveLength(0)
  expect(shortcut(url)).toHaveBeenCalledWith(true)
  s.stop()
})
it('rejects an owner closed after readiness without passing it to application navigation', async () => {
  const s = setup()
  await s.router.isReady()
  shortcut(s.router.shortcutURL('message', { name: 'message', params: { id: 7 } }))
  s.window.close()
  await settle()
  expect(s.received).toHaveLength(0)
})
it('rejects foreign windows, preserves other quick actions and validates malformed/oversized URLs', async () => {
  const s = setup()
  await s.router.isReady()
  expect(shortcut('another-sdk://action')).not.toHaveBeenCalled()
  expect(
    shortcut(s.router.shortcutURL('message', '/messages/7'), 'b'),
  ).toHaveBeenCalledWith(false)
  shortcut('vue-router-ns://shortcut/x?to=%ZZ&v=2')
  shortcut('vue-router-ns://' + 'x'.repeat(9000))
  await settle()
  expect(s.received.map((r) => r.request)).toEqual([
    { status: 'ignored', reason: 'invalid' },
    { status: 'ignored', reason: 'invalid' },
  ])
  expect(paths(s.router.stack.value)).toEqual(['/'])
})
