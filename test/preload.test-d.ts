import { expectTypeOf, it } from 'vitest'
import {
  createRouter,
  useRoutePreload,
  type RoutePreload,
  type RoutePreloadResult,
  type RoutePreloadState,
} from '../src/index.js'

it('types destinations and exposes code preparation without data or native handles', () => {
  const router = createRouter({
    routes: [{ path: '/items/:id', name: 'item', component: {} }],
    preload: { concurrency: 2, maxEntries: 8, ttl: 5_000 },
  })
  const handle = router.preload({ name: 'item', params: { id: 1 } })
  expectTypeOf(handle).toEqualTypeOf<RoutePreload>()
  expectTypeOf(handle.ready).toEqualTypeOf<Promise<RoutePreloadResult>>()
  expectTypeOf(handle.state.value).toEqualTypeOf<RoutePreloadState>()
  expectTypeOf(useRoutePreload).returns.toBeFunction()
  // @ts-expect-error required param
  router.preload({ name: 'item' })
  // @ts-expect-error unknown name
  router.preload({ name: 'missing' })
  // @ts-expect-error no speculative data switch in this stage
  router.preload('/items/1', { data: true })
  // @ts-expect-error readonly state
  handle.state.value = { status: 'ready' }
  // @ts-expect-error no native object in the public handle
  handle.page
})
