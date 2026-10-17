import { createApp, h } from 'nativescript-vue'
import { describe, expect, it, vi } from 'vitest'
import {
  createRouter,
  isNavigationFailure,
  mountNativeHost,
  NavigationFailureType,
  useNativeHost,
  type NativeHost,
  type NativeHostHandle,
  type Router,
} from '../src/index.js'
import { events, page, paths, settle } from './helpers.js'
import { resetNative } from './shims/core.js'

export interface HostFixture {
  host: NativeHost
  /** What the platform does on its own: drops the page on top without asking. */
  popNatively(): void
}

/**
 * What every native host has to get right, run against the router itself:
 * order, external pops, cancelled and concurrent navigations, disposal and
 * results settled exactly once. A host declares what it can't do through its
 * capabilities, and the suite checks the router reports that instead of faking it.
 */
export function describeNativeHostContract(name: string, create: () => HostFixture) {
  const probe = create()
  const capabilities = probe.host.capabilities
  probe.host.dispose()

  describe(`native host contract: ${name}`, () => {
    const handles: NativeHostHandle[] = []
    const Home = page('Home', () => handles.push(useNativeHost()))
    const List = page('List')
    const Detail = page('Detail')
    const routes = [
      { path: '/', component: Home },
      { path: '/list', component: List },
      { path: '/items/:id', component: Detail },
    ]
    /** With a pinned root, the first page is always there. */
    const rooted = (...rest: string[]) =>
      capabilities.pinnedRoot ? ['/', ...rest] : rest

    async function mount(before?: (router: Router) => void) {
      resetNative()
      events.length = 0
      handles.length = 0
      const router = createRouter({ routes, diagnostics: true }) as Router
      before?.(router)
      const app = createApp({ render: () => h('GridLayout') })
      app.use(router)
      app.start()
      const fixture = create()
      const unmount = mountNativeHost(router, 'default', fixture.host, '/')
      await router.isReady()
      return { router, app, unmount, ...fixture }
    }

    const issues = (router: Router) =>
      router.diagnostics!.snapshot().issues.map((issue) => issue.code)

    it('shows the initial route and hands pages their host', async () => {
      const { router, host } = await mount()

      expect(paths(router.stack.value)).toEqual(['/'])
      expect(host.pages()).toHaveLength(1)
      expect(handles[0]!.kind).toBe(host.kind)
      expect(handles[0]!.capabilities).toBe(host.capabilities)
      expect(handles[0]!.native).toBe(host.native)
      expect(issues(router)).toEqual([])
    })

    it('pushes and goes back in native order, unmounting the page it leaves', async () => {
      const { router, host } = await mount()

      await router.push('/list')
      await router.push('/items/1')
      expect(paths(router.stack.value)).toEqual(['/', '/list', '/items/1'])
      expect(host.pages()).toHaveLength(3)

      await router.back()
      expect(paths(router.stack.value)).toEqual(['/', '/list'])
      expect(host.pages()).toHaveLength(2)
      expect(events).toContain('unmount Detail')
      expect(events).not.toContain('unmount List')
      expect(issues(router)).toEqual([])
    })

    it.runIf(capabilities.replace)('drops the page on top with replace', async () => {
      const { router, host } = await mount()
      await router.push('/list')

      await router.replace('/items/1')

      expect(paths(router.stack.value)).toEqual(['/', '/items/1'])
      expect(host.pages()).toHaveLength(2)
      expect(events).toContain('unmount List')
      expect(issues(router)).toEqual([])
    })

    it.runIf(capabilities.clearHistory)(
      'drops the pages below with clearHistory',
      async () => {
        const { router, host } = await mount()
        await router.push('/list')
        await router.push('/items/1')

        await router.push('/items/2', { clearHistory: true })

        expect(paths(router.stack.value)).toEqual(rooted('/items/2'))
        expect(host.pages()).toHaveLength(rooted('/items/2').length)
        expect(events).toContain('unmount List')
        expect(events.filter((event) => event === 'unmount Detail')).toHaveLength(1)
        await router.back()
        expect(paths(router.stack.value)).toEqual(
          capabilities.pinnedRoot ? ['/'] : rooted('/items/2'),
        )
      },
    )

    it.runIf(!capabilities.clearHistory)(
      'reports clearHistory as unsupported instead of faking it',
      async () => {
        const { router } = await mount()
        await router.push('/list')

        await expect(router.push('/items/1', { clearHistory: true })).rejects.toThrow(
          /doesn't support clearHistory/,
        )
        expect(paths(router.stack.value)).toEqual(['/', '/list'])
      },
    )

    it.runIf(!capabilities.replace)(
      'reports replace as unsupported instead of faking it',
      async () => {
        const { router } = await mount()
        await router.push('/list')

        await expect(router.replace('/items/1')).rejects.toThrow(
          /doesn't support replace/,
        )
        expect(paths(router.stack.value)).toEqual(['/', '/list'])
      },
    )

    it('mirrors a pop the platform made on its own', async () => {
      const after = vi.fn()
      const { router, host, popNatively } = await mount((router) =>
        router.afterEach(after),
      )
      await router.push('/list')
      after.mockClear()

      popNatively()
      await settle()

      expect(paths(router.stack.value)).toEqual(['/'])
      expect(host.pages()).toHaveLength(1)
      expect(events).toContain('unmount List')
      expect(after).toHaveBeenCalledTimes(1)
      expect(after.mock.calls[0]![0].path).toBe('/')
      expect(after.mock.calls[0]![1].path).toBe('/list')
      expect(issues(router)).toEqual([])
    })

    it('cancels a navigation when a newer one starts during its guards', async () => {
      let release!: () => void
      const held = new Promise<void>((resolve) => {
        release = resolve
      })
      const { router, host } = await mount((router) =>
        router.beforeEach((to) => (to.path === '/list' ? held : undefined)),
      )

      const first = router.push('/list')
      await settle()
      const second = router.push('/items/1')
      await settle()
      release()

      expect(isNavigationFailure(await first, NavigationFailureType.cancelled)).toBe(true)
      expect(await second).toBeUndefined()
      expect(paths(router.stack.value)).toEqual(['/', '/items/1'])
      expect(host.pages()).toHaveLength(2)
      expect(events).not.toContain('mount List')
    })

    it('lets the newest of several requests started together win', async () => {
      const { router, host } = await mount()

      const first = router.push('/list')
      const second = router.push('/items/1')

      expect(isNavigationFailure(await first, NavigationFailureType.cancelled)).toBe(true)
      expect(await second).toBeUndefined()
      expect(paths(router.stack.value)).toEqual(['/', '/items/1'])
      expect(host.pages()).toHaveLength(2)
      expect(events).not.toContain('mount List')
      expect(issues(router)).toEqual([])
    })

    it('settles a result exactly once', async () => {
      const { router } = await mount()

      const result = router.pushForResult<string>('/items/1')
      await settle()
      await router.back({ result: 'picked' })

      expect(await result).toBe('picked')
      await router.push('/items/2')
      expect(
        router.diagnostics!.events.filter((event) => event.code === 'duplicate-result'),
      ).toEqual([])
    })

    it('settles a pending result when the host is disposed', async () => {
      const { router, host, unmount } = await mount()
      const result = router.pushForResult<string>('/items/1')
      await settle()

      unmount()

      expect(await result).toBeUndefined()
      expect(host.native).toBeNull()
      expect(handles[0]!.native).toBeNull()
      expect(
        router.diagnostics!.events.filter((event) => event.code === 'duplicate-result'),
      ).toEqual([])
    })

    it('ignores the host once it is disposed', async () => {
      const { router, unmount, popNatively } = await mount()
      await router.push('/list')

      unmount()
      expect(() => popNatively()).not.toThrow()
      await settle()

      expect(router.currentRoute.value.matched).toEqual([])
      await expect(router.push('/items/1')).rejects.toThrow(/No <RouterView> is mounted/)
    })

    it('cancels a navigation whose host goes away during its guards', async () => {
      let release!: () => void
      const held = new Promise<void>((resolve) => {
        release = resolve
      })
      const { router, unmount } = await mount((router) =>
        router.beforeEach((to) => (to.path === '/list' ? held : undefined)),
      )

      const navigation = router.push('/list')
      await settle()
      unmount()
      release()

      expect(isNavigationFailure(await navigation, NavigationFailureType.cancelled)).toBe(
        true,
      )
      expect(events).not.toContain('mount List')
    })
  })
}
