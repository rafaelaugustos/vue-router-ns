import { Application, isAndroid, isIOS } from '@nativescript/core'
import type { RouteLocation, RouteLocationRaw } from './types.js'

/** A destination offered from the home screen: a long press on the icon, a launcher shortcut. */
export interface RouteShortcut<To = RouteLocationRaw> {
  /** Stable identity, also the shortcut's native id. */
  id: string
  title: string
  subtitle?: string
  /** Where it goes. Resolved when it is set, and again when it is taken. */
  to: To
  icon?: {
    /** A drawable resource name. */
    android?: string
    /** An SF Symbols name. */
    ios?: string
  }
}

/** The scheme shortcut payloads travel with. Internal: it is not an app scheme to register. */
export const SHORTCUT_SCHEME = 'vue-router-ns'
/** Version 2 retains a stable route name when one exists, so path renames work. */
export function shortcutURL(id: string, location: RouteLocation): string {
  if (!id.trim()) throw new Error('A shortcut needs a non-empty id')
  const to =
    typeof location.name === 'string'
      ? {
          name: location.name,
          params: location.params,
          query: location.query,
          hash: location.hash,
        }
      : { path: location.path, query: location.query, hash: location.hash }
  return `${SHORTCUT_SCHEME}://shortcut/${encodeURIComponent(id)}?to=${encodeURIComponent(JSON.stringify(to))}&v=2`
}

/** Reads the original path payload and the current named-route payload. */
export function readShortcutURL(link: {
  scheme: string
  path: string
  query: Record<string, string | null | (string | null)[]>
}): { id: string; to: RouteLocationRaw } | undefined {
  if (link.scheme !== SHORTCUT_SCHEME || !link.path.startsWith('/shortcut/')) return
  try {
    const id = decodeURIComponent(link.path.slice('/shortcut/'.length))
    if (!id.trim() || typeof link.query.to !== 'string') return
    if (link.query.v === '1') return { id, to: link.query.to }
    if (link.query.v !== '2') return
    const raw: unknown = JSON.parse(link.query.to)
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return
    const value = raw as Record<string, unknown>
    if (
      Object.keys(value).some(
        (key) => !['name', 'path', 'params', 'query', 'hash'].includes(key),
      )
    )
      return
    if (
      'name' in value
        ? typeof value.name !== 'string' || 'path' in value
        : typeof value.path !== 'string'
    )
      return
    if (value.hash !== undefined && typeof value.hash !== 'string') return
    for (const key of ['params', 'query']) {
      const data = value[key]
      if (data === undefined) continue
      if (!data || typeof data !== 'object' || Array.isArray(data)) return
      for (const [key, val] of Object.entries(data)) {
        if (['__proto__', 'prototype', 'constructor'].includes(key)) return
        if (
          !(Array.isArray(val) ? val : [val]).every(
            (v) => v === null || typeof v === 'string' || typeof v === 'number',
          )
        )
          return
      }
    }
    return { id, to: value as unknown as RouteLocationRaw }
  } catch {
    return
  }
}

export interface PublishedShortcut extends RouteShortcut {
  location: RouteLocation
}

/** Whether this platform shows home-screen shortcuts at all. */
export function supportsShortcuts(): boolean {
  if (isAndroid)
    return (
      typeof androidx !== 'undefined' &&
      !!androidx.core?.content?.pm?.ShortcutManagerCompat
    )
  if (isIOS) return typeof UIApplicationShortcutItem !== 'undefined'
  return false
}

/**
 * Replaces the app's dynamic shortcuts with `shortcuts`, within the
 * platform's limit. Returns the ids that were published.
 */
export function publishShortcuts(shortcuts: readonly PublishedShortcut[]): string[] {
  if (isAndroid) return publishAndroid(shortcuts)
  if (isIOS) return publishIOS(shortcuts)
  return []
}

