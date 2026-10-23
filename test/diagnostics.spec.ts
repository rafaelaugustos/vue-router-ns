import { createApp, defineComponent, h, ref } from 'nativescript-vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createRouter,
  onBeforeRouteLeave,
  RouterSplitView,
  RouterView,
  type DiagnosticEvent,
  type RouterDiagnostics,
} from '../src/index.js'
import { createDiagnostics } from '../src/diagnostics.js'
import { mount, page, paths, settle } from './helpers.js'
import { Application, Frame, Page, View } from './shims/core.js'

const routes = [
  { path: '/', component: page('Home') },
  { path: '/items/:id', component: page('Item') },
  { path: '/compose', component: page('Compose'), modal: true },
] as const

afterEach(() => vi.restoreAllMocks())

const finished = (diagnostics: RouterDiagnostics, phase: DiagnosticEvent['phase']) =>
  diagnostics.events.filter((event) => event.phase === phase && event.status === 'end')

describe('opt-in router diagnostics', () => {
  it('does not call a clock, collect snapshots or add diagnostic listeners when disabled', async () => {
    const performance = (globalThis as { performance?: { now(): number } }).performance!
    const clock = vi.spyOn(performance, 'now')
    const { router, frame, app } = await mount(routes)
    await router.push('/items/1')
    await router.back()
    expect(router.diagnostics).toBeUndefined()
    expect(clock).not.toHaveBeenCalled()
    expect(frame().listenerCount(Frame.navigatedToEvent)).toBe(1)
    app.unmount()
  })

  it('correlates queue, individual guards, loading, synchronous mounting and native completion', async () => {
    const { router, app } = await mount(routes, { diagnostics: true })
    const diagnostics = router.diagnostics!
    diagnostics.clear()
    let release!: () => void
    router.beforeEach(
      () =>
        new Promise<void>((resolve) => {
          release = resolve
        }),
    )
    const pending = router.push('/items/sensitive-item-123?token=secret#private', {
      props: { password: 'private-prop' },
    })
    await settle()
    const waiting = diagnostics.snapshot()
    expect(waiting.stacks[0]!.busy).toBe(true)
    expect(waiting.issues).toEqual([])
    expect(diagnostics.events.at(-1)).toMatchObject({
      phase: 'guard',
      status: 'start',
      detail: 'beforeEach',
    })
    release()
    await pending
    const navigation = finished(diagnostics, 'navigation').at(-1)!
    expect(navigation.outcome).toBe('success')
    expect(navigation.route).toBe('/items/:id')
    const phases = diagnostics.events.filter(
      (event) => event.navigationId === navigation.navigationId && event.status === 'end',
    )
    expect(phases.map((event) => event.phase)).toEqual([
      'queue',
      'guard',
      'load',
      'mount',
      'transition',
      'navigation',
    ])
    expect(phases.every((event) => event.duration! >= 0)).toBe(true)
    expect(finished(diagnostics, 'guard')[0]!.duration).toBeGreaterThan(1)
    expect(diagnostics.snapshot().issues).toEqual([])
    expect(diagnostics.snapshot().stacks[0]!.logical.map((entry) => entry.route)).toEqual(
      ['/', '/items/:id'],
    )
    const json = diagnostics.export()
    for (const secret of ['sensitive-item-123', 'secret', 'private', 'password', 'token'])
      expect(json).not.toContain(secret)
    expect(JSON.parse(json)).toMatchObject({
      version: 1,
      clock: 'monotonic',
      routerId: diagnostics.routerId,
    })
    app.unmount()
  })

  it('reports aborted, redirected, duplicated, failed and no-op requests without copying errors', async () => {
    const { router, app } = await mount(
      [
        ...routes,
        { path: '/blocked', component: page('Blocked'), beforeEnter: () => false },
        { path: '/redirect', component: page('Redirect'), beforeEnter: () => '/items/1' },
        {
          path: '/error',
          component: () => {
            throw new Error('sensitive-error-payload')
          },
        },
      ],
      { diagnostics: true },
    )
    router.onError(() => {})
    const diagnostics = router.diagnostics!
    diagnostics.clear()
    await router.back()
    await router.push('/blocked')
    expect(diagnostics.snapshot().stacks[0]!.busy).toBe(false)
    await router.push('/redirect')
    await router.push('/items/1')
    await expect(router.push('/error')).rejects.toThrow('sensitive-error-payload')
    const navigations = finished(diagnostics, 'navigation')
    expect(navigations.map((event) => event.outcome)).toEqual([
      'noop',
      'aborted',
      'redirected',
      'success',
      'duplicated',
      'error',
    ])
    expect(navigations[3]!.parentNavigationId).toBe(navigations[2]!.navigationId)
    expect(diagnostics.export()).not.toContain('sensitive-error-payload')
    app.unmount()
  })

  it('keeps cancelled concurrent guards separate and closes every navigation span once', async () => {
    const { router, app } = await mount(routes, { diagnostics: true })
    const diagnostics = router.diagnostics!
    diagnostics.clear()
    let release!: () => void
    router.beforeEach((to) =>
      to.params.id === 'slow'
        ? new Promise<void>((resolve) => {
            release = resolve
          })
        : undefined,
    )
    const first = router.push('/items/slow')
    await settle()
    await router.push('/items/fast')
    release()
    await first
    const navigations = finished(diagnostics, 'navigation')
    expect(navigations.map((event) => event.outcome)).toEqual(['success', 'cancelled'])
    expect(new Set(navigations.map((event) => event.spanId)).size).toBe(2)
    expect(paths(router.stack.value)).toEqual(['/', '/items/fast'])
    app.unmount()
  })

  it('distinguishes native pops from requested transitions and keeps IDs stable', async () => {
    const { router, frame, app } = await mount(routes, { diagnostics: true })
    const diagnostics = router.diagnostics!
    const initial = diagnostics.snapshot().stacks[0]!
    await router.push('/items/1')
    diagnostics.clear()
    frame().popNatively()
    const popped = diagnostics.snapshot().stacks[0]!
    expect(popped.id).toBe(initial.id)
    expect(popped.native[0]!.id).toBe(initial.native[0]!.id)
    expect(popped.logical[0]!.id).toBe(initial.logical[0]!.id)
    expect(diagnostics.events).toContainEqual(
      expect.objectContaining({ phase: 'native', detail: 'pop' }),
    )
    expect(finished(diagnostics, 'navigation')).toEqual([])
    expect(diagnostics.snapshot().issues).toEqual([])
    app.unmount()
  })

  it('detects unmanaged native pages and clears the mismatch when the native host returns', async () => {
    const { router, frame, app } = await mount(routes, { diagnostics: true })
    const diagnostics = router.diagnostics!
    frame().navigate({ create: () => new Page(), animated: false })
    await settle()
    expect(diagnostics.snapshot().issues.map((issue) => issue.code)).toEqual([
      'unknown-native-page',
      'stack-mismatch',
    ])
    expect(diagnostics.events).toContainEqual(
      expect.objectContaining({ phase: 'issue', code: 'stack-mismatch' }),
    )
    frame().goBack()
    await settle()
    expect(diagnostics.snapshot().issues).toEqual([])
    app.unmount()
  })

  it('marks live stacks in closed windows as orphaned and separates window identities', async () => {
    const { router, frame, app } = await mount(routes, { diagnostics: true })
    const firstWindow = { state: 'attached' }
    Object.assign(frame(), { getNativeWindow: () => firstWindow })
    const second = createRouter({ routes, diagnostics: true })
    const secondApp = createApp({ render: () => h(RouterView) }).use(second)
    secondApp.start()
    await second.isReady()
    const secondFrame = Frame.topmost()!
    const secondWindow = { state: 'attached' }
    Object.assign(secondFrame, { getNativeWindow: () => secondWindow })
    const a = router.diagnostics!.snapshot().stacks[0]!
    const b = second.diagnostics!.snapshot().stacks[0]!
    expect(a.native[0]!.windowId).not.toBe(b.native[0]!.windowId)
    expect(a.logical[0]!.id).not.toBe(b.logical[0]!.id)
    firstWindow.state = 'closed'
    expect(router.diagnostics!.snapshot().issues).toContainEqual(
      expect.objectContaining({ code: 'orphaned-host' }),
    )
    expect(second.diagnostics!.snapshot().issues).toEqual([])
    app.unmount()
    secondApp.unmount()
  })

  it('represents split list/detail hosts without counting the native placeholder', async () => {
    const { router, app } = await mount(routes, {
      diagnostics: true,
      render: () => h(RouterSplitView, { list: '/' }),
    })
    await router.push('/items/1')
    const snapshot = router.diagnostics!.snapshot()
    expect(snapshot.issues).toEqual([])
    expect(snapshot.stacks[0]!.native.map((host) => host.role)).toEqual([
      'list',
      'detail',
    ])
    expect(snapshot.stacks[0]!.native.flatMap((host) => host.entries)).toEqual(
      snapshot.stacks[0]!.logical.map((entry) => entry.id),
    )
    await router.back()
    expect(router.diagnostics!.snapshot().issues).toEqual([])
    app.unmount()
  })

  it('keeps guarded modal results pending and observes settlement exactly once without result data', async () => {
    const dirty = ref(true)
    const Guarded = page('Guarded', () => onBeforeRouteLeave(() => !dirty.value))
    const { router, app } = await mount(
      [...routes, { path: '/guarded', component: Guarded, modal: true }],
      { diagnostics: true, platform: 'android' },
    )
    const pending = router.pushForResult('/guarded')
    await settle()
    const diagnostics = router.diagnostics!
    const modal = diagnostics.snapshot().stacks.find((stack) => stack.modal)!
    expect(modal.logical[0]!.awaitingResult).toBe(true)
    await router.back({ result: { secret: 'private-result' } })
    expect(diagnostics.events.filter((event) => event.phase === 'result')).toEqual([])
    dirty.value = false
    await router.back({ result: { secret: 'private-result' } })
    await pending
    expect(diagnostics.events.filter((event) => event.phase === 'result')).toHaveLength(1)
    expect(diagnostics.export()).not.toContain('private-result')
    expect(diagnostics.snapshot().issues).toEqual([])
    app.unmount()
  })

  it('bounds retained events, freezes reports, isolates listener errors and releases subscriptions on stop', async () => {
    const { router, app } = await mount(routes, { diagnostics: { maxEvents: 12 } })
    const diagnostics = router.diagnostics!
    const throws = vi.fn(() => {
      throw new Error('listener failure')
    })
    const listener = vi.fn()
    diagnostics.subscribe(throws)
    const unsubscribe = diagnostics.subscribe(listener)
    for (let i = 0; i < 10; i++) await router.replace(`/items/${i}`)
    expect(diagnostics.events).toHaveLength(12)
    expect(diagnostics.droppedEvents).toBeGreaterThan(100)
    expect(Object.isFrozen(diagnostics.snapshot().stacks[0]!.native[0]!.entries)).toBe(
      true,
    )
    expect(Object.isFrozen(diagnostics.events[0])).toBe(true)
    unsubscribe()
    listener.mockClear()
    await router.back()
    expect(listener).not.toHaveBeenCalled()
    diagnostics.stop()
    const exported = diagnostics.export()
    throws.mockClear()
    await router.replace('/items/after-stop')
    expect(throws).not.toHaveBeenCalled()
    expect(diagnostics.export()).toBe(exported)
    expect(diagnostics.snapshot().stopped).toBe(true)
    expect(paths(router.stack.value)).toEqual(['/items/after-stop'])
    app.unmount()
  })

  it('automatically stops on app unmount and rejects invalid capacities', async () => {
    for (const maxEvents of [0, -1, 1.5, NaN, Infinity, 10_001])
      expect(() => createRouter({ routes, diagnostics: { maxEvents } })).toThrow(
        'maxEvents',
      )
    const { router, app } = await mount(routes, { diagnostics: true })
    const diagnostics = router.diagnostics!
    app.unmount()
    expect(diagnostics.stopped).toBe(true)
    // app.onUnmount runs before component disposal; the report retains plain
    // data from that last live snapshot, without retaining the native source.
    expect(diagnostics.snapshot().stacks).toHaveLength(1)
    expect(Frame.topmost()!.listenerCount(Frame.navigatedToEvent)).toBe(0)
    expect(Application.android.listenerCount('activityBackPressed')).toBe(0)
  })

  it('does not retain live inspector sources after stopping and detects duplicate result signals', () => {
    const source = vi.fn(() => [])
    const lookup = vi.fn()
    const collector = createDiagnostics({}, source, lookup)
    const fake = {
      id: 1,
      route: { matched: [{ path: '/items/:id' }] },
      stack: { frame: null },
    } as unknown as import('../src/stack.js').Entry
    collector.result(fake)
    collector.result(fake)
    expect(collector.api.events).toContainEqual(
      expect.objectContaining({ code: 'duplicate-result' }),
    )
    collector.api.stop()
    source.mockClear()
    collector.api.snapshot()
    collector.api.export()
    expect(source).not.toHaveBeenCalled()
    expect(lookup).not.toHaveBeenCalled()
  })
})
