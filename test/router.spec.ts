import { h, nextTick, ref, type ShallowRef } from 'nativescript-vue'
import { describe, expect, it, vi } from 'vitest'
import {
  isNavigationFailure,
  NavigationFailureType,
  onBeforeRouteLeave,
  onPageActivated,
  onPageDeactivated,
  RouterView,
  useBackGesture,
  useRoute,
  useRouter,
  type BackGesture,
  type RouteLocation,
  type Router,
} from '../src/index.js'
import { events, mount, page, paths, settle } from './helpers.js'
import {
  Activity,
  Application,
  backOwner,
  Device,
  Frame,
  pressAndroidBack,
  swipeAndroidBack,
  View,
} from './shims/core.js'

const Home = page('Home')
const List = page('List')
const Detail = page('Detail')
const Settings = page('Settings')

const routes = [
  { path: '/', name: 'home', component: Home },
  { path: '/list', name: 'list', component: List },
  { path: '/items/:id', name: 'item', component: Detail, props: true },
  { path: '/settings', name: 'settings', component: Settings },
]

describe('stack', () => {
  it('starts on the initial route', async () => {
    const { router, frame } = await mount(routes)

    expect(router.currentRoute.value.name).toBe('home')
    expect(paths(router.stack.value)).toEqual(['/'])
    expect(frame().backStack).toHaveLength(0)
    expect(Frame.navigations[0]!.animated).toBe(false)
  })

  it('pushes pages on top of the native stack', async () => {
    const { router, frame } = await mount(routes)

    await router.push('/list')
    await router.push({ name: 'item', params: { id: 7 }, query: { tab: 'info' } })

    expect(router.currentRoute.value.fullPath).toBe('/items/7?tab=info')
    expect(router.currentRoute.value.params).toEqual({ id: '7' })
    expect(paths(router.stack.value)).toEqual(['/', '/list', '/items/7?tab=info'])
    expect(frame().backStack).toHaveLength(2)
  })

  it('goes back and destroys the page it leaves', async () => {
    const { router, frame } = await mount(routes)
    await router.push('/list')

    await router.back()

    expect(router.currentRoute.value.path).toBe('/')
    expect(frame().backStack).toHaveLength(0)
    expect(events).toContain('unmount List')
    expect(events).not.toContain('unmount Home')
  })

  it('replaces the page on top', async () => {
    const { router, frame } = await mount(routes)
    await router.push('/list')

    await router.replace('/settings')

    expect(paths(router.stack.value)).toEqual(['/', '/settings'])
    expect(frame().backStack).toHaveLength(1)
    expect(events).toContain('unmount List')
  })

  it('accepts `replace: true` in the location, like Vue Router', async () => {
    const { router } = await mount(routes)
    await router.push('/list')

    await router.push({ path: '/settings', replace: true })

    expect(paths(router.stack.value)).toEqual(['/', '/settings'])
  })

  it('clears the history', async () => {
    const { router, frame } = await mount(routes)
    await router.push('/list')
    await router.push('/settings')

    await router.push('/', { clearHistory: true })

    expect(paths(router.stack.value)).toEqual(['/'])
    expect(frame().backStack).toHaveLength(0)
    expect(events.filter((event) => event.startsWith('unmount'))).toEqual([
      'unmount Home',
      'unmount List',
      'unmount Settings',
    ])
  })

  it('goes back several pages, or back to a given one', async () => {
    const { router } = await mount(routes)
    await router.push('/list')
    await router.push('/items/1')
    await router.push('/items/2')
    await router.push('/settings')

    await router.go(-2)
    expect(paths(router.stack.value)).toEqual(['/', '/list', '/items/1'])

    await router.push('/settings')
    await router.backTo({ name: 'list' })
    expect(paths(router.stack.value)).toEqual(['/', '/list'])

    await expect(router.backTo('/settings')).rejects.toThrow(
      'No page matching "/settings"',
    )
  })

  it('ignores back() on the first page and go() forward', async () => {
    const { router } = await mount(routes)

    expect(await router.back()).toBeUndefined()
    expect(await router.go(1)).toBeUndefined()
    expect(paths(router.stack.value)).toEqual(['/'])
  })

  it('passes transitions and options to the frame', async () => {
    const { router } = await mount([
      ...routes,
      { path: '/fade', component: List, transition: 'fade' },
    ])

    await router.push('/list', { transition: 'slideTop', animated: true })
    await router.push('/fade')

    expect(Frame.navigations[1]).toMatchObject({
      transition: { name: 'slideTop' },
      animated: true,
    })
    expect(Frame.navigations[2]).toMatchObject({ transition: { name: 'fade' } })
  })

  it('throws for routes that do not exist', async () => {
    const { router } = await mount(routes)

    await expect(router.push('/nope')).rejects.toThrow('No route matches "/nope"')
    await expect(router.push({ name: 'nope' })).rejects.toThrow('No route named "nope"')
  })
})