declare const androidx: {
  core?: {
    content?: {
      pm?: {
        ShortcutManagerCompat: {
          getMaxShortcutCountPerActivity(context: unknown): number
          setDynamicShortcuts(
            context: unknown,
            shortcuts: NativeList<NativeShortcut>,
          ): boolean
          getShortcuts?(context: unknown, flags: number): NativeList<NativeShortcut>
          disableShortcuts?(
            context: unknown,
            ids: NativeList<string>,
            message: string,
          ): void
          enableShortcuts?(context: unknown, shortcuts: NativeList<NativeShortcut>): void
          isRequestPinShortcutSupported?(context: unknown): boolean
          requestPinShortcut?(
            context: unknown,
            shortcut: unknown,
            callback: null,
          ): boolean
          removeAllDynamicShortcuts(context: unknown): void
        }
        ShortcutInfoCompat: {
          Builder: new (context: unknown, id: string) => ShortcutBuilder
        }
      }
    }
    graphics?: {
      drawable?: {
        IconCompat: { createWithResource(context: unknown, resource: number): unknown }
      }
    }
  }
}
declare const android: {
  content: {
    Intent: new (action: string, data: unknown) => AndroidIntent
    ComponentName: new (context: unknown, className: string) => unknown
  }
  net: { Uri: { parse(url: string): unknown } }
}
declare const java: {
  util: { ArrayList: new <T>() => NativeList<T> & { add(item: T): void } }
}

interface ShortcutBuilder {
  setShortLabel(label: string): ShortcutBuilder
  setLongLabel(label: string): ShortcutBuilder
  setIcon(icon: unknown): ShortcutBuilder
  setIntent(intent: AndroidIntent): ShortcutBuilder
  build(): NativeShortcut
}
interface AndroidIntent {
  setComponent(component: unknown): AndroidIntent
  addFlags(flags: number): AndroidIntent
}
interface AndroidContext {
  getPackageName(): string
  getResources(): { getIdentifier(name: string, type: string, pkg: string): number }
  getClass(): { getName(): string }
}

const FLAG_ACTIVITY_NEW_TASK = 0x10000000
const FLAG_ACTIVITY_CLEAR_TOP = 0x04000000
const FLAG_ACTIVITY_SINGLE_TOP = 0x20000000

interface NativeList<T> {
  size(): number
  get(index: number): T
}
interface NativeShortcut {
  getId(): string
  getIntent(): { getData(): { toString(): string } | null } | null
  isDeclaredInManifest(): boolean
}
function array<T>(list: NativeList<T> | undefined): T[] {
  return list ? Array.from({ length: list.size() }, (_, index) => list.get(index)) : []
}
function nativeList<T>(items: readonly T[]) {
  const list = new java.util.ArrayList<T>()
  for (const item of items) list.add(item)
  return list
}
function androidContext() {
  return (Application.android.foregroundActivity ??
    Application.android.startActivity) as unknown as AndroidContext | undefined
}
function androidShortcut(activity: AndroidContext, shortcut: PublishedShortcut) {
  const pm = androidx.core!.content!.pm!
  const intent = new android.content.Intent(
    'android.intent.action.VIEW',
    android.net.Uri.parse(shortcutURL(shortcut.id, shortcut.location)),
  )
  intent.setComponent(
    new android.content.ComponentName(activity, activity.getClass().getName()),
  )
  intent.addFlags(
    FLAG_ACTIVITY_NEW_TASK | FLAG_ACTIVITY_CLEAR_TOP | FLAG_ACTIVITY_SINGLE_TOP,
  )
  const builder = new pm.ShortcutInfoCompat.Builder(activity, shortcut.id)
    .setShortLabel(shortcut.title)
    .setLongLabel(shortcut.subtitle ?? shortcut.title)
    .setIntent(intent)
  const icon = shortcut.icon?.android
  if (icon) {
    const resource = activity
      .getResources()
      .getIdentifier(icon, 'drawable', activity.getPackageName())
    const IconCompat = androidx.core?.graphics?.drawable?.IconCompat
    if (resource && IconCompat)
      builder.setIcon(IconCompat.createWithResource(activity, resource))
    else if (__DEV__)
      console.warn(`[vue-router-ns] No drawable named "${icon}" for a shortcut`)
  }
  return builder.build()
}
function publishAndroid(shortcuts: readonly PublishedShortcut[]): string[] {
  const activity = androidContext()
  if (!activity || typeof androidx === 'undefined') return []
  const manager = androidx.core?.content?.pm?.ShortcutManagerCompat
  if (!manager) return []
  // Static shortcuts share the dynamic quota and cannot be replaced at runtime.
  const statics = array(manager.getShortcuts?.(activity, 1))
  if (shortcuts.some((shortcut) => statics.some((item) => item.getId() === shortcut.id)))
    throw new Error('A dynamic shortcut cannot replace a manifest shortcut')
  const limit = Math.max(
    0,
    manager.getMaxShortcutCountPerActivity(activity) - statics.length,
  )
  const kept = shortcuts.slice(0, limit)
  if (__DEV__ && kept.length < shortcuts.length)
    console.warn(
      `[vue-router-ns] The launcher shows ${limit} dynamic shortcuts; ${shortcuts.length - kept.length} left out`,
    )
  const removed = array(manager.getShortcuts?.(activity, 2 | 4))
    .filter(
      (item) =>
        !item.isDeclaredInManifest() &&
        !shortcuts.some((shortcut) => shortcut.id === item.getId()) &&
        item
          .getIntent()
          ?.getData()
          ?.toString()
          .startsWith(`${SHORTCUT_SCHEME}://shortcut/`),
    )
    .map((item) => item.getId())
  if (kept.length) {
    const native = nativeList(kept.map((item) => androidShortcut(activity, item)))
    if (manager.setDynamicShortcuts(activity, native) === false)
      throw new Error(
        'Android refused to update shortcuts (rate limit or launcher policy)',
      )
    manager.enableShortcuts?.(activity, native)
  } else manager.removeAllDynamicShortcuts(activity)
  // Launchers own pinned copies. Disable obsolete router entries instead of
  // pretending removing the dynamic list also removes the user's pinned icons.
  if (removed.length)
    manager.disableShortcuts?.(
      activity,
      nativeList(removed),
      'This shortcut is no longer available',
    )
  return kept.map((shortcut) => shortcut.id)
}

