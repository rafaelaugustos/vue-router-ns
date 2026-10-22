import { createApp, defineComponent, h, type ShallowRef } from 'nativescript-vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createRouter,
  getWindowRoute,
  NavigationFailureType,
  onPageDeactivated,
  RouterView,
  useBackGesture,
  usePageState,
  useRouter,
  type BackGesture,
  type RestoreOptions,
  type SavedStacks,
  type RouterWindow,
} from '../src/index.js'
import { page, paths, settle } from './helpers.js'
import {
  Activity,
  Application,
  Device,
  Frame,
  NativeWindow,
  resetNative,
  setPlatform,
  View,
  iosLinks,
} from './shims/core.js'

const apps: ReturnType<typeof createApp>[] = []
const routes = [
  { path: '/', name: 'home', component: page('Home') },
  { path: '/items/:id', name: 'item', component: page('Item') },
  { path: '/compose', component: page('Compose'), modal: true },
] as const

async function mountWindow(
  window: NativeWindow,
  restore?: RestoreOptions,
  links = false,
) {
  const router = createRouter({
    routes,
    window: window as unknown as RouterWindow,
    restore,
    links,
  })
  const Root = defineComponent({ render: () => h(RouterView) })
  const app = createApp(Root)
  apps.push(app)
  app.use(router)
  const vm = app.start()!
  const frame = vm.$el.nativeView as Frame
  window.setContent(frame)
  await router.isReady()
  return { router, frame, app }
}

beforeEach(() => {
  resetNative()
  setPlatform('android')
})

afterEach(() => {
  for (const app of apps.splice(0)) app.unmount()
  vi.restoreAllMocks()
})

