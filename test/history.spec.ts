import { computed, createApp, h } from 'nativescript-vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createRouter,
  mountNativeHost,
  NavigationFailureType,
  onBeforeRouteLeave,
  RouterSplitView,
  useRouter,
  type Router,
  type SavedStacks,
} from '../src/index.js'
import { createMemoryHost } from './hosts/memory.js'
import { events, mount, page, paths, settle } from './helpers.js'
import { Frame, resetNative } from './shims/core.js'

const routes = [
  { path: '/', component: page('Home') },
  { path: '/a', component: page('A') },
  { path: '/b', component: page('B') },
  { path: '/sheet', component: page('Sheet'), modal: true },
  { path: '/files/:parts+', name: 'files', component: page('Files') },
]
const stops: (() => void)[] = []
beforeEach(() => {
  resetNative()
  events.length = 0
})
afterEach(() => {
  stops
    .splice(0)
    .reverse()
    .forEach((stop) => stop())
  vi.restoreAllMocks()
})

async function fixture(records = routes) {
  const router = createRouter({ routes: records, diagnostics: true })
  const app = createApp({ render: () => h('GridLayout') }).use(router)
  app.start()
  stops.push(() => app.unmount())
  function add(name: string) {
    const host = createMemoryHost()
    const stop = mountNativeHost(router, name, host)
    stops.push(stop)
    return { host, stop }
  }
  const main = add('main')
  await router.isReady()
  return { router, add, ...main }
}

