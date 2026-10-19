import { compilePath } from '../path.js'
import type { Router } from '../router.js'
import type { RouteRecord, RouteRecordName, RouteRecordRaw } from '../types.js'

/** Combine independent tables; name/pattern conflicts are errors, never silent overrides. */
export function mergeFileRoutes<
  const G extends readonly RouteRecordRaw[],
  const E extends readonly RouteRecordRaw[],
>(generated: G, explicit: E): readonly [...G, ...E] {
  const all = [...generated, ...explicit]
  inspect(all)
  return all as [...G, ...E]
}

export interface FileRouteUpdater {
  /** Future path/name matching sees the new table. Retained entries keep their Page/route/state. */
  update(routes: readonly RouteRecordRaw[]): void
}

/** Attach after createRouter({ routes }). Accept generated-module HMR without replacing the router. */
export function createFileRouteUpdater(
  router: Pick<Router<any>, 'getRoutes' | 'addRoute' | 'removeRoute'>,
  initial: readonly RouteRecordRaw[],
): FileRouteUpdater {
  let current = inspect(initial, true)
  let owned = capture(current)
  function capture(records: FlatRecord[]) {
    const actual = new Map(router.getRoutes().map((r) => [r.name, r]))
    const result = new Set<RouteRecord>()
    for (const record of records) {
      const found = actual.get(record.raw.name)
      if (
        !found ||
        found.path !== record.path ||
        found.component !== record.raw.component
      )
        throw new Error(
          `File route "${String(record.raw.name)}" must be installed before creating its updater`,
        )
      result.add(found)
    }
    return result
  }
  return {
    update(next) {
      const incoming = inspect(next, true)
      const registered = router.getRoutes()
      // External addRoute/removeRoute stays authoritative; don't resurrect or replace it.
      for (const old of owned)
        if (!registered.includes(old))
          throw new Error(
            `File route "${String(old.name)}" was changed through addRoute/removeRoute; recreate its updater before applying generated changes`,
          )
      const foreign = registered.filter((r) => !owned.has(r))
      for (const record of foreign) {
        if (record.parent && owned.has(record.parent))
          throw new Error(
            `Cannot update file routes with externally added child "${String(record.name)}"; remove that child first`,
          )
        for (const candidate of incoming)
          if (
            (record.name !== undefined && record.name === candidate.raw.name) ||
            signature(record.path) === signature(candidate.path)
          )
            throw new Error(
              `Generated route "${String(candidate.raw.name)}" conflicts with explicit route "${String(record.name ?? record.path)}"`,
            )
      }
      // Everything that can fail structurally is validated before changing the matcher.
      for (const old of current) if (!old.parent) router.removeRoute(old.raw.name!)
      for (const route of next) router.addRoute(route)
      current = incoming
      owned = capture(current)
    },
  }
}

interface FlatRecord {
  raw: RouteRecordRaw
  path: string
  parent?: FlatRecord
}
function inspect(routes: readonly RouteRecordRaw[], generated = false): FlatRecord[] {
  const list: FlatRecord[] = [],
    names = new Set<RouteRecordName>(),
    paths = new Map<string, FlatRecord>()
  function visit(raw: RouteRecordRaw, parent?: FlatRecord) {
    const path = raw.path.startsWith('/')
      ? raw.path
      : `${parent?.path.replace(/\/$/, '') ?? ''}/${raw.path}`.replace(/\/$/, '') || '/'
    compilePath(path)
    if (generated && (typeof raw.name !== 'string' || !raw.path.startsWith('/')))
      throw new Error('Generated routes must have string names and absolute paths')
    if (raw.name !== undefined && names.has(raw.name))
      throw new Error(`Duplicate route name "${String(raw.name)}"`)
    if (raw.name !== undefined) names.add(raw.name)
    const entry = { raw, path, parent },
      key = signature(path),
      prior = paths.get(key)
    if (prior && !(prior === parent && prior.path === path))
      throw new Error(`Conflicting route pattern "${path}"`)
    paths.set(key, entry)
    list.push(entry)
    for (const child of raw.children ?? []) visit(child, entry)
  }
  routes.forEach((r) => visit(r))
  return list
}
function signature(path: string) {
  return path.replace(/:\w+/g, ':param').replace(/\/$/, '').toLowerCase()
}
