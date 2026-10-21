import { Application, isAndroid, isIOS } from '@nativescript/core'
import type { NavigationFailure } from './errors.js'
import { parseQuery, parseURL } from './query.js'
import { shortcutItemURL } from './shortcuts.js'
import type { RouterWindow } from './windows.js'
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
  /** Bring the route's parents along. Defaults to `true`. */
  withParents?: boolean
  clearHistory?: boolean
  replace?: boolean
  /** Name of the `<RouterView>` to open it in. Waits for it to mount. */
  frame?: string
}

export interface LinksOptions {
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

/** A second system delivery of the same URL within this window is the same tap. */
export const REPEAT_WINDOW = 1500
const FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY = 0x00100000
const URL_PATTERN = /^([a-z][a-z0-9+.-]*):(?:\/\/([^/?#]*))?([^?#]*)(\?[^#]*)?(#.*)?$/i

export function parseLink(href: string, source: LinkSource): IncomingLink | undefined {
  const text = href.trim()
  if (!text) return undefined
  if (text.startsWith('/')) {
    const { path, query, hash } = parseURL(text)
    return { href: text, scheme: '', host: '', path, query, hash, source }
  }
  const match = URL_PATTERN.exec(text)
  if (!match) return undefined
  const scheme = match[1]!.toLowerCase()
  const authority = (match[2] ?? '').split('@').pop()!
  const rawPath = match[3] ?? ''
  const web = scheme === 'http' || scheme === 'https'
  const host = web ? authority.split(':')[0]!.toLowerCase() : ''
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
  /** Read at delivery time: primary ownership may be inferred after installation. */
  window?(): RouterWindow | undefined
  /** The OS handed the app a URL. Returns whether the router takes it. */
  deliver(href: string, source: LinkSource): boolean
}

declare const UIApplicationLaunchOptionsURLKey: string
declare const UIApplicationLaunchOptionsUserActivityDictionaryKey: string
declare const NSUserActivityTypeBrowsingWeb: string

interface AndroidIntent {
  getData(): { toString(): string } | null
  getFlags(): number
}

/**
 * Wires the platform's link callbacks to `deliver`, next to whatever the app
 * installed: Android launch and new intents, iOS `openURL`, Universal Link
 * activities and scene connections. Returns what undoes it.
 */
export function installSystemLinks(handlers: SystemLinkHandlers | undefined): () => void {
  // Core delegate handlers cannot be removed on every supported version.
  // Deactivate their closures when their app/window closes.
  let active = true
  const deliver: SystemLinkHandlers['deliver'] = (...args) =>
    active && !!handlers?.deliver(...args)
  const accepts = (origin?: { window?: RouterWindow; activity?: unknown }) => {
    if (!active) return false
    const owner = handlers?.window?.()
    if (origin?.window)
      return owner ? origin.window === owner : origin.window.isPrimary !== false
    if (!owner) return true
    if (origin?.activity) return origin.activity === owner.android?.activity
    // Scene events carry an owner; their app-delegate forwarding must not
    // deliver again to every router. Legacy UIKit apps still use the delegate.
    return isIOS && !owner.ios?.scene
  }
  const stop = isAndroid
    ? installAndroid(deliver, accepts)
    : isIOS
      ? installIOS(deliver, accepts)
      : () => {}
  return () => {
    active = false
    handlers = undefined
    stop()
  }
}

type AcceptLink = (origin?: { window?: RouterWindow; activity?: unknown }) => boolean

function installAndroid(
  deliver: SystemLinkHandlers['deliver'],
  accepts: AcceptLink,
): () => void {
  const android = Application.android
  const created = new WeakSet<object>()
  const intent = (candidate: AndroidIntent | null | undefined, source: LinkSource) => {
    const data = candidate?.getData?.()
    if (!data) return
    // reopened from the recents: the link was already taken the first time
    if ((candidate!.getFlags() & FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY) !== 0) return
    deliver(String(data.toString()), source)
  }
  const onLaunch = (args: {
    android?: AndroidIntent
    intent?: AndroidIntent
    savedInstanceState?: unknown
  }) => {
    // Core passes null to Activity.onCreate after process death to avoid
    // restoring native fragments. Its activityCreated event therefore loses
    // the bundle, but launch retains it: do not replay the old task's URL.
    if (accepts() && !args.savedInstanceState)
      intent(args.intent ?? args.android, 'launch')
  }
  const onCreated = (args: { activity: object }) => created.add(args.activity)
  const onNewIntent = (args: {
    window?: RouterWindow
    activity?: object
    intent: AndroidIntent
  }) => {
    // Core also emits activityNewIntent from onCreate, before launch. Launch
    // owns that delivery because only it knows whether this is restoration.
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
  addDelegateHandler?(method: string, handler: (...args: any[]) => unknown): void
  on(event: string, callback: (args: any) => void): void
  off(event: string, callback: (args: any) => void): void
}

function installIOS(
  deliver: SystemLinkHandlers['deliver'],
  accepts: AcceptLink,
): () => void {
  const ios = Application.ios as unknown as IOSApplication | undefined
  if (!ios?.addDelegateHandler) return () => {}
  const url = (
    candidate: { absoluteString?: string } | null | undefined,
    source: LinkSource,
  ) => (candidate?.absoluteString ? deliver(candidate.absoluteString, source) : false)
  const activity = (candidate: any, source: LinkSource) => {
    const browsing =
      typeof NSUserActivityTypeBrowsingWeb === 'string'
        ? NSUserActivityTypeBrowsingWeb
        : 'NSUserActivityTypeBrowsingWeb'
    if (!candidate || candidate.activityType !== browsing) return false
    return url(candidate.webpageURL, source)
  }
  const each = (set: any, visit: (item: any) => void) => {
    const items = set?.allObjects
    for (let index = 0; index < (items?.count ?? 0); index++)
      visit(items.objectAtIndex(index))
  }

  const key = (constant: unknown, fallback: string) =>
    typeof constant === 'string' ? constant : fallback
  ios.addDelegateHandler('applicationDidFinishLaunchingWithOptions', (_app, options) => {
    if (!accepts()) return true
    url(
      options?.objectForKey?.(
        key(
          typeof UIApplicationLaunchOptionsURLKey === 'string'
            ? UIApplicationLaunchOptionsURLKey
            : undefined,
          'UIApplicationLaunchOptionsURLKey',
        ),
      ),
      'launch',
    )
    const activities = options?.objectForKey?.(
      key(
        typeof UIApplicationLaunchOptionsUserActivityDictionaryKey === 'string'
          ? UIApplicationLaunchOptionsUserActivityDictionaryKey
          : undefined,
        'UIApplicationLaunchOptionsUserActivityDictionaryKey',
      ),
    )
    activity(
      activities?.objectForKey?.('UIApplicationLaunchOptionsUserActivityKey'),
      'launch',
    )
    return true
  })
  ios.addDelegateHandler(
    'applicationOpenURLOptions',
    (_app, candidate) => accepts() && url(candidate, 'resume'),
  )
  ios.addDelegateHandler(
    'applicationContinueUserActivityRestorationHandler',
    (_app, candidate) => accepts() && activity(candidate, 'resume'),
  )
  // a quick action; UIKit calls this after the launch too, so the launch options skip it
  const shortcut = (item: unknown, source: LinkSource) => {
    const href = shortcutItemURL(item)
    return href ? deliver(href, source) : false
  }
  ios.addDelegateHandler(
    'applicationPerformActionForShortcutItemCompletionHandler',
    (_app, item, completion) => {
      if (!accepts()) return false
      const taken = shortcut(item, 'resume')
      if (typeof completion === 'function') completion(taken)
      return taken
    },
  )
  // a scene connecting with a URL: the cold start of an app with scenes
  const onConnect = (args: { window?: RouterWindow; connectionOptions?: any }) => {
    if (!accepts(args)) return
    const options = args.connectionOptions
    each(options?.URLContexts, (context) => url(context?.URL, 'launch'))
    each(options?.userActivities, (item) => activity(item, 'launch'))
    shortcut(options?.shortcutItem, 'launch')
  }
  const onURLs = (args: { window?: RouterWindow; urlContexts?: any }) => {
    if (accepts(args)) each(args.urlContexts, (context) => url(context?.URL, 'resume'))
  }
  const onActivity = (args: { window?: RouterWindow; userActivity?: any }) => {
    if (accepts(args)) activity(args.userActivity, 'resume')
  }
  const onShortcut = (args: {
    window?: RouterWindow
    shortcutItem?: any
    completionHandler?: (taken: boolean) => void
  }) => {
    if (accepts(args)) args.completionHandler?.(shortcut(args.shortcutItem, 'resume'))
  }
  const events = {
    sceneWillConnect: onConnect,
    sceneOpenURLContexts: onURLs,
    sceneContinueUserActivity: onActivity,
    scenePerformActionForShortcutItem: onShortcut,
  }
  for (const [name, listener] of Object.entries(events)) ios.on(name, listener)
  return () => {
    for (const [name, listener] of Object.entries(events)) ios.off(name, listener)
  }
}
