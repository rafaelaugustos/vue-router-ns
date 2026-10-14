import { defineComponent, h, watchEffect } from 'nativescript-vue'
import { describe, expect, it } from 'vitest'
import {
  Deferred,
  RouterLink,
  RouterView,
  useRoute,
  type RouteLocation,
} from '../src/index.js'
import { events, mount, page, paths, settle } from './helpers.js'
import { Frame } from './shims/core.js'
import { views } from './shims/nativescript-vue.js'

const Home = page('Home')
const List = page('List')

describe('RouterLink', () => {
  it('makes its child navigate on tap, without adding a view', async () => {
    const Linked = defineComponent({
      render: () =>
        h('Page', [
          h(RouterLink, { to: '/list', transition: 'fade' }, () =>
            h('Button', { text: 'Go' }),
          ),
        ]),
    })
    const { router } = await mount([
      { path: '/', component: Linked },
      { path: '/list', component: List },
    ])
    const button = views.get('Button')!.at(-1)!

    button.notify({ eventName: 'tap' })
    await settle()

    expect(paths(router.stack.value)).toEqual(['/', '/list'])
    expect(Frame.navigations.at(-1)).toMatchObject({ transition: { name: 'fade' } })
  })
})

describe('$route', () => {
  it('is the route of the page a template renders in', async () => {
    const seen: string[] = []
    const Item = defineComponent({
      render() {
        seen.push(this.$route.fullPath)
        return h('Page')
      },
    })
    const { router } = await mount([
      { path: '/', component: Home },
      { path: '/item/:id', component: Item },
    ])

    await router.push('/item/1')
    await router.push('/item/2')

    expect(seen).toEqual(['/item/1', '/item/2'])
  })
})

describe('outside pages', () => {
  it('useRoute() follows the current route', async () => {
    const seen: string[] = []
    let route!: RouteLocation
    const Shell = defineComponent({
      setup() {
        route = useRoute()
        watchEffect(() => seen.push(route.fullPath))
        return () => h(RouterView)
      },
    })
    const { router } = await mount(
      [
        { path: '/', component: Home },
        { path: '/list', component: List },
      ],
      { render: () => h(Shell) },
    )

    await router.push('/list?page=2')

    expect(route.query).toEqual({ page: '2' })
    expect(seen.at(-1)).toBe('/list?page=2')
  })

  it('navigations started before the first page is up stack on top of it', async () => {
    const { router } = await mount(
      [
        { path: '/', component: Home },
        { path: '/list', component: List },
      ],
      { before: (router) => void router.push('/list') },
    )
    await settle()

    expect(paths(router.stack.value)).toEqual(['/', '/list'])
  })
})

describe('Deferred', () => {
  it('renders the fallback until the page is on screen, then the content', async () => {
    const Content = page('Content')
    const Heavy = defineComponent({
      render: () =>
        h('Page', [
          h(Deferred, null, {
            default: () => h(Content),
            fallback: () => h('ActivityIndicator'),
          }),
        ]),
    })
    const { router } = await mount([
      { path: '/', component: Home },
      { path: '/heavy', component: Heavy },
    ])

    const push = router.push('/heavy')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(views.get('ActivityIndicator')).toHaveLength(1)
    expect(events).not.toContain('mount Content')

    await push
    await settle()
    expect(events).toContain('mount Content')
  })

  it('renders right away outside a page', async () => {
    const Content = page('Content')
    const { router } = await mount([{ path: '/', component: Home }], {
      render: () => [h(RouterView), h(Deferred, null, { default: () => h(Content) })],
    })
    await settle()

    expect(events).toContain('mount Content')
    expect(router.currentRoute.value.path).toBe('/')
  })
})
