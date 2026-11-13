import { createApp, h, ref } from 'nativescript-vue'
import { describe, expect, it, vi } from 'vitest'
import {
  createRouter,
  isNavigationFailure,
  mountNativeHost,
  NavigationFailureType,
  onBeforeRouteLeave,
  type NativeHostDelegate,
} from '../src/index.js'
import { createMemoryHost } from './hosts/memory.js'
import { page, settle } from './helpers.js'
import { resetNative } from './shims/core.js'

function fixture(close = false, guarded = false) {
  resetNative()
  let delegate!: NativeHostDelegate
  const allow = ref(false)
  const host = createMemoryHost()
  const hold = vi.fn()
  Object.defineProperty(host, 'capabilities', {
    value: { ...host.capabilities, close, cancellableDismissal: guarded },
  })
  const attach = host.attach
  host.attach = (target) => {
    delegate = target
    attach(target)
  }
  const back = host.back
  host.back = (target, options) => (target ? back(target, options) : delegate.closed())
  Object.assign(host, { holdDismissal: hold })
  const router = createRouter({
    routes: [
      {
        path: '/',
        component: page('Home', () => {
          if (guarded) onBeforeRouteLeave(() => allow.value)
        }),
      },
      { path: '/item', component: page('Item') },
    ],
    diagnostics: true,
  })
  const app = createApp({ render: () => h('GridLayout') })
  app.use(router)
  app.start()
  return {
    host,
    router,
    allow,
    hold,
    delegate: () => delegate,
    mount: () => mountNativeHost(router, 'default', host),
  }
}

const bounded = <T>(promise: Promise<T>) =>
  Promise.race([
    promise,
    new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 100)),
  ])

