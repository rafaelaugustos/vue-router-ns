import { PageTransition, SharedTransition } from '@nativescript/core'
import { defineComponent } from 'nativescript-vue'
import { describe, expectTypeOf, it } from 'vitest'
import {
  createRouter,
  type ParamsFromPath,
  type RouteLocationOf,
  type RouteRecordRaw,
  type Router,
} from '../src/index.js'

const Page = defineComponent({})

describe('ParamsFromPath', () => {
  it('reads params and their modifiers', () => {
    expectTypeOf<ParamsFromPath<'/'>>().toEqualTypeOf<{}>()
    expectTypeOf<ParamsFromPath<'/users/:id'>>().toEqualTypeOf<{ id: string }>()
    expectTypeOf<ParamsFromPath<'/users/:id?'>>().toEqualTypeOf<{ id?: string }>()
    expectTypeOf<ParamsFromPath<'/files/:path+'>>().toEqualTypeOf<{ path: string[] }>()
    expectTypeOf<ParamsFromPath<'/files/:path*'>>().toEqualTypeOf<{ path?: string[] }>()
    expectTypeOf<ParamsFromPath<'/orders/:id(\\d+)'>>().toEqualTypeOf<{ id: string }>()
    expectTypeOf<ParamsFromPath<'/:pathMatch(.*)*'>>().toEqualTypeOf<{
      pathMatch?: string[]
    }>()
    expectTypeOf<ParamsFromPath<'/range/:from-:to'>>().toEqualTypeOf<{
      from: string
      to: string
    }>()
  })
})

describe('typed routers', () => {
  const router = createRouter({
    routes: [
      { path: '/', name: 'home', component: Page },
      { path: '/users/:id', name: 'user', component: Page },
      {
        path: '/settings',
        children: [
          { path: '', name: 'settings', component: Page },
          { path: ':section', name: 'settings-section', component: Page },
        ],
      },
      { path: '/about', component: Page },
    ],
  })

  it('infers names and params, children included', () => {
    type M = typeof router extends Router<infer M> ? M : never

    expectTypeOf<keyof M>().toEqualTypeOf<
      'home' | 'user' | 'settings' | 'settings-section'
    >()
    expectTypeOf<M['user']['params']>().toEqualTypeOf<{ id: string }>()
    expectTypeOf<M['settings-section']['path']>().toEqualTypeOf<'/settings/:section'>()
  })

  it('checks named locations', () => {
    router.push({ name: 'user', params: { id: 1 } })
    router.push({ name: 'home' })
    router.push('/anything/goes/as/a/path')

    // @ts-expect-error: missing the required param
    router.push({ name: 'user' })
    // @ts-expect-error: unknown route name
    router.push({ name: 'nope' })
    // @ts-expect-error: unknown param
    router.push({ name: 'user', params: { slug: 'x' } })
  })

  it('takes shared transitions and zoom sources', () => {
    router.push('/about', { transition: SharedTransition.custom(new PageTransition()) })
    router.push('/about', { zoomFrom: { nativeView: null as never } })
    // @ts-expect-error: not a view
    router.push('/about', { zoomFrom: 'thumbnail' })
  })

  it('narrows a route by name', () => {
    type M = typeof router extends Router<infer M> ? M : never
    type User = RouteLocationOf<M, 'user'>

    expectTypeOf<User['params']>().toEqualTypeOf<{ id: string }>()
    expectTypeOf<User['name']>().toEqualTypeOf<'user'>()
  })
})

describe('untyped routers', () => {
  it('fall back to loose names and params', () => {
    const routes: RouteRecordRaw[] = [
      { path: '/users/:id', name: 'user', component: Page },
    ]
    const router = createRouter({ routes })

    router.push({ name: 'anything', params: { id: 1 } })
    expectTypeOf(router.currentRoute.value.params).toEqualTypeOf<
      Record<string, string | string[]>
    >()
  })
})
