import { Application, isAndroid, isIOS } from '@nativescript/core'
import type { NavigationFailure } from './errors.js'
import { parseQuery, parseURL } from './query.js'
import { shortcutItemURL } from './shortcuts.js'
import type { LocationQuery, RouteLocation, RouteLocationRaw } from './types.js'

/** Where a link came from: the launch, a running app, or the app's own code. */
export type LinkSource = 'launch' | 'resume' | 'app'

export interface IncomingLink {
  /** The URL as received. */
  readonly href: string
  /** Lower-case; empty for a bare path. */
  readonly scheme: string
  /** Lower-case, for `http` and `https`; empty otherwise. */
  readonly host: string
  /** For a custom scheme, the whole part after `scheme://`. */
  readonly path: string
  readonly query: LocationQuery
  readonly hash: string
  readonly source: LinkSource
  /** The id of the home-screen shortcut it came from, if it did. */
  readonly shortcut?: string
}

export type LinkIgnoredReason = 'malformed' | 'scheme' | 'host' | 'unmatched' | 'repeat'

export interface LinkResult {
  readonly link: IncomingLink
  /** Where the link pointed, when it matched a route. */
  readonly location?: RouteLocation
  /** Why the navigation did not happen, from the guards. */
  readonly failure?: NavigationFailure
  /** Why the link was not taken, before any navigation. */
  readonly ignored?: LinkIgnoredReason
}

export interface LinkOptions {
  /** Provider event id: repeated delivery of this id is ignored, even after another link. */
  deliveryId?: string
  /** Bring the route's parents along. Defaults to `true`. */
  withParents?: boolean
  clearHistory?: boolean
  replace?: boolean
  /** Name of the `<RouterView>` to open it in. Waits for it to mount. */
  frame?: string
}

/** Only the identity needed to receive links; accepts a NativeScript NativeWindow. */
export interface LinkWindow {
  readonly id: string
  readonly isPrimary: boolean
  readonly android?: { readonly activity?: object | null }
  readonly ios?: { readonly scene?: object | null }
}

/** The link-bearing part of NativeScript's WindowContentRequest. */
export interface InitialLinkRequest {
  readonly window?: LinkWindow
  readonly android?: { readonly intent?: unknown; readonly savedInstanceState?: unknown }
  readonly ios?: { readonly connectionOptions?: unknown }
}

export interface LinksOptions {
  /** Optional non-web NSUserActivity adapter. Return an app URL/path; guards still run. */
  activity?(activity: unknown): string | null | undefined
  /** Receive only this window's events. Defaults to the application's primary window. */
  window?: LinkWindow | (() => LinkWindow | undefined)
  /** Cold secondary-window delivery, passed from setWindowContentResolver. */
  initial?: InitialLinkRequest
  /** Schemes to accept, like `['https', 'myapp']`. Bare paths are always accepted. Defaults to all. */
  schemes?: readonly string[]
  /** Hosts to accept for `http` and `https` links. Defaults to all. */
  hosts?: readonly string[]
  /** Turns an accepted link into a location. Defaults to its path, query and hash. `null` ignores it. */
  map?(link: IncomingLink): RouteLocationRaw | null | undefined
  /** The stack a link opens in. Select its tab here, before the navigation. */
  frame?(location: RouteLocation, link: IncomingLink): string | undefined
  /** How links land. `withParents` is on unless turned off here. */
  options?: LinkOptions | ((location: RouteLocation, link: IncomingLink) => LinkOptions)
  /** Listen to the operating system: Android intents, iOS URLs and Universal Links. Defaults to `true`. */
  system?: boolean
}

export type LinkListener = (result: LinkResult) => void

