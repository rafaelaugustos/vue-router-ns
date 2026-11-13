import { createApp, h } from 'nativescript-vue'
import { expect, it, vi } from 'vitest'
import { createRouter, mountNativeHost } from '../src/index.js'
import {
  NativeHostConformanceError,
  runNativeHostConformance,
  type NativeHostTestFixture,
} from '../src/testing/native-host.js'
import { createMemoryHost } from './hosts/memory.js'
import { resetNative } from './shims/core.js'

const run = (
  options: { replace?: boolean; clearHistory?: boolean; brokenPop?: boolean } = {},
) =>
  runNativeHostConformance(
    (routes) => {
      resetNative()
      const router = createRouter({ routes })
      router.onError(() => {})
      const app = createApp({ render: () => h('GridLayout') })
      app.use(router)
      app.start()
      const host = createMemoryHost(options)
      let late!: () => void
      const attach = host.attach
      host.attach = (delegate) => {
        late = () => {
          delegate.changed()
          delegate.closed()
          delegate.backPressed()
          delegate.dismissAttempted()
          delegate.backGesture()
        }
        attach(delegate)
      }
      const push = host.push,
        back = host.back
      let failure: 'push' | 'back' | undefined
      host.push = (component, opts) => {
        if (failure === 'push') {
          failure = undefined
          throw new Error('injected push')
        }
        return push(component, opts)
      }
      host.back = (page, opts) => {
        if (failure === 'back') {
          failure = undefined
          return Promise.reject(new Error('injected back'))
        }
        return back(page, opts)
      }
      const unmount = mountNativeHost(router, 'default', host)
      return {
        router,
        host,
        unmount,
        popNatively: () => {
          if (!options.brokenPop) host.popNatively()
        },
        lateEvents: () => late(),
        rejectNext: (operation) => {
          failure = operation
        },
      } satisfies NativeHostTestFixture
    },
    { timeoutMs: options.brokenPop ? 100 : 5000 },
  )

it('runs the separately exported checks without a test-framework adapter', async () => {
  const report = await run()
  expect(report.contractVersion).toBe(1)
  expect(report.harnessVersion).toBe(1)
  expect(report.checks.filter((check) => check.status === 'failed')).toEqual([])
  expect(
    report.checks.find((check) => check.name === 'native pop and exactly-once result')
      ?.status,
  ).toBe('passed')
  expect(report.checks.find((check) => check.name === 'held dismissal')?.status).toBe(
    'skipped',
  )
})
it('checks unsupported operations as rejections', async () => {
  const report = await run({ replace: false, clearHistory: false })
  expect(report.checks.filter((check) => check.status === 'failed')).toEqual([])
})
it('rejects a host that never acknowledges native pop with a bounded report', async () => {
  vi.useFakeTimers()
  const pending = run({ brokenPop: true }).catch((error) => error)
  await vi.runAllTimersAsync()
  const failure = await pending
  vi.useRealTimers()
  expect(failure).toBeInstanceOf(NativeHostConformanceError)
  expect(failure.report.checks.at(-1)).toMatchObject({
    name: 'native pop and exactly-once result',
    status: 'failed',
  })
})
