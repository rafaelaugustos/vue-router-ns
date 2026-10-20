import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  defineNativeDestination,
  NavigationFailureType,
  type NativeDestinationContext,
  type SavedStacks,
} from '../src/index.js'
import { mount, page, settle } from './helpers.js'
import { View } from './shims/core.js'
import type { NativeDestinationSession } from '../src/native-destinations.js'

const mounted = vi.hoisted(() => ({
  sessions: [] as NativeDestinationSession[],
  failure: undefined as Error | undefined,
}))

// The router contracts run without UIKit/AndroidX. Native containment is covered
// by the separate two-platform fixture, not by this stand-in.
vi.mock('../src/destinations/view.js', () => ({
  assertNativeInstance: (native: unknown) => {
    if (!native) throw new Error('Expected a native instance')
  },
  nativeDestinationView: () =>
    class extends View {
      set session(value: NativeDestinationSession) {
        mounted.sessions.push(value)
        if (mounted.failure) {
          value.failed(mounted.failure)
          mounted.failure = undefined
        } else value.attached()
      }
    },
}))

afterEach(() => vi.restoreAllMocks())

function fixture() {
  const contexts: NativeDestinationContext<{ id: string }, string>[] = []
  const dispose = vi.fn()
  const create = vi.fn((context: NativeDestinationContext<{ id: string }, string>) => {
    contexts.push(context)
    return { native: {}, dispose }
  })
  const destination = defineNativeDestination({
    id: 'vendor-editor',
    input: (route) => ({ id: String(route.params.id) }),
    ios: create,
    android: create,
  })
  const routes = [
    { path: '/', component: page('Home') },
    { path: '/native/:id', name: 'native', component: destination },
    { path: '/other', component: page('Other') },
  ]
  return { contexts, dispose, create, routes }
}