/** Matching cold-start deliveries within this interval belong to the same launch. */
export const REPEAT_WINDOW = 1500
const FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY = 0x00100000
const URL_PATTERN = /^([a-z][a-z0-9+.-]*):(?:\/\/([^/?#]*))?([^?#]*)(\?[^#]*)?(#.*)?$/i

export function parseLink(href: string, source: LinkSource): IncomingLink | undefined {
  const text = href.trim()
  if (!text || /[\\\s\u0000-\u001f\u007f]/.test(text)) return undefined
  // Reject broken escapes/UTF-8 before the forgiving route/query parsers see them.
  try {
    decodeURI(text)
  } catch {
    return undefined
  }
  if (text.startsWith('/')) {
    if (text.startsWith('//')) return undefined
    const { path, query, hash } = parseURL(text)
    return { href: text, scheme: '', host: '', path, query, hash, source }
  }
  const match = URL_PATTERN.exec(text)
  if (!match) return undefined
  const scheme = match[1]!.toLowerCase()
  const authority = match[2] ?? ''
  if (authority.includes('@')) return undefined
  const rawPath = match[3] ?? ''
  const web = scheme === 'http' || scheme === 'https'
  const webAuthority = web
    ? /^(\[[0-9a-f:.]+\]|[^:\[\]]+)(?::\d+)?$/i.exec(authority)
    : null
  if (web && !webAuthority) return undefined
  const host = web ? webAuthority![1]!.toLowerCase() : ''
  const path = web ? rawPath || '/' : `/${authority}${rawPath}`.replace(/\/{2,}/g, '/')
  return {
    href: text,
    scheme,
    host,
    path,
    query: match[4] ? parseQuery(match[4]) : {},
    hash: match[5] ?? '',
    source,
  }
}

/** Why `policy` turns `link` down, or `undefined` when it lets it through. */
export function screen(
  policy: LinksOptions,
  link: IncomingLink,
): Exclude<LinkIgnoredReason, 'malformed' | 'unmatched' | 'repeat'> | undefined {
  if (link.scheme && policy.schemes && !lower(policy.schemes).includes(link.scheme))
    return 'scheme'
  if (link.host && policy.hosts && !lower(policy.hosts).includes(link.host)) return 'host'
  return undefined
}

function lower(values: readonly string[]) {
  return values.map((value) => value.toLowerCase())
}

export interface SystemLinkHandlers {
  /** Owning router window, discovered when its native host mounts. */
  window?(): LinkWindow | undefined
  /** The OS handed the app a URL. Returns whether the router takes it. */
  deliver(href: string, source: LinkSource): boolean
  policy?: LinksOptions
}

interface AndroidIntent {
  getData(): { toString(): string } | null
  getFlags(): number
}
interface Origin {
  window?: LinkWindow
  activity?: object
  scene?: object
}
interface Receiver {
  deliver: SystemLinkHandlers['deliver']
  activity(candidate: unknown): string | undefined
  accepts(origin?: Origin): boolean
}

function androidURL(candidate: unknown): string | undefined {
  const intent = candidate as AndroidIntent | undefined
  // Reopening a task from recents must not replay its original link.
  if (((intent?.getFlags?.() ?? 0) & FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY) !== 0) return
  const data = intent?.getData?.()
  return data ? String(data.toString()) : undefined
}
function each(set: any, visit: (item: any) => void) {
  const items = set?.allObjects
  for (let index = 0; index < (items?.count ?? 0); index++)
    visit(items.objectAtIndex(index))
}
function activityURL(candidate: any): string | undefined {
  if (candidate?.activityType === 'NSUserActivityTypeBrowsingWeb')
    return candidate.webpageURL?.absoluteString
}
function connectionLinks(
  options: any,
  deliver: SystemLinkHandlers['deliver'],
  decodeActivity = activityURL,
) {
  each(options?.URLContexts, (context) => {
    if (context?.URL?.absoluteString) deliver(context.URL.absoluteString, 'launch')
  })
  each(options?.userActivities, (activity) => {
    const href = decodeActivity(activity)
    if (href) deliver(href, 'launch')
  })
  const href = shortcutItemURL(options?.shortcutItem)
  if (href) deliver(href, 'launch')
}

/** Receives events only for the owning window, with an explicit cold-start handoff. */
export function installSystemLinks({
  deliver,
  policy = {},
  window: routerWindow,
}: SystemLinkHandlers): () => void {
  const explicit = policy.window !== undefined || policy.initial?.window !== undefined
  const window = () =>
    (typeof policy.window === 'function' ? policy.window() : policy.window) ??
    policy.initial?.window ??
    routerWindow?.() ??
    (explicit
      ? undefined
      : (Application as unknown as { primaryWindow?: LinkWindow }).primaryWindow)
  const receiver: Receiver = {
    deliver,
    activity(candidate) {
      try {
        return activityURL(candidate) ?? policy.activity?.(candidate) ?? undefined
      } catch {
        return undefined
      }
    },
    accepts(origin) {
      const owner = window()
      if (origin?.window)
        return owner
          ? origin.window.id === owner.id
          : !explicit && origin.window.isPrimary
      if (origin?.activity && owner?.android?.activity)
        return origin.activity === owner.android.activity
      if (origin?.scene && owner?.ios?.scene) return origin.scene === owner.ios.scene
      // Scene events are followed by process-wide delegate forwarding in Core.
      // A scene-owned router must not also consume that unscoped forwarding.
      if (!origin && owner?.ios?.scene) return false
      return owner ? owner.isPrimary : !explicit
    },
  }
  let stop = () => {}
  if (policy.system !== false) {
    if (isAndroid) stop = installAndroid(receiver)
    else if (isIOS) stop = installIOS(receiver)
  }
  const initial = policy.initial
  if (initial?.android && !initial.android.savedInstanceState) {
    const href = androidURL(initial.android.intent)
    if (href) deliver(href, 'launch')
  }
  if (initial?.ios)
    connectionLinks(initial.ios.connectionOptions, deliver, receiver.activity)
  return stop
}

function installAndroid({ deliver, accepts }: Receiver): () => void {
  const android = Application.android
  const created = new WeakSet<object>()
  const intent = (candidate: unknown, source: LinkSource) => {
    const href = androidURL(candidate)
    if (href) deliver(href, source)
  }
  const onLaunch = (
    args: Origin & { android?: unknown; intent?: unknown; savedInstanceState?: unknown },
  ) => {
    // Launch retains the real saved state even when Core passes null to onCreate.
    if (accepts(args) && !args.savedInstanceState)
      intent(args.intent ?? args.android, 'launch')
  }
  const onCreated = (args: { activity: object }) => created.add(args.activity)
  const onNewIntent = (args: Origin & { intent: unknown }) => {
    // The synthetic onCreate delivery precedes launch and loses savedInstanceState.
    if (args.activity && created.delete(args.activity)) return
    if (accepts(args)) intent(args.intent, 'resume')
  }
  Application.on(Application.launchEvent, onLaunch)
  android.on('activityCreated', onCreated)
  android.on('activityNewIntent', onNewIntent)
  return () => {
    Application.off(Application.launchEvent, onLaunch)
    android.off('activityCreated', onCreated)
    android.off('activityNewIntent', onNewIntent)
  }
}

interface IOSApplication {
  delegate?: { prototype: Record<string, any> }
  addDelegateHandler?(method: string, handler: (...args: any[]) => unknown): void
  on(event: string, callback: (args: any) => void): void
}

// Preserve existing delegate results as well as invocation. Core's public
// addDelegateHandler returns only its last handler's result; a router refusing
// a foreign URL must not turn an application's earlier true into false.
function chainIOSDelegate(
  ios: IOSApplication,
  method: string,
  handler: (...args: any[]) => unknown,
) {
  if (!ios.delegate) {
    ios.addDelegateHandler!(method, handler)
    return
  }
  const prototype = ios.delegate.prototype
  const previous = prototype[method]
  prototype[method] = function (...args: any[]) {
    if (method === 'applicationPerformActionForShortcutItemCompletionHandler') {
      const completion = args[2]
      let completed = false
      args[2] = (taken: boolean) => {
        if (completed || typeof completion !== 'function') return
        completed = true
        completion(taken)
      }
      const own = handler(...args)
      return previous?.apply(this, args) || own || false
    }
    const prior = previous?.apply(this, args)
    return handler(...args) || prior || false
  }
}

// Core cannot remove delegate handlers. Keep one bridge per application; remove
// routers from its receiver set on unmount so a destroyed app is never retained.
const iosBridges = new WeakMap<IOSApplication, Set<Receiver>>()
function installIOS(receiver: Receiver): () => void {
  const ios = Application.ios as unknown as IOSApplication | undefined
  if (!ios?.addDelegateHandler) return () => {}
  let receivers = iosBridges.get(ios)
  if (!receivers) {
    receivers = new Set()
    iosBridges.set(ios, receivers)
    const listeners = receivers
    const deliver = (href: string | undefined, source: LinkSource, origin?: Origin) => {
      let taken = false
      if (href)
        for (const listener of listeners) {
          if (listener.accepts(origin)) taken = listener.deliver(href, source) || taken
        }
      return taken
    }
    const deliverActivity = (activity: unknown, source: LinkSource, origin?: Origin) => {
      let taken = false
      for (const listener of listeners) {
        if (!listener.accepts(origin)) continue
        const href = listener.activity(activity)
        if (href) taken = listener.deliver(href, source) || taken
      }
      return taken
    }
    chainIOSDelegate(ios, 'applicationDidFinishLaunchingWithOptions', (_app, options) => {
      deliver(
        shortcutItemURL(
          options?.objectForKey?.('UIApplicationLaunchOptionsShortcutItemKey'),
        ),
        'launch',
      )
      deliver(
        options?.objectForKey?.('UIApplicationLaunchOptionsURLKey')?.absoluteString,
        'launch',
      )
      const activities = options?.objectForKey?.(
        'UIApplicationLaunchOptionsUserActivityDictionaryKey',
      )
      deliverActivity(
        activities?.objectForKey?.('UIApplicationLaunchOptionsUserActivityKey'),
        'launch',
      )
      return true
    })
    chainIOSDelegate(ios, 'applicationOpenURLOptions', (_app, url) =>
      deliver(url?.absoluteString, 'resume'),
    )
    chainIOSDelegate(
      ios,
      'applicationContinueUserActivityRestorationHandler',
      (_app, activity) => deliverActivity(activity, 'resume'),
    )
    chainIOSDelegate(
      ios,
      'applicationPerformActionForShortcutItemCompletionHandler',
      (_app, item, completion) => {
        const href = shortcutItemURL(item)
        const taken = deliver(href, 'resume')
        // Leave other SDKs' quick actions and already-unmounted handlers alone.
        if (listeners.size && href && typeof completion === 'function') completion(taken)
        return taken
      },
    )
    ios.on('sceneWillConnect', (args) => {
      for (const listener of listeners)
        if (listener.accepts(args))
          connectionLinks(args.connectionOptions, listener.deliver, listener.activity)
    })
    ios.on('sceneOpenURLContexts', (args) =>
      each(args.urlContexts, (context) =>
        deliver(context?.URL?.absoluteString, 'resume', args),
      ),
    )
    ios.on('sceneContinueUserActivity', (args) =>
      deliverActivity(args.userActivity, 'resume', args),
    )
    ios.on('scenePerformActionForShortcutItem', (args) => {
      const href = shortcutItemURL(args.shortcutItem)
      const taken = deliver(href, 'resume', args)
      if (listeners.size && href && typeof args.completionHandler === 'function')
        args.completionHandler(taken)
    })
  }
  receivers.add(receiver)
  return () => {
    receivers.delete(receiver)
  }
}
