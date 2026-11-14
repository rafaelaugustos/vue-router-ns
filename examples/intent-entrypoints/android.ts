import { Application } from '@nativescript/core'
import {
  notificationIntent,
  type IgnoredIntent,
  type NavigationIntent,
  type Router,
} from 'vue-router-ns'

/** App-owned Core 9.1.4 integration; install before app.start(). */
export interface AndroidEntryOwner {
  router: Router
  scope: string
  frame: string
}
export interface AndroidEntryReceipt {
  owner: AndroidEntryOwner
  source: 'url' | 'shortcut' | 'notification'
  windowId: string
  request: NavigationIntent | IgnoredIntent
}
export interface AndroidIngressOptions {
  /** Stable account-owned registration, selected by the receiving native window. */
  owner(windowId: string): AndroidEntryOwner | undefined
  /** App-chosen action and JSON extra used by its notification PendingIntent. */
  notification: { action: string; extra: string }
  /** Fresh identity for each intentional native delivery, never a content id. */
  nextId(): string
  receive(receipt: AndroidEntryReceipt): Promise<void>
  error(error: unknown): void
}

export function installAndroidIntentIngress(options: AndroidIngressOptions) {
  const native = Application.android
  const created = new WeakSet<object>()
  const waiting = new Set<() => void>()
  let launching: { intent: unknown; windowId: string } | undefined
  let stopped = false
  async function handoff(receipt: AndroidEntryReceipt, scope: string) {
    const current = () =>
      !stopped &&
      options.owner(receipt.windowId) === receipt.owner &&
      receipt.owner.scope === scope
    let cancel!: () => void
    const cancelled = new Promise<false>((resolve) => {
      cancel = () => resolve(false)
    })
    waiting.add(cancel)
    const timer = setTimeout(cancel, 15000)
    try {
      const ready = await Promise.race([
        receipt.owner.router.isReady().then(() => true),
        cancelled,
      ])
      if (!current()) return
      if (!ready) throw new Error('Android intent readiness timed out')
      const window = receipt.owner.router.window.value
      if (window?.id !== receipt.windowId || window.state === 'closed') return
      await options.receive(receipt)
    } catch (error) {
      if (current()) options.error(error)
    } finally {
      clearTimeout(timer)
      waiting.delete(cancel)
    }
  }
  function deliver(args: any) {
    try {
      if (stopped || waiting.size >= 16 || args.savedInstanceState) return
      const intent = args.intent ?? args.android
      // Recents reuses a task's old launch Intent; it is not a new user delivery.
      if (!intent || intent.getFlags() & 0x00100000) return
      const action = intent.getAction()
      if (
        action !== 'android.intent.action.VIEW' &&
        action !== options.notification.action
      )
        return
      const windowId = args.window?.id
      if (typeof windowId !== 'string') return
      const owner = options.owner(windowId)
      if (!owner) return
      const scope = owner.scope
      const context = {
        delivery: { scope, id: options.nextId() },
        target: { windowId, frame: owner.frame },
        options: { replace: true },
      }
      let source: AndroidEntryReceipt['source'], input: unknown
      if (action === options.notification.action) {
        source = 'notification'
        const json = intent.getStringExtra(options.notification.extra)
        let payload: unknown
        // Bound before JSON parsing; extras never choose scope, target or options.
        if (typeof json === 'string' && json.length <= 8192) {
          try {
            payload = JSON.parse(json)
          } catch {
            /* invalid payload */
          }
        }
        input = notificationIntent(payload, context)
      } else {
        const href = intent.getData()?.toString()
        source =
          typeof href === 'string' && href.startsWith('vue-router-ns://')
            ? 'shortcut'
            : 'url'
        input = { version: 1, source, destination: { url: href }, ...context }
      }
      // Keep only canonical data while waiting, never the native Intent/Activity.
      const result =
        input && typeof input === 'object' && 'status' in input
          ? (input as IgnoredIntent)
          : owner.router.resolveIntent(input)
      void handoff(
        {
          owner,
          windowId,
          source,
          request: result.status === 'resolved' ? result.intent : result,
        },
        scope,
      )
    } catch (error) {
      options.error(error)
    }
  }
  function onCreated(args: any) {
    if (args.activity) created.add(args.activity)
  }
  function onNewIntent(args: any) {
    // Core emits a synthetic new-intent during onCreate, before launch provides
    // savedInstanceState. Consume cold delivery only from the launch event.
    if (args.activity && created.delete(args.activity)) {
      // Core's legacy launch event omits window. Carry the exact receiving id
      // from this synchronous onCreate forwarding, only for this same Intent.
      const captured =
        typeof args.window?.id === 'string'
          ? { intent: args.intent, windowId: args.window.id }
          : undefined
      launching = captured
      void Promise.resolve().then(() => {
        if (launching === captured) launching = undefined
      })
      return
    }
    deliver(args)
  }
  function onLaunch(args: any) {
    const captured = launching
    launching = undefined
    const intent = args.intent ?? args.android
    if (captured && captured.intent === intent)
      deliver({ ...args, window: { id: captured.windowId } })
  }
  native.on('activityCreated', onCreated)
  native.on('activityNewIntent', onNewIntent)
  Application.on(Application.launchEvent, onLaunch)
  return () => {
    stopped = true
    native.off('activityCreated', onCreated)
    native.off('activityNewIntent', onNewIntent)
    Application.off(Application.launchEvent, onLaunch)
    launching = undefined
    for (const cancel of waiting) cancel()
  }
}