describe('external NativeHost lifecycle', () => {
  it('an old unmount never closes a replacement under the same name', async () => {
    const f = fixture()
    const oldUnmount = f.mount()
    await f.router.isReady()
    f.delegate().closed()
    const replacement = createMemoryHost()
    const unmount = mountNativeHost(f.router, 'default', replacement)
    await settle()
    oldUnmount()
    oldUnmount()
    expect(replacement.native).not.toBeNull()
    await f.router.push('/item')
    expect(f.router.currentRoute.value.path).toBe('/item')
    unmount()
  })

  it('honors close capability on an externally mounted host at its root', async () => {
    const f = fixture(true)
    f.mount()
    await f.router.isReady()
    await f.router.back()
    expect(f.host.native).toBeNull()
    expect(f.router.stack.value).toEqual([])
  })

  it('holds external dismissal for leave guards and closes after approval', async () => {
    const f = fixture(true, true)
    f.mount()
    await f.router.isReady()
    expect(f.hold).toHaveBeenLastCalledWith(true)
    f.delegate().dismissAttempted()
    await settle()
    expect(f.host.native).not.toBeNull()
    f.allow.value = true
    f.delegate().dismissAttempted()
    await settle()
    expect(f.host.native).toBeNull()
  })

  it('does not deliver a result from a failed back on a later successful back', async () => {
    const f = fixture()
    const unmount = f.mount()
    await f.router.isReady()
    const result = f.router.pushForResult('/item')
    await settle()
    const back = f.host.back
    f.host.back = () => Promise.reject(new Error('native back refused'))
    await expect(f.router.back({ result: 'not committed' })).rejects.toThrow(
      'native back refused',
    )
    f.host.back = back
    await f.router.back()
    expect(await result).toBeUndefined()
    unmount()
  })

  it('owner closure releases a pending host promise and later rejection cannot block remount', async () => {
    const f = fixture()
    const unmount = f.mount()
    await f.router.isReady()
    let reject!: (error: Error) => void
    f.host.push = () =>
      new Promise<void>((_, fail) => {
        reject = fail
      })
    const navigation = f.router.push('/item')
    await settle()
    unmount()
    const outcome = await bounded(navigation)
    expect(isNavigationFailure(outcome, NavigationFailureType.cancelled)).toBe(true)
    const replacement = createMemoryHost()
    const stop = mountNativeHost(f.router, 'default', replacement)
    await settle()
    expect(replacement.pages()).toHaveLength(1)
    reject(new Error('late presentation rejection'))
    await settle()
    expect(replacement.pages()).toHaveLength(1)
    stop()
  })

  it('rolls back partial attach ownership when attach throws', () => {
    const f = fixture()
    f.host.attach = () => {
      throw new Error('partial native setup')
    }
    expect(f.mount).toThrow('partial native setup')
    expect(f.host.native).toBeNull()
    expect(() => mountNativeHost(f.router, 'default', createMemoryHost())).not.toThrow()
  })

  it('settles pending results even when an adapter throws during disposal', async () => {
    const f = fixture()
    const unmount = f.mount()
    await f.router.isReady()
    const result = f.router.pushForResult('/item')
    await settle()
    const dispose = f.host.dispose
    f.host.dispose = () => {
      dispose()
      throw new Error('adapter cleanup failure')
    }
    expect(unmount).toThrow('adapter cleanup failure')
    expect(await bounded(result)).toBeUndefined()
    expect(f.router.stack.value).toEqual([])
  })

  it('uses the targeted named host capabilities when another host is focused', async () => {
    const f = fixture()
    const main = f.mount()
    await f.router.isReady()
    const side = createMemoryHost()
    Object.defineProperty(side, 'capabilities', {
      value: { ...side.capabilities, close: true },
    })
    let delegate!: NativeHostDelegate
    const attach = side.attach
    side.attach = (target) => {
      delegate = target
      attach(target)
    }
    side.back = () => delegate.closed()
    const stop = mountNativeHost(f.router, 'side', side)
    await settle()
    await f.router.push('/item', { frame: 'default' })
    await f.router.back({ frame: 'side' })
    expect(side.native).toBeNull()
    expect(f.host.pages()).toHaveLength(2)
    expect(f.router.currentRoute.value.path).toBe('/item')
    stop()
    main()
  })

  it('waits for native acknowledgement even after push resolves', async () => {
    const f = fixture()
    let hold = false
    let complete!: () => void
    const attach = f.host.attach
    f.host.attach = (delegate) =>
      attach({
        ...delegate,
        changed() {
          if (hold) complete = delegate.changed
          else delegate.changed()
        },
      })
    const stop = f.mount()
    await f.router.isReady()
    hold = true
    let done = false
    const navigation = f.router.push('/item').then(() => {
      done = true
    })
    await settle()
    expect(done).toBe(false)
    expect(f.router.stack.value).toHaveLength(1)
    complete()
    await navigation
    expect(f.router.stack.value).toHaveLength(2)
    stop()
  })

  it('an unloaded host queues locally without blocking another host', async () => {
    const f = fixture()
    const stop = f.mount()
    await f.router.isReady()
    Object.defineProperty(f.host, 'loaded', { value: false })
    f.host.push = () => new Promise<void>(() => {})
    const navigation = f.router.push('/item')
    await settle()
    const other = createMemoryHost()
    const stopOther = mountNativeHost(f.router, 'other', other)
    await settle()
    expect(other.pages()).toHaveLength(1)
    await f.router.push('/item', { frame: 'other' })
    expect(other.pages()).toHaveLength(2)
    stop()
    expect(isNavigationFailure(await navigation, NavigationFailureType.cancelled)).toBe(
      true,
    )
    stopOther()
  })

  it('does not deliver an uncommitted Back result when its owner unmounts', async () => {
    const f = fixture()
    const stop = f.mount()
    await f.router.isReady()
    const result = f.router.pushForResult('/item')
    await settle()
    f.host.back = () => new Promise<void>(() => {})
    const back = f.router.back({ result: 'not committed' })
    await settle()
    stop()
    expect(await bounded(result)).toBeUndefined()
    expect(
      isNavigationFailure(await bounded(back), NavigationFailureType.cancelled),
    ).toBe(true)
  })

  it('reports an external close once, after switching focus to the surviving host', async () => {
    const f = fixture()
    const stop = f.mount()
    await f.router.isReady()
    const other = createMemoryHost()
    const stopOther = mountNativeHost(f.router, 'other', other)
    await settle()
    await f.router.push('/item', { frame: 'default' })
    const after = vi.fn()
    f.router.afterEach(after)
    f.delegate().closed()
    f.delegate().closed()
    expect(after).toHaveBeenCalledTimes(1)
    expect(after.mock.calls[0]![0].path).toBe('/')
    expect(after.mock.calls[0]![1].path).toBe('/item')
    expect(f.router.currentRoute.value.path).toBe('/')
    stop()
    stopOther()
  })

  it('cancels a pending page Back result when the platform closes the entire host', async () => {
    const f = fixture(true)
    const stop = f.mount()
    await f.router.isReady()
    const result = f.router.pushForResult('/item')
    await settle()
    f.host.back = () => new Promise<void>(() => {})
    const back = f.router.back({ result: 'not committed' })
    await settle()
    f.delegate().closed()
    expect(await bounded(result)).toBeUndefined()
    expect(
      isNavigationFailure(await bounded(back), NavigationFailureType.cancelled),
    ).toBe(true)
    stop()
  })

  it('waits for the method promise after native completion has arrived', async () => {
    const f = fixture()
    const stop = f.mount()
    await f.router.isReady()
    const push = f.host.push
    let release!: () => void
    f.host.push = async (component, options) => {
      await push(component, options)
      await new Promise<void>((resolve) => {
        release = resolve
      })
    }
    let done = false
    const navigation = f.router.push('/item').then(() => {
      done = true
    })
    await settle()
    expect(f.router.stack.value).toHaveLength(2)
    expect(done).toBe(false)
    release()
    await navigation
    stop()
  })

  it('delivers the result when the platform acknowledges a requested owner close', async () => {
    const f = fixture(true)
    const stop = f.mount()
    await f.router.isReady()
    const result = f.router.pushForResult('/item', { clearHistory: true })
    await settle()
    expect(await f.router.back({ result: 'picked' })).toBeUndefined()
    expect(await bounded(result)).toBe('picked')
    stop()
  })

  it.each([
    ['cancellableDismissal', 'holdDismissal'],
    ['multipleVisible', 'visible'],
  ])('rejects %s without its required method before attaching', (capability, method) => {
    const f = fixture()
    Object.defineProperty(f.host, 'capabilities', {
      value: { ...f.host.capabilities, [capability]: true },
    })
    Object.assign(f.host, { [method!]: undefined })
    const attach = vi.spyOn(f.host, 'attach')
    expect(f.mount).toThrow(new RegExp(method!))
    expect(attach).not.toHaveBeenCalled()
  })
})
