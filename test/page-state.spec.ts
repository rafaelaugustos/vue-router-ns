import { ref, type Ref } from 'nativescript-vue'
import { describe, expect, it, vi } from 'vitest'
import {
  usePageState,
  type PageStateContext,
  type RouteRecordRaw,
  type SavedStacks,
} from '../src/index.js'
import { mount, page, paths, settle } from './helpers.js'
import { Application, Page, View } from './shims/core.js'

const storage = (initial: SavedStacks | null = null) => {
  let state = initial
  return {
    save: vi.fn((next: SavedStacks | null) => void (state = next)),
    load: vi.fn(() => state),
    get state() {
      return state
    },
  }
}

interface Draft {
  text: string
}

const editors: Ref<string>[] = []
const restores: PageStateContext[] = []
/** A page whose draft comes back after process death. */
const Editor = page('Editor', () => {
  const draft = ref('')
  editors.push(draft)
  usePageState<Draft>('draft', {
    save: () => (draft.value ? { text: draft.value } : undefined),
    restore(value, context) {
      draft.value = value.text
      restores.push(context)
    },
  })
})
const Home = page('Home')
const List = page('List')
const routes = [
  { path: '/', component: Home },
  { path: '/list', component: List },
  { path: '/edit', component: Editor },
] satisfies RouteRecordRaw[]

const suspend = () => Application.notify({ eventName: 'suspend' })
const reset = () => {
  editors.length = 0
  restores.length = 0
}

