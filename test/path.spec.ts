import { describe, expect, it } from 'vitest'
import { comparePatterns, compilePath } from '../src/path.js'

describe('compilePath', () => {
  it('matches static paths, ignoring case and trailing slashes', () => {
    const pattern = compilePath('/settings/profile')

    expect(pattern.match('/settings/profile')).toEqual({})
    expect(pattern.match('/Settings/Profile/')).toEqual({})
    expect(pattern.match('/settings')).toBeNull()
  })

  it('matches the root', () => {
    const pattern = compilePath('/')

    expect(pattern.match('/')).toEqual({})
    expect(pattern.match('/a')).toBeNull()
    expect(pattern.stringify({})).toBe('/')
  })

  it('extracts and decodes params', () => {
    const pattern = compilePath('/users/:id/posts/:slug')

    expect(pattern.match('/users/42/posts/hello%20world')).toEqual({
      id: '42',
      slug: 'hello world',
    })
    expect(pattern.match('/users/42/posts')).toBeNull()
  })

  it('handles optional params with their slash', () => {
    const pattern = compilePath('/users/:id?')

    expect(pattern.match('/users')).toEqual({})
    expect(pattern.match('/users/7')).toEqual({ id: '7' })
    expect(pattern.stringify({})).toBe('/users')
    expect(pattern.stringify({ id: '7' })).toBe('/users/7')
  })

  it('handles repeatable params as arrays', () => {
    const oneOrMore = compilePath('/files/:path+')
    const zeroOrMore = compilePath('/files/:path*')

    expect(oneOrMore.match('/files/a/b/c')).toEqual({ path: ['a', 'b', 'c'] })
    expect(oneOrMore.match('/files')).toBeNull()
    expect(zeroOrMore.match('/files')).toEqual({})
    expect(oneOrMore.stringify({ path: ['a', 'b'] })).toBe('/files/a/b')
  })

  it('respects custom regexes', () => {
    const pattern = compilePath('/orders/:id(\\d+)')

    expect(pattern.match('/orders/12')).toEqual({ id: '12' })
    expect(pattern.match('/orders/new')).toBeNull()
  })

  it('supports several params in one segment', () => {
    const pattern = compilePath('/range/:from-:to')

    expect(pattern.match('/range/1-5')).toEqual({ from: '1', to: '5' })
    expect(pattern.stringify({ from: '2', to: '9' })).toBe('/range/2-9')
  })

  it('matches catch-all routes', () => {
    const pattern = compilePath('/:pathMatch(.*)*')

    expect(pattern.match('/')).toEqual({})
    expect(pattern.match('/a/b')).toEqual({ pathMatch: ['a', 'b'] })
  })

  it('encodes params when building a path', () => {
    expect(compilePath('/search/:term').stringify({ term: 'a/b c' })).toBe(
      '/search/a%2Fb%20c',
    )
  })

  it('throws on missing required params', () => {
    expect(() => compilePath('/users/:id').stringify({})).toThrow(
      'Missing required param "id"',
    )
  })

  it('rejects capturing groups and relative paths', () => {
    expect(() => compilePath('/a/:id((x|y))')).toThrow('capturing group')
    expect(() => compilePath('users')).toThrow('must start with "/"')
  })
})

describe('comparePatterns', () => {
  const rank = (...paths: string[]) =>
    paths
      .map((path) => ({ path, pattern: compilePath(path) }))
      .sort((a, b) => comparePatterns(a.pattern, b.pattern))
      .map((entry) => entry.path)

  it('puts static segments before params, and catch-alls last', () => {
    expect(
      rank('/:pathMatch(.*)*', '/users/:id', '/users/new', '/users/:id(\\d+)'),
    ).toEqual(['/users/new', '/users/:id(\\d+)', '/users/:id', '/:pathMatch(.*)*'])
  })

  it('prefers the shorter path when one is a prefix of the other', () => {
    expect(rank('/users/:id?', '/users')).toEqual(['/users', '/users/:id?'])
  })
})
