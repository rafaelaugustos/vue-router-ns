import { createApp, h } from 'nativescript-vue'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  createRouter,
  RouterView,
  NavigationFailureType,
  type Router,
  type RouteLocation,
  type NavigationIntent,
} from '../src/index.js'
import {
  createWindowDropOffers,
  type ClaimedWindowDrop,
  type WindowDropOffer,
} from '../examples/drag-drop/new-window.js'
import type { DropOwner } from '../examples/drag-drop/policy.js'
import { NativeWindow, resetNative, setPlatform } from './shims/core.js'
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
    .forEach((fn) => fn())
  vi.useRealTimers()
  vi.restoreAllMocks()
})
function host(id: string, ready = true) {
  const window = new NativeWindow(id)
  const router = createRouter({
    window,
    routes: [
      { path: '/', component: page('Root') },
      { path: '/documents/:id', name: 'document', component: page('Document') },
      { path: '/private', component: page('Private') },
    ],
  }) as unknown as Router
  const app = createApp({ render: () => h(RouterView, { name: 'main' }) }).use(router)
  const owner: DropOwner = { router, scope: 'account:a', windowId: id, frame: 'main' }
  let current: DropOwner | undefined = owner
  const start = () => window.setContent(app.start()!.$el.nativeView)
  cleanup.push(() => app.unmount())
  if (ready) start()
  return {
    router,
    window,
    owner,
    start,
    current: () => current,
    replace: () => {
      current = { ...owner }
    },
    remove: () => {
      current = undefined
    },
  }
}
async function setup(ready = true, maxAge = 30000) {
  const source = host('source'),
    target = host('target', ready)
  await source.router.isReady()
  if (ready) await target.router.isReady()
  let identity: object | undefined = {},
    id = 0
  const authorize = vi.fn((_location: RouteLocation, _intent: NavigationIntent) => true),
    nextId = vi.fn(() => `action:${++id}`)
  const offers = createWindowDropOffers({
    owner: source.current,
    session: () => identity,
    authorize,
    nextId,
    maxAge,
  })
  cleanup.push(offers.dispose)
  const offer = (destination = { route: '/documents/7' }) => offers.offer(destination)
  const issue = () => {
    const offered = offer()
    expect(offered.status).toBe('offered')
    const grant = offers.take((offered as WindowDropOffer).data)
    expect(grant.status).toBe('claimed')
    return { offered: offered as WindowDropOffer, grant: grant as ClaimedWindowDrop }
  }
  return {
    source,
    target,
    offers,
    offer,
    issue,
    authorize,
    nextId,
    rotate: () => {
      identity = {}
    },
    signout: () => {
      identity = undefined
    },
  }
}
it('offers public correlation only; one actual new receiver consumes it and repeated delivery shares the Promise', async () => {
  const s = await setup(),
    sourceRoot = s.source.router.stack.value[0],
    targetRoot = s.target.router.stack.value[0]
  const guard = vi.fn()
  s.target.router.beforeEach(guard)
  const offered = s.offer() as WindowDropOffer
  expect(offered.data).toEqual({ version: 1, windowDrag: 'action:1' })
  expect(paths(s.source.router.stack.value)).toEqual(['/'])
  expect(paths(s.target.router.stack.value)).toEqual(['/'])
  const claim = s.offers.take(offered.data) as ClaimedWindowDrop
  expect(claim.origin).toEqual({ windowId: 'source', frame: 'main' })
  expect(s.offers.take(offered.data)).toEqual({ status: 'ignored', reason: 'repeat' })
  const first = claim.deliver(s.target.owner, s.target.current)
  expect(claim.deliver(s.target.owner, s.target.current)).toBe(first)
  expect(await first).toMatchObject({
    status: 'handled',
    intent: {
      source: 'drag-drop',
      delivery: { scope: 'account:a', id: 'action:1' },
      target: { windowId: 'target', frame: 'main' },
    },
  })
  expect(guard).toHaveBeenCalledOnce()
  expect(paths(s.target.router.stack.value)).toEqual(['/', '/documents/7'])
  expect(s.source.router.stack.value[0]).toBe(sourceRoot)
  expect(s.target.router.stack.value[0]).toBe(targetRoot)
  expect(s.offers.pending).toBe(0)
  expect(s.offers.take(offered.data)).toEqual({ status: 'ignored', reason: 'repeat' })
})
it('snapshots the destination before the native transfer', async () => {
  const s = await setup(),
    destination = { route: '/documents/7' }
  const offered = s.offer(destination) as WindowDropOffer
  destination.route = '/private'
  const claim = s.offers.take(offered.data) as ClaimedWindowDrop
  await claim.deliver(s.target.owner, s.target.current)
  expect(paths(s.target.router.stack.value)).toEqual(['/', '/documents/7'])
})
it.each([
  'cancel',
  'dispose',
  'account',
  'signout',
  'registration',
  'frame',
  'router',
  'closed',
  'removed',
  'permission',
] as const)('rejects a delayed native connection after %s', async (change) => {
  const s = await setup(),
    offered = s.offer() as WindowDropOffer
  if (change === 'cancel') offered.cancel()
  if (change === 'dispose') s.offers.dispose()
  if (change === 'account') s.rotate()
  if (change === 'signout') s.signout()
  if (change === 'registration') s.source.replace()
  if (change === 'frame') s.source.owner.frame = 'other'
  if (change === 'router') s.source.owner.router = s.target.router
  if (change === 'closed') s.source.window.close()
  if (change === 'removed') s.source.router.removeRoute('document')
  if (change === 'permission') s.authorize.mockReturnValue(false)
  expect(s.offers.take(offered.data).status).toBe('ignored')
  expect(s.offers.pending).toBe(0)
  expect(paths(s.target.router.stack.value)).toEqual(['/'])
})
it.each([
  null,
  [],
  {},
  { version: 2, windowDrag: 'action:1' },
  { version: 1, windowDrag: 7 },
  { version: 1, windowDrag: 'x'.repeat(129) },
  { version: 1, windowDrag: 'action:1', target: { frame: 'other' } },
])(
  'rejects malformed native activity data %# without consuming a valid offer',
  async (data) => {
    const s = await setup(),
      offered = s.offer() as WindowDropOffer
    expect(s.offers.take(data)).toEqual({ status: 'ignored', reason: 'invalid' })
    expect(s.offers.pending).toBe(1)
    expect(s.offers.take(offered.data).status).toBe('claimed')
  },
)
it('rejects unknown tokens, invalid destinations, unauthorized offers and reused action ids', async () => {
  const s = await setup()
  expect(s.offers.take({ version: 1, windowDrag: 'unknown' })).toEqual({
    status: 'ignored',
    reason: 'target-unavailable',
  })
  expect(s.offer({ route: '/missing' })).toMatchObject({
    status: 'ignored',
    reason: 'unmatched',
  })
  s.authorize.mockReturnValue(false)
  expect(s.offer()).toMatchObject({ status: 'ignored', reason: 'unauthorized' })
  s.authorize.mockReturnValue(true)
  s.nextId.mockReturnValue('fixed')
  const offer = s.offer() as WindowDropOffer
  expect(s.offer()).toMatchObject({ status: 'ignored', reason: 'invalid' })
  offer.cancel()
  expect(s.offer()).toMatchObject({ status: 'ignored', reason: 'invalid' })
})
it('bounds outstanding offers and expires claimed readiness waits without a late navigation', async () => {
  const s = await setup(false, 1000)
  vi.useFakeTimers()
  const { grant, offered } = s.issue()
  for (let i = 0; i < 7; i++) expect(s.offer().status).toBe('offered')
  expect(s.offer()).toEqual({ status: 'ignored', reason: 'busy' })
  const attempt = grant.deliver(s.target.owner, s.target.current)
  await vi.advanceTimersByTimeAsync(1001)
  expect(await attempt).toEqual({ status: 'ignored', reason: 'expired' })
  expect(s.offers.pending).toBe(0)
  expect(s.offers.take(offered.data)).toEqual({ status: 'ignored', reason: 'expired' })
  vi.useRealTimers()
  s.target.start()
  await s.target.router.isReady()
  expect(paths(s.target.router.stack.value)).toEqual(['/'])
})
it('cancels an accepted connection while the receiver is waiting to mount', async () => {
  const s = await setup(false),
    { grant } = s.issue()
  const attempt = grant.deliver(s.target.owner, s.target.current)
  await settle()
  grant.cancel()
  expect(await attempt).toEqual({ status: 'ignored', reason: 'cancelled' })
  s.target.start()
  await s.target.router.isReady()
  expect(paths(s.target.router.stack.value)).toEqual(['/'])
})
it.each(['frame', 'scope', 'registration', 'router', 'closed'] as const)(
  'freezes the receiving owner before asynchronous delivery: %s',
  async (change) => {
    const s = await setup(),
      { grant } = s.issue()
    const attempt = grant.deliver(s.target.owner, s.target.current)
    if (change === 'frame') s.target.owner.frame = 'other'
    if (change === 'scope') s.target.owner.scope = 'account:b'
    if (change === 'registration') s.target.replace()
    if (change === 'router') s.target.owner.router = s.source.router
    if (change === 'closed') s.target.window.close()
    expect((await attempt).status).toBe('ignored')
    expect(paths(s.source.router.stack.value)).toEqual(['/'])
  },
)
it('does not reuse the source window or rebind one claim to another owner', async () => {
  const s = await setup(),
    { grant } = s.issue()
  const attempt = grant.deliver(s.source.owner, s.source.current)
  expect(await grant.deliver(s.target.owner, s.target.current)).toEqual({
    status: 'ignored',
    reason: 'wrong-window',
  })
  expect(await attempt).toEqual({ status: 'ignored', reason: 'wrong-window' })
  expect(paths(s.source.router.stack.value)).toEqual(['/'])
})
it.each(['account', 'permission', 'dispose', 'close'] as const)(
  'rechecks admission through an asynchronous target guard after %s',
  async (change) => {
    const s = await setup(),
      { grant } = s.issue()
    let release!: (value?: boolean) => void
    s.target.router.beforeEach(
      () =>
        new Promise<boolean | undefined>((resolve) => {
          release = resolve
        }),
    )
    const attempt = grant.deliver(s.target.owner, s.target.current)
    await settle()
    expect(release).toBeTypeOf('function')
    if (change === 'account') s.rotate()
    if (change === 'permission') s.authorize.mockReturnValue(false)
    if (change === 'dispose') s.offers.dispose()
    if (change === 'close') s.source.window.close()
    release()
    expect(await attempt).toMatchObject({
      status: 'handled',
      failure: { type: NavigationFailureType.cancelled },
    })
    expect(paths(s.target.router.stack.value)).toEqual(['/'])
    expect(s.offers.pending).toBe(0)
  },
)
it('runs ordinary refusal guards and releases the claimed grant', async () => {
  const s = await setup()
  s.target.router.beforeEach(() => false)
  let { grant } = s.issue()
  expect(await grant.deliver(s.target.owner, s.target.current)).toMatchObject({
    status: 'handled',
    failure: { type: NavigationFailureType.aborted },
  })
  expect(s.offers.pending).toBe(0)
})

it('rechecks current permission for a guard redirect before the private Page is created', async () => {
  const s = await setup(),
    { grant } = s.issue()
  s.authorize.mockImplementation((location) => location.path !== '/private')
  s.target.router.beforeEach((to) =>
    to.path === '/documents/7' ? '/private' : undefined,
  )
  expect(await grant.deliver(s.target.owner, s.target.current)).toMatchObject({
    status: 'handled',
    failure: { type: NavigationFailureType.cancelled },
  })
  expect(paths(s.target.router.stack.value)).toEqual(['/'])
  expect(s.offers.pending).toBe(0)
})

it('fails closed for throwing or accidentally asynchronous permission callbacks', async () => {
  const s = await setup()
  s.authorize.mockImplementation(() => {
    throw new Error('permission failed')
  })
  expect(s.offer()).toMatchObject({ status: 'ignored', reason: 'unauthorized' })
  s.authorize.mockReturnValue(Promise.reject(new Error('async is unsupported')) as never)
  expect(s.offer()).toMatchObject({ status: 'ignored', reason: 'unauthorized' })
  await settle()
  expect(s.offers.pending).toBe(0)
})