/** Whether the Android launcher supports a user-confirmed pin request. */
export function supportsPinnedShortcuts(): boolean {
  if (!isAndroid || typeof androidx === 'undefined') return false
  const activity = androidContext()
  return (
    !!activity &&
    !!androidx.core?.content?.pm?.ShortcutManagerCompat.isRequestPinShortcutSupported?.(
      activity,
    )
  )
}

/** True means the launcher accepted the request, not that the user approved it. */
export function pinShortcut(shortcut: PublishedShortcut): boolean {
  if (!supportsPinnedShortcuts()) return false
  const activity = androidContext()!
  return !!androidx.core!.content!.pm!.ShortcutManagerCompat.requestPinShortcut?.(
    activity,
    androidShortcut(activity, shortcut),
    null,
  )
}

declare const UIApplicationShortcutItem: {
  alloc(): {
    initWithTypeLocalizedTitleLocalizedSubtitleIconUserInfo(
      type: string,
      title: string,
      subtitle: string | null,
      icon: unknown,
      userInfo: unknown,
    ): unknown
  }
}
declare const UIApplicationShortcutIcon: {
  iconWithSystemImageName(name: string): unknown
}
declare const UIApplication: { sharedApplication: { shortcutItems: unknown } }
declare const NSDictionary: {
  dictionaryWithObjectsForKeys(objects: unknown, keys: unknown): unknown
}
declare const NSArray: { arrayWithArray(items: unknown[]): unknown }

/** Applied to every quick action, mirroring Android's dynamic shortcut limit. */
const IOS_LIMIT = 4

function publishIOS(shortcuts: readonly PublishedShortcut[]): string[] {
  if (typeof UIApplicationShortcutItem === 'undefined') return []
  const kept = shortcuts.slice(0, IOS_LIMIT)
  if (__DEV__ && kept.length < shortcuts.length) {
    console.warn(
      `[vue-router-ns] iOS shows ${IOS_LIMIT} quick actions; ${shortcuts.length - kept.length} left out`,
    )
  }
  const items = kept.map((shortcut) => {
    const icon =
      shortcut.icon?.ios && typeof UIApplicationShortcutIcon !== 'undefined'
        ? UIApplicationShortcutIcon.iconWithSystemImageName(shortcut.icon.ios)
        : null
    const userInfo = NSDictionary.dictionaryWithObjectsForKeys(
      NSArray.arrayWithArray([shortcutURL(shortcut.id, shortcut.location)]),
      NSArray.arrayWithArray(['url']),
    )
    return UIApplicationShortcutItem.alloc().initWithTypeLocalizedTitleLocalizedSubtitleIconUserInfo(
      shortcut.id,
      shortcut.title,
      shortcut.subtitle ?? null,
      icon,
      userInfo,
    )
  })
  UIApplication.sharedApplication.shortcutItems = NSArray.arrayWithArray(items)
  return kept.map((shortcut) => shortcut.id)
}

/** The URL inside a quick action the router published, or `undefined` for someone else's. */
export function shortcutItemURL(item: any): string | undefined {
  const url = item?.userInfo?.objectForKey?.('url') ?? item?.userInfo?.url
  return typeof url === 'string' && url.startsWith(`${SHORTCUT_SCHEME}://`)
    ? url
    : undefined
}
