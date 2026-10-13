import { comparePatterns, compilePath, type PathPattern } from './path.js'
import { normalizeQuery, parseURL, stringifyURL } from './query.js'
import type {
  LocationQuery,
  RouteLocation,
  RouteLocationRaw,
  RouteParams,
  RouteParamsRaw,
  RouteRecord,
  RouteRecordName,
  RouteRecordRaw,
} from './types.js'

interface RouteMatcher {
  record: RouteRecord
  pattern: PathPattern
  parent: RouteMatcher | undefined
  children: RouteMatcher[]
}

export interface Matcher {
  addRoute(route: RouteRecordRaw, parentName?: RouteRecordName): () => void
  removeRoute(name: RouteRecordName): void
  hasRoute(name: RouteRecordName): boolean
  getRoutes(): RouteRecord[]
  resolve(to: RouteLocationRaw, current: RouteLocation): RouteLocation
}

export function createMatcher(routes: readonly RouteRecordRaw[]): Matcher {
  /** Records that can be navigated to, most specific first. */
  const ranked: RouteMatcher[] = []
  const all: RouteMatcher[] = []
  const named = new Map<RouteRecordName, RouteMatcher>()
  const byRecord = new WeakMap<RouteRecord, RouteMatcher>()

  function add(raw: RouteRecordRaw, parent?: RouteMatcher): RouteMatcher {
    const path = joinPaths(parent?.record.path, raw.path)
    const record: RouteRecord = {
      path,
      name: raw.name,
      component: raw.component,
      redirect: raw.redirect,
      meta: raw.meta ?? {},
      props: raw.props,
      beforeEnter: toArray(raw.beforeEnter),
      modal: raw.modal === true ? {} : raw.modal || false,
      transition: raw.transition,
      children: [],
      parent: parent?.record,
    }
    const matcher: RouteMatcher = {
      record,
      pattern: compilePath(path),
      parent,
      children: [],
    }

    if (record.name !== undefined) {
      const existing = named.get(record.name)
      if (existing) remove(existing)
      named.set(record.name, matcher)
    }

    if (parent) {
      parent.children.push(matcher)
      parent.record.children.push(record)
    }

    // children go first, so `{ path: '' }` wins over a parent with the same path
    for (const child of raw.children ?? []) add(child, matcher)

    all.push(matcher)
    byRecord.set(record, matcher)
    if (record.component || record.redirect) insert(matcher)

    return matcher
  }

  function insert(matcher: RouteMatcher) {
    const index = ranked.findIndex(
      (other) => comparePatterns(matcher.pattern, other.pattern) < 0,
    )
    ranked.splice(index < 0 ? ranked.length : index, 0, matcher)
  }

  function remove(matcher: RouteMatcher) {
    for (const child of [...matcher.children]) remove(child)

    removeFrom(ranked, matcher)
    removeFrom(all, matcher)
    if (matcher.parent) {
      removeFrom(matcher.parent.children, matcher)
      removeFrom(matcher.parent.record.children, matcher.record)
    }
    if (matcher.record.name !== undefined && named.get(matcher.record.name) === matcher) {
      named.delete(matcher.record.name)
    }
  }

  function resolve(to: RouteLocationRaw, current: RouteLocation): RouteLocation {
    if (typeof to === 'string') {
      const { path, query, hash } = parseURL(to)
      return byPath(path, query, hash)
    }

    const query = normalizeQuery(to.query)
    const hash = to.hash ? (to.hash.startsWith('#') ? to.hash : `#${to.hash}`) : ''

    if (to.path !== undefined) return byPath(to.path, query, hash)

    let matcher: RouteMatcher | undefined
    let params: RouteParams

    if (to.name !== undefined) {
      matcher = named.get(to.name)
      if (!matcher) throw new Error(`No route named "${String(to.name)}"`)
      if (!matcher.record.component && !matcher.record.redirect) {
        throw new Error(`Route "${String(to.name)}" has no component to navigate to`)
      }
      params = { ...current.params, ...normalizeParams(to.params) }
    } else {
      const leaf = current.matched.at(-1)
      matcher = leaf && byRecord.get(leaf)
      if (!matcher) {
        throw new Error(`Cannot resolve a relative location without a current route`)
      }
      params = { ...current.params, ...normalizeParams(to.params) }
    }

    params = pick(
      params,
      matcher.pattern.keys.map((key) => key.name),
    )
    return build(matcher, matcher.pattern.stringify(params), params, query, hash)
  }

  function byPath(path: string, query: LocationQuery, hash: string): RouteLocation {
    if (!path.startsWith('/')) {
      throw new Error(`Paths must be absolute, got "${path}"`)
    }
    for (const matcher of ranked) {
      const params = matcher.pattern.match(path)
      if (params) return build(matcher, path, params, query, hash)
    }
    return build(undefined, path, {}, query, hash)
  }

  for (const route of routes) add(route)

  return {
    addRoute(route, parentName) {
      let parent: RouteMatcher | undefined
      if (parentName !== undefined) {
        parent = named.get(parentName)
        if (!parent) {
          throw new Error(`No route named "${String(parentName)}" to nest under`)
        }
      }
      const matcher = add(route, parent)
      return () => remove(matcher)
    },
    removeRoute(name) {
      const matcher = named.get(name)
      if (matcher) remove(matcher)
    },
    hasRoute: (name) => named.has(name),
    getRoutes: () => all.map((matcher) => matcher.record),
    resolve,
  }
}

function build(
  matcher: RouteMatcher | undefined,
  path: string,
  params: RouteParams,
  query: LocationQuery,
  hash: string,
): RouteLocation {
  const matched: RouteRecord[] = []
  for (let m = matcher; m; m = m.parent) matched.unshift(m.record)

  return {
    path,
    fullPath: stringifyURL(path, query, hash),
    name: matcher?.record.name,
    params,
    query,
    hash,
    meta: Object.assign({}, ...matched.map((record) => record.meta)),
    matched,
    redirectedFrom: undefined,
  }
}

function joinPaths(parent: string | undefined, child: string): string {
  if (parent === undefined || child.startsWith('/')) return child
  if (!child) return parent
  return `${parent.replace(/\/$/, '')}/${child}`
}

function normalizeParams(params: RouteParamsRaw | undefined): RouteParams {
  const normalized: RouteParams = {}
  if (!params) return normalized

  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue
    normalized[key] = Array.isArray(value) ? value.map(String) : String(value)
  }
  return normalized
}

function pick(params: RouteParams, keys: string[]): RouteParams {
  const picked: RouteParams = {}
  for (const key of keys) {
    const value = params[key]
    if (value !== undefined) picked[key] = value
  }
  return picked
}

function toArray<T>(value: T | readonly T[] | undefined): T[] {
  if (value === undefined) return []
  return Array.isArray(value) ? [...value] : [value as T]
}

function removeFrom<T>(list: T[], item: T) {
  const index = list.indexOf(item)
  if (index >= 0) list.splice(index, 1)
}
