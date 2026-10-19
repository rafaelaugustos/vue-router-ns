import { describe, expect, it, vi } from 'vitest'
import {
  defineRouteMiddleware,
  isNavigationFailure,
  NavigationFailureType,
  onBeforeRouteLeave,
} from '../src/index.js'
import { events, mount, page, paths } from './helpers.js'

const Home = page('Home')
const Target = page('Target')

describe('optional route middleware', () => {
  it('uses the existing guard phases, globals first and declarations in order, once each', async () => {
    const order: string[] = []
    const inline = defineRouteMiddleware(() => void order.push('inline'))
    const { router } = await mount([
      {
        path: '/',
        component: page('Home', () => {
          onBeforeRouteLeave(() => void order.push('leave'))
        }),
      },
      {
        path: '/target',
        meta: { middleware: ['second', 'first', 'second', 'global', inline, inline] },
        beforeEnter: () => void order.push('beforeEnter'),
        component: () => {
          order.push('load')
          return Target
        },
      },
    ])
    router.beforeResolve(() => void order.push('beforeResolve'))
    router.addRouteMiddleware('first', () => void order.push('first'))
    router.addRouteMiddleware('global', () => void order.push('global'), { global: true })
    router.addRouteMiddleware('second', () => void order.push('second'))
    router.addRouteMiddleware('global-2', () => void order.push('global-2'), {
      global: true,
    })
    router.beforeEach(() => void order.push('beforeEach'))
    router.afterEach(() => void order.push('afterEach'))

    await router.replace('/target')

    expect(order).toEqual([
      'leave',
      'beforeEach',
      'global',
      'global-2',
      'second',
      'first',
      'inline',
      'beforeEnter',
      'load',
      'beforeResolve',
      'afterEach',
    ])
  })

  it('redirects authentication once within the same transaction, including initial navigation', async () => {
    const auth = vi.fn(
      defineRouteMiddleware((to) => ({
        path: '/login',
        query: { next: to.fullPath },
        replace: true,
      })),
    )
    const { router, frame } = await mount(
      [
        { path: '/', component: Home, meta: { middleware: 'auth' } },
        { path: '/login', component: Target },
      ],
      {
        before: (router) => {
          router.addRouteMiddleware('auth', auth)
        },
      },
    )

    expect(auth).toHaveBeenCalledOnce()
    expect(router.currentRoute.value.fullPath).toBe('/login?next=%2F')
    expect(router.currentRoute.value.redirectedFrom?.path).toBe('/')
    expect(paths(router.stack.value)).toEqual(['/login?next=%2F'])
    expect(frame().backStack).toHaveLength(0)
    expect(events).not.toContain('mount Home')
  })

  it('awaits refusal without mounting a page or changing native history', async () => {
    let answer!: (value: boolean) => void
    const { router, frame } = await mount([
      { path: '/', component: Home },
      { path: '/target', component: Target, meta: { middleware: 'confirm' } },
    ])
    router.addRouteMiddleware(
      'confirm',
      () =>
        new Promise<boolean>((resolve) => {
          answer = resolve
        }),
    )
    const before = frame().currentPage
    const attempt = router.push('/target')
    await vi.waitFor(() => expect(answer).toBeDefined())
    expect(frame().currentPage).toBe(before)
    expect(events).not.toContain('mount Target')
    answer(false)

    expect(isNavigationFailure(await attempt, NavigationFailureType.aborted)).toBe(true)
    expect(paths(router.stack.value)).toEqual(['/'])
    expect(frame().backStack).toHaveLength(0)
  })

  it('reports a thrown middleware error once and skips later phases', async () => {
    const { router } = await mount([
      { path: '/', component: Home },
      { path: '/target', component: Target, meta: { middleware: 'broken' } },
    ])
    const error = new Error('middleware failed')
    const onError = vi.fn()
    const resolve = vi.fn()
    router.onError(onError)
    router.beforeResolve(resolve)
    router.addRouteMiddleware('broken', async () => {
      throw error
    })

    await expect(router.push('/target')).rejects.toBe(error)
    expect(onError).toHaveBeenCalledExactlyOnceWith(
      error,
      expect.anything(),
      expect.anything(),
    )
    expect(resolve).not.toHaveBeenCalled()
    expect(paths(router.stack.value)).toEqual(['/'])
  })

  it('reports missing names and rejects duplicate registrations without replacing them', async () => {
    const { router } = await mount([
      { path: '/', component: Home },
      { path: '/target', component: Target, meta: { middleware: 'missing' } },
    ])
    const error = vi.fn()
    router.onError(error)
    await expect(router.push('/target')).rejects.toThrow(
      'Unknown route middleware "missing"',
    )
    expect(error).toHaveBeenCalledOnce()
    const original = vi.fn()
    router.addRouteMiddleware('missing', original)
    expect(() => router.addRouteMiddleware('missing', () => false)).toThrow(
      'already registered',
    )
    expect(() => router.addRouteMiddleware(' ', original)).toThrow('non-empty name')
    await router.push('/target')
    expect(original).toHaveBeenCalledOnce()
  })

  it('unregisters globals and names with an idempotent disposer', async () => {
    const { router } = await mount([
      { path: '/', component: Home },
      { path: '/target', component: Target },
    ])
    const old = vi.fn()
    const current = vi.fn()
    const remove = router.addRouteMiddleware('global', old, { global: true })
    await router.push('/target')
    remove()
    router.addRouteMiddleware('global', current, { global: true })
    remove()
    await router.back()
    expect(old).toHaveBeenCalledOnce()
    expect(current).toHaveBeenCalledOnce()
  })

  it('uses merged metadata, with child lists overriding the parent', async () => {
    const parent = vi.fn()
    const child = vi.fn()
    const { router } = await mount([
      { path: '/', component: Home },
      {
        path: '/parent',
        meta: { middleware: 'parent' },
        children: [
          { path: 'inherited', component: Target },
          { path: 'child', component: Target, meta: { middleware: 'child' } },
          { path: 'none', component: Target, meta: { middleware: [] } },
        ],
      },
    ])
    router.addRouteMiddleware('parent', parent)
    router.addRouteMiddleware('child', child)
    await router.push('/parent/inherited')
    await router.push('/parent/child')
    await router.push('/parent/none')
    expect(parent).toHaveBeenCalledOnce()
    expect(child).toHaveBeenCalledOnce()
  })

  it('runs for each repeated entry and returning to an existing record', async () => {
    const middleware = vi.fn()
    const beforeEnter = vi.fn()
    const { router } = await mount([
      { path: '/', component: Home },
      { path: '/item/:id', component: Target, beforeEnter, meta: { middleware } },
    ])
    await router.push('/item/1')
    await router.push('/item/2')
    await router.push({ path: '/item/2', force: true })
    await router.back()
    expect(middleware.mock.calls.map(([to, , info]) => [to.path, info.type])).toEqual([
      ['/item/1', 'push'],
      ['/item/2', 'push'],
      ['/item/2', 'push'],
      ['/item/2', 'back'],
    ])
    expect(beforeEnter).toHaveBeenCalledOnce()
  })

  it('cancels pending middleware when its stack is disposed', async () => {
    let finish!: () => void
    const { router, app } = await mount([
      { path: '/', component: Home },
      {
        path: '/target',
        component: Target,
        meta: {
          middleware: () =>
            new Promise<void>((resolve) => {
              finish = resolve
            }),
        },
      },
    ])
    const attempt = router.push('/target')
    await vi.waitFor(() => expect(finish).toBeDefined())
    app.unmount()
    finish()
    expect(isNavigationFailure(await attempt, NavigationFailureType.cancelled)).toBe(true)
    expect(events).not.toContain('mount Target')
  })

  it('does not share middleware between router instances', async () => {
    const routes = [
      { path: '/', component: Home },
      { path: '/target', component: Target },
    ]
    const first = await mount(routes)
    const middleware = vi.fn()
    first.router.addRouteMiddleware('only-first', middleware, { global: true })
    first.app.unmount()
    const second = await mount(routes)
    await second.router.push('/target')
    expect(middleware).not.toHaveBeenCalled()
  })

  it('rejects external middleware redirects without launching or mounting anything', async () => {
    const { router } = await mount([
      { path: '/', component: Home },
      {
        path: '/target',
        component: Target,
        meta: { middleware: () => 'https://example.com' },
      },
    ])
    const onError = vi.fn()
    router.onError(onError)
    await expect(router.push('/target')).rejects.toThrow('external URL')
    expect(onError).toHaveBeenCalledOnce()
    expect(paths(router.stack.value)).toEqual(['/'])
  })
})
