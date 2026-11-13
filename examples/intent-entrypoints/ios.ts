import { Application } from '@nativescript/core'
import type { IgnoredIntent, NavigationIntent, Router } from 'vue-router-ns'

/** App-owned integration for Core 9.1.4 scene events, not a package API. */
export interface EntryOwner {
  router: Router
  scope: string
  frame: string
}
export interface EntryReceipt {
  owner: EntryOwner
  source: 'shortcut' | 'spotlight' | 'url'
  windowId: string
  request: NavigationIntent | IgnoredIntent
}
export interface SceneIngressOptions {
  /** Return the same account-owned object until its registration/session changes. */
  owner(windowId: string): EntryOwner | undefined
  /** App-selected Spotlight domain adapter; null means removed/unauthorized. */
  activity(activity: unknown): string | null | undefined
  /** One id per native user action, not per content item. */
  nextId(): string
  receive(receipt: EntryReceipt): Promise<void>
  error(error: unknown): void
}

export function installSceneIntentIngress(options: SceneIngressOptions) {
  let stopped = false
  const waiting = new Set<() => void>()
  const ios = Application.ios
  async function handoff(receipt: EntryReceipt, current: () => boolean) {
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
      if (!ready) throw new Error('Scene intent readiness timed out')
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
  function deliver(args: any, source: EntryReceipt['source'], href: unknown) {
    if (stopped || waiting.size >= 16) return false
    const windowId = args.window?.id
    if (typeof windowId !== 'string') return false
    const owner = options.owner(windowId)
    if (!owner) return false
    const scope = owner.scope
    // Only the extracted destination is external. Authority comes from the app.
    const resolution = owner.router.resolveIntent({
      version: 1,
      source,
      destination: { url: href },
      delivery: { scope, id: options.nextId() },
      target: { windowId, frame: owner.frame },
      options: { replace: true },
    })
    const request =
      source === 'spotlight' && (href === null || href === undefined)
        ? { status: 'ignored' as const, reason: 'unmatched' as const }
        : resolution.status === 'resolved'
          ? resolution.intent
          : resolution
    void handoff(
      { owner, source, windowId, request },
      () => !stopped && options.owner(windowId) === owner && owner.scope === scope,
    )
    return true
  }
  function shortcut(args: any) {
    try {
      const href =
        args.shortcutItem?.userInfo?.objectForKey?.('url') ??
        args.shortcutItem?.userInfo?.url
      if (typeof href !== 'string' || !href.startsWith('vue-router-ns://')) return
      const accepted = deliver(args, 'shortcut', href)
      // Acknowledge enqueueing immediately, never wait for readiness or login.
      args.completionHandler?.(accepted)
    } catch (error) {
      options.error(error)
    }
  }
  function activity(args: any) {
    try {
      if (args.userActivity?.activityType === 'NSUserActivityTypeBrowsingWeb') {
        deliver(args, 'url', args.userActivity.webpageURL?.absoluteString)
      } else if (args.userActivity?.activityType === 'com.apple.corespotlightitem') {
        deliver(args, 'spotlight', options.activity(args.userActivity))
      }
    } catch (error) {
      options.error(error)
    }
  }
  function urls(args: any) {
    try {
      const items = args.urlContexts?.allObjects
      for (let i = 0; i < Math.min(items?.count ?? 0, 16); i++)
        deliver(args, 'url', items.objectAtIndex(i)?.URL?.absoluteString)
    } catch (error) {
      options.error(error)
    }
  }
  // Core 9.1.4 forwards cold connection payloads through these same events.
  // Do not also read sceneWillConnect or the process-wide delegate forwarding.
  const listeners = [
    ['scenePerformActionForShortcutItem', shortcut],
    ['sceneContinueUserActivity', activity],
    ['sceneOpenURLContexts', urls],
  ] as const
  for (const [event, listener] of listeners) ios.on(event, listener)
  return () => {
    stopped = true
    for (const [event, listener] of listeners) ios.off(event, listener)
    for (const cancel of waiting) cancel()
  }
}
