import { PageTransition, SharedTransition } from '@nativescript/core'
import { defineComponent } from 'nativescript-vue'
import { describe, expectTypeOf, it } from 'vitest'
import {
  createRouter,
  defineRouteMiddleware,
  navigateTo,
  useNavigateTo,
  type NavigateTo,
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

  it('checks helper locations and supports only native options', () => {
    navigateTo(
      router,
      { name: 'user', params: { id: 1 } },
      { replace: true, frame: 'settings', modal: true },
    )
    // @ts-expect-error: missing required param
    navigateTo(router, { name: 'user' })
    // @ts-expect-error: unknown name must not widen the inferred router map
    navigateTo(router, { name: 'nope' })
    // @ts-expect-error: browser options are not native navigation options
    navigateTo(router, '/', { external: true })
    expectTypeOf(useNavigateTo).returns.toEqualTypeOf<NavigateTo>()
  })

  it('types middleware like existing guards and preserves metadata references', () => {
    const auth = defineRouteMiddleware((to, from, info) => {
      expectTypeOf(to.fullPath).toBeString()
      expectTypeOf(from.params).toEqualTypeOf<Record<string, string | string[]>>()
      expectTypeOf(info.type).toEqualTypeOf<'push' | 'replace' | 'back'>()
      return to.meta.requiresAuth ? { name: 'home' } : undefined
    })
    router.addRouteMiddleware('auth', auth, { global: true })
    router.addRoute({
      path: '/private',
      component: Page,
      meta: { middleware: ['auth', auth] },
    })
    // @ts-expect-error: middleware uses guard outcomes, not result objects
    defineRouteMiddleware(() => ({ redirectCode: 302 }))
    // @ts-expect-error: invalid middleware metadata
    router.addRoute({ path: '/invalid', meta: { middleware: 42 } })
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
  it('types optional native layouts without changing route types', () => {
    const router = createRouter({
      routes: [{ path: '/', name: 'home', component: Page, meta: { layout: 'shared' } }],
      layouts: { shared: Page, lazy: () => Promise.resolve({ default: Page }) },
      defaultLayout: 'shared',
    })
    router.push({ name: 'home' })
    router.addRoute({ path: '/own', component: Page, meta: { layout: false } })
    // @ts-expect-error: layout selection is a name or false
    router.addRoute({ path: '/invalid', meta: { layout: true } })
    // @ts-expect-error: defaults are explicitly named or disabled
    createRouter({ routes: [], defaultLayout: true })
    // @ts-expect-error: layout values are component factories/components
    createRouter({ routes: [], layouts: { invalid: 42 } })
  })
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
