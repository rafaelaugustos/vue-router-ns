import { createApp, h, ref } from 'nativescript-vue'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  createRouter,
  RouterTabs,
  RouterTab,
  RouterView,
  type Router,
} from '../src/index.js'
import {
  createDropPolicy,
  destinationType,
  type DropOwner,
} from '../examples/drag-drop/policy.js'
import { page, settle } from './helpers.js'
import { Frame, NativeWindow, resetNative, setPlatform } from './shims/core.js'
import { views } from './shims/nativescript-vue.js'

const cleanup: (() => void)[] = []
beforeEach(() => {
  resetNative()
  setPlatform('ios')
})
afterEach(() =>
  cleanup
    .splice(0)
    .reverse()
    .forEach((stop) => stop()),
)
const payload = JSON.stringify({ version: 1, destination: { route: '/documents/7' } })
function item(value = Promise.resolve(payload)) {
  const cancel = vi.fn(),
    load = vi.fn(() => ({ value, cancel }))
  return { type: destinationType, load, cancel }
}
async function setup() {
  const selected = ref('source'),
    names = ['source', 'inbox', 'archive'] as const
  const window = new NativeWindow('sidebar-window')
  const router = createRouter({
    window,
    routes: [
      { path: '/source', component: page('Library') },
      { path: '/inbox', component: page('Inbox') },
      { path: '/archive', component: page('Archive') },
      { path: '/documents/:id', component: page('Document') },
    ],
  }) as unknown as Router
  const app = createApp({
    render: () =>
      h(
        RouterTabs,
        {
          selected: selected.value,
          'onUpdate:selected': (value: string) => {
            selected.value = value
          },
        },
        () =>
          names.map((name) =>
            h(RouterTab, { name, title: name }, () =>
              h(RouterView, { name, initial: `/${name}` }),
            ),
          ),
      ),
  }).use(router)
  window.setContent(app.start()!.$el.nativeView)
  await router.isReady()
  cleanup.push(() => app.unmount())
  await settle()
  const frames = (views.get('Frame') as Frame[]).slice(-3)
  const roots = frames.map((frame) => frame.currentPage)
  const rows = Object.fromEntries(
    ['inbox', 'archive'].map((name) => {
      const owner: DropOwner = {
        router,
        scope: 'session:a',
        windowId: router.window.value!.id,
        frame: name,
      }
      const authorize = vi.fn(() => true)
      const policy = createDropPolicy({ owner: () => owner, authorize })
      cleanup.push(policy.dispose)
      return [name, { owner, authorize, policy }]
    }),
  )
  const histories = () =>
    Object.fromEntries(
      names.map((name) => [
        name,
        router.getHistory({ frame: name })!.entries.map((e) => e.route.path),
      ]),
    )
  const retained = () =>
    frames.forEach((frame, index) =>
      expect([
        frame.currentPage,
        ...frame.backStack.map((entry) => entry.resolvedPage),
      ]).toContain(roots[index]),
    )
  return { router, selected, rows, histories, retained }
}
it('sidebar metadata never selects a tab; each row delivers to its own retained stack', async () => {
  const s = await setup(),
    provider = item(),
    guard = vi.fn()
  s.router.beforeEach(guard)
  for (const row of Object.values(s.rows))
    expect(row.policy.accepts([destinationType])).toBe(true)
  expect(provider.load).not.toHaveBeenCalled()
  expect(s.selected.value).toBe('source')
  expect(guard).not.toHaveBeenCalled()
  expect(await s.rows.inbox!.policy.drop('inbox-action', [provider])).toMatchObject({
    intent: { target: { frame: 'inbox' } },
    navigation: { status: 'handled' },
  })
  expect(s.selected.value).toBe('inbox')
  expect(await s.rows.archive!.policy.drop('archive-action', [item()])).toMatchObject({
    intent: { target: { frame: 'archive' } },
    navigation: { status: 'handled' },
  })
  expect(s.selected.value).toBe('archive')
  expect(s.histories()).toEqual({
    source: ['/source'],
    inbox: ['/inbox', '/documents/7'],
    archive: ['/archive', '/documents/7'],
  })
  s.retained()
})
it('a refused drop can reveal its row without changing either destination history', async () => {
  const s = await setup()
  await s.rows.archive!.policy.drop('archive-first', [item()])
  const before = s.histories()
  s.router.beforeEach(() => false)
  expect(await s.rows.inbox!.policy.drop('blocked', [item()])).toMatchObject({
    navigation: { status: 'handled', failure: { type: 4 } },
  })
  expect(s.selected.value).toBe('inbox')
  expect(s.histories()).toEqual(before)
  s.retained()
})
it('disposing one sidebar row cancels only its provider; the other row still accepts an internal action', async () => {
  const s = await setup()
  let deliver!: (value: string) => void
  const provider = item(
    new Promise((resolve) => {
      deliver = resolve
    }),
  )
  const pending = s.rows.inbox!.policy.drop('waiting', [provider])
  s.rows.inbox!.policy.dispose()
  expect(await pending).toEqual({ status: 'ignored', reason: 'disposed' })
  expect(provider.cancel).toHaveBeenCalledOnce()
  expect(s.rows.inbox!.policy.accepts([destinationType])).toBe(false)
  expect(
    await s.rows.archive!.policy.drop('keyboard', [item()], 'internal'),
  ).toMatchObject({ intent: { source: 'internal', target: { frame: 'archive' } } })
  deliver(payload)
  await settle()
  expect(s.histories()).toEqual({
    source: ['/source'],
    inbox: ['/inbox'],
    archive: ['/archive', '/documents/7'],
  })
  s.retained()
})
it.each(['owner', 'permission'] as const)(
  'cannot redirect a pending sidebar drop after %s changes',
  async (change) => {
    const s = await setup()
    let deliver!: (value: string) => void
    const pending = s.rows.inbox!.policy.drop('waiting', [
      item(
        new Promise((resolve) => {
          deliver = resolve
        }),
      ),
    ])
    if (change === 'owner') s.rows.inbox!.owner.frame = 'archive'
    else s.rows.inbox!.authorize.mockReturnValue(false)
    deliver(payload)
    expect(await pending).toEqual({
      status: 'ignored',
      reason: change === 'owner' ? 'owner-changed' : 'unauthorized',
    })
    expect(s.selected.value).toBe('source')
    expect(s.histories()).toEqual({
      source: ['/source'],
      inbox: ['/inbox'],
      archive: ['/archive'],
    })
    s.retained()
  },
)
it('delivery replay cannot switch rows; a fresh action can open the same document in the other row', async () => {
  const s = await setup()
  await s.rows.inbox!.policy.drop('one-native-delivery', [item()])
  expect(
    await s.rows.archive!.policy.drop('one-native-delivery', [item()]),
  ).toMatchObject({ navigation: { status: 'ignored', reason: 'repeat' } })
  expect(s.selected.value).toBe('inbox')
  expect(s.histories().archive).toEqual(['/archive'])
  expect(
    await s.rows.archive!.policy.drop('fresh-button', [item()], 'internal'),
  ).toMatchObject({ navigation: { status: 'handled' } })
  expect(s.histories().archive).toEqual(['/archive', '/documents/7'])
  s.retained()
})
