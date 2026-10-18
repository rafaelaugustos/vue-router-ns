import { h, ref } from 'nativescript-vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  isNavigationFailure,
  NavigationFailureType,
  RouterView,
  type LinkResult,
  type RouteRecordRaw,
  type SavedStacks,
} from '../src/index.js'
import { mount, page, paths, settle } from './helpers.js'
import {
  androidLinks,
  FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY,
  iosLinks,
  View,
} from './shims/core.js'

const Home = page('Home')
const Detail = page('Detail')
const Settings = page('Settings')
const Account = page('Account')
const Login = page('Login')
const Compose = page('Compose')
const routes = [
  { path: '/', component: Home },
  { path: '/items/:id', name: 'item', component: Detail, props: true },
  {
    path: '/settings',
    component: Settings,
    children: [{ path: 'account', name: 'account', component: Account }],
  },
  { path: '/login', component: Login },
  { path: '/compose', component: Compose, modal: true },
] satisfies RouteRecordRaw[]
const policy = { schemes: ['https', 'app'], hosts: ['example.com'] }

describe('links', () => {
  afterEach(() => vi.restoreAllMocks())

  it('resolve URLs under the policy', async () => {
    const { router } = await mount(routes, { links: policy })

    expect(router.resolveLink('https://example.com/items/7?tab=info#top')).toMatchObject({
      path: '/items/7',
      params: { id: '7' },
      query: { tab: 'info' },
      hash: '#top',
    })
    expect(router.resolveLink('HTTPS://Example.COM/items/7')?.path).toBe('/items/7')
    expect(router.resolveLink('app://items/9')?.path).toBe('/items/9')
    expect(router.resolveLink('/items/1')?.path).toBe('/items/1')
    expect(router.resolveLink('https://other.com/items/7')).toBeUndefined()
    expect(router.resolveLink('ftp://example.com/items/7')).toBeUndefined()
    expect(router.resolveLink('https://example.com/nowhere')).toBeUndefined()
    expect(router.resolveLink('not a url')).toBeUndefined()
    expect(router.resolveLink('')).toBeUndefined()
  })

  it('map links to typed locations', async () => {
    const { router } = await mount(routes, {
      links: {
        ...policy,
        map: (link) =>
          link.path.startsWith('/m/')
            ? { name: 'item', params: { id: link.path.slice(3) } }
            : link.path === '/private'
              ? null
              : { path: link.path, query: link.query },
      },
    })

    expect(router.resolveLink('https://example.com/m/42')?.fullPath).toBe('/items/42')
    expect(router.resolveLink('https://example.com/private')).toBeUndefined()
    const result = await router.openLink('https://example.com/private')
    expect(result.ignored).toBe('unmatched')
  })

  it('open a link with its parents, through the guards', async () => {
    const { router } = await mount(routes, { links: policy })

    const result = await router.openLink('https://example.com/settings/account')

    expect(paths(router.stack.value)).toEqual(['/', '/settings', '/settings/account'])
    expect(result.location?.path).toBe('/settings/account')
    expect(result.failure).toBeUndefined()
    expect(result.ignored).toBeUndefined()
    expect(result.link).toMatchObject({
      scheme: 'https',
      host: 'example.com',
      source: 'app',
    })
  })

  it('report what they do not take, to the caller and to listeners', async () => {
    const heard: LinkResult[] = []
    const { router } = await mount(routes, {
      links: policy,
      before: (router) => router.onLink((result) => heard.push(result)),
    })

    const results = await Promise.all([
      router.openLink('ftp://example.com/items/1'),
      router.openLink('https://elsewhere.com/items/1'),
      router.openLink('https://example.com/nothing/here'),
      router.openLink('::'),
    ])

    expect(results.map((result) => result.ignored)).toEqual([
      'scheme',
      'host',
      'unmatched',
      'malformed',
    ])
    expect(heard).toHaveLength(4)
    expect(paths(router.stack.value)).toEqual(['/'])
  })

  it('return the guard’s answer, so a login can resume the link', async () => {
    const { router } = await mount(routes, {
      links: policy,
      before: (router) =>
        router.beforeEach((to) => {
          if (to.path === '/settings/account') return '/login'
          if (to.path === '/items/13') return false
        }),
    })

    const redirected = await router.openLink('https://example.com/settings/account')
    expect(router.currentRoute.value.path).toBe('/login')
    expect(redirected.location?.path).toBe('/settings/account')
    expect(redirected.failure).toBeUndefined()

    const refused = await router.openLink('https://example.com/items/13')
    expect(isNavigationFailure(refused.failure, NavigationFailureType.aborted)).toBe(true)
  })

  it('wait for the first page on a cold start, and land on a restored stack', async () => {
    const cold = await mount(routes, {
      links: policy,
      before: (router) => void router.openLink('app://items/7'),
    })
    await settle()
    expect(paths(cold.router.stack.value)).toEqual(['/', '/items/7'])

    const saved: SavedStacks = {
      savedAt: Date.now(),
      stacks: { default: ['/', '/items/1'] },
    }
    const restored = await mount(routes, {
      links: policy,
      restore: { save: () => {}, load: () => saved },
      before: (router) => void router.openLink('app://items/7'),
    })
    await settle()
    expect(paths(restored.router.stack.value)).toEqual(['/', '/items/1', '/items/7'])
  })

  it('wait for the stack they target, and let the app select its tab first', async () => {
    const show = ref(false)
    const selected: string[] = []
    const { router } = await mount(routes, {
      links: {
        ...policy,
        frame(location) {
          const name = location.path.startsWith('/settings') ? 'settings' : 'inbox'
          selected.push(name)
          return name
        },
      },
      render: () => [
        h(RouterView, { name: 'inbox', initial: '/' }),
        ...(show.value
          ? [h(RouterView, { name: 'settings', initial: '/settings' })]
          : []),
      ],
    })

    let settledLink: LinkResult | undefined
    const pending = router
      .openLink('app://settings/account')
      .then((result) => (settledLink = result))
    await settle()
    expect(selected).toEqual(['settings'])
    expect(settledLink).toBeUndefined()

    show.value = true
    await settle()
    await pending

    expect(settledLink?.location?.path).toBe('/settings/account')
    expect(paths(router.stack.value)).toEqual(['/settings', '/settings/account'])
  })

  it('take Android intents once per launch, and every new intent', async () => {
    const heard: LinkResult[] = []
    const { router } = await mount(routes, {
      platform: 'android',
      links: policy,
      before: (router) => router.onLink((result) => heard.push(result)),
    })

    androidLinks.create('app://items/7')
    await settle()
    expect(paths(router.stack.value)).toEqual(['/', '/items/7'])

    androidLinks.create('app://items/7', { bundle: {} })
    androidLinks.create('app://items/8', { flags: FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY })
    androidLinks.create(null)
    await settle()
    expect(paths(router.stack.value)).toEqual(['/', '/items/7'])

    androidLinks.newIntent('app://items/9')
    await settle()
    expect(paths(router.stack.value)).toEqual(['/', '/items/7', '/items/9'])
    expect(heard.map((result) => result.link.source)).toEqual(['launch', 'resume'])
  })

  it('does not replay the old Android intent after process death', async () => {
    const heard = vi.fn()
    const { router } = await mount(routes, {
      platform: 'android',
      links: policy,
      before: (router) => router.onLink(heard),
    })
    await router.push('/settings')

    // Core emits activityCreated(null bundle), then a synthetic new intent,
    // then launch with the real savedInstanceState, even in a new JS runtime.
    androidLinks.create('app://items/7', { bundle: {} })
    await settle()
    expect(router.currentRoute.value.path).toBe('/settings')
    expect(heard).not.toHaveBeenCalled()

    androidLinks.newIntent('app://items/7')
    await settle()
    expect(router.currentRoute.value.path).toBe('/items/7')
    expect(heard).toHaveBeenCalledOnce()
  })

  it('take iOS URLs, Universal Links and scene connections', async () => {
    const { router } = await mount(routes, { links: policy })

    expect(iosLinks.launch(undefined, 'https://example.com/items/1')).toBe(true)
    await settle()
    expect(paths(router.stack.value)).toEqual(['/', '/items/1'])

    expect(iosLinks.openURL('app://items/2')).toBe(true)
    expect(iosLinks.openURL('other://items/3')).toBe(false)
    await settle()
    expect(iosLinks.continueUserActivity('https://example.com/items/4')).toBe(true)
    expect(iosLinks.continueUserActivity('https://elsewhere.com/items/5')).toBe(false)
    await settle()
    iosLinks.connectScene(['app://items/6'])
    await settle()
    iosLinks.connectScene([], ['https://example.com/items/7'])
    await settle()

    expect(paths(router.stack.value)).toEqual([
      '/',
      '/items/1',
      '/items/2',
      '/items/4',
      '/items/6',
      '/items/7',
    ])
  })

  it('treat a second system delivery of the same URL as the same tap', async () => {
    const heard: LinkResult[] = []
    let now = 1_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    const { router } = await mount(routes, {
      links: policy,
      before: (router) => router.onLink((result) => heard.push(result)),
    })

    iosLinks.openURL('app://items/1')
    now += 200
    iosLinks.openURL('app://items/1')
    await settle()
    expect(heard).toHaveLength(2)
    expect(heard.filter((result) => result.ignored === 'repeat')).toHaveLength(1)
    expect(paths(router.stack.value)).toEqual(['/', '/items/1'])

    await router.back()
    now += 5000
    iosLinks.openURL('app://items/1')
    await settle()
    expect(paths(router.stack.value)).toEqual(['/', '/items/1'])

    await router.back()
    now += 100
    await router.openLink('app://items/1')
    expect(paths(router.stack.value)).toEqual(['/', '/items/1'])
    expect(heard.filter((result) => result.ignored === 'repeat')).toHaveLength(1)
  })

  it('present a modal route, and follow the link options', async () => {
    const { router } = await mount(routes, {
      links: { ...policy, options: { clearHistory: true, withParents: false } },
    })
    await router.push('/items/1')

    await router.openLink('app://compose')
    expect(View.presented).toHaveLength(1)
    await router.back()

    await router.openLink('app://settings/account')
    expect(paths(router.stack.value)).toEqual(['/settings/account'])

    await router.openLink('app://items/2', { replace: true })
    expect(paths(router.stack.value)).toEqual(['/items/2'])
  })

  it('leave the system alone without the option, or with system off', async () => {
    const quiet = await mount(routes)
    iosLinks.openURL('app://items/1')
    await settle()
    expect(paths(quiet.router.stack.value)).toEqual(['/'])
    expect(quiet.router.resolveLink('app://items/1')?.path).toBe('/items/1')

    const off = await mount(routes, { links: { ...policy, system: false } })
    iosLinks.openURL('app://items/1')
    await settle()
    expect(paths(off.router.stack.value)).toEqual(['/'])
  })
})
