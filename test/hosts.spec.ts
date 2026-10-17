import type { Frame as NativeFrame } from '@nativescript/core'
import { createApp, h, ref } from 'nativescript-vue'
import { describe, expect, it } from 'vitest'
import {
  createFrameHost,
  createRouter,
  createSplitFrameHost,
  mountNativeHost,
  NATIVE_HOST_VERSION,
  useNativeHost,
} from '../src/index.js'
import { describeNativeHostContract } from './host-contract.js'
import { createMemoryHost } from './hosts/memory.js'
import { page } from './helpers.js'
import { Frame, resetNative } from './shims/core.js'

describeNativeHostContract('frame', () => {
  const frame = new Frame()
  return {
    host: createFrameHost(frame as unknown as NativeFrame),
    popNatively: () => frame.popNatively(),
  }
})

describeNativeHostContract('split frame', () => {
  const list = new Frame()
  const detail = new Frame()
  return {
    host: createSplitFrameHost(
      list as unknown as NativeFrame,
      detail as unknown as NativeFrame,
      { expanded: ref(false), detailVisible: ref(false) },
    ),
    popNatively: () => detail.popNatively(),
  }
})

describeNativeHostContract('memory', () => {
  const host = createMemoryHost()
  return { host, popNatively: () => host.popNatively() }
})

describeNativeHostContract('memory without replace or clearHistory', () => {
  const host = createMemoryHost({ replace: false, clearHistory: false })
  return { host, popNatively: () => host.popNatively() }
})

describe('mountNativeHost', () => {
  const routes = [{ path: '/', component: page('Home') }]

  it('refuses a host built for another contract version', () => {
    resetNative()
    const router = createRouter({ routes })
    const host = {
      ...createMemoryHost(),
      version: 2 as unknown as typeof NATIVE_HOST_VERSION,
    }

    expect(() => mountNativeHost(router, 'default', host)).toThrow(
      /contract version 2; this router needs 1/,
    )
    expect(() => mountNativeHost(router, 'default', createMemoryHost())).not.toThrow()
  })

  it('needs a router from createRouter()', () => {
    expect(() => mountNativeHost({} as never, 'default', createMemoryHost())).toThrow(
      /needs a router from createRouter/,
    )
  })

  it('can be targeted by name next to a <RouterView>', async () => {
    resetNative()
    const List = page('List')
    const router = createRouter({
      routes: [...routes, { path: '/list', component: List }],
    })
    const app = createApp({ render: () => h('GridLayout') })
    app.use(router)
    app.start()
    const host = createMemoryHost()
    const unmount = mountNativeHost(router, 'side', host, '/')
    await router.isReady()

    await router.push('/list', { frame: 'side' })

    expect(host.pages()).toHaveLength(2)
    expect(router.stack.value.map((route) => route.path)).toEqual(['/', '/list'])
    unmount()
    expect(host.native).toBeNull()
  })
})

describe('useNativeHost', () => {
  it('must be used inside a routed page', () => {
    expect(() => useNativeHost()).toThrow(/inside a routed page/)
  })
})
