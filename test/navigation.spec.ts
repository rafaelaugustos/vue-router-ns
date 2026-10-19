import { h } from 'nativescript-vue'
import { describe, expect, it, vi } from 'vitest'
import {
  isNavigationFailure,
  navigateTo,
  NavigationFailureType,
  onBeforeRouteLeave,
  RouterView,
  useNavigateTo,
  useRoute,
  useRouter,
  type NavigateTo,
  type NavigateToOptions,
  type RouteLocation,
  type Router,
} from '../src/index.js'
import { mount, page, paths, settle } from './helpers.js'
import { Frame, pressAndroidBack } from './shims/core.js'
import { dismissAttempted } from '../src/ios.js'

describe('native navigation helpers', () => {
  it('settles after native completion and forwards push/replace options', async () => {
    const { router, frame } = await mount([
      { path: '/', component: page('Root') },
      { path: '/item/:id', component: page('Item') },
    ])
    let completed = false
    const attempt = navigateTo(router, '/item/1', {
      animated: false,
      props: { value: 42 },
    }).then((failure) => {
      completed = true
      return failure
    })
    expect(completed).toBe(false)
    expect(await attempt).toBeUndefined()
    expect(frame().currentPage).not.toBeNull()
    expect(router.currentRoute.value.path).toBe('/item/1')
    expect(Frame.navigations.at(-1)).toMatchObject({ animated: false })

    await navigateTo(router, '/item/2', { replace: true, clearHistory: true })
    expect(paths(router.stack.value)).toEqual(['/item/2'])
    expect(frame().backStack).toHaveLength(0)
  })

  it('retains the owning stack and page route while another stack is focused', async () => {
    const captured: { route: RouteLocation; navigate: NavigateTo; router: Router }[] = []
    const Item = page('Item', () => {
      captured.push({ route: useRoute(), navigate: useNavigateTo(), router: useRouter() })
    })
    const { router } = await mount(
      [
        { path: '/', component: page('Root') },
        { path: '/item/:id', component: Item },
      ],
      {
        render: () =>
          h('GridLayout', [
            h(RouterView, { name: 'left' }),
            h(RouterView, { name: 'right' }),
          ]),
      },
    )
    await settle()
    await router.push('/item/1', { frame: 'left' })
    const left = captured[0]!
    await router.push('/item/2', { frame: 'right' })
    const right = captured[1]!
    await left.navigate('/item/3')
    expect(left.route.path).toBe('/item/1')
    expect(right.route.path).toBe('/item/2')
    expect(paths(left.router.stack.value)).toEqual(['/', '/item/1', '/item/3'])
    expect(paths(right.router.stack.value)).toEqual(['/', '/item/2'])
    await left.navigate('/item/4', { frame: 'right', replace: true })
    expect(paths(right.router.stack.value)).toEqual(['/', '/item/4'])
  })

  it('keeps repeated paths as distinct page contexts and refuses a disposed helper', async () => {
    const captured: { route: RouteLocation; navigate: NavigateTo }[] = []
    const { router, app } = await mount([
      { path: '/', component: page('Root') },
      {
        path: '/item',
        component: page('Item', () => {
          captured.push({ route: useRoute(), navigate: useNavigateTo() })
        }),
      },
    ])
    await router.push('/item')
    await captured[0]!.navigate({ path: '/item', force: true })
    expect(captured).toHaveLength(2)
    expect(captured[0]!.route).not.toBe(captured[1]!.route)
    await router.back()
    await expect(captured[1]!.navigate('/')).rejects.toThrow('unmounted')
    expect(paths(router.stack.value)).toEqual(['/', '/item'])
    app.unmount()
    await expect(captured[0]!.navigate('/')).rejects.toThrow('unmounted')
  })

  it('preserves modal result delivery while helper navigation settles at presentation', async () => {
    let navigate!: NavigateTo
    let modalRouter!: Router
    const { router } = await mount([
      {
        path: '/',
        component: page('Root', () => {
          navigate = useNavigateTo()
        }),
      },
      {
        path: '/modal',
        component: page('Modal', () => {
          modalRouter = useRouter()
        }),
        modal: true,
      },
    ])
    await navigate('/modal')
    expect(router.currentRoute.value.path).toBe('/modal')
    await modalRouter.back()
    let returned = false
    const result = router.pushForResult<string>('/modal').then((value) => {
      returned = true
      return value
    })
    await settle()
    expect(returned).toBe(false)
    await modalRouter.back({ result: 'accepted' })
    expect(await result).toBe('accepted')
  })

  it.each(['ios', 'android'] as const)(
    'preserves guarded back and modal refusal on %s',
    async (platform) => {
      let navigate!: NavigateTo
      let owned!: Router
      let allow = false
      const { router, frame } = await mount(
        [
          {
            path: '/',
            component: page('Root', () => {
              navigate = useNavigateTo()
            }),
          },
          {
            path: '/guarded',
            component: page('Guarded', () => {
              owned = useRouter()
              onBeforeRouteLeave(async () => allow)
            }),
          },
        ],
        { platform },
      )
      await navigate('/guarded')
      const refused = await navigate('/', { replace: true })
      expect(isNavigationFailure(refused, NavigationFailureType.aborted)).toBe(true)
      expect(paths(router.stack.value)).toEqual(['/', '/guarded'])
      if (platform === 'android') pressAndroidBack()
      else expect(frame().currentPage!.enableSwipeBackNavigation).toBe(false)
      await settle()
      expect(router.currentRoute.value.path).toBe('/guarded')
      allow = true
      await owned.back()
      allow = false
      await navigate('/guarded', { modal: true })
      const attempt =
        platform === 'ios' ? dismissAttempted(frame() as never) : owned.back()
      await attempt
      await settle()
      expect(router.currentRoute.value.path).toBe('/guarded')
      allow = true
      await owned.back()
      expect(router.currentRoute.value.path).toBe('/')
    },
  )

  it('returns the same duplicate failures and reports guard errors only once', async () => {
    const { router } = await mount([
      { path: '/', component: page('Root') },
      { path: '/target', component: page('Target') },
    ])
    expect(
      isNavigationFailure(
        await navigateTo(router, '/'),
        NavigationFailureType.duplicated,
      ),
    ).toBe(true)
    const error = new Error('helper guard')
    const onError = vi.fn()
    router.onError(onError)
    router.beforeEach(() => {
      throw error
    })
    await expect(navigateTo(router, '/target')).rejects.toBe(error)
    expect(onError).toHaveBeenCalledOnce()
  })

  it('requires page setup for the composable and explicit context for the standalone helper', () => {
    expect(() => useNavigateTo()).toThrow('inside a routed page')
  })

  it.each(['https://example.com', '//example.com', 'mailto:hello@example.com'])(
    'rejects external URL %s',
    async (url) => {
      const { router } = await mount([{ path: '/', component: page('Root') }])
      await expect(navigateTo(router, url)).rejects.toThrow('external URL')
      await expect(navigateTo(router, { path: url })).rejects.toThrow('external URL')
      expect(paths(router.stack.value)).toEqual(['/'])
    },
  )

  it.each(['external', 'open', 'redirectCode'])(
    'rejects unsupported Nuxt option %s from JavaScript',
    async (key) => {
      const { router } = await mount([{ path: '/', component: page('Root') }])
      await expect(
        navigateTo(router, '/', { [key]: true } as NavigateToOptions),
      ).rejects.toThrow(`"${key}"`)
    },
  )
})
