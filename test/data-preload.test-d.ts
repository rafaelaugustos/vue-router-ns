import { expectTypeOf, it } from 'vitest'
import {
  createRouter,
  defineRouteLoader,
  useRouteData,
  useRouteDataPreload,
  type RouteData,
  type RoutePreload,
} from '../src/index.js'

it('keeps loader inference and typed destinations with explicit speculative permission', () => {
  const session = {}
  const loader = defineRouteLoader(
    async (context) => {
      expectTypeOf(context.preloading).toEqualTypeOf<boolean>()
      return { id: String(context.to.params.id) }
    },
    {
      preload: {
        scope: () => session,
        authorize: ({ to }) => to.params.id !== 'private',
      },
    },
  )
  const router = createRouter({
    routes: [
      { path: '/item/:id', name: 'item', component: {}, meta: { loaders: loader } },
    ],
    preloadData: { concurrency: 1, maxEntries: 3, ttl: 1000 },
  })
  expectTypeOf(
    router.preloadData({ name: 'item', params: { id: 1 } }, loader),
  ).toEqualTypeOf<RoutePreload>()
  expectTypeOf(useRouteData(loader)).toEqualTypeOf<RouteData<{ id: string }>>()
  expectTypeOf(useRouteDataPreload).returns.toBeFunction()
  // @ts-expect-error required params
  router.preloadData({ name: 'item' }, loader)
  // @ts-expect-error an explicit loader is required
  router.preloadData('/item/1')
  defineRouteLoader(() => 1, {
    // @ts-expect-error scope is a session identity object, not a globally reusable account string
    preload: { scope: () => 'account', authorize: () => true },
  })
  defineRouteLoader(() => 1, {
    // @ts-expect-error permissions must already be known synchronously
    preload: { scope: () => session, authorize: async () => true },
  })
})
