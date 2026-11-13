import { afterEach, expect, it, vi } from 'vitest'
import { observeDrawerSettlement } from '../demo/src/testing/adaptive-settlement.android'

function harness() {
  vi.useFakeTimers()
  vi.stubGlobal('androidx', {
    drawerlayout: {
      widget: {
        DrawerLayout: {
          DrawerListener: class {
            constructor(methods: object) {
              Object.assign(this, methods)
            }
          },
        },
      },
    },
  })
  const native = {
    isLaidOut: vi.fn(() => true),
    isLayoutRequested: vi.fn(() => false),
    addDrawerListener: vi.fn(),
    removeDrawerListener: vi.fn(),
  }
  const observer = observeDrawerSettlement({ nativeViewProtected: native })
  const listener = native.addDrawerListener.mock.calls[0]![0] as {
    onDrawerStateChanged(state: number): void
    onDrawerOpened(): void
  }
  return { native, observer, listener }
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it('waits past the old 500ms snapshot until the native endpoint and layout settle', async () => {
  const h = harness()
  h.listener.onDrawerStateChanged(2)
  let complete = false
  const result = h.observer.wait().then((value) => {
    complete = true
    return value
  })
  await vi.advanceTimersByTimeAsync(600)
  expect(complete).toBe(false)
  h.listener.onDrawerOpened()
  h.native.isLayoutRequested.mockReturnValue(true)
  h.listener.onDrawerStateChanged(0)
  await vi.advanceTimersByTimeAsync(100)
  expect(complete).toBe(false)
  h.native.isLayoutRequested.mockReturnValue(false)
  await vi.advanceTimersByTimeAsync(32)
  expect((await result).state).toBe(0)
  expect(complete).toBe(true)
})

it('fails a drawer that never reaches idle instead of retrying the operation', async () => {
  const h = harness()
  h.listener.onDrawerStateChanged(2)
  const result = expect(h.observer.wait()).rejects.toThrow('within 3000ms')
  await vi.advanceTimersByTimeAsync(3010)
  await result
})

it('does not wait 500ms for an already settled command and removes its observer', async () => {
  const h = harness()
  const result = h.observer.wait()
  await vi.advanceTimersByTimeAsync(16)
  expect((await result).elapsedMs).toBe(16)
  h.observer.dispose()
  expect(h.native.removeDrawerListener).toHaveBeenCalledExactlyOnceWith(h.listener)
})
