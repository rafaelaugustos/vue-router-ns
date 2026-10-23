import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { openRouteWindow, getWindowRoute, type RouterWindow } from '../src/windows.js'
import { Application, resetNative, setPlatform, Utils } from './shims/core.js'

class Intent {
  static FLAG_ACTIVITY_NEW_TASK = 0x10000000
  static FLAG_ACTIVITY_MULTIPLE_TASK = 0x08000000
  static FLAG_ACTIVITY_NEW_DOCUMENT = 0x00080000
  static FLAG_ACTIVITY_LAUNCH_ADJACENT = 0x00001000
  flags = 0
  extras: Record<string, unknown> = {}
  constructor(
    public context: unknown,
    public target: unknown,
  ) {}
  setFlags(value: number) {
    this.flags = value
  }
  putExtra(key: string, value: unknown) {
    this.extras[key] = value
  }
}

beforeEach(() => {
  resetNative()
  setPlatform('android')
  vi.stubGlobal('android', { content: { Intent } })
  Object.assign(Utils, { dataSerialize: (value: unknown) => value })
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
function owner() {
  const activity = {
    getClass: () => 'com.example.CustomActivity',
    isFinishing: () => false,
    isDestroyed: () => false,
    isInMultiWindowMode: () => true,
    startActivity: vi.fn(),
  }
  return { activity, window: { android: { activity } } as unknown as RouterWindow }
}
it('launches from the surviving owner class with Core-compatible flags and serialized handoff', () => {
  const { activity, window } = owner()
  const core = vi.spyOn(Application, 'openWindow')
  openRouteWindow(
    '/items/42?tab=details',
    { data: { documentId: 'c', nested: { value: 42 } } },
    window,
  )
  const intent = activity.startActivity.mock.calls[0]![0] as Intent
  expect(intent.context).toBe(activity)
  expect(intent.target).toBe('com.example.CustomActivity')
  expect(intent.flags).toBe(0x18081000)
  expect(getWindowRoute(intent.extras)).toBe('/items/42?tab=details')
  expect(intent.extras.nested).toEqual({ value: 42 })
  expect(core).not.toHaveBeenCalled()
})
it('does not launch through an owner being destroyed or forward to an unrelated Activity', () => {
  const { activity, window } = owner()
  activity.isDestroyed = () => true
  const core = vi.spyOn(Application, 'openWindow')
  expect(() => openRouteWindow('/items/1', undefined, window)).toThrow(
    'inactive Activity',
  )
  expect(activity.startActivity).not.toHaveBeenCalled()
  expect(core).not.toHaveBeenCalled()
})
