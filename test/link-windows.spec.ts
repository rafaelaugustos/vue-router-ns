import { describe, expect, it, vi } from 'vitest'
import { installSystemLinks, type LinkWindow } from '../src/links.js'
import { Application, iosLinks, resetNative, setPlatform } from './shims/core.js'

const url = (href: string) => ({ absoluteString: href })
const nsset = (items: unknown[]) => ({
  allObjects: { count: items.length, objectAtIndex: (index: number) => items[index] },
})
const intent = (href: string) => ({
  getData: () => ({ toString: () => href }),
  getFlags: () => 0,
})

function windows(platform: 'ios' | 'android') {
  resetNative()
  setPlatform(platform)
  const a: LinkWindow = {
    id: 'a',
    isPrimary: true,
    ios: { scene: {} },
    android: { activity: {} },
  }
  const b: LinkWindow = {
    id: 'b',
    isPrimary: false,
    ios: { scene: {} },
    android: { activity: {} },
  }
  const first = vi.fn(() => true)
  const second = vi.fn(() => true)
  const stopA = installSystemLinks({ deliver: first, policy: { window: a } })
  const stopB = installSystemLinks({ deliver: second, policy: { window: b } })
  return { a, b, first, second, stopA, stopB }
}

describe('incoming window ownership', () => {
  it('routes warm Android intents and launch events only to the receiving window', () => {
    const { a, b, first, second, stopA, stopB } = windows('android')
    try {
      Application.android.notify({
        eventName: 'activityNewIntent',
        object: Application.android,
        window: b,
        activity: b.android!.activity,
        intent: intent('app://items/2'),
      })
      Application.notify({
        eventName: 'launch',
        object: Application,
        window: a,
        intent: intent('app://items/1'),
      })
      expect(first.mock.calls).toEqual([['app://items/1', 'launch']])
      expect(second.mock.calls).toEqual([['app://items/2', 'resume']])
      stopB()
      Application.android.notify({
        eventName: 'activityNewIntent',
        object: Application.android,
        window: b,
        intent: intent('app://items/3'),
      })
      expect(second).toHaveBeenCalledTimes(1)
      expect(first).toHaveBeenCalledTimes(1)
    } finally {
      stopA()
      stopB()
    }
  })

  it('takes iOS URL, Universal Link and quick-action scene events without delegate replay', () => {
    const { a, b, first, second, stopA, stopB } = windows('ios')
    const completion = vi.fn()
    try {
      Application.ios.notify({
        eventName: 'sceneOpenURLContexts',
        object: Application.ios,
        window: b,
        scene: b.ios!.scene,
        urlContexts: nsset([{ URL: url('app://items/2') }]),
      })
      iosLinks.openURL('app://items/2') // Core forwards the same scene URL to the app delegate.
      Application.ios.notify({
        eventName: 'sceneContinueUserActivity',
        object: Application.ios,
        window: a,
        userActivity: {
          activityType: 'NSUserActivityTypeBrowsingWeb',
          webpageURL: url('https://example.com/items/1'),
        },
      })
      const href = 'vue-router-ns://shortcut/item?to=%2Fitems%2F3&v=1'
      const item = { userInfo: { objectForKey: () => href } }
      Application.ios.notify({
        eventName: 'scenePerformActionForShortcutItem',
        object: Application.ios,
        window: b,
        shortcutItem: item,
        completionHandler: completion,
      })
      expect(first.mock.calls).toEqual([['https://example.com/items/1', 'resume']])
      expect(second.mock.calls).toEqual([
        ['app://items/2', 'resume'],
        [href, 'resume'],
      ])
      expect(completion).toHaveBeenCalledExactlyOnceWith(true)
      stopB()
      Application.ios.notify({
        eventName: 'sceneOpenURLContexts',
        object: Application.ios,
        window: b,
        urlContexts: nsset([{ URL: url('app://items/4') }]),
      })
      expect(second).toHaveBeenCalledTimes(2)
    } finally {
      stopA()
      stopB()
    }
  })

  it('hands a cold scene request to a router created after sceneWillConnect', () => {
    resetNative()
    setPlatform('ios')
    const deliver = vi.fn(() => true)
    const stop = installSystemLinks({
      deliver,
      policy: {
        initial: {
          window: { id: 'secondary', isPrimary: false, ios: { scene: {} } },
          ios: {
            connectionOptions: {
              URLContexts: nsset([{ URL: url('app://items/1') }]),
              userActivities: nsset([
                {
                  activityType: 'NSUserActivityTypeBrowsingWeb',
                  webpageURL: url('https://example.com/items/2'),
                },
              ]),
            },
          },
        },
      },
    })
    expect(deliver.mock.calls).toEqual([
      ['app://items/1', 'launch'],
      ['https://example.com/items/2', 'launch'],
    ])
    stop()
    iosLinks.openURL('app://items/3')
    expect(deliver).toHaveBeenCalledTimes(2)
  })

  it('preserves application callbacks and detaches routers across remounts', () => {
    resetNative()
    setPlatform('ios')
    const existing = vi.fn(() => true)
    Application.ios.addDelegateHandler('applicationOpenURLOptions', existing)
    const old = vi.fn(() => true)
    const current = vi.fn((href: string) => href.startsWith('app://'))
    const stop = installSystemLinks({ deliver: old })
    stop()
    const stopCurrent = installSystemLinks({ deliver: current })
    expect(iosLinks.openURL('app://items/1')).toBe(true)
    expect(existing).toHaveBeenCalledOnce()
    expect(old).not.toHaveBeenCalled()
    expect(current).toHaveBeenCalledOnce()
    expect(iosLinks.openURL('other-sdk://callback')).toBe(true)
    stopCurrent()
    expect(iosLinks.openURL('other-sdk://callback')).toBe(true)
    expect(existing).toHaveBeenCalledTimes(3)
  })
})
