import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  supportsShortcuts,
  type LinkResult,
  type RouteRecordRaw,
  type RouteShortcut,
} from '../src/index.js'
import { mount, page, paths, settle } from './helpers.js'
import {
  androidLinks,
  installShortcuts,
  iosLinks,
  shortcuts,
  View,
} from './shims/core.js'

const routes = [
  { path: '/', component: page('Home') },
  { path: '/items/:id', name: 'item', component: page('Detail'), props: true },
  { path: '/settings', component: page('Settings') },
  { path: '/compose', component: page('Compose'), modal: true },
] satisfies RouteRecordRaw[]
const items: RouteShortcut[] = [
  {
    id: 'compose',
    title: 'New message',
    to: '/compose',
    icon: { android: 'ic_compose', ios: 'square.and.pencil' },
  },
  { id: 'settings', title: 'Settings', subtitle: 'Account and more', to: '/settings' },
  {
    id: 'item',
    title: 'Item 7',
    to: { name: 'item', params: { id: 7 }, query: { tab: 'info' } },
  },
]

describe('home-screen shortcuts', () => {
  let uninstall: () => void
  beforeEach(() => {
    uninstall = installShortcuts()
  })
  afterEach(() => {
    uninstall()
    vi.restoreAllMocks()
  })

  it('publish Android dynamic shortcuts that open their routes through the links pipeline', async () => {
    const heard: LinkResult[] = []
    const { router } = await mount(routes, {
      platform: 'android',
      links: { schemes: ['https'] },
      before: (router) => router.onLink((result) => heard.push(result)),
    })

    expect(supportsShortcuts()).toBe(true)
    expect(router.setShortcuts(items)).toEqual(['compose', 'settings', 'item'])
    expect(shortcuts.android.map((shortcut) => shortcut.id)).toEqual([
      'compose',
      'settings',
      'item',
    ])
    expect(shortcuts.android[0]).toMatchObject({
      shortLabel: 'New message',
      longLabel: 'New message',
    })
    expect(shortcuts.android[0]!.icon).toBe(42)
    expect(shortcuts.android[1]).toMatchObject({ longLabel: 'Account and more' })
    expect(shortcuts.android[2]!.url).toBe(
      'vue-router-ns://shortcut/item?to=%2Fitems%2F7%3Ftab%3Dinfo&v=1',
    )

    androidLinks.newIntent(shortcuts.android[2]!.url)
    await settle()
    expect(router.currentRoute.value.fullPath).toBe('/items/7?tab=info')
    expect(heard[0]!.link.shortcut).toBe('item')
    expect(heard[0]!.link.source).toBe('resume')

    androidLinks.newIntent(shortcuts.android[0]!.url)
    await settle()
    expect(View.presented).toHaveLength(1)
  })

  it('publish iOS quick actions and take their taps on launch and while running', async () => {
    const { router } = await mount(routes, { links: { schemes: ['https'] } })

    router.setShortcuts(items)
    expect(shortcuts.ios.map((item) => item.type)).toEqual([
      'compose',
      'settings',
      'item',
    ])
    expect(shortcuts.ios[0]).toMatchObject({
      title: 'New message',
      subtitle: null,
      icon: 'symbol:square.and.pencil',
    })

    const { returned, completed } = iosLinks.performShortcut(shortcuts.ios[1])
    await settle()
    expect(returned).toBe(true)
    expect(completed).toBe(true)
    expect(paths(router.stack.value)).toEqual(['/', '/settings'])

    iosLinks.connectScene([], [], shortcuts.ios[2])
    await settle()
    expect(router.currentRoute.value.fullPath).toBe('/items/7?tab=info')

    const foreign = iosLinks.performShortcut({
      type: 'other',
      userInfo: { objectForKey: () => null },
    })
    expect(foreign.returned).toBe(false)
    expect(foreign.completed).toBe(false)
  })

  it('remove every shortcut with an empty list, and respect the platform limit', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { router } = await mount(routes, { platform: 'android' })
    shortcuts.androidLimit = 2

    expect(router.setShortcuts(items)).toEqual(['compose', 'settings'])
    expect(shortcuts.android).toHaveLength(2)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('1 left out'))

    expect(router.setShortcuts([])).toEqual([])
    expect(shortcuts.android).toEqual([])
    shortcuts.androidLimit = 4
  })

  it('ignore a shortcut whose destination is gone, or whose payload is not the router’s', async () => {
    const heard: LinkResult[] = []
    const { router } = await mount(routes, {
      before: (router) => router.onLink((result) => heard.push(result)),
    })

    const stale = await router.openLink(
      'vue-router-ns://shortcut/old?to=%2Fretired%2F1&v=1',
    )
    const foreign = await router.openLink('vue-router-ns://shortcut/x?to=%2Fsettings&v=9')
    const noise = await router.openLink('vue-router-ns://anything')

    expect(stale.ignored).toBe('unmatched')
    expect(stale.link.shortcut).toBe('old')
    expect(foreign.ignored).toBe('malformed')
    expect(noise.ignored).toBe('malformed')
    expect(paths(router.stack.value)).toEqual(['/'])
    expect(heard).toHaveLength(3)
  })

  it('refuse unknown routes and duplicate ids when setting', async () => {
    const { router } = await mount(routes)

    expect(() => router.setShortcuts([{ id: 'x', title: 'X', to: '/nowhere' }])).toThrow(
      /No route matches/,
    )
    expect(() =>
      router.setShortcuts([
        { id: 'x', title: 'X', to: '/settings' },
        { id: 'x', title: 'Y', to: '/settings' },
      ]),
    ).toThrow(/Two shortcuts are named "x"/)
  })
})
