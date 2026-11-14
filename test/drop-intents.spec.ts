import { createApp, h } from 'nativescript-vue'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createRouter, RouterView, type Router } from '../src/index.js'
import {
  createDropPolicy,
  destinationType,
  type DropOwner,
  type DropItem,
} from '../examples/drag-drop/policy.js'
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
const payload = () =>
  JSON.stringify({
    version: 1,
    destination: { route: { name: 'document', params: { id: 7 } } },
  })
function item(json = payload(), type = destinationType) {
  const cancel = vi.fn(),
    load = vi.fn(() => ({ value: Promise.resolve(json), cancel }))
  return { type, load, cancel }
}
function setup(ready = true) {
  const window = new NativeWindow('target')
  const router = createRouter({
    window,
    routes: [
      { path: '/', component: page('Home') },
      { path: '/documents/:id', name: 'document', component: page('Document') },
    ],
  }) as unknown as Router
  const app = createApp({ render: () => h(RouterView) }).use(router)
  const owner: DropOwner = {
    router,
    scope: 'account:a',
    windowId: 'target',
    frame: 'default',
  }
  let current: DropOwner | undefined = owner
  const authorize = vi.fn(() => true),
    stage = vi.fn()
  const policy = createDropPolicy({ owner: () => current, authorize, stage })
  const start = () => window.setContent(app.start()!.$el.nativeView)
  cleanups.push(() => app.unmount(), policy.dispose)
  if (ready) start()
  return {
    window,
    router,
    owner,
    policy,
    authorize,
    stage,
    start,
    replace: () => {
      current = { ...owner }
    },
    remove: () => {
      current = undefined
    },
  }
}
it('hover only inspects metadata; a typed async drop targets the registered owner with normal guards', async () => {
  const s = setup(),
    provider = item()
  await s.router.isReady()
  const guard = vi.fn()
  s.router.beforeEach(guard)
  expect(s.policy.accepts([destinationType])).toBe(true)
  expect(provider.load).not.toHaveBeenCalled()
  expect(paths(s.router.stack.value)).toEqual(['/'])
  const result = await s.policy.drop('native:1', [provider])
  expect(result).toMatchObject({
    status: 'settled',
    intent: {
      source: 'drag-drop',
      target: { windowId: 'target', frame: 'default' },
      delivery: { scope: 'account:a', id: 'native:1' },
    },
    navigation: { status: 'handled' },
  })
  expect(guard).toHaveBeenCalledOnce()
  expect(paths(s.router.stack.value)).toEqual(['/', '/documents/7'])
  expect(s.stage.mock.calls).toEqual([
    ['accepted', 'native:1'],
    ['loaded', 'native:1'],
  ])
})
it('distinguishes duplicate delivery from a new drop and an accessible internal command', async () => {
  const s = setup()
  await s.router.isReady()
  await s.policy.drop('one', [item()])
  const replay = item()
  expect(await s.policy.drop('one', [replay])).toEqual({
    status: 'ignored',
    reason: 'repeat',
  })
  expect(replay.load).not.toHaveBeenCalled()
  expect(await s.policy.drop('two', [item()])).toMatchObject({
    status: 'settled',
    navigation: { failure: { type: 16 } },
  })
  expect(await s.policy.drop('command', [item()], 'internal')).toMatchObject({
    intent: { source: 'internal' },
  })
})
it('rejects multi-item and unsupported transfers without loading or moving anything', async () => {
  const s = setup(),
    a = item(),
    b = item()
  await s.router.isReady()
  expect(s.policy.accepts([destinationType, destinationType])).toBe(false)
  expect(await s.policy.drop('multi', [a, b])).toEqual({
    status: 'ignored',
    reason: 'multiple-items',
  })
  expect(await s.policy.drop('other', [item('{}', 'public.text')])).toEqual({
    status: 'ignored',
    reason: 'unsupported-type',
  })
  expect(a.load).not.toHaveBeenCalled()
  expect(b.load).not.toHaveBeenCalled()
  expect(paths(s.router.stack.value)).toEqual(['/'])
})
it.each([
  ['{broken', 'invalid'],
  [JSON.stringify({ version: 2, destination: { url: '/documents/7' } }), 'version'],
  [JSON.stringify({ version: 1, destination: { route: '/gone' } }), 'unmatched'],
  [
    JSON.stringify({ version: 1, destination: { route: '/documents/7' }, expiresAt: 1 }),
    'expired',
  ],
  [
    JSON.stringify({
      version: 1,
      destination: { route: '/documents/7' },
      target: { frame: 'source' },
    }),
    'invalid',
  ],
  [' '.repeat(8193), 'invalid'],
  [
    JSON.stringify({ version: 1, destination: { route: '/' + '界'.repeat(3000) } }),
    'invalid',
  ],
])('rejects untrusted payload %s as %s', async (json, reason) => {
  const s = setup()
  await s.router.isReady()
  expect(await s.policy.drop('one', [item(json)])).toEqual({ status: 'ignored', reason })
  expect(paths(s.router.stack.value)).toEqual(['/'])
})
it.each(['dispose', 'replace', 'account', 'frame', 'close', 'remove'] as const)(
  'invalidates a slow provider after %s',
  async (change) => {
    const s = setup()
    await s.router.isReady()
    let deliver!: (s: string) => void
    const cancel = vi.fn()
    const pending = s.policy.drop('one', [
      {
        type: destinationType,
        load: () => ({
          value: new Promise((resolve) => {
            deliver = resolve
          }),
          cancel,
        }),
      },
    ])
    if (change === 'dispose') s.policy.dispose()
    if (change === 'replace') s.replace()
    if (change === 'account') s.owner.scope = 'account:b'
    if (change === 'frame') s.owner.frame = 'other'
    if (change === 'close') s.window.close()
    if (change === 'remove') s.remove()
    deliver(payload())
    expect((await pending).status).toBe('ignored')
    expect(s.authorize).not.toHaveBeenCalled()
    expect(cancel).toHaveBeenCalledOnce()
  },
)
it('limits pending providers and times out an unavailable data source', async () => {
  const s = setup()
  await s.router.isReady()
  vi.useFakeTimers()
  const cancel = vi.fn()
  const pending = s.policy.drop('one', [
    {
      type: destinationType,
      load: () => ({ value: new Promise<string>(() => {}), cancel }),
    },
  ])
  expect(await s.policy.drop('two', [item()])).toEqual({
    status: 'ignored',
    reason: 'busy',
  })
  expect(s.policy.accepts([destinationType])).toBe(false)
  await vi.advanceTimersByTimeAsync(10001)
  expect(await pending).toEqual({ status: 'ignored', reason: 'timeout' })
  expect(cancel).toHaveBeenCalledOnce()
  expect(s.policy.accepts([destinationType])).toBe(true)
})
it('rechecks route removal and permission after asynchronous transfer', async () => {
  const s = setup()
  await s.router.isReady()
  s.authorize.mockReturnValue(false)
  expect(await s.policy.drop('private', [item()])).toEqual({
    status: 'ignored',
    reason: 'unauthorized',
  })
  s.authorize.mockReturnValue(true)
  let deliver!: (s: string) => void
  const pending = s.policy.drop('removed', [
    {
      type: destinationType,
      load: () => ({
        value: new Promise((resolve) => {
          deliver = resolve
        }),
        cancel() {},
      }),
    },
  ])
  s.router.removeRoute('document')
  deliver(payload())
  expect(await pending).toEqual({ status: 'ignored', reason: 'unmatched' })
})
it('reports accepted transfer separately from guard refusal and releases provider errors', async () => {
  const s = setup()
  await s.router.isReady()
  s.router.beforeEach(() => false)
  expect(await s.policy.drop('guard', [item()])).toMatchObject({
    status: 'settled',
    navigation: { status: 'handled', failure: { type: 4 } },
  })
  expect(paths(s.router.stack.value)).toEqual(['/'])
  const bad: DropItem = {
    type: destinationType,
    load: () => ({ value: Promise.reject(new Error('provider failed')), cancel() {} }),
  }
  expect(await s.policy.drop('bad', [bad])).toEqual({
    status: 'ignored',
    reason: 'provider-error',
  })
  expect(s.policy.accepts([destinationType])).toBe(true)
})
it('waits for router readiness and disposes before a delayed host can navigate', async () => {
  const s = setup(false)
  const pending = s.policy.drop('one', [item()])
  await settle()
  s.policy.dispose()
  expect(await pending).toEqual({ status: 'ignored', reason: 'disposed' })
  s.start()
  await s.router.isReady()
  expect(paths(s.router.stack.value)).toEqual(['/'])
})
