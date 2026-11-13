import { defineComponent, h, nextTick, onUnmounted, ref } from 'nativescript-vue'
import {
  isNavigationFailure,
  NavigationFailureType,
  NATIVE_HOST_VERSION,
  onBeforeRouteLeave,
  useNativeHost,
  useRoute,
  type NativeHost,
  type NativeHostCapabilities,
  type NativeHostHandle,
  type RouteRecordRaw,
  type Router,
} from '../index.js'

/** Version of the checks, independent of the native presentation contract. */
export const NATIVE_HOST_CONFORMANCE_VERSION = 1

export interface NativeHostTestFixture {
  router: Router<any>
  host: NativeHost
  /** Permanent owner teardown; must also remove the native container from its UI. */
  unmount(): void | Promise<void>
  /** Perform a platform pop, without calling router.back(). */
  popNatively(): void | Promise<void>
  /** If initially unloaded, make the container available for queued presentation. */
  load?(): void | Promise<void>
  /** Optional fault injection, before any native mutation or completion callback. */
  rejectNext?(operation: 'push' | 'back'): void
  /** Deliver captured platform callbacks after disposal to check their isolation. */
  lateEvents?(): void | Promise<void>
  /** Attempt native dismissal; applicable only to cancellableDismissal hosts. */
  dismissAttempted?(): void | Promise<void>
}

export interface NativeHostConformanceReport {
  harnessVersion: typeof NATIVE_HOST_CONFORMANCE_VERSION
  contractVersion: typeof NATIVE_HOST_VERSION
  kind: string
  capabilities: NativeHostCapabilities
  checks: { name: string; status: 'passed' | 'skipped' | 'failed'; detail?: string }[]
}

export class NativeHostConformanceError extends Error {
  constructor(
    message: string,
    readonly report: NativeHostConformanceReport,
  ) {
    super(message)
    this.name = 'NativeHostConformanceError'
  }
}

/**
 * Opt-in adapter checks, without Vitest, Node APIs, shims or global app startup.
 * The factory installs these routes in a fresh router, mounts an empty host at
 * '/' and returns immediately (not after isReady if the host is unloaded).
 * Run in a disposable native test app or your own test runner. Native gestures,
 * natural OS lifecycle, resource collection and accessibility require separate
 * platform evidence; skipped optional probes are recorded explicitly.
 */
