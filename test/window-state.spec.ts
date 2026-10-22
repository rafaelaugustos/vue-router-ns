import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { watchWindowActivityState } from '../src/window-state.android.js'
import type { RouterWindow } from '../src/windows.js'
import { Device, setPlatform, Utils } from './shims/core.js'

const marker = 'vue-router-ns:window-process:v1'
const registryKey = 'androidx.lifecycle.BundlableSavedStateRegistry.key'
class Bundle extends Map<string, any> {
  getString(key: string) {
    return this.get(key) ?? null
  }
  putString(key: string, value: string) {
    this.set(key, value)
  }
  getBundle(key: string) {
    return this.get(key) ?? null
  }
  remove(key: string) {
    this.delete(key)
  }
}
const activity = () => ({
  getClass: () => ({ getName: () => 'com.example.RouterActivity' }),
})
const windowFor = (owner: ReturnType<typeof activity>) =>
  ({ android: { activity: owner } }) as unknown as RouterWindow
let callbacks: any
const application = {
  registerActivityLifecycleCallbacks: vi.fn((value) => {
    callbacks = value
  }),
  unregisterActivityLifecycleCallbacks: vi.fn(),
}
const stops: (() => void)[] = []
function watch(window: RouterWindow) {
  const stop = watchWindowActivityState(window)
  stops.push(stop)
  return stop
}
function state() {
  return new Bundle([
    ['com.tns.activity.windowId', 'document-b'],
    ['com.tns.activity.rootViewId', 2],
    ['com.tns.activity', 1],
    ['application-data', { draft: 'hello' }],
    ['android:support:fragments', 'legacy fragments'],
    [
      registryKey,
      new Bundle([
        ['android:support:fragments', 'stale fragments'],
        ['android:support:activity-result', { pending: 42 }],
        ['androidx.lifecycle.internal.SavedStateHandlesProvider', { custom: true }],
      ]),
    ],
  ])
}
beforeEach(() => {
  setPlatform('android')
  Device.sdkVersion = '34'
  Object.assign(Utils.android, { getApplication: () => application })
  vi.stubGlobal('android', {
    app: {
      Application: {
        ActivityLifecycleCallbacks: class {
          constructor(value: object) {
            Object.assign(this, value)
          }
        },
      },
    },
  })
  vi.clearAllMocks()
})
afterEach(() => {
  stops.splice(0).forEach((stop) => stop())
  delete (Utils.android as any).getApplication
  vi.unstubAllGlobals()
  Device.sdkVersion = '36'
})
it('marks only owned Activities, with one callback and reference-counted cleanup', () => {
  const a = activity(),
    b = activity(),
    foreign = activity()
  const stopA = watch(windowFor(a)),
    stopB = watch(windowFor(b))
  expect(application.registerActivityLifecycleCallbacks).toHaveBeenCalledTimes(1)
  const saved = state()
  callbacks.onActivitySaveInstanceState(foreign, saved)
  expect(saved.has(marker)).toBe(false)
  callbacks.onActivitySaveInstanceState(b, saved)
  expect(JSON.parse(saved.getString(marker)).activity).toBe('com.example.RouterActivity')
  stopA()
  stopA()
  expect(application.unregisterActivityLifecycleCallbacks).not.toHaveBeenCalled()
  stopB()
  expect(application.unregisterActivityLifecycleCallbacks).toHaveBeenCalledWith(callbacks)
})
it('preserves every saved field during same-process Activity recreation', () => {
  const owner = activity()
  watch(windowFor(owner))
  const saved = state()
  callbacks.onActivitySaveInstanceState(owner, saved)
  const before = structuredClone(saved)
  callbacks.onActivityPreCreated(owner, saved)
  expect(structuredClone(saved)).toEqual(before)
})
it('drops dead Frame/Fragment references while retaining window identity and unrelated registries', () => {
  const owner = activity()
  watch(windowFor(owner))
  const saved = state()
  saved.putString(
    marker,
    JSON.stringify({ token: 'old-process', activity: owner.getClass().getName() }),
  )
  callbacks.onActivityPreCreated(owner, saved)
  expect(saved.has('com.tns.activity')).toBe(false)
  expect(saved.has('com.tns.activity.rootViewId')).toBe(false)
  expect(saved.has('android:support:fragments')).toBe(false)
  expect(saved.getBundle(registryKey).has('android:support:fragments')).toBe(false)
  expect(saved.get('com.tns.activity.windowId')).toBe('document-b')
  expect(saved.get('application-data')).toEqual({ draft: 'hello' })
  expect(saved.getBundle(registryKey).get('android:support:activity-result')).toEqual({
    pending: 42,
  })
  expect(
    saved
      .getBundle(registryKey)
      .get('androidx.lifecycle.internal.SavedStateHandlesProvider'),
  ).toEqual({ custom: true })
})
it('does not change unmarked, malformed, foreign-class or fresh Activity state', () => {
  const owner = activity()
  watch(windowFor(owner))
  callbacks.onActivityPreCreated(owner, null)
  for (const value of [
    undefined,
    '{',
    'null',
    '{}',
    JSON.stringify({ token: 'old', activity: 'SDKActivity' }),
  ]) {
    const saved = state()
    if (value) saved.putString(marker, value)
    const before = structuredClone(saved)
    callbacks.onActivityPreCreated(owner, saved)
    expect(structuredClone(saved)).toEqual(before)
  }
})
it('tracks the replacement Activity through its stable window owner', () => {
  const original = activity(),
    replacement = activity()
  const owner = windowFor(original)
  watch(owner)
  ;(owner.android as any).activity = replacement
  const saved = state()
  callbacks.onActivitySaveInstanceState(original, saved)
  expect(saved.has(marker)).toBe(false)
  callbacks.onActivitySaveInstanceState(replacement, saved)
  expect(saved.has(marker)).toBe(true)
})
it('does not install Android 29 callbacks on older Android or iOS', () => {
  Device.sdkVersion = '28'
  watch(windowFor(activity()))
  setPlatform('ios')
  Device.sdkVersion = '36'
  watch(windowFor(activity()))
  expect(application.registerActivityLifecycleCallbacks).not.toHaveBeenCalled()
})
