import { describe, expect, it } from 'vitest'
import { createMatcher } from '../src/matcher.js'
import { START_LOCATION } from '../src/router.js'
import type { RouteRecordRaw } from '../src/types.js'

const Page = {}

describe('createMatcher', () => {
  const routes: RouteRecordRaw[] = [
    { path: '/', name: 'home', component: Page },
    {
      path: '/users/:id',
      meta: { section: 'users', auth: true },
      children: [
        { path: '', name: 'user', component: Page },
        { path: 'posts/:postId', name: 'post', component: Page, meta: { auth: false } },
      ],
    },
    { path: '/users/new', name: 'new-user', component: Page },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: Page },
  ]

  it('resolves paths to the most specific route', () => {
    const matcher = createMatcher(routes)

    expect(matcher.resolve('/users/new', START_LOCATION).name).toBe('new-user')
    expect(matcher.resolve('/users/42', START_LOCATION).name).toBe('user')
    expect(matcher.resolve('/nope/at/all', START_LOCATION)).toMatchObject({
      name: 'not-found',
      params: { pathMatch: ['nope', 'at', 'all'] },
    })
  })

  it('joins child paths and merges meta from parent to child', () => {
    const route = createMatcher(routes).resolve(
      '/users/1/posts/9?draft#top',
      START_LOCATION,
    )

    expect(route).toMatchObject({
      name: 'post',
      path: '/users/1/posts/9',
      fullPath: '/users/1/posts/9?draft#top',
      params: { id: '1', postId: '9' },
      query: { draft: null },
      hash: '#top',
      meta: { section: 'users', auth: false },
    })
    expect(route.matched.map((record) => record.path)).toEqual([
      '/users/:id',
      '/users/:id/posts/:postId',
    ])
  })

  it('builds paths for named routes, reusing params of the current route', () => {
    const matcher = createMatcher(routes)
    const current = matcher.resolve('/users/7', START_LOCATION)

    const post = matcher.resolve({ name: 'post', params: { postId: 3 } }, current)

    expect(post.fullPath).toBe('/users/7/posts/3')
    expect(post.params).toEqual({ id: '7', postId: '3' })
  })

  it('drops params the route does not declare', () => {
    const matcher = createMatcher(routes)
    const current = matcher.resolve('/users/7', START_LOCATION)

    expect(matcher.resolve({ name: 'home' }, current).params).toEqual({})
  })

  it('resolves relative locations against the current route', () => {
    const matcher = createMatcher(routes)
    const current = matcher.resolve('/users/7/posts/1', START_LOCATION)

    expect(
      matcher.resolve({ params: { postId: 2 }, query: { a: 1 } }, current).fullPath,
    ).toBe('/users/7/posts/2?a=1')
  })

  it('does not navigate to records without a component', () => {
    const matcher = createMatcher([{ path: '/group', name: 'group', children: [] }])

    expect(matcher.resolve('/group', START_LOCATION).matched).toEqual([])
    expect(() => matcher.resolve({ name: 'group' }, START_LOCATION)).toThrow(
      'has no component',
    )
  })

  it('adds and removes routes at runtime', () => {
    const matcher = createMatcher(routes)

    const remove = matcher.addRoute({ path: '/admin', name: 'admin', component: Page })
    matcher.addRoute({ path: 'logs', name: 'logs', component: Page }, 'admin')
    expect(matcher.resolve('/admin/logs', START_LOCATION).name).toBe('logs')

    remove()
    expect(matcher.hasRoute('admin')).toBe(false)
    expect(matcher.hasRoute('logs')).toBe(false)
    expect(matcher.resolve('/admin/logs', START_LOCATION).name).toBe('not-found')
  })

  it('replaces a route added again under the same name', () => {
    const matcher = createMatcher(routes)

    matcher.addRoute({ path: '/home', name: 'home', component: Page })

    expect(matcher.resolve({ name: 'home' }, START_LOCATION).path).toBe('/home')
    expect(matcher.resolve('/', START_LOCATION).name).toBe('not-found')
  })

  it('rejects relative paths', () => {
    expect(() => createMatcher(routes).resolve('users/1', START_LOCATION)).toThrow(
      'Paths must be absolute',
    )
  })
})