describe('retained entry history', () => {
  it('has no history before mounting or for an unknown named stack', () => {
    const router = createRouter({ routes })
    expect(router.history.value).toBeUndefined()
    expect(router.getHistory({ frame: 'missing' })).toBeUndefined()
  })

  it('publishes detached frozen snapshots that update reactively', async () => {
    const { router } = await fixture()
    const named = computed(() => router.getHistory({ frame: 'main' }))
    const old = named.value!
    await router.push('/files/a/b?tag=x&tag=y#heading')
    const snapshot = named.value!
    const entry = snapshot.entries.at(-1)!
    expect(old.entries).toHaveLength(1)
    expect(snapshot.entries).toHaveLength(2)
    expect(snapshot.scope).toEqual({
      id: old.scope.id,
      name: 'main',
      kind: 'frame',
      windowId: undefined,
      pinnedRoot: false,
    })
    expect(snapshot.entries[0]).toBe(old.entries[0])
    expect(Object.keys(entry).sort()).toEqual([
      'id',
      'key',
      'restored',
      'route',
      'scopeId',
    ])
    expect(Object.keys(entry.route).sort()).toEqual([
      'fullPath',
      'hash',
      'name',
      'params',
      'path',
      'query',
    ])
    expect(entry.restored).toBe(false)
    for (const value of [
      snapshot,
      snapshot.scope,
      snapshot.entries,
      entry,
      entry.route,
      entry.route.params,
      entry.route.params.parts,
      entry.route.query,
      entry.route.query.tag,
    ])
      expect(Object.isFrozen(value)).toBe(true)
    expect(() => (entry.route.query.tag as string[]).push('bad')).toThrow()
    expect(router.currentRoute.value.query.tag).toEqual(['x', 'y'])
    expect(JSON.parse(JSON.stringify(snapshot)).entries).toHaveLength(2)
  })

  it('targets the older of two identical paths and preserves its native page', async () => {
    const { router, host } = await fixture()
    await router.push('/a')
    const older = router.history.value!.entries.at(-1)!
    const native = host.pages().at(-1)
    await router.push('/b')
    await router.push('/a')
    await router.push('/b')
    const snapshot = router.history.value!
    expect(snapshot.entries[1]!.route.fullPath).toBe(snapshot.entries[3]!.route.fullPath)
    expect(snapshot.entries[1]!.id).not.toBe(snapshot.entries[3]!.id)
    expect(await router.backToEntry(older, { animated: false })).toBeUndefined()
    expect(paths(router.stack.value)).toEqual(['/', '/a'])
    expect(host.pages().at(-1)).toBe(native)
    expect(router.history.value!.entries.at(-1)).toBe(older)
    expect(router.diagnostics!.snapshot().issues).toEqual([])
  })

  it('uses the target stack after focus changes, and reading never reveals another stack', async () => {
    const { router, add, host } = await fixture()
    await router.push('/a')
    const target = router.history.value!.entries[0]!
    const other = add('other')
    await settle()
    await router.push('/b', { frame: 'other' })
    const focused = router.history.value!
    const otherPages = [...other.host.pages()]
    expect(router.getHistory({ frame: 'main' })!.entries).toHaveLength(2)
    expect(router.history.value!.scope.id).toBe(focused.scope.id)
    await router.backToEntry(target)
    expect(host.pages()).toHaveLength(1)
    expect(other.host.pages()).toEqual(otherPages)
    expect(router.getHistory({ frame: 'other' })!.entries).toHaveLength(2)
  })

  it('treats the current entry as duplicated without guards, result delivery or native work', async () => {
    const { router, host } = await fixture()
    const guard = vi.fn()
    router.beforeEach(guard)
    const back = vi.spyOn(host, 'back')
    expect(
      (await router.backToEntry(router.history.value!.entries[0]!, { result: 'ignored' }))
        ?.type,
    ).toBe(NavigationFailureType.duplicated)
    expect(guard).not.toHaveBeenCalled()
    expect(back).not.toHaveBeenCalled()
  })

  it('runs all leaving guards in reverse order and preserves history when refused', async () => {
    const seen: string[] = []
    const guarded = (name: string, allow: boolean) =>
      page(name, () =>
        onBeforeRouteLeave(() => {
          seen.push(name)
          return allow
        }),
      )
    const { router, host } = await fixture([
      routes[0]!,
      { path: '/a', component: guarded('A', false) },
      { path: '/b', component: guarded('B', true) },
    ])
    const root = router.history.value!.entries[0]!
    await router.push('/a')
    await router.push('/b')
    const before = [...host.pages()]
    expect((await router.backToEntry(root))?.type).toBe(NavigationFailureType.aborted)
    expect(seen).toEqual(['B', 'A'])
    expect(host.pages()).toEqual(before)
    expect(router.history.value!.entries).toHaveLength(3)
  })

  it('settles each removed result once, with the supplied result only for the top', async () => {
    const { router } = await fixture()
    const root = router.history.value!.entries[0]!
    const first = vi.fn(),
      second = vi.fn()
    const a = router.pushForResult('/a').then(first)
    await settle()
    const b = router.pushForResult('/b').then(second)
    await settle()
    await router.backToEntry(root, { result: 'picked' })
    await Promise.all([a, b])
    expect(first).toHaveBeenCalledExactlyOnceWith(undefined)
    expect(second).toHaveBeenCalledExactlyOnceWith('picked')
    expect(events.filter((e) => e === 'unmount A')).toHaveLength(1)
    expect(events.filter((e) => e === 'unmount B')).toHaveLength(1)
  })

  it.each(['replace', 'clearHistory', 'native pop'] as const)(
    'rejects a stale target after %s, even when its path returns',
    async (action) => {
      const { router, host } = await fixture()
      await router.push('/a')
      const old = router.history.value!.entries.at(-1)!
      if (action === 'replace') await router.replace('/b')
      else if (action === 'clearHistory') await router.push('/b', { clearHistory: true })
      else host.popNatively()
      await router.push('/a')
      const before = [...host.pages()]
      await expect(router.backToEntry(old)).rejects.toThrow(/no longer available/)
      expect(host.pages()).toEqual(before)
      expect(router.history.value!.entries.at(-1)!.id).not.toBe(old.id)
    },
  )

  it('rejects removed scope addresses after the same frame name is mounted again', async () => {
    const { router, stop, add } = await fixture()
    const old = router.history.value!
    stop()
    add('main')
    await settle()
    expect(router.history.value!.scope.id).not.toBe(old.scope.id)
    await expect(router.backToEntry(old.entries[0]!)).rejects.toThrow(
      /no longer available/,
    )
  })

  it('does not let a page-bound history adopt another stack after owner closure', async () => {
    let bound!: Router
    const { router, stop, add } = await fixture([
      {
        path: '/',
        component: page('Bound', () => {
          bound = useRouter()
        }),
      },
    ])
    const original = bound
    const target = original.history.value!.entries[0]!
    add('other')
    await settle()
    stop()
    expect(original.history.value).toBeUndefined()
    expect(original.getHistory()).toBeUndefined()
    expect(router.history.value!.scope.name).toBe('other')
    await expect(original.backToEntry(target)).rejects.toThrow(/no longer available/)
  })

  it('rejects a target belonging to another router even with the same frame and entry order', async () => {
    const a = await fixture(),
      b = await fixture()
    const target = a.router.history.value!.entries[0]!
    expect(target.scopeId).not.toBe(b.router.history.value!.scope.id)
    await expect(b.router.backToEntry(target)).rejects.toThrow(/no longer available/)
  })

  it('copies caller-provided address data before waiting for guards', async () => {
    const { router } = await fixture()
    const address = { ...router.history.value!.entries[0]! }
    await router.push('/a')
    let release!: () => void
    router.beforeEach(
      () =>
        new Promise<void>((resolve) => {
          release = resolve
        }),
    )
    const nav = router.backToEntry(address)
    await settle()
    address.id = 'different'
    address.scopeId = 'different'
    release()
    expect(await nav).toBeUndefined()
    expect(paths(router.stack.value)).toEqual(['/'])
  })

  it.each(['retained target', 'removed target', 'owner closed'] as const)(
    'cancels a pending selection after native mutation: %s',
    async (action) => {
      const { router, host, stop } = await fixture()
      const root = router.history.value!.entries[0]!
      await router.push('/a')
      await router.push('/b')
      let release!: () => void
      router.beforeEach(
        () =>
          new Promise<void>((resolve) => {
            release = resolve
          }),
      )
      const back = vi.spyOn(host, 'back')
      const nav = router.backToEntry(root, { result: 'uncommitted' })
      await settle()
      if (action === 'owner closed') stop()
      else {
        host.popNatively()
        if (action === 'removed target') {
          host.popNatively()
          host.popNatively()
        }
      }
      release()
      expect((await nav)?.type).toBe(NavigationFailureType.cancelled)
      expect(back).not.toHaveBeenCalled()
    },
  )

  it('cancels selection when a newer navigation wins while its guard waits', async () => {
    const { router } = await fixture()
    const root = router.history.value!.entries[0]!
    await router.push('/a')
    let release!: () => void
    router.beforeEach((_to, _from, info) =>
      info.type === 'back'
        ? new Promise<void>((resolve) => {
            release = resolve
          })
        : undefined,
    )
    const nav = router.backToEntry(root)
    await settle()
    await router.push('/b')
    release()
    expect((await nav)?.type).toBe(NavigationFailureType.cancelled)
    expect(paths(router.stack.value)).toEqual(['/', '/a', '/b'])
  })

  it('uses the existing redirect path when a Back guard redirects', async () => {
    const { router } = await fixture()
    const root = router.history.value!.entries[0]!
    await router.push('/a')
    router.beforeEach((_to, _from, info) => (info.type === 'back' ? '/b' : undefined))
    expect(await router.backToEntry(root)).toBeUndefined()
    expect(paths(router.stack.value)).toEqual(['/', '/a', '/b'])
  })

  it('does not retarget when a queued native push changes the guarded top', async () => {
    const { router, host } = await fixture()
    const root = router.history.value!.entries[0]!
    await router.push('/a')
    const push = host.push
    let release!: () => void
    host.push = async (...args) => {
      await new Promise<void>((resolve) => {
        release = resolve
      })
      return push(...args)
    }
    const pushing = router.push('/b')
    await settle()
    const selection = router.backToEntry(root)
    await settle()
    release()
    await pushing
    expect((await selection)?.type).toBe(NavigationFailureType.cancelled)
    expect(paths(router.stack.value)).toEqual(['/', '/a', '/b'])
  })

  it('does not leak a result when the native Back fails', async () => {
    const { router, host } = await fixture()
    const root = router.history.value!.entries[0]!
    const result = router.pushForResult('/a')
    await settle()
    vi.spyOn(host, 'back').mockRejectedValueOnce(new Error('native refusal'))
    await expect(router.backToEntry(root, { result: 'failed' })).rejects.toThrow(
      'native refusal',
    )
    await router.backToEntry(root)
    expect(await result).toBeUndefined()
  })

  it.each([false, true])(
    'marks reconstructed entries and gives them new live addresses (version2=%s)',
    async (version2) => {
      let saved: SavedStacks | null = null
      const one = await mount(routes, {
        restore: {
          load: () => undefined,
          save: (state) => {
            saved = state
          },
        },
      })
      await one.router.push('/a')
      const old = one.router.history.value!
      one.app.unmount()
      if (!version2) delete saved!.entries
      const two = await mount(routes, { restore: { load: () => saved, save: () => {} } })
      stops.push(() => two.app.unmount())
      const restored = two.router.history.value!
      expect(restored.entries.map((e) => e.restored)).toEqual([true, true])
      expect(restored.scope.id).not.toBe(old.scope.id)
      expect(restored.entries[1]!.id).not.toBe(old.entries[1]!.id)
      if (version2) expect(restored.entries[1]!.key).toBe(old.entries[1]!.key)
      await expect(two.router.backToEntry(old.entries[0]!)).rejects.toThrow(
        /no longer available/,
      )
      await two.router.push('/b')
      expect(two.router.history.value!.entries.at(-1)!.restored).toBe(false)
    },
  )

  it('stays inside the top modal and rejects covered history without dismissing anything', async () => {
    const { router, app } = await mount(routes)
    stops.push(() => app.unmount())
    const main = router.history.value!
    await router.push('/sheet')
    const modal = router.history.value!
    expect(modal.scope.kind).toBe('modal')
    await router.push('/a')
    await expect(router.backToEntry(main.entries[0]!)).rejects.toThrow(
      /beneath an open modal/,
    )
    await router.backToEntry(modal.entries[0]!)
    expect(router.history.value!.scope.id).toBe(modal.scope.id)
    expect(router.stack.value).toHaveLength(1)
    await router.back()
    expect(router.history.value!.scope.id).toBe(main.scope.id)
    await expect(router.backToEntry(modal.entries[0]!)).rejects.toThrow(
      /no longer available/,
    )
  })

  it('returns to a pinned split root without removing or replacing it', async () => {
    const { router, app } = await mount(routes, {
      render: () => h(RouterSplitView, { list: '/' }),
    })
    stops.push(() => app.unmount())
    const root = router.history.value!.entries[0]!
    expect(router.history.value!.scope.pinnedRoot).toBe(true)
    await router.push('/a')
    await router.push('/b')
    await router.backToEntry(root)
    expect(router.history.value!.entries).toEqual([root])
    expect(events).not.toContain('unmount Home')
  })

  it('keeps a retained unloaded frame local while another stack navigates', async () => {
    const { router, app, frame } = await mount(routes)
    stops.push(() => app.unmount())
    const native = frame()
    const root = router.history.value!.entries[0]!
    await router.push('/a')
    native.isLoaded = false
    const other = createMemoryHost()
    const stop = mountNativeHost(router, 'other', other)
    stops.push(stop)
    await settle()
    const back = router.backToEntry(root)
    await settle()
    await router.push('/b', { frame: 'other' })
    expect(router.getHistory({ frame: 'default' })!.entries).toHaveLength(2)
    native.load()
    await back
    expect(router.getHistory({ frame: 'default' })!.entries).toEqual([root])
  })
})
