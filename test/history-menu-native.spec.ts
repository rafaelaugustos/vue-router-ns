import { afterEach, describe, expect, it, vi } from 'vitest'
import { setPlatform } from './shims/core.js'
import { presentHistoryMenu } from '../src/history-menu-native.js'

afterEach(() => vi.unstubAllGlobals())
const options = () => ({
  title: 'History',
  cancelTitle: 'Cancel',
  labels: ['Same (2)', 'Same (1)'],
  select: vi.fn(),
  close: vi.fn(),
})

describe('native history menu dismissal', () => {
  it('anchors UIKit to its owning page and waits for dismissal before selecting', () => {
    setPlatform('ios')
    const actions: any[] = [],
      completions: (() => void)[] = []
    const sheet = {
      addAction: (action: unknown) => actions.push(action),
      popoverPresentationController: {} as any,
      dismissViewControllerAnimatedCompletion: vi.fn((_animated, done) => {
        if (done) completions.push(done)
      }),
    }
    vi.stubGlobal('UIAlertController', {
      alertControllerWithTitleMessagePreferredStyle: () => sheet,
    })
    vi.stubGlobal('UIAlertControllerStyle', { ActionSheet: 0 })
    vi.stubGlobal('UIAlertActionStyle', { Default: 0, Cancel: 1 })
    vi.stubGlobal('UIAlertAction', {
      actionWithTitleStyleHandler: (title: string, style: number, run: () => void) => ({
        title,
        style,
        run,
      }),
    })
    const presenter = {
      view: { window: {} },
      presentedViewController: undefined as any,
      presentViewControllerAnimatedCompletion: vi.fn(),
    }
    const source = { page: { ios: presenter }, ios: { bounds: {} } } as any
    const callbacks = options()
    const binding = presentHistoryMenu(source, callbacks)!
    expect(actions.map((action) => action.title)).toEqual([
      'Same (2)',
      'Same (1)',
      'Cancel',
    ])
    expect(sheet.popoverPresentationController.sourceView).toBe(source.ios)
    expect(sheet.popoverPresentationController.sourceRect).toBe(source.ios.bounds)
    actions[1].run()
    expect(callbacks.select).not.toHaveBeenCalled()
    completions.shift()!()
    expect(callbacks.select).toHaveBeenCalledExactlyOnceWith(1)
    binding.dismiss()
    actions[0].run()
    expect(sheet.dismissViewControllerAnimatedCompletion).toHaveBeenCalledOnce()
    presenter.presentedViewController = {}
    expect(presentHistoryMenu(source, callbacks)).toBeUndefined()
  })

  it('Android selection and hardware/native dismissal are mutually exclusive', () => {
    setPlatform('android')
    const popups: any[] = []
    class Popup {
      static OnMenuItemClickListener = class {
        constructor(callbacks: object) {
          Object.assign(this, callbacks)
        }
      }
      static OnDismissListener = class {
        constructor(callbacks: object) {
          Object.assign(this, callbacks)
        }
      }
      click: any
      close: any
      labels: string[] = []
      constructor() {
        popups.push(this)
      }
      getMenu() {
        return {
          add: (_group: number, _id: number, _order: number, label: string) =>
            this.labels.push(label),
        }
      }
      setOnMenuItemClickListener(listener: any) {
        this.click = listener
      }
      setOnDismissListener(listener: any) {
        this.close = listener
      }
      show() {}
      dismiss() {
        this.close.onDismiss()
      }
    }
    vi.stubGlobal('android', { widget: { PopupMenu: Popup } })
    const source = {
      android: { getWindowToken: () => ({}), getContext: () => ({}) },
    } as any
    const callbacks = options()
    const binding = presentHistoryMenu(source, callbacks)!
    expect(popups[0].labels).toEqual(callbacks.labels)
    popups[0].click.onMenuItemClick({ getItemId: () => 1 })
    binding.dismiss()
    expect(callbacks.select).toHaveBeenCalledExactlyOnceWith(1)
    expect(callbacks.close).not.toHaveBeenCalled()
    presentHistoryMenu(source, callbacks)
    popups[1].dismiss()
    popups[1].click.onMenuItemClick({ getItemId: () => 0 })
    expect(callbacks.close).toHaveBeenCalledOnce()
    expect(callbacks.select).toHaveBeenCalledOnce()
  })
})
