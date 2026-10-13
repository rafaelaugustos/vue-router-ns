import { describe, expect, it } from 'vitest'
import { normalizeQuery, parseQuery, parseURL, stringifyQuery } from '../src/query.js'

describe('query', () => {
  it('parses repeated keys, flags and encoded values', () => {
    expect(parseQuery('?tag=a&tag=b&draft&q=hello+world%21')).toEqual({
      tag: ['a', 'b'],
      draft: null,
      q: 'hello world!',
    })
  })

  it('round-trips through stringify', () => {
    const query = { tag: ['a', 'b'], draft: null, q: 'hello world!' }
    expect(parseQuery(stringifyQuery(query))).toEqual(query)
  })

  it('normalizes raw values the way a URL would', () => {
    expect(
      normalizeQuery({ page: 2, open: true, skip: undefined, ids: [1, undefined, 3] }),
    ).toEqual({
      page: '2',
      open: 'true',
      ids: ['1', '3'],
    })
  })

  it('splits a URL into path, query and hash', () => {
    expect(parseURL('/a/b?x=1#top')).toEqual({
      path: '/a/b',
      query: { x: '1' },
      hash: '#top',
    })
    expect(parseURL('/a#top?x=1')).toEqual({ path: '/a', query: {}, hash: '#top?x=1' })
  })
})
