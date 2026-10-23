import { expectTypeOf, it } from 'vitest'
import {
  defineRouteLoader,
  useRouteData,
  type RouteData,
  type RouteLoaderContext,
  type RouteRecordRaw,
} from '../src/index.js'
import type { PageMeta } from '../src/file-routing/index.js'

it('infers async loader results and accepts named file metadata', () => {
  const product = defineRouteLoader(async (context) => {
    expectTypeOf(context).toEqualTypeOf<RouteLoaderContext>()
    return { id: String(context.to.params.id), price: 12 }
  })
  expectTypeOf(useRouteData(product)).toEqualTypeOf<
    RouteData<{ id: string; price: number }>
  >()
  const route: RouteRecordRaw = { path: '/products/:id', meta: { loaders: product } }
  const file: PageMeta = { meta: { loaders: ['product'] } }
  expectTypeOf(route).toMatchTypeOf<RouteRecordRaw>()
  expectTypeOf(file).toMatchTypeOf<PageMeta>()
  // @ts-expect-error A loader must be a definition or a registered name.
  const invalid: RouteRecordRaw = { path: '/', meta: { loaders: 42 } }
  const state = useRouteData(product)
  // @ts-expect-error Data is a read-only ref; updates belong to its invocation.
  state.data.value = { id: 'manual', price: 0 }
})
