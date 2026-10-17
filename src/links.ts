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
export function installSystemLinks({ deliver }: SystemLinkHandlers): () => void {
  if (isAndroid) return installAndroid(deliver)
  if (isIOS) return installIOS(deliver)
  return () => {}
}

function installAndroid(deliver: SystemLinkHandlers['deliver']): () => void {
  const android = Application.android
  const intent = (candidate: AndroidIntent | null | undefined, source: LinkSource) => {
    const data = candidate?.getData?.()
    if (!data) return
    // reopened from the recents: the link was already taken the first time
    if ((candidate!.getFlags() & FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY) !== 0) return
    deliver(String(data.toString()), source)
  }
  const onCreated = (args: {
    activity: { getIntent(): AndroidIntent }
    bundle?: unknown
  }) => {
    // a recreated activity (rotation, process death) brings its old intent back
    if (!args.bundle) intent(args.activity.getIntent(), 'launch')
  }
  const onNewIntent = (args: { intent: AndroidIntent }) => intent(args.intent, 'resume')
  android.on('activityCreated', onCreated)
  android.on('activityNewIntent', onNewIntent)
  return () => {
    android.off('activityCreated', onCreated)
    android.off('activityNewIntent', onNewIntent)
  }
}

interface IOSApplication {
  addDelegateHandler?(method: string, handler: (...args: any[]) => unknown): void
  on(event: string, callback: (args: any) => void): void
  off(event: string, callback: (args: any) => void): void
}

function installIOS(deliver: SystemLinkHandlers['deliver']): () => void {
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
  ios.addDelegateHandler('applicationOpenURLOptions', (_app, candidate) =>
    url(candidate, 'resume'),
  )
  ios.addDelegateHandler(
    'applicationContinueUserActivityRestorationHandler',
    (_app, candidate) => activity(candidate, 'resume'),
  )
  // a quick action; UIKit calls this after the launch too, so the launch options skip it
  const shortcut = (item: unknown, source: LinkSource) => {
    const href = shortcutItemURL(item)
    return href ? deliver(href, source) : false
  }
  ios.addDelegateHandler(
    'applicationPerformActionForShortcutItemCompletionHandler',
    (_app, item, completion) => {
      const taken = shortcut(item, 'resume')
      if (typeof completion === 'function') completion(taken)
      return taken
    },
  )
  // a scene connecting with a URL: the cold start of an app with scenes
  const onConnect = (args: { connectionOptions?: any }) => {
    const options = args.connectionOptions
    each(options?.URLContexts, (context) => url(context?.URL, 'launch'))
    each(options?.userActivities, (item) => activity(item, 'launch'))
    shortcut(options?.shortcutItem, 'launch')
  }
  ios.on('sceneWillConnect', onConnect)
  return () => ios.off('sceneWillConnect', onConnect)
}
