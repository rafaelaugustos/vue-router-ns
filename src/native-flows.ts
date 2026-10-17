import { Application, isAndroid, type Page } from '@nativescript/core'
import { inject, onUnmounted, shallowRef, type Ref } from 'nativescript-vue'
import { entryKey } from './injection.js'
import { pageEffect } from './page-effects.js'

/** How a native flow ended. Exactly one of these, exactly once. */
export type NativeFlowOutcome<Output> =
  | { status: 'completed'; value: Output }
  | { status: 'cancelled'; reason: 'user' | 'guard' | 'disposed' | 'replaced' }
  | { status: 'failed'; error: unknown }

/** What a flow gets to start with, and how it reports back. */
export interface NativeFlowContext<Output> {
  /** Correlation id of this attempt. */
  readonly id: string
  /** The page that started the flow, when one did: present from its controller or window. */
  readonly page: Page | undefined
  /** Android: a request code reserved for this attempt. */
  readonly requestCode: number
  /** Android: hears the activity result for `requestCode`, once. */
  onActivityResult(handler: (resultCode: number, intent: any) => void): void
  complete(value: Output): void
  cancel(): void
  fail(error: unknown): void
}

/**
 * A flow the system owns: a picker, another app's activity, a share sheet. It
 * is not a page: nothing enters the history, and the page that started it
 * stays active. The adapter owns the native API and the data it returns.
 */
export interface NativeFlow<Input, Output> {
  /** A short name for errors and diagnostics. */
  readonly kind: string
  /** Whether this platform can run it. */
  supported?(): boolean
  /**
   * Launches the native UI. Report through the context, once. Throwing fails
   * the attempt. The returned function, if any, runs when the attempt is
   * abandoned: the page left, or a newer attempt replaced it.
   */
  start(input: Input, context: NativeFlowContext<Output>): void | (() => void)
}

export interface NativeFlowRunOptions<Input> {
  /** Runs before the launch. `false` cancels the attempt with reason `'guard'`. */
  before?: (input: Input) => boolean | Promise<boolean>
}

export interface NativeFlowHandle<Input, Output> {
  /** Starts the flow and resolves with how it ended. A page can run one attempt of a flow at a time. */
  run(
    input: Input,
    options?: NativeFlowRunOptions<Input>,
  ): Promise<NativeFlowOutcome<Output>>
  /** `true` from the launch until the outcome. */
  readonly running: Readonly<Ref<boolean>>
}

interface Attempt {
  id: string
  requestCode: number
  settle: (outcome: NativeFlowOutcome<any>) => void
  result?: (resultCode: number, intent: any) => void
  cleanup?: () => void
}

const REQUEST_CODE_BASE = 0x7a00
const REQUEST_CODE_SPAN = 0x100
let sequence = 0
const attempts = new Map<number, Attempt>()
const listening = new WeakSet<object>()

function nextRequestCode(): number {
  for (let tries = 0; tries < REQUEST_CODE_SPAN; tries++) {
    const code = REQUEST_CODE_BASE + (++sequence % REQUEST_CODE_SPAN)
    if (!attempts.has(code)) return code
  }
  throw new Error('[vue-router-ns] Too many native flows are waiting for a result')
}

/** Core forwards every `onActivityResult`; the request code says which attempt it belongs to. */
function listenForActivityResults() {
  if (!isAndroid || listening.has(Application.android)) return
  listening.add(Application.android)
  Application.android.on('activityResult', (args: any) => {
    const attempt = attempts.get(args.requestCode)
    if (!attempt?.result) return
    const handler = attempt.result
    attempt.result = undefined
    handler(args.resultCode, args.intent)
  })
}

/**
 * Runs `flow` on behalf of `page`. Settles exactly once: when the flow
 * reports, or with `cancelled` when `dispose` is called first, in which case a
 * late native result is dropped.
 */
export function startNativeFlow<Input, Output>(
  flow: NativeFlow<Input, Output>,
  input: Input,
  page: Page | undefined,
): {
  outcome: Promise<NativeFlowOutcome<Output>>
  dispose(reason?: 'disposed' | 'replaced'): void
} {
  listenForActivityResults()
  const requestCode = nextRequestCode()
  const id = `${flow.kind}-${requestCode.toString(16)}-${Date.now().toString(36)}`
  let settled = false
  let resolve!: (outcome: NativeFlowOutcome<Output>) => void
  const outcome = new Promise<NativeFlowOutcome<Output>>((done) => (resolve = done))
  const attempt: Attempt = {
    id,
    requestCode,
    settle(result) {
      if (settled) return
      settled = true
      attempts.delete(requestCode)
      const cleanup = attempt.cleanup
      attempt.cleanup = undefined
      attempt.result = undefined
      cleanup?.()
      resolve(result)
    },
  }
  attempts.set(requestCode, attempt)
  if (flow.supported && !flow.supported()) {
    attempt.settle({
      status: 'failed',
      error: new Error(`[vue-router-ns] The "${flow.kind}" flow isn't supported here`),
    })
    return { outcome, dispose: () => {} }
  }
  const context: NativeFlowContext<Output> = {
    id,
    page,
    requestCode,
    onActivityResult(handler) {
      attempt.result = handler
    },
    complete: (value) => attempt.settle({ status: 'completed', value }),
    cancel: () => attempt.settle({ status: 'cancelled', reason: 'user' }),
    fail: (error) => attempt.settle({ status: 'failed', error }),
  }
  try {
    const cleanup = flow.start(input, context)
    if (typeof cleanup === 'function') {
      if (settled) cleanup()
      else attempt.cleanup = cleanup
    }
  } catch (error) {
    attempt.settle({ status: 'failed', error })
  }
  return {
    outcome,
    dispose: (reason = 'disposed') => attempt.settle({ status: 'cancelled', reason }),
  }
}

/**
 * Binds a native flow to the current page: a document picker, another app's
 * activity. `run` resolves with the outcome once, including `cancelled` when
 * the page leaves its stack first. A pending result never survives process
 * death; the page's own state is the place to remember that a flow was open.
 */
export function useNativeFlow<Input, Output>(
  flow: NativeFlow<Input, Output>,
): NativeFlowHandle<Input, Output> {
  const entry = inject(entryKey, null)
  if (!entry) throw new Error('useNativeFlow() must be used inside a routed page')
  const running = shallowRef(false)
  let page: Page | undefined
  let current: { dispose(reason?: 'disposed' | 'replaced'): void } | undefined

  const unregister = pageEffect(entry, (view) => {
    page = view
    return () => {
      page = undefined
      current?.dispose()
      current = undefined
    }
  })
  onUnmounted(() => {
    unregister()
    current?.dispose()
    current = undefined
  })

  return {
    running,
    async run(input, options = {}) {
      if (options.before && !(await options.before(input))) {
        return { status: 'cancelled', reason: 'guard' }
      }
      if (entry.disposed || !page) return { status: 'cancelled', reason: 'disposed' }
      current?.dispose('replaced')
      const started = startNativeFlow(flow, input, page)
      current = started
      running.value = true
      try {
        return await started.outcome
      } finally {
        if (current === started) current = undefined
        running.value = false
      }
    },
  }
}
