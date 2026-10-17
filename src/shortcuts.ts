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
const PAYLOAD_VERSION = 1

/** The URL a shortcut carries: its id, the resolved path and the payload version. */
export function shortcutURL(id: string, location: RouteLocation): string {
  return `${SHORTCUT_SCHEME}://shortcut/${encodeURIComponent(id)}?to=${encodeURIComponent(location.fullPath)}&v=${PAYLOAD_VERSION}`
}

/** The id and path in a shortcut URL, when it is one the router wrote. */
export function readShortcutURL(link: {
  scheme: string
  path: string
  query: Record<string, string | null | (string | null)[]>
}): { id: string; to: string } | undefined {
  if (link.scheme !== SHORTCUT_SCHEME || !link.path.startsWith('/shortcut/'))
    return undefined
  const to = link.query.to
  const version = link.query.v
  if (typeof to !== 'string' || version !== String(PAYLOAD_VERSION)) return undefined
  return { id: decodeURIComponent(link.path.slice('/shortcut/'.length)), to }
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
          setDynamicShortcuts(context: unknown, shortcuts: unknown): void
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
declare const java: { util: { ArrayList: new () => { add(item: unknown): void } } }

interface ShortcutBuilder {
  setShortLabel(label: string): ShortcutBuilder
  setLongLabel(label: string): ShortcutBuilder
  setIcon(icon: unknown): ShortcutBuilder
  setIntent(intent: AndroidIntent): ShortcutBuilder
  build(): unknown
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

function publishAndroid(shortcuts: readonly PublishedShortcut[]): string[] {
  const activity = (Application.android.foregroundActivity ??
    Application.android.startActivity) as unknown as AndroidContext | undefined
  const pm = androidx.core?.content?.pm
  if (!activity || !pm) return []
  const limit = pm.ShortcutManagerCompat.getMaxShortcutCountPerActivity(activity)
  const kept = shortcuts.slice(0, limit)
  if (__DEV__ && kept.length < shortcuts.length) {
    console.warn(
      `[vue-router-ns] The launcher shows ${limit} shortcuts; ${shortcuts.length - kept.length} left out`,
    )
  }
  if (!kept.length) {
    pm.ShortcutManagerCompat.removeAllDynamicShortcuts(activity)
    return []
  }
  const list = new java.util.ArrayList()
  for (const shortcut of kept) {
    const intent = new android.content.Intent(
      'android.intent.action.VIEW',
      android.net.Uri.parse(shortcutURL(shortcut.id, shortcut.location)),
    )
    intent.setComponent(
      new android.content.ComponentName(activity, activity.getClass().getName()),
    )
    intent.addFlags(FLAG_ACTIVITY_NEW_TASK | FLAG_ACTIVITY_CLEAR_TOP)
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
    list.add(builder.build())
  }
  pm.ShortcutManagerCompat.setDynamicShortcuts(activity, list)
  return kept.map((shortcut) => shortcut.id)
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
