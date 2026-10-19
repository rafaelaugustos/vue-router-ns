import type { Page } from '@nativescript/core'
import {
  createApp,
  createNativeView,
  h,
  inject,
  ref,
  watch,
  type Component,
} from 'nativescript-vue'
import { expect, it } from 'vitest'
import {
  createRouter,
  mountNativeHost,
  onPageActivated,
  type NativeHost,
  type NativeHostDelegate,
} from '../src/index.js'
import { createMemoryHost } from './hosts/memory.js'
import { page } from './helpers.js'
import { resetNative } from './shims/core.js'
import { entryKey } from '../src/injection.js'
import { pageEffect } from '../src/page-effects.js'

it.each(['push', 'replace', 'clearHistory'] as const)(
  'reconciles native completion before Vue mounted hooks on startup and %s',
  async (operation) => {
    resetNative()
    let activations = 0
    let after = 0
    const component = page('Destination', () => {
      let effectsConnected = false
      pageEffect(inject(entryKey)!, () => {
        effectsConnected = true
        return () => {
          effectsConnected = false
        }
      })
      onPageActivated(() => {
        expect(effectsConnected).toBe(true)
        activations++
      })
    })
    const router = createRouter({
      routes: [
        { path: '/', name: 'home', component },
        { path: '/next', name: 'next', component },
      ],
    })
    router.afterEach(() => {
      after++
    })
    const app = createApp({ render: () => h('GridLayout') })
    app.use(router).start()
    let delegate: NativeHostDelegate
    const nativePages: Page[] = []
    const views: ReturnType<typeof createNativeView>[] = []
    let observedBeforeMounted: string[] | undefined
    const host: NativeHost = {
      ...createMemoryHost(),
      attach(value: NativeHostDelegate) {
        delegate = value
      },
      pages: () => nativePages,
      push(component: Component, options) {
        return new Promise<void>((resolve) => {
          const show = ref(false)
          const stop = watch(
            show,
            () => {
              stop()
              // Mount during a Vue post-flush callback. The nested app's mounted
              // hooks run later in this flush, while a native host may finish now.
              const view = createNativeView(component)
              views.push(view)
              const page = view.mount() as unknown as Page
              if (options.clearHistory) nativePages.length = 0
              else if (options.replace) nativePages.pop()
              nativePages.push(page)
              delegate.changed()
              observedBeforeMounted = router.stack.value.map((route) => route.fullPath)
              resolve()
            },
            { flush: 'post' },
          )
          show.value = true
        })
      },
      dispose() {
        views.forEach((view) => view.unmount())
        nativePages.length = 0
      },
    }
    const unmount = mountNativeHost(router, 'default', host)
    try {
      await router.isReady()
      expect(observedBeforeMounted).toEqual([])
      expect(router.stack.value.map((route) => route.fullPath)).toEqual(['/'])
      expect(router.currentRoute.value.name).toBe('home')
      expect(activations).toBe(1)
      expect(after).toBe(1)
      await (operation === 'replace'
        ? router.replace('/next')
        : router.push('/next', { clearHistory: operation === 'clearHistory' }))
      expect(observedBeforeMounted).toEqual(['/'])
      expect(router.stack.value.map((route) => route.fullPath)).toEqual(
        operation === 'push' ? ['/', '/next'] : ['/next'],
      )
      expect(router.currentRoute.value.name).toBe('next')
      expect(activations).toBe(2)
      expect(after).toBe(2)
      delegate!.changed()
      expect(activations).toBe(2)
      expect(after).toBe(2)
    } finally {
      unmount()
      app.unmount()
    }
  },
)