export async function runNativeHostConformance(
  create: (
    routes: readonly RouteRecordRaw[],
  ) => NativeHostTestFixture | Promise<NativeHostTestFixture>,
  options: {
    timeoutMs?: number
    onCheck?: (check: NativeHostConformanceReport['checks'][number]) => void
  } = {},
): Promise<NativeHostConformanceReport> {
  const timeout = options.timeoutMs ?? 5000
  if (!Number.isFinite(timeout) || timeout <= 0)
    throw new Error('timeoutMs must be positive')
  const handles: NativeHostHandle[] = []
  const unmounted: string[] = []
  const blockLeave = ref(false)
  const component = defineComponent({
    setup() {
      const route = useRoute()
      handles.push(useNativeHost())
      onBeforeRouteLeave(() => false, { when: blockLeave })
      onUnmounted(() => unmounted.push(route.fullPath))
      return () =>
        h('Page', { actionBarHidden: true }, [h('Label', { text: route.fullPath })])
    },
  })
  const routes: RouteRecordRaw[] = ['/', '/one', '/two', '/three'].map((path) => ({
    path,
    component,
  }))
  // The factory owns setup failures and must tear down any partially built UI.
  const fixture = await limit(
    Promise.resolve().then(() => create(routes)),
    'factory',
  )
  const { router, host } = fixture
  const report: NativeHostConformanceReport = {
    harnessVersion: NATIVE_HOST_CONFORMANCE_VERSION,
    contractVersion: NATIVE_HOST_VERSION,
    kind: host.kind,
    capabilities: { ...host.capabilities },
    checks: [],
  }
  let disposed = false
  const assert = (condition: unknown, message: string) => {
    if (!condition) throw new Error(message)
  }
  const paths = () => router.stack.value.map((route) => route.fullPath)
  const stack = (...expected: string[]) => {
    assert(
      JSON.stringify(paths()) === JSON.stringify(expected),
      `Logical history: ${paths().join(',')}; expected ${expected.join(',')}`,
    )
    assert(host.pages().length === expected.length, 'Native/logical page counts differ')
    assert(
      new Set(host.pages()).size === host.pages().length,
      'Duplicate native Page identity',
    )
  }
  const rooted = (path: string) => (host.capabilities.pinnedRoot ? ['/', path] : [path])
  async function limit<T>(operation: Promise<T>, label: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      return await Promise.race([
        operation,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`${label} exceeded ${timeout}ms`)),
            timeout,
          )
        }),
      ])
    } finally {
      if (timer !== undefined) clearTimeout(timer)
    }
  }
  async function until(predicate: () => boolean) {
    const end = Date.now() + timeout
    while (!predicate()) {
      assert(Date.now() < end, 'Native completion was not observed')
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
  }
  async function check(name: string, run?: () => unknown | Promise<unknown>) {
    const result: NativeHostConformanceReport['checks'][number] = {
      name,
      status: run ? 'passed' : 'skipped',
    }
    try {
      if (run) await limit(Promise.resolve().then(run), name)
    } catch (error) {
      result.status = 'failed'
      result.detail = String(error)
    }
    report.checks.push(result)
    options.onCheck?.(result)
    if (result.status === 'failed')
      throw new NativeHostConformanceError(`${name}: ${result.detail}`, report)
  }
  try {
    await check('version and capabilities', () => {
      assert(host.version === NATIVE_HOST_VERSION, 'Contract version mismatch')
      for (const key of [
        'replace',
        'clearHistory',
        'pinnedRoot',
        'close',
        'cancellableDismissal',
        'multipleVisible',
      ] as const) {
        assert(
          typeof host.capabilities[key] === 'boolean',
          `Capability ${key} must be a boolean`,
        )
      }
      assert(
        !host.capabilities.multipleVisible || typeof host.visible === 'function',
        'multipleVisible requires visible()',
      )
      assert(
        !host.capabilities.cancellableDismissal ||
          typeof host.holdDismissal === 'function',
        'cancellableDismissal requires holdDismissal()',
      )
    })
    await check(
      'initially unloaded host',
      !host.loaded
        ? async () => {
            assert(!!fixture.load, 'An unloaded fixture must provide load()')
            await fixture.load!()
          }
        : undefined,
    )
    await check('initial page and handle', async () => {
      await router.isReady()
      stack('/')
      assert(
        handles[0]?.native === host.native && host.native !== null,
        'Page did not receive the live host',
      )
    })
    const root = host.pages()[0]!
    await check('push, back and retained identity', async () => {
      await router.push('/one')
      const one = host.pages()[1]
      await router.push('/two')
      stack('/', '/one', '/two')
      await router.back()
      stack('/', '/one')
      assert(
        host.pages()[0] === root && host.pages()[1] === one,
        'Back replaced retained Pages',
      )
      assert(
        unmounted.includes('/two') && !unmounted.includes('/one'),
        'Incorrect Vue page lifetime',
      )
    })
    await check('replace capability', async () => {
      if (host.capabilities.replace) {
        await router.replace('/two')
        stack('/', '/two')
      } else {
        await rejects(() => router.replace('/two'))
        stack('/', '/one')
      }
    })
    await check('clearHistory capability', async () => {
      if (host.capabilities.clearHistory) {
        await router.push('/three', { clearHistory: true })
        stack(...rooted('/three'))
      } else {
        const before = paths()
        await rejects(() => router.push('/three', { clearHistory: true }))
        stack(...before)
      }
    })
    await check('guard cancellation', async () => {
      await router.push('/one')
      const before = [...host.pages()]
      blockLeave.value = true
      const failure = await router.back()
      assert(
        isNavigationFailure(failure, NavigationFailureType.aborted),
        'Leave guard did not abort',
      )
      assert(
        host.pages().every((page, i) => page === before[i]) &&
          host.pages().length === before.length,
        'Aborted back changed native identities',
      )
      blockLeave.value = false
      await router.back()
    })
    await check('concurrent requests', async () => {
      const first = router.push('/one')
      const second = router.push('/two')
      assert(
        isNavigationFailure(await first, NavigationFailureType.cancelled),
        'Older request was not cancelled',
      )
      assert(
        (await second) === undefined && paths().at(-1) === '/two',
        'Newest request did not win',
      )
    })
    await check('native pop and exactly-once result', async () => {
      let count = 0
      const result = router.pushForResult('/one').then((value) => {
        count++
        return value
      })
      await until(() => paths().at(-1) === '/one')
      await fixture.popNatively()
      assert(
        (await result) === undefined && count === 1,
        'Native pop did not settle once',
      )
      assert(paths().at(-1) === '/two', 'Native pop did not reconcile')
      await router.push('/one')
      await router.back()
      assert(count === 1, 'Result settled again')
    })
    await check(
      'atomic push failure',
      fixture.rejectNext
        ? async () => {
            const before = [...host.pages()]
            fixture.rejectNext!('push')
            await rejects(() => router.push('/one'))
            assert(
              host.pages().length === before.length &&
                host.pages().every((page, i) => page === before[i]),
              'Rejected push changed history',
            )
          }
        : undefined,
    )
    await check(
      'failed back result isolation',
      fixture.rejectNext
        ? async () => {
            const result = router.pushForResult('/one')
            await until(() => paths().at(-1) === '/one')
            fixture.rejectNext!('back')
            await rejects(() => router.back({ result: 'failed result' }))
            await router.back()
            assert((await result) === undefined, 'Failed back leaked its result')
          }
        : undefined,
    )
    await check(
      'held dismissal',
      host.capabilities.cancellableDismissal && fixture.dismissAttempted
        ? async () => {
            blockLeave.value = true
            await nextTick()
            let stop = () => {}
            const attempted = new Promise<void>((resolve, reject) => {
              stop = router.afterEach((_to, _from, failure) => {
                if (isNavigationFailure(failure, NavigationFailureType.aborted)) resolve()
                else
                  reject(
                    new Error('Held dismissal did not run the rejecting leave guard'),
                  )
              })
            })
            try {
              await fixture.dismissAttempted!()
              await limit(attempted, 'dismissal guard')
              assert(host.native !== null, 'Held dismissal closed the host')
            } finally {
              stop()
              blockLeave.value = false
            }
          }
        : undefined,
    )
    await check('owner disposal and pending result', async () => {
      let count = 0
      const result = router.pushForResult('/one').then((value) => {
        count++
        return value
      })
      await until(() => paths().at(-1) === '/one')
      await fixture.unmount()
      disposed = true
      assert(
        (await result) === undefined && count === 1,
        'Owner disposal did not settle once',
      )
      assert(
        host.native === null && handles.every((handle) => handle.native === null),
        'Disposed native handles remain live',
      )
      assert(router.stack.value.length === 0, 'Disposed stack remains logical')
    })
    await check(
      'late callbacks and repeated disposal',
      fixture.lateEvents
        ? async () => {
            await fixture.lateEvents!()
            await fixture.unmount()
            assert(
              router.stack.value.length === 0 && host.native === null,
              'Late callback resurrected a disposed host',
            )
          }
        : undefined,
    )
    return report
  } finally {
    blockLeave.value = false
    if (!disposed)
      await limit(
        Promise.resolve().then(() => fixture.unmount()),
        'cleanup',
      )
  }

  async function rejects(operation: () => Promise<unknown>) {
    let rejected = false
    try {
      await operation()
    } catch {
      rejected = true
    }
    assert(rejected, 'Unsupported or injected failing operation resolved successfully')
  }
}