describe('native destinations', () => {
  it('returns typed results once and ignores callbacks from a disposed entry', async () => {
    const f = fixture()
    const { router } = await mount(f.routes)
    const result = router.pushForResult<string>('/native/42')
    await settle()
    const context = f.contexts[0]!
    expect(context.input).toEqual({ id: '42' })
    expect(context.page).not.toBeNull()
    await Promise.all([context.complete('saved'), context.complete('duplicate')])
    expect(await result).toBe('saved')
    expect(f.dispose).toHaveBeenCalledTimes(1)
    expect(context.page).toBeNull()
    await router.push('/other')
    await context.cancel()
    expect(router.currentRoute.value.path).toBe('/other')
  })

  it('keeps the native screen when a leave guard refuses completion', async () => {
    const f = fixture()
    const { router } = await mount(f.routes)
    const result = router.pushForResult<string>('/native/7')
    await settle()
    const context = f.contexts[0]!
    const remove = context.beforeLeave(() => false)
    expect((await context.complete('blocked'))?.type).toBe(NavigationFailureType.aborted)
    expect(f.dispose).not.toHaveBeenCalled()
    remove()
    await context.cancel()
    expect(await result).toBeUndefined()
    expect(f.dispose).toHaveBeenCalledTimes(1)
  })

  it('reconciles an already committed SDK dismissal without running leave guards', async () => {
    const f = fixture()
    const { router } = await mount(f.routes)
    const result = router.pushForResult('/native/7')
    await settle()
    const context = f.contexts[0]!
    const guard = vi.fn(() => false)
    context.beforeLeave(guard)
    await context.dismissed()
    expect(await result).toBeUndefined()
    expect(guard).not.toHaveBeenCalled()
    expect(router.currentRoute.value.path).toBe('/')
    expect(f.dispose).toHaveBeenCalledTimes(1)
  })

  it('observes native back and releases the instance', async () => {
    const f = fixture()
    const { router, frame } = await mount(f.routes)
    const result = router.pushForResult('/native/7')
    await settle()
    frame().popNatively()
    expect(await result).toBeUndefined()
    expect(f.dispose).toHaveBeenCalledTimes(1)
  })

  it('restores fresh instances from route identities, never serialized native objects', async () => {
    const f = fixture()
    let saved: SavedStacks | null = null
    const restore = {
      save: (value: SavedStacks | null) => {
        saved = value
      },
      load: () => saved,
    }
    const first = await mount(f.routes, { restore })
    await first.router.push('/native/42')
    const snapshot = JSON.stringify(saved)
    expect(snapshot).toContain('/native/42')
    expect(snapshot).not.toContain('native":')
    const second = await mount(f.routes, { restore })
    expect(second.router.currentRoute.value.path).toBe('/native/42')
    expect(f.create).toHaveBeenCalledTimes(2)
    expect(f.contexts[1]!.input).toEqual({ id: '42' })
    expect(f.contexts[1]).not.toBe(f.contexts[0])
  })

  it('rejects an unsupported platform before changing history', async () => {
    const destination = defineNativeDestination({
      id: 'ios-only',
      input: () => null,
      ios: () => ({ native: {} }),
    })
    const { router } = await mount(
      [
        { path: '/', component: page('Home') },
        { path: '/native', component: destination },
      ],
      { platform: 'android' },
    )
    await expect(router.push('/native')).rejects.toThrow(/not supported on Android/)
    expect(router.stack.value).toHaveLength(1)
  })

  it('rejects factory failure and keeps the previous page usable', async () => {
    const destination = defineNativeDestination({
      id: 'broken',
      input: () => null,
      ios: () => {
        throw new Error('SDK unavailable')
      },
    })
    const { router } = await mount([
      { path: '/', component: page('Home') },
      { path: '/native', component: destination },
    ])
    await expect(router.push('/native')).rejects.toThrow('SDK unavailable')
    await expect(router.pushForResult('/native')).rejects.toThrow('SDK unavailable')
    expect(router.stack.value).toHaveLength(1)
  })

  it('rolls back a failed native attachment and rejects its result promise', async () => {
    const f = fixture()
    const { router } = await mount(f.routes)
    mounted.failure = new Error('SDK attachment failed')
    await expect(router.pushForResult('/native/42')).rejects.toThrow(
      'SDK attachment failed',
    )
    expect(f.dispose).toHaveBeenCalledTimes(1)
    expect(router.stack.value).toHaveLength(1)
    expect(router.currentRoute.value.path).toBe('/')
    await router.push('/other')
    expect(router.currentRoute.value.path).toBe('/other')
  })

  it('invalidates old SDK callbacks when the same entry gets a rebuilt native view', async () => {
    const f = fixture()
    const { router } = await mount(f.routes)
    await router.push('/native/42')
    const old = f.contexts[0]!
    const session = mounted.sessions.at(-1)!
    session.release()
    session.create()
    expect(f.create).toHaveBeenCalledTimes(2)
    expect(old.page).toBeNull()
    await old.complete('late')
    await old.dismissed()
    expect(router.currentRoute.value.path).toBe('/native/42')
    await f.contexts[1]!.cancel()
    expect(f.dispose).toHaveBeenCalledTimes(2)
  })

  it('releases SDK instances on replace and clearHistory', async () => {
    const f = fixture()
    const { router } = await mount(f.routes)
    await router.push('/native/1')
    await router.replace('/native/2')
    expect(f.dispose).toHaveBeenCalledTimes(1)
    await router.push('/other', { clearHistory: true })
    expect(f.dispose).toHaveBeenCalledTimes(2)
    expect(router.stack.value).toHaveLength(1)
  })

  it('settles results even when SDK cleanup throws', async () => {
    const f = fixture()
    f.dispose.mockImplementation(() => {
      throw new Error('cleanup failed')
    })
    const { router } = await mount(f.routes)
    const onError = vi.fn()
    router.onError(onError)
    const result = router.pushForResult('/native/1')
    await settle()
    await f.contexts[0]!.cancel()
    expect(await result).toBeUndefined()
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'cleanup failed' }),
      expect.anything(),
      expect.anything(),
    )
    expect(router.currentRoute.value.path).toBe('/')
  })
})