describe('usePageState', () => {
  it('saves each page’s state next to its path, with a stable key', async () => {
    reset()
    const store = storage()
    const { router } = await mount(routes, { restore: store })

    await router.push('/edit')
    editors[0]!.value = 'hello'
    suspend()

    const saved = store.state!
    expect(saved.version).toBe(2)
    expect(saved.stacks.default).toEqual(['/', '/edit'])
    expect(saved.entries!.default).toHaveLength(2)
    expect(saved.entries!.default![0]).toEqual({ key: expect.any(String) })
    expect(saved.entries!.default![1]).toEqual({
      key: expect.any(String),
      state: { draft: { version: 1, value: { text: 'hello' } } },
    })
    const [home, edit] = saved.entries!.default!.map((entry) => entry.key)
    expect(home).not.toBe(edit)

    await router.push('/list')
    expect(store.state!.entries!.default!.map((entry) => entry.key).slice(0, 2)).toEqual([
      home,
      edit,
    ])
  })

  it('restores two pages at the same path with their own state', async () => {
    reset()
    const store = storage()
    const first = await mount(routes, { restore: store })
    await first.router.push('/edit')
    await first.router.push({ path: '/edit', force: true })
    editors[0]!.value = 'first draft'
    editors[1]!.value = 'second draft'
    suspend()
    const keys = store.state!.entries!.default!.map((entry) => entry.key)
    reset()

    const { router } = await mount(routes, { restore: store })
    await settle()

    expect(paths(router.stack.value)).toEqual(['/', '/edit', '/edit'])
    expect(editors.map((draft) => draft.value)).toEqual(['first draft', 'second draft'])
    expect(restores).toHaveLength(2)
    expect(restores[0]!.page).toBeInstanceOf(Page)
    expect(restores[0]!.version).toBe(1)
    expect(store.state!.entries!.default!.map((entry) => entry.key)).toEqual(keys)
  })

  it('preserves duplicate entry state when load migrates a renamed route', async () => {
    reset()
    const snapshot: SavedStacks = {
      version: 2,
      savedAt: Date.now(),
      stacks: { default: ['/', '/legacy-edit', '/legacy-edit'] },
      entries: {
        default: [
          { key: 'home' },
          {
            key: 'first',
            state: { draft: { version: 1, value: { text: 'first draft' } } },
          },
          {
            key: 'second',
            state: { draft: { version: 1, value: { text: 'second draft' } } },
          },
        ],
      },
    }
    const store = storage(snapshot)
    const { app, router } = await mount(routes, {
      restore: {
        save: store.save,
        load: () => ({
          ...snapshot,
          stacks: Object.fromEntries(
            Object.entries(snapshot.stacks).map(([name, paths]) => [
              name,
              paths.map((path) => (path === '/legacy-edit' ? '/edit' : path)),
            ]),
          ),
        }),
      },
    })
    await settle()
    expect(paths(router.stack.value)).toEqual(['/', '/edit', '/edit'])
    expect(editors.map((draft) => draft.value)).toEqual(['first draft', 'second draft'])
    expect(store.state!.entries!.default!.map((entry) => entry.key)).toEqual([
      'home',
      'first',
      'second',
    ])
    await router.back()
    await settle()
    expect(paths(router.stack.value)).toEqual(['/', '/edit'])
    expect(store.state!.entries!.default!.at(-1)).toEqual({
      key: 'first',
      state: { draft: { version: 1, value: { text: 'first draft' } } },
    })
    app.unmount()
  })

  it('saves when the app goes to the background, and forgets on exit', async () => {
    reset()
    const store = storage()
    await mount(routes, { restore: store, initial: '/edit' })
    editors[0]!.value = 'typed later'
    expect(store.state!.entries!.default![0]!.state).toBeUndefined()

    suspend()
    expect(store.state!.entries!.default![0]!.state).toEqual({
      draft: { version: 1, value: { text: 'typed later' } },
    })

    Application.notify({ eventName: 'exit' })
    expect(store.state).toBeNull()
  })

  it('migrates older versions and starts fresh without a migration', async () => {
    reset()
    const seen: unknown[] = []
    const Migrating = page('Migrating', () =>
      usePageState<{ body: string }>('draft', {
        version: 2,
        save: () => undefined,
        restore: (value) => seen.push(value),
        migrate: (old, version) =>
          version === 1 ? { body: (old as Draft).text } : undefined,
      }),
    )
    const Strict = page('Strict', () =>
      usePageState<{ body: string }>('draft', {
        version: 2,
        save: () => undefined,
        restore: (value) => seen.push(value),
      }),
    )
    const saved = (version: number): SavedStacks => ({
      version: 2,
      savedAt: Date.now(),
      stacks: { default: ['/old'] },
      entries: {
        default: [
          { key: 'k1', state: { draft: { version, value: { text: 'legacy' } } } },
        ],
      },
    })

    await mount([{ path: '/old', component: Migrating }], { restore: storage(saved(1)) })
    await settle()
    expect(seen).toEqual([{ body: 'legacy' }])

    seen.length = 0
    await mount([{ path: '/old', component: Migrating }], { restore: storage(saved(0)) })
    await settle()
    expect(seen).toEqual([])

    await mount([{ path: '/old', component: Strict }], { restore: storage(saved(1)) })
    await settle()
    expect(seen).toEqual([])
  })

  it('leaves state behind when a guard sends the restored page elsewhere', async () => {
    reset()
    const store = storage({
      version: 2,
      savedAt: Date.now(),
      stacks: { default: ['/', '/edit'] },
      entries: {
        default: [
          { key: 'home' },
          { key: 'edit', state: { draft: { version: 1, value: { text: 'secret' } } } },
        ],
      },
    })
    const { router } = await mount(routes, {
      restore: store,
      before: (router) =>
        router.beforeEach((to) => (to.path === '/edit' ? '/list' : true)),
    })
    await settle()

    expect(paths(router.stack.value)).toEqual(['/', '/list'])
    expect(editors).toHaveLength(0)
    expect(store.state!.entries!.default![0]!.key).toBe('home')
    expect(store.state!.entries!.default![1]).toEqual({
      key: expect.not.stringMatching(/^edit$/),
    })
  })

  it('loads the path-only format and saves the new one', async () => {
    reset()
    const store = storage({ savedAt: Date.now(), stacks: { default: ['/', '/edit'] } })

    const { router } = await mount(routes, { restore: store })
    await settle()

    expect(paths(router.stack.value)).toEqual(['/', '/edit'])
    expect(editors[0]!.value).toBe('')
    expect(store.state!.version).toBe(2)
    expect(store.state!.entries!.default).toHaveLength(2)
  })

  it('keeps what JSON cannot carry out of the save, with a warning', async () => {
    reset()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const values: unknown[] = []
    const Odd = page('Odd', () =>
      usePageState('odd', { save: () => values.shift(), restore: () => {} }),
    )
    const store = storage()
    await mount([{ path: '/', component: Odd }], {
      restore: { ...store, stateLimit: 40 },
    })
    const saved = () => store.state!.entries!.default![0]!.state

    values.push({ view: new View() })
    suspend()
    expect(saved()).toBeUndefined()
    expect(warn).toHaveBeenLastCalledWith(
      expect.stringContaining('native or class object'),
    )

    values.push({ run: () => {} })
    suspend()
    expect(saved()).toBeUndefined()
    expect(warn).toHaveBeenLastCalledWith(expect.stringContaining('holds a function'))

    values.push({ text: 'x'.repeat(100) })
    suspend()
    expect(saved()).toBeUndefined()
    expect(warn).toHaveBeenLastCalledWith(expect.stringContaining('over 40 bytes'))

    values.push({ text: 'short', count: 2, tags: ['a'] })
    suspend()
    expect(saved()).toEqual({
      odd: { version: 1, value: { text: 'short', count: 2, tags: ['a'] } },
    })
    warn.mockRestore()
  })

  it('must be used inside a routed page, once per key', async () => {
    expect(() => usePageState('x', { save: () => 1, restore: () => {} })).toThrow(
      /inside a routed page/,
    )
    const Twice = page('Twice', () => {
      usePageState('x', { save: () => 1, restore: () => {} })
      usePageState('x', { save: () => 2, restore: () => {} })
    })
    await expect(
      mount([{ path: '/', component: Twice }], { restore: storage() }),
    ).rejects.toThrow(/usePageState\("x"\) is already used/)
  })
})
