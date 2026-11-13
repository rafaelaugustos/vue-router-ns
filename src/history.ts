import type { Entry, Stack } from './stack.js'
import type { BackOptions, RouteLocation } from './types.js'

/** A live stack incarnation, owned by one router/window. Never a restore key. */
export interface NavigationHistoryScope {
  readonly id: string
  readonly name: string
  readonly kind: 'frame' | 'modal'
  readonly windowId: string | undefined
  readonly pinnedRoot: boolean
}

/** An exact live entry address. Retaining it does not retain a native Page. */
export interface NavigationHistoryTarget {
  readonly scopeId: string
  readonly id: string
}

/** Detached route data: no route records, components, metadata or native handles. */
export interface NavigationHistoryRoute {
  readonly path: string
  readonly fullPath: string
  readonly name: RouteLocation['name']
  readonly params: Readonly<Record<string, string | readonly string[]>>
  readonly query: Readonly<Record<string, string | null | readonly (string | null)[]>>
  readonly hash: string
}

export interface NavigationHistoryEntry extends NavigationHistoryTarget {
  /** Page-state key; may survive restoration, unlike the live address above. */
  readonly key: string
  readonly route: NavigationHistoryRoute
  /** Reconstructed from a saved stack, including legacy path-only snapshots. */
  readonly restored: boolean
}

/** Frozen snapshot of retained entries, bottom to top. There is no forward list. */
export interface NavigationHistory {
  readonly scope: NavigationHistoryScope
  readonly entries: readonly NavigationHistoryEntry[]
}

export interface HistoryOptions {
  /** Named frame in this router/window; otherwise the caller's stack. */
  frame?: string
}

/** The target already identifies its stack; a frame override is not accepted. */
export type BackToEntryOptions = Omit<BackOptions, 'frame'>

const lifetime = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
let nextScope = 0

/** Private projection caches use weak keys; public snapshots contain only data. */
export function createHistory() {
  const scopes = new WeakMap<Stack, string>()
  const entries = new WeakMap<Entry, NavigationHistoryEntry>()
  const scopeId = (stack: Stack) => {
    let id = scopes.get(stack)
    if (!id) scopes.set(stack, (id = `${lifetime}-${++nextScope}`))
    return id
  }
  const entryId = (entry: Entry) => `${scopeId(entry.stack)}:${entry.id}`
  function project(entry: Entry): NavigationHistoryEntry {
    let snapshot = entries.get(entry)
    if (!snapshot) {
      const { path, fullPath, name, params, query, hash } = entry.route
      snapshot = Object.freeze({
        scopeId: scopeId(entry.stack),
        id: entryId(entry),
        key: entry.key,
        restored: entry.restored,
        route: Object.freeze({
          path,
          fullPath,
          name,
          hash,
          params: copyValues(params),
          query: copyValues(query),
        }),
      })
      entries.set(entry, snapshot)
    }
    return snapshot
  }
  return {
    scopeId,
    entryId,
    snapshot(stack: Stack, windowId: string | undefined): NavigationHistory {
      return Object.freeze({
        scope: Object.freeze({
          id: scopeId(stack),
          name: stack.name,
          kind: stack.modal ? 'modal' : 'frame',
          windowId,
          pinnedRoot: !!stack.host?.capabilities.pinnedRoot,
        }),
        entries: Object.freeze(stack.entries.value.map(project)),
      })
    },
  }
}

function copyValues<T extends string | null>(values: Record<string, T | T[]>) {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(values).map(([key, value]) => [
        key,
        Array.isArray(value) ? Object.freeze([...value]) : value,
      ]),
    ),
  ) as Readonly<Record<string, T | readonly T[]>>
}
