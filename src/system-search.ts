import { isIOS } from '@nativescript/core'

/** Explicit, app-reviewed content. No routes or route params are indexed automatically. */
export interface SearchItem {
  /** Stable content id; the application resolves it to today's destination on activation. */
  id: string
  title: string
  description?: string
  keywords?: readonly string[]
  expiresAt?: Date
}
export interface SystemSearchOptions {
  /** An app-owned namespace, e.g. com.example.app.public-documents. */
  domain: string
  /** Return today's app URL/path, or null for removed/unauthorized content. */
  resolve(id: string): string | null | undefined
}
export interface SystemSearch {
  /** Native availability, not a promise that Spotlight will rank or display an item. */
  readonly supported: boolean
  /** Upsert only these explicitly selected items. Rejects native indexing failures. */
  index(items: readonly SearchItem[]): Promise<boolean>
  /** Remove selected ids; omit ids to remove this domain's entire index. */
  remove(ids?: readonly string[]): Promise<boolean>
  /** Pass as links.activity. Consumes this domain's versioned Spotlight identifiers. */
  url(activity: unknown): string | undefined
}

interface NativeError {
  localizedDescription?: string
}
interface Attributes {
  title: string
  contentDescription?: string
  keywords?: unknown
}
interface NativeItem {
  expirationDate?: unknown
}
interface NativeIndex {
  indexSearchableItemsCompletionHandler(
    items: unknown,
    completion: (error: NativeError | null) => void,
  ): void
  deleteSearchableItemsWithIdentifiersCompletionHandler(
    ids: unknown,
    completion: (error: NativeError | null) => void,
  ): void
  deleteSearchableItemsWithDomainIdentifiersCompletionHandler(
    domains: unknown,
    completion: (error: NativeError | null) => void,
  ): void
}
declare const CSSearchableIndex: {
  isIndexingAvailable(): boolean
  defaultSearchableIndex(): NativeIndex
}
declare const CSSearchableItemAttributeSet: {
  alloc(): { initWithItemContentType(type: string): Attributes }
}
declare const CSSearchableItem: {
  alloc(): {
    initWithUniqueIdentifierDomainIdentifierAttributeSet(
      id: string,
      domain: string,
      attributes: Attributes,
    ): NativeItem
  }
}
declare const NSArray: { arrayWithArray(items: readonly unknown[]): unknown }
declare const NSDate: { dateWithTimeIntervalSince1970(seconds: number): unknown }
declare const CSSearchableItemActionType: string
declare const CSSearchableItemActivityIdentifier: string

/** Optional Core Spotlight prototype, imported separately from the router. */
export function createSystemSearch(options: SystemSearchOptions): SystemSearch {
  if (!options.domain.trim()) throw new Error('System search needs a non-empty domain')
  const prefix = `vue-router-ns:search:v1:${encodeURIComponent(options.domain)}:`
  const identifier = (id: string) => {
    if (!id.trim()) throw new Error('A search item needs a non-empty id')
    return prefix + encodeURIComponent(id)
  }
  const supported = () =>
    isIOS &&
    typeof CSSearchableIndex !== 'undefined' &&
    CSSearchableIndex.isIndexingAvailable()
  const invoke = (
    start: (index: NativeIndex, done: (error: NativeError | null) => void) => void,
  ) => {
    if (!supported()) return Promise.resolve(false)
    return new Promise<boolean>((resolve, reject) => {
      start(CSSearchableIndex.defaultSearchableIndex(), (error) => {
        if (error)
          reject(
            new Error(error.localizedDescription ?? 'Core Spotlight operation failed'),
          )
        else resolve(true)
      })
    })
  }
  return {
    get supported() {
      return supported()
    },
    async index(items) {
      const ids = items.map((item) => identifier(item.id))
      if (new Set(ids).size !== ids.length)
        throw new Error('Search item ids must be unique')
      if (!supported()) return false
      const native = items.map((item, index) => {
        if (!item.title.trim()) throw new Error('A search item needs a title')
        const attributes =
          CSSearchableItemAttributeSet.alloc().initWithItemContentType('public.content')
        attributes.title = item.title
        if (item.description !== undefined)
          attributes.contentDescription = item.description
        if (item.keywords) attributes.keywords = NSArray.arrayWithArray(item.keywords)
        const native =
          CSSearchableItem.alloc().initWithUniqueIdentifierDomainIdentifierAttributeSet(
            ids[index]!,
            options.domain,
            attributes,
          )
        if (item.expiresAt) {
          if (!Number.isFinite(item.expiresAt.getTime()))
            throw new Error('Invalid search expiration date')
          native.expirationDate = NSDate.dateWithTimeIntervalSince1970(
            item.expiresAt.getTime() / 1000,
          )
        }
        return native
      })
      return invoke((index, done) =>
        index.indexSearchableItemsCompletionHandler(NSArray.arrayWithArray(native), done),
      )
    },
    remove(ids) {
      const native = ids?.map(identifier)
      return invoke((index, done) =>
        native
          ? index.deleteSearchableItemsWithIdentifiersCompletionHandler(
              NSArray.arrayWithArray(native),
              done,
            )
          : index.deleteSearchableItemsWithDomainIdentifiersCompletionHandler(
              NSArray.arrayWithArray([options.domain]),
              done,
            ),
      )
    },
    url(activity) {
      const candidate = activity as {
        activityType?: string
        userInfo?: { objectForKey?(key: string): unknown }
      } | null
      const type =
        typeof CSSearchableItemActionType === 'string'
          ? CSSearchableItemActionType
          : 'com.apple.corespotlightitem'
      if (candidate?.activityType !== type) return
      const key =
        typeof CSSearchableItemActivityIdentifier === 'string'
          ? CSSearchableItemActivityIdentifier
          : 'kCSSearchableItemActivityIdentifier'
      const value = candidate.userInfo?.objectForKey?.(key)
      if (typeof value !== 'string' || !value.startsWith(prefix)) return
      try {
        const id = decodeURIComponent(value.slice(prefix.length))
        return id ? (options.resolve(id) ?? undefined) : undefined
      } catch {
        return
      }
    },
  }
}