describe('pages', () => {
  it('give each page its own route, frozen while others are pushed on top', async () => {
    const seen: RouteLocation[] = []
    const Item = page('Item', () => seen.push(useRoute()))
    const { router } = await mount([...routes, { path: '/item/:id', component: Item }])

    await router.push('/item/1')
    await router.push('/item/2')

    expect(seen.map((route) => route.params.id)).toEqual(['1', '2'])
    expect(router.currentRoute.value.params.id).toBe('2')
  })

  it('pass params as props when the record asks for it', async () => {
    let props: Record<string, unknown> = {}
    const Item = page('Item', (attrs) => (props = attrs))
    const { router } = await mount([
      ...routes,
      { path: '/item/:id', component: Item, props: true },
    ])

    await router.push('/item/3', { props: { preview: { title: 'Hi' } } })

    expect(props).toEqual({ id: '3', preview: { title: 'Hi' } })
  })

  it('load lazy components', async () => {
    const Lazy = page('Lazy')
    const loader = vi.fn(async () => ({ default: Lazy }))
    const { router } = await mount([...routes, { path: '/lazy', component: loader }])

    await router.push('/lazy')
    await router.back()
    await router.push('/lazy')

    expect(events.filter((event) => event === 'mount Lazy')).toHaveLength(2)
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('know when they are on screen', async () => {
    const Tracked = page('Tracked', () => {
      onPageActivated(() => events.push('activated'))
      onPageDeactivated(() => events.push('deactivated'))
    })
    const { router } = await mount([...routes, { path: '/tracked', component: Tracked }])

    await router.push('/tracked')
    await router.push('/list')
    await router.back()

    expect(events.filter((event) => event.endsWith('activated'))).toEqual([
      'activated',
      'deactivated',
      'activated',
    ])
  })
})

describe('guards', () => {
  it('run in Vue Router order', async () => {
    const order: string[] = []
    const { router } = await mount([
      ...routes,
      {
        path: '/guarded',
        component: Settings,
        beforeEnter: () => void order.push('beforeEnter'),
      },
    ])
    router.beforeEach(() => void order.push('beforeEach'))
    router.beforeResolve(() => void order.push('beforeResolve'))
    router.afterEach(() => void order.push('afterEach'))

    await router.push('/guarded')

    expect(order).toEqual(['beforeEach', 'beforeEnter', 'beforeResolve', 'afterEach'])
  })

  it('redirect from a guard', async () => {
    const { router } = await mount([
      ...routes,
      { path: '/login', name: 'login', component: Home },
      { path: '/account', component: Settings, meta: { requiresAuth: true } },
    ])
    router.beforeEach((to) => (to.meta.requiresAuth ? { name: 'login' } : undefined))

    await router.push('/account')

    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.redirectedFrom?.path).toBe('/account')
  })

  it('redirect the initial page', async () => {
    const Login = page('Login')
    const { router, frame } = await mount(
      [
        { path: '/', component: Home, meta: { requiresAuth: true } },
        { path: '/login', component: Login },
      ],
      {
        before: (router) =>
          router.beforeEach((to) => (to.meta.requiresAuth ? '/login' : true)),
      },
    )

    expect(paths(router.stack.value)).toEqual(['/login'])
    expect(frame().backStack).toHaveLength(0)
    expect(events).not.toContain('mount Home')
  })

  it('abort with false', async () => {
    const { router } = await mount(routes)
    router.beforeEach((to) => to.path !== '/settings')

    const failure = await router.push('/settings')

    expect(isNavigationFailure(failure, NavigationFailureType.aborted)).toBe(true)
    expect(router.currentRoute.value.path).toBe('/')
  })

  it('surface errors through onError and the returned promise', async () => {
    const { router } = await mount(routes)
    const onError = vi.fn()
    router.onError(onError)
    router.beforeEach(() => {
      throw new Error('boom')
    })

    await expect(router.push('/list')).rejects.toThrow('boom')
    expect(onError).toHaveBeenCalledOnce()
  })

  it('tell back navigations apart', async () => {
    const { router } = await mount(routes)
    const types: string[] = []
    router.beforeEach((_to, _from, { type }) => void types.push(type))

    await router.push('/list')
    await router.replace('/settings')
    await router.back()

    expect(types).toEqual(['push', 'replace', 'back'])
  })

  it('skip beforeEnter when staying on the same record', async () => {
    const beforeEnter = vi.fn()
    const { router } = await mount([
      ...routes,
      { path: '/p/:id', component: Detail, beforeEnter },
    ])

    await router.push('/p/1')
    await router.push('/p/2')

    expect(beforeEnter).toHaveBeenCalledOnce()
  })
})

describe('leave guards', () => {
  const Form = (when?: () => boolean, answer = false) =>
    page('Form', () => onBeforeRouteLeave(() => answer, { when }))

  it('run when the page is removed, not when something is pushed over it', async () => {
    const leave = vi.fn(() => true)
    const Editor = page('Editor', () => onBeforeRouteLeave(leave))
    const { router } = await mount([...routes, { path: '/editor', component: Editor }])

    await router.push('/editor')
    await router.push('/list')
    expect(leave).not.toHaveBeenCalled()

    await router.back()
    await router.back()
    expect(leave).toHaveBeenCalledOnce()
  })

  it('keep the page when they say no', async () => {
    const { router } = await mount([...routes, { path: '/form', component: Form() }])
    await router.push('/form')

    const failure = await router.back()

    expect(isNavigationFailure(failure, NavigationFailureType.aborted)).toBe(true)
    expect(router.currentRoute.value.path).toBe('/form')
  })

  it('only guard while `when` holds, and block the iOS swipe meanwhile', async () => {
    const dirty = ref(true)
    const { router, frame } = await mount([
      ...routes,
      { path: '/form', component: Form(() => dirty.value) },
    ])
    await router.push('/form')
    const form = frame().currentPage!

    expect(form.enableSwipeBackNavigation).toBe(false)
    expect(await router.back()).toBeDefined()

    dirty.value = false
    await nextTick()
    expect(form.enableSwipeBackNavigation).toBe(true)
    expect(await router.back()).toBeUndefined()
    expect(router.currentRoute.value.path).toBe('/')
  })

  it('run for every page a multi-page back removes, top first', async () => {
    const order: string[] = []
    const Step = (name: string) =>
      page(name, () => onBeforeRouteLeave(() => void order.push(name)))
    const { router } = await mount([
      ...routes,
      { path: '/a', component: Step('a') },
      { path: '/b', component: Step('b') },
    ])
    await router.push('/a')
    await router.push('/b')

    await router.go(-2)

    expect(order).toEqual(['b', 'a'])
  })
})

describe('system back', () => {
  it('follows an iOS swipe it did not start', async () => {
    const { router, frame } = await mount(routes)
    const after = vi.fn()
    router.afterEach(after)
    await router.push('/list')

    frame().popNatively()

    expect(router.currentRoute.value.path).toBe('/')
    expect(after).toHaveBeenLastCalledWith(
      expect.objectContaining({ path: '/' }),
      expect.objectContaining({ path: '/list' }),
      undefined,
    )
  })

  it('routes the Android back button through the guards', async () => {
    const Form = page('Form', () => onBeforeRouteLeave(() => false))
    const { router } = await mount([...routes, { path: '/form', component: Form }], {
      platform: 'android',
    })
    await router.push('/form')

    expect(pressAndroidBack().cancel).toBe(true)
    await settle()

    expect(router.currentRoute.value.path).toBe('/form')
  })

  it('goes back on the Android back button when nothing objects', async () => {
    const { router } = await mount(routes, { platform: 'android' })
    await router.push('/list')

    expect(pressAndroidBack().cancel).toBe(true)
    await settle()

    expect(paths(router.stack.value)).toEqual(['/'])
  })

  it('lets Android close the app from the first page', async () => {
    await mount(routes, { platform: 'android' })

    expect(pressAndroidBack().cancel).toBe(false)
  })
})

describe('Android back gesture', () => {
  type Gesture = Readonly<ShallowRef<BackGesture | null>>
  const gestures: Record<string, Gesture> = {}
  const tracked = (name: string, setup?: () => void) =>
    page(name, () => {
      gestures[name] = useBackGesture()
      setup?.()
    })

  const gestureRoutes = [
    { path: '/', component: tracked('Home') },
    { path: '/list', component: tracked('List') },
    { path: '/pick', component: tracked('Picker'), modal: true },
    { path: '/locked', component: tracked('Locked'), modal: { cancelable: false } },
  ]

  it('reports the swipe to the page it would close', async () => {
    const { router } = await mount(gestureRoutes, { platform: 'android' })
    await router.push('/list')

    const swipe = swipeAndroidBack('right')
    expect(gestures.List!.value).toEqual({ progress: 0, edge: 'right' })
    swipe.move(0.4)
    expect(gestures.List!.value).toEqual({ progress: 0.4, edge: 'right' })
    expect(gestures.Home!.value).toBeNull()

    swipe.cancel()
    expect(gestures.List!.value).toBeNull()
    expect(paths(router.stack.value)).toEqual(['/', '/list'])
  })

  it('goes back through the router when the swipe is released', async () => {
    const leave = vi.fn()
    const { router } = await mount(gestureRoutes, {
      platform: 'android',
      before: (router) => router.beforeEach((to, from, info) => leave(info.type)),
    })
    await router.push('/list')

    const swipe = swipeAndroidBack()
    swipe.move(0.8)
    expect(swipe.release().cancel).toBe(true)
    expect(gestures.List!.value).toBeNull()
    await settle()

    expect(paths(router.stack.value)).toEqual(['/'])
    expect(leave).toHaveBeenLastCalledWith('back')
  })

  it('reports nothing while a leave guard is active', async () => {
    const dirty = ref(true)
    const Form = tracked('Form', () => onBeforeRouteLeave(() => false, { when: dirty }))
    const { router } = await mount(
      [...gestureRoutes, { path: '/form', component: Form }],
      {
        platform: 'android',
      },
    )
    await router.push('/form')

    swipeAndroidBack().move(0.5)
    expect(gestures.Form!.value).toBeNull()
    expect(pressAndroidBack().cancel).toBe(true)
    await settle()
    expect(router.currentRoute.value.path).toBe('/form')

    dirty.value = false
    swipeAndroidBack().move(0.5)
    expect(gestures.Form!.value).toEqual({ progress: 0.5, edge: 'left' })
  })

  it('reports nothing on the first page, and lets Android close the app', async () => {
    await mount(gestureRoutes, { platform: 'android' })

    const swipe = swipeAndroidBack()
    swipe.move(0.5)
    expect(gestures.Home!.value).toBeNull()

    expect(swipe.release().cancel).toBe(false)
    expect(Application.android.foregroundActivity!.finished).toBe(true)
  })

  it('follows swipes inside a modal, unless it is not cancelable', async () => {
    const { router } = await mount(gestureRoutes, { platform: 'android' })

    await router.push('/pick')
    await settle()
    const swipe = swipeAndroidBack()
    swipe.move(0.3)
    expect(gestures.Picker!.value).toEqual({ progress: 0.3, edge: 'left' })
    expect(gestures.Home!.value).toBeNull()
    swipe.release()
    await settle()
    expect(View.presented).toHaveLength(0)

    await router.push('/locked')
    await settle()
    swipeAndroidBack().move(0.3)
    expect(gestures.Locked!.value).toBeNull()
    pressAndroidBack()
    await settle()
    expect(View.presented).toHaveLength(1)
  })

  it('follows activities created later', async () => {
    const { router } = await mount(gestureRoutes, { platform: 'android' })
    await router.push('/list')

    const activity = new Activity()
    Application.android.foregroundActivity = activity
    Application.android.notify({ eventName: 'activityCreated', activity })

    swipeAndroidBack().move(0.6)
    expect(gestures.List!.value).toEqual({ progress: 0.6, edge: 'left' })
  })

  it('stays out of the way before Android 14, and once the app is unmounted', async () => {
    const legacy = await mount(gestureRoutes, {
      platform: 'android',
      before: () => (Device.sdkVersion = '33'),
    })
    expect(backOwner().getOnBackPressedDispatcher().enabledCount()).toBe(1)
    await legacy.router.push('/list')
    expect(pressAndroidBack().cancel).toBe(true)
    await settle()
    expect(paths(legacy.router.stack.value)).toEqual(['/'])

    const { app } = await mount(gestureRoutes, { platform: 'android' })
    const dispatcher = backOwner().getOnBackPressedDispatcher()
    expect(dispatcher.enabledCount()).toBe(2)
    app.unmount()
    expect(dispatcher.enabledCount()).toBe(1)
  })
})

describe('concurrency', () => {
  it('turns a double tap into a single page', async () => {
    const { router } = await mount(routes)

    const first = router.push('/list')
    await new Promise((resolve) => setTimeout(resolve, 0))
    const second = router.push('/list')

    expect(await first).toBeUndefined()
    expect(isNavigationFailure(await second, NavigationFailureType.duplicated)).toBe(true)
    expect(paths(router.stack.value)).toEqual(['/', '/list'])
  })

  it('keeps the last of two navigations started in the same tick', async () => {
    const { router } = await mount(routes)

    const [first, second] = await Promise.all([
      router.push('/list'),
      router.push('/settings'),
    ])

    expect(isNavigationFailure(first, NavigationFailureType.cancelled)).toBe(true)
    expect(second).toBeUndefined()
    expect(paths(router.stack.value)).toEqual(['/', '/settings'])
  })

  it('lets a newer navigation cancel one still in its guards', async () => {
    const { router } = await mount(routes)
    let release!: () => void
    router.beforeEach((to) =>
      to.path === '/list'
        ? new Promise<void>((resolve) => (release = resolve))
        : undefined,
    )

    const slow = router.push('/list')
    await settle()
    const fast = router.push('/settings')
    release()

    expect(isNavigationFailure(await slow, NavigationFailureType.cancelled)).toBe(true)
    expect(await fast).toBeUndefined()
    expect(paths(router.stack.value)).toEqual(['/', '/settings'])
  })

  it('waits for the first page when used before it is up', async () => {
    const { router } = await mount(routes)
    await router.push('/list')

    expect(paths(router.stack.value)).toEqual(['/', '/list'])
  })
})

describe('modals', () => {
  const Compose = page('Compose')
  const Picker = page('Picker')
  const modalRoutes = [
    ...routes,
    { path: '/compose', component: Compose, modal: { fullscreen: true } },
    { path: '/pick', component: Picker, modal: true },
  ]

  it('present modal routes in their own frame', async () => {
    const { router } = await mount(modalRoutes)

    await router.push('/compose')

    expect(View.presented).toHaveLength(1)
    expect(View.presented[0]!.view).toBeInstanceOf(Frame)
    expect(View.presented[0]!.options).toMatchObject({ fullscreen: true })
    expect(router.currentRoute.value.path).toBe('/compose')
  })

  it('push inside the modal from its pages, and close it from its first page', async () => {
    let modalRouter!: Router
    const Compose = page('Compose', () => (modalRouter = useRouter() as Router))
    const { router } = await mount([
      ...routes,
      { path: '/compose', component: Compose, modal: true },
    ])
    await router.push('/compose')

    await modalRouter.push('/list')
    expect(paths(modalRouter.stack.value)).toEqual(['/compose', '/list'])
    expect(paths(router.stack.value)).toEqual(['/compose', '/list'])

    await modalRouter.back()
    await modalRouter.back()

    expect(View.presented).toHaveLength(0)
    expect(router.currentRoute.value.path).toBe('/')
    expect(events).toContain('unmount Compose')
  })

  it('deliver a result to pushForResult', async () => {
    const { router } = await mount(modalRoutes)

    const result = router.pushForResult<string>('/pick')
    await settle()
    await router.back({ result: 'blue' })

    expect(await result).toBe('blue')
  })

  it('resolve pushForResult with undefined when closed by the system', async () => {
    const { router } = await mount(modalRoutes)
    const after = vi.fn()
    router.afterEach(after)

    const result = router.pushForResult('/pick')
    await settle()
    View.presented[0]!.view.closeModal()

    expect(await result).toBeUndefined()
    expect(router.currentRoute.value.path).toBe('/')
    expect(after).toHaveBeenLastCalledWith(
      expect.objectContaining({ path: '/' }),
      expect.objectContaining({ path: '/pick' }),
      undefined,
    )
  })

  it('work with plain pages too', async () => {
    const { router } = await mount(routes)

    const result = router.pushForResult<number>('/list')
    await settle()
    await router.back({ result: 42 })

    expect(await result).toBe(42)
  })

  it('do not open twice on a double tap', async () => {
    const { router } = await mount(modalRoutes)

    await Promise.all([router.push('/compose'), router.push('/compose')])

    expect(View.presented).toHaveLength(1)
  })

  it('cover the pages below', async () => {
    const Tracked = page('Tracked', () => onPageDeactivated(() => events.push('covered')))
    const { router } = await mount([
      ...modalRoutes,
      { path: '/tracked', component: Tracked },
    ])
    await router.push('/tracked')

    await router.push('/pick')

    expect(events).toContain('covered')
  })

  it('close on the Android back button, unless not cancelable', async () => {
    const { router } = await mount(
      [
        ...modalRoutes,
        { path: '/locked', component: Picker, modal: { cancelable: false } },
      ],
      { platform: 'android' },
    )

    await router.push('/pick')
    expect(pressAndroidBack().cancel).toBe(true)
    await settle()
    expect(View.presented).toHaveLength(0)

    await router.push('/locked')
    pressAndroidBack()
    await settle()
    expect(View.presented).toHaveLength(1)
  })
})

describe('tabs', () => {
  it('keep one stack per RouterView and navigate in the one a page lives in', async () => {
    let feedRouter!: Router
    const Feed = page('Feed', () => (feedRouter = useRouter() as Router))
    const Profile = page('Profile')
    const { router } = await mount(
      [
        { path: '/feed', component: Feed },
        { path: '/profile', component: Profile },
        { path: '/post/:id', component: Detail },
      ],
      {
        render: () => [
          h(RouterView, { name: 'feed', initial: '/feed' }),
          h(RouterView, { name: 'profile', initial: '/profile' }),
        ],
      },
    )
    await settle()

    await feedRouter.push('/post/1')
    await router.push('/post/2', { frame: 'profile' })

    expect(paths(feedRouter.stack.value)).toEqual(['/feed', '/post/1'])
    expect(router.currentRoute.value.path).toBe('/post/2')
    expect(Frame.stack).toHaveLength(2)
  })
})

describe('redirect records', () => {
  it('follow redirects and keep the query', async () => {
    const { router } = await mount([
      ...routes,
      { path: '/old-settings', redirect: '/settings' },
      {
        path: '/u/:id',
        redirect: (to: RouteLocation) => ({ name: 'item', params: to.params }),
      },
    ])

    await router.push('/old-settings?from=email')
    expect(router.currentRoute.value.fullPath).toBe('/settings?from=email')
    expect(router.currentRoute.value.redirectedFrom?.path).toBe('/old-settings')

    await router.push('/u/9')
    expect(router.currentRoute.value.fullPath).toBe('/items/9')
  })
})
