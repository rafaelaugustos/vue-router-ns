import { afterEach, expect, it, vi } from 'vitest'
import { createSystemSearch } from '../src/system-search.js'
import { mount, page, settle } from './helpers.js'
import { Application, iosLinks } from './shims/core.js'

afterEach(() => vi.unstubAllGlobals())
function native() {
  const indexed: any[] = []
  const deleted: string[][] = []
  const domains: string[][] = []
  let failure: { localizedDescription: string } | null = null
  vi.stubGlobal('CSSearchableIndex', {
    isIndexingAvailable: () => true,
    defaultSearchableIndex: () => ({
      indexSearchableItemsCompletionHandler(items: any[], done: Function) {
        indexed.push(...items)
        done(failure)
      },
      deleteSearchableItemsWithIdentifiersCompletionHandler(
        ids: string[],
        done: Function,
      ) {
        deleted.push(ids)
        done(failure)
      },
      deleteSearchableItemsWithDomainIdentifiersCompletionHandler(
        ids: string[],
        done: Function,
      ) {
        domains.push(ids)
        done(failure)
      },
    }),
  })
  vi.stubGlobal('CSSearchableItemAttributeSet', {
    alloc: () => ({ initWithItemContentType: () => ({}) }),
  })
  vi.stubGlobal('CSSearchableItem', {
    alloc: () => ({
      initWithUniqueIdentifierDomainIdentifierAttributeSet: (
        id: string,
        domain: string,
        attributes: unknown,
      ) => ({ id, domain, attributes }),
    }),
  })
  vi.stubGlobal('NSArray', { arrayWithArray: (items: unknown) => items })
  vi.stubGlobal('NSDate', { dateWithTimeIntervalSince1970: (seconds: number) => seconds })
  return {
    indexed,
    deleted,
    domains,
    fail: () => (failure = { localizedDescription: 'Index unavailable' }),
  }
}
const activity = (id: string) => ({
  activityType: 'com.apple.corespotlightitem',
  userInfo: { objectForKey: () => id },
})
it('indexes explicit metadata, resolves current routes through guards, and removes only its domain', async () => {
  const ns = native()
  let path: string | null = '/private'
  const search = createSystemSearch({
    domain: 'app.public',
    resolve: (id) => (id === 'doc-1' ? path : null),
  })
  const { router } = await mount(
    [
      { path: '/', component: page('Home') },
      { path: '/private', component: page('Private') },
      { path: '/renamed', component: page('Renamed') },
      { path: '/login', component: page('Login') },
    ],
    {
      links: { activity: search.url },
      before: (router) =>
        router.beforeEach((to) => (to.path === '/private' ? '/login' : undefined)),
    },
  )
  expect(
    await search.index([
      {
        id: 'doc-1',
        title: 'Public guide',
        keywords: ['guide'],
        expiresAt: new Date('2030-01-01'),
      },
    ]),
  ).toBe(true)
  expect(ns.indexed[0].attributes).toEqual({ title: 'Public guide', keywords: ['guide'] })
  const received = activity(ns.indexed[0].id)
  Application.ios.call(
    'applicationContinueUserActivityRestorationHandler',
    {},
    received,
    () => {},
  )
  await settle()
  expect(router.currentRoute.value.path).toBe('/login')
  path = '/renamed'
  Application.ios.call(
    'applicationContinueUserActivityRestorationHandler',
    {},
    received,
    () => {},
  )
  await settle()
  expect(router.currentRoute.value.path).toBe('/renamed')
  path = null
  expect(search.url(received)).toBeUndefined()
  await search.remove(['doc-1'])
  expect(ns.deleted).toEqual([[ns.indexed[0].id]])
  await search.remove()
  expect(ns.domains).toEqual([['app.public']])
  expect(search.url(activity('vue-router-ns:search:v9:app.public:doc-1'))).toBeUndefined()
  expect(search.url(activity('vue-router-ns:search:v1:another:doc-1'))).toBeUndefined()
  ns.fail()
  await expect(search.index([{ id: 'doc-1', title: 'Public guide' }])).rejects.toThrow(
    'Index unavailable',
  )
})
it('leaves ordinary web activities intact and does not require Core Spotlight on Android', async () => {
  const search = createSystemSearch({ domain: 'app.public', resolve: () => '/items/1' })
  const { router } = await mount(
    [
      { path: '/', component: page('Home') },
      { path: '/items/:id', component: page('Item') },
    ],
    { links: { activity: search.url } },
  )
  iosLinks.continueUserActivity('https://example.com/items/1')
  await settle()
  expect(router.currentRoute.value.path).toBe('/items/1')
  expect(search.supported).toBe(false)
  expect(await search.index([{ id: 'id', title: 'Title' }])).toBe(false)
  expect(await search.remove()).toBe(false)
})