describe('NativeWindow ownership', () => {
  it('preserves existing single-window restores when the inferred primary ID changes', async () => {
    let saved: SavedStacks | null = null
    async function boot(id: string) {
      const window = Object.assign(new NativeWindow(id), { isPrimary: true })
      const router = createRouter({
        routes,
        restore: {
          save: (state) => {
            saved = state
          },
          load: () => saved,
        },
      })
      const app = createApp({ render: () => h(RouterView) }).use(router)
      apps.push(app)
      window.setContent(app.start()!.$el.nativeView)
      await router.isReady()
      return { router, app }
    }
    const first = await boot('before-process-death')
    await first.router.push('/items/1')
    first.app.unmount()
    const second = await boot('after-process-death')
    expect(paths(second.router.stack.value)).toEqual(['/', '/items/1'])
    expect(saved!.windowKey).toBe('primary')
  })

  it('restores duplicate page identities and UI state separately for each window', async () => {
    const received = new Map<string, string[]>()
    const draftPage = page('Draft', () => {
      const key = useRouter().options.restore!.key!
      usePageState('draft', {
        save: () => '',
        restore: (value: string) =>
          received.set(key, [...(received.get(key) ?? []), value]),
      })
    })
    for (const key of ['a', 'b']) {
      const window = new NativeWindow(`new-${key}`)
      const router = createRouter({
        window,
        routes: [{ path: '/', component: draftPage }],
        restore: {
          key,
          save: () => {},
          load: (scope) => ({
            version: 2,
            windowKey: scope!.key,
            savedAt: Date.now(),
            stacks: { default: ['/', '/'] },
            entries: {
              default: [1, 2].map((n) => ({
                key: `${key}-${n}`,
                state: { draft: { version: 1, value: `${key} draft ${n}` } },
              })),
            },
          }),
        },
      })
      const app = createApp({ render: () => h(RouterView) }).use(router)
      apps.push(app)
      window.setContent(app.start()!.$el.nativeView)
      await router.isReady()
      await router.back()
    }
    expect(received.get('a')).toEqual(['a draft 1', 'a draft 2'])
    expect(received.get('b')).toEqual(['b draft 1', 'b draft 2'])
  })
  it('delivers Android intents only to their owning window and stops after close', async () => {
    const a = new NativeWindow('a')
    const b = new NativeWindow('b')
    const first = await mountWindow(a, undefined, true)
    const second = await mountWindow(b, undefined, true)
    const deliver = (window: NativeWindow, path: string) =>
      Application.android.notify({
        eventName: 'activityNewIntent',
        window,
        activity: window.android!.activity,
        intent: {
          getData: () => ({ toString: () => `app://${path}` }),
          getFlags: () => 0,
        },
      })
    deliver(b, 'items/2')
    await settle()
    expect(paths(first.router.stack.value)).toEqual(['/'])
    expect(paths(second.router.stack.value)).toEqual(['/', '/items/2'])
    const heard = vi.fn()
    second.router.onLink(heard)
    b.close()
    deliver(b, 'items/3')
    await settle()
    expect(heard).not.toHaveBeenCalled()
    expect(paths(first.router.stack.value)).toEqual(['/'])
  })

  it('routes iOS scene URLs and activities once, ignoring the forwarded app delegate', async () => {
    setPlatform('ios')
    const a = new NativeWindow('a')
    const b = new NativeWindow('b')
    Object.assign(a, { ios: { scene: {} } })
    Object.assign(b, { ios: { scene: {} } })
    const first = await mountWindow(a, undefined, true)
    const second = await mountWindow(b, undefined, true)
    const heard = vi.fn()
    second.router.onLink(heard)
    Application.ios.notify({
      eventName: 'sceneOpenURLContexts',
      window: b,
      urlContexts: {
        allObjects: {
          count: 1,
          objectAtIndex: () => ({ URL: { absoluteString: 'app://items/2' } }),
        },
      },
    })
    iosLinks.openURL('app://items/2')
    await settle()
    expect(heard).toHaveBeenCalledOnce()
    expect(paths(first.router.stack.value)).toEqual(['/'])
    expect(paths(second.router.stack.value)).toEqual(['/', '/items/2'])
    Application.ios.notify({
      eventName: 'sceneContinueUserActivity',
      window: a,
      userActivity: {
        activityType: 'NSUserActivityTypeBrowsingWeb',
        webpageURL: { absoluteString: 'https://example.com/items/1' },
      },
    })
    iosLinks.continueUserActivity('https://example.com/items/1')
    await settle()
    expect(paths(first.router.stack.value)).toEqual(['/', '/items/1'])
    expect(paths(second.router.stack.value)).toEqual(['/', '/items/2'])
    b.close()
    expect(Application.ios.listenerCount('sceneOpenURLContexts')).toBe(1)
  })

  it('disables legacy UIKit delegate closures after the router app is unmounted', async () => {
    setPlatform('ios')
    const { router, app } = await mountWindow(new NativeWindow('a'), undefined, true)
    const heard = vi.fn()
    router.onLink(heard)
    app.unmount()
    iosLinks.openURL('app://items/1')
    await settle()
    expect(heard).not.toHaveBeenCalled()
  })
  it('keeps identically named stacks, guards and system back independent of global focus', async () => {
    const a = new NativeWindow('a')
    const b = new NativeWindow('b')
    const first = await mountWindow(a)
    const second = await mountWindow(b)
    const firstGuard = vi.fn(() => false)
    const secondGuard = vi.fn()
    first.router.beforeEach(firstGuard)
    second.router.beforeEach(secondGuard)

    expect((await first.router.push('/items/1'))?.type).toBe(
      NavigationFailureType.aborted,
    )
    firstGuard.mockReturnValue(true)
    await first.router.push('/items/1')
    await second.router.push('/items/2')
    firstGuard.mockClear()
    secondGuard.mockClear()
    expect(Frame.topmost()).toBe(second.frame)

    a.android!.activity.getOnBackPressedDispatcher().onBackPressed()
    await settle()
    expect(paths(first.router.stack.value)).toEqual(['/'])
    expect(paths(second.router.stack.value)).toEqual(['/', '/items/2'])
    expect(firstGuard).toHaveBeenCalledOnce()
    expect(secondGuard).not.toHaveBeenCalled()
    expect(first.router.window.value).toBe(a)

    // Back at A's root belongs to the platform; B must not pop.
    a.android!.activity.getOnBackPressedDispatcher().onBackPressed()
    await settle()
    expect(a.android!.activity.finished).toBe(true)
    expect(paths(second.router.stack.value)).toEqual(['/', '/items/2'])
  })

  it('does not let a globally prioritized unbound Frame divert back from its window', async () => {
    const window = new NativeWindow('a')
    const { router } = await mountWindow(window)
    await router.push('/items/1')
    const unbound = new Frame()
    vi.spyOn(Frame, 'topmost').mockReturnValue(unbound)
    window.android!.activity.getOnBackPressedDispatcher().onBackPressed()
    await settle()
    expect(paths(router.stack.value)).toEqual(['/'])
    expect(window.android!.activity.finished).toBe(false)
  })

  it('presents simultaneous modals from their own window and settles only the closed owner', async () => {
    const a = new NativeWindow('a')
    const b = new NativeWindow('b')
    const first = await mountWindow(a)
    const second = await mountWindow(b)
    let firstResult: unknown = 'pending'
    let secondResult: unknown = 'pending'
    const pa = first.router
      .pushForResult('/compose')
      .then((value) => (firstResult = value))
    await settle()
    const pb = second.router
      .pushForResult('/compose')
      .then((value) => (secondResult = value))
    await settle()
    expect(View.presented).toHaveLength(2)
    expect(View.presented[0]!.view.getNativeWindow()).toBe(a)
    expect(View.presented[1]!.view.getNativeWindow()).toBe(b)
    a.close()
    await pa
    expect(firstResult).toBeUndefined()
    expect(secondResult).toBe('pending')
    expect(View.presented).toHaveLength(1)
    expect(second.router.currentRoute.value.path).toBe('/compose')
    await second.router.back({ result: 'sent' })
    await pb
    expect(secondResult).toBe('sent')
  })

  it('removes callbacks from a detached Activity, rebinds once, and retains page instances/history', async () => {
    const window = new NativeWindow('document')
    const { router, frame } = await mountWindow(window)
    await router.push('/items/1')
    const current = frame.currentPage
    const old = window.android!.activity
    expect(old.getOnBackPressedDispatcher().enabledCount()).toBe(2)
    window.detach()
    expect(old.getOnBackPressedDispatcher().enabledCount()).toBe(1)
    const replacement = new Activity()
    window.attach(replacement)
    window.notify({ eventName: 'activityCreated', activity: replacement, window })
    expect(replacement.getOnBackPressedDispatcher().enabledCount()).toBe(2)
    expect(frame.currentPage).toBe(current)
    expect(paths(router.stack.value)).toEqual(['/', '/items/1'])
    replacement.getOnBackPressedDispatcher().onBackPressed()
    await settle()
    expect(paths(router.stack.value)).toEqual(['/'])
    window.close()
    expect(replacement.getOnBackPressedDispatcher().enabledCount()).toBe(1)
    expect(paths(router.stack.value)).toEqual([])
  })

  it('keeps pending page results through temporary detachment', async () => {
    const window = new NativeWindow('a')
    const { router } = await mountWindow(window)
    let result: unknown = 'pending'
    const pending = router.pushForResult('/items/1').then((value) => (result = value))
    await settle()
    window.detach()
    await settle()
    expect(result).toBe('pending')
    window.attach(new Activity())
    await router.back({ result: 'done' })
    await pending
    expect(result).toBe('done')
  })

  it('clears only the closed window snapshot even when closing a pending modal', async () => {
    const saved = new Map<string, SavedStacks | null>()
    const storage = (key: string): RestoreOptions => ({
      key,
      save: (state, context) => {
        saved.set(context!.key, state)
      },
      load: () => null,
    })
    const a = new NativeWindow('a')
    const b = new NativeWindow('b')
    const first = await mountWindow(a, storage('a'))
    const second = await mountWindow(b, storage('b'))
    await first.router.push('/items/1')
    const result = second.router.pushForResult('/compose')
    await settle()
    b.close()
    expect(await result).toBeUndefined()
    expect(saved.get('b')).toBeNull()
    expect(saved.get('a')!.stacks.default).toEqual(['/', '/items/1'])
  })

  it('runs modal leave guards only in the originating window', async () => {
    const first = await mountWindow(new NativeWindow('a'))
    const second = await mountWindow(new NativeWindow('b'))
    let canClose = false
    first.router.beforeEach((_to, from) => from.path !== '/compose' || canClose)
    const pa = first.router.pushForResult('/compose')
    await settle()
    let result: unknown = 'pending'
    const pb = second.router.pushForResult('/compose').then((value) => (result = value))
    await settle()
    const dispatcher = View.presented[0]!.view.dialog!.getOnBackPressedDispatcher()
    dispatcher.onBackPressed()
    await settle()
    expect(first.router.currentRoute.value.path).toBe('/compose')
    expect(second.router.currentRoute.value.path).toBe('/compose')
    expect(result).toBe('pending')
    canClose = true
    dispatcher.onBackPressed()
    await pa
    expect(first.router.currentRoute.value.path).toBe('/')
    expect(second.router.currentRoute.value.path).toBe('/compose')
    await second.router.back({ result: 'second' })
    await pb
    expect(result).toBe('second')
  })

  it('sends gesture progress only to the window that owns the dispatcher', async () => {
    const gestures: ShallowRef<BackGesture | null>[] = []
    const Tracked = page('Tracked', () =>
      gestures.push(useBackGesture() as ShallowRef<BackGesture | null>),
    )
    const a = new NativeWindow('a')
    const b = new NativeWindow('b')
    for (const window of [a, b]) {
      const router = createRouter({
        routes: [...routes, { path: '/tracked', component: Tracked }],
        window: window as unknown as RouterWindow,
      })
      const app = createApp({ render: () => h(RouterView) })
      apps.push(app)
      app.use(router)
      const vm = app.start()!
      window.setContent(vm.$el.nativeView)
      await router.isReady()
      await router.push('/tracked')
    }
    const event = { getProgress: () => 0.4, getSwipeEdge: () => 0 }
    a.android!.activity.getOnBackPressedDispatcher().startGesture(event)
    expect(gestures[0]!.value).toEqual({ progress: 0.4, edge: 'left' })
    expect(gestures[1]!.value).toBeNull()
    a.android!.activity.getOnBackPressedDispatcher().cancelGesture()
    expect(gestures[0]!.value).toBeNull()
  })

  it('honors leave guards in the correct window before Android 14', async () => {
    Device.sdkVersion = '33'
    const a = new NativeWindow('a')
    const b = new NativeWindow('b')
    const first = await mountWindow(a)
    const second = await mountWindow(b)
    await first.router.push('/items/1')
    await second.router.push('/items/2')
    first.router.beforeEach(() => false)
    a.android!.activity.getOnBackPressedDispatcher().onBackPressed()
    await settle()
    expect(paths(first.router.stack.value)).toEqual(['/', '/items/1'])
    expect(paths(second.router.stack.value)).toEqual(['/', '/items/2'])
  })

  it('infers ownership from a loaded Frame and rejects a second router for that window', async () => {
    const window = new NativeWindow('a')
    const router = createRouter({ routes })
    const app = createApp({ render: () => h(RouterView) })
    apps.push(app)
    app.use(router)
    const vm = app.start()!
    window.setContent(vm.$el.nativeView)
    await router.isReady()
    expect(router.window.value).toBe(window)
    expect(Application.android.listenerCount('activityBackPressed')).toBe(1)
    const other = createRouter({ routes, window: window as unknown as RouterWindow })
    const duplicate = createApp({ render: () => h(RouterView) })
    expect(() => duplicate.use(other)).toThrow('already has a router')
  })

  it('namespaces snapshots and clearing by stable application keys', async () => {
    const snapshots = new Map<string, SavedStacks | null>()
    const storage = (key: string): RestoreOptions => ({
      key,
      save: (state, scope) => void snapshots.set(scope!.key, state),
      load: (scope) => snapshots.get(scope!.key),
    })
    const a = new NativeWindow('a')
    const b = new NativeWindow('b')
    const first = await mountWindow(a, storage('document:1'))
    const second = await mountWindow(b, storage('document:2'))
    await first.router.push('/items/1')
    await second.router.push('/items/2')
    a.detach()
    Application.notify({ eventName: 'exit' })
    expect(snapshots.get('document:1')!.stacks.default).toEqual(['/', '/items/1'])
    expect(snapshots.get('document:2')!.stacks.default).toEqual(['/', '/items/2'])

    // Reconnect the same scene before permanently closing only that window.
    a.attach(new Activity())
    a.close()
    expect(snapshots.get('document:1')).toBeNull()
    expect(snapshots.get('document:2')!.stacks.default).toEqual(['/', '/items/2'])

    // A reconstructed scene can use its app key even when the native ID changes.
    snapshots.set('document:1', {
      savedAt: Date.now(),
      stacks: { default: ['/', '/items/9'] },
    })
    const reconstructed = await mountWindow(
      new NativeWindow('new-native-id'),
      storage('document:1'),
    )
    expect(paths(reconstructed.router.stack.value)).toEqual(['/', '/items/9'])
  })

  it('does not deactivate a removed page when native disposal defers its Vue unmount', async () => {
    const deactivated = vi.fn()
    const tracked = page('Tracked', () => onPageDeactivated(deactivated))
    const window = new NativeWindow('a')
    const router = createRouter({
      routes: [...routes, { path: '/tracked', component: tracked }],
      window: window as unknown as RouterWindow,
    })
    const app = createApp({ render: () => h(RouterView) })
    apps.push(app)
    app.use(router)
    const vm = app.start()!
    window.setContent(vm.$el.nativeView)
    await router.isReady()
    await router.push('/tracked')
    await router.back()
    await settle()
    expect(deactivated).not.toHaveBeenCalled()
  })

  it('ignores a snapshot tagged for another window key', async () => {
    const saved: SavedStacks = {
      savedAt: Date.now(),
      windowKey: 'other',
      stacks: { default: ['/', '/items/99'] },
    }
    const { router } = await mountWindow(new NativeWindow('a'), {
      key: 'mine',
      save: () => {},
      load: () => saved,
    })
    expect(paths(router.stack.value)).toEqual(['/'])
  })

  it('opens a resolved typed route with serializable metadata without navigating the source window', async () => {
    setPlatform('ios')
    const open = vi.spyOn(Application, 'openWindow')
    const { router } = await mountWindow(new NativeWindow('a'))
    router.openWindow(
      { name: 'item', params: { id: 42 }, query: { source: 'window' } },
      { data: { documentId: '42' } },
    )
    const data = open.mock.calls[0]![0]!.data!
    expect(data.documentId).toBe('42')
    expect(getWindowRoute(data)).toBe('/items/42?source=window')
    expect(paths(router.stack.value)).toEqual(['/'])
    expect(
      getWindowRoute({ __vueRouterNS: { version: 2, fullPath: '/items/1' } }),
    ).toBeUndefined()
    expect(
      getWindowRoute({ __vueRouterNS: { version: 1, fullPath: 'https://example.com' } }),
    ).toBeUndefined()
    expect(() => router.openWindow('/unknown')).toThrow('No route matches')
    expect(open).toHaveBeenCalledOnce()
  })

  it('keeps the legacy router usable when NativeWindow APIs are unavailable', async () => {
    const getWindows = Application.getWindows
    Object.assign(Application, { getWindows: undefined })
    try {
      expect(() =>
        createRouter({
          routes,
          window: new NativeWindow('a') as unknown as RouterWindow,
        }),
      ).toThrow('9.1')
      const router = createRouter({ routes })
      const app = createApp({ render: () => h(RouterView) })
      apps.push(app)
      app.use(router)
      app.start()
      await router.isReady()
      await router.push('/items/1')
      expect(paths(router.stack.value)).toEqual(['/', '/items/1'])
      expect(() => router.openWindow('/items/2')).toThrow('9.1')
    } finally {
      Application.getWindows = getWindows
    }
  })
})
