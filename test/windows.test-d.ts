import type { NativeWindow } from '@nativescript/core'
import { expectTypeOf, it } from 'vitest'
import { createRouter, type RouterWindow } from '../src/index.js'

it('accepts native windows and preserves typed openWindow destinations', () => {
  expectTypeOf<NativeWindow>().toExtend<RouterWindow>()
  const router = createRouter({ routes: [{ path: '/items/:id', name: 'item' }] })
  router.openWindow({ name: 'item', params: { id: 42 } })
  // @ts-expect-error required parameter
  router.openWindow({ name: 'item' })
  // @ts-expect-error unknown route name
  router.openWindow({ name: 'missing' })
})
