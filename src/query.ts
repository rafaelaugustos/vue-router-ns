import type {
  LocationQuery,
  LocationQueryRaw,
  LocationQueryValue,
  LocationQueryValueRaw,
} from './types.js'

export function parseQuery(search: string): LocationQuery {
  const query: LocationQuery = {}
  const source = search.startsWith('?') ? search.slice(1) : search

  for (const part of source.split('&')) {
    if (!part) continue

    const eq = part.indexOf('=')
    const key = decode(eq < 0 ? part : part.slice(0, eq))
    const value = eq < 0 ? null : decode(part.slice(eq + 1))

    if (Object.hasOwn(query, key)) {
      const current = query[key]!
      query[key] = Array.isArray(current) ? [...current, value] : [current, value]
    } else {
      query[key] = value
    }
  }

  return query
}

export function stringifyQuery(query: LocationQuery): string {
  const parts: string[] = []

  for (const [key, value] of Object.entries(query)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      parts.push(item === null ? encode(key) : `${encode(key)}=${encode(item)}`)
    }
  }

  return parts.join('&')
}

/** Turns numbers and booleans into strings and drops `undefined`, like a URL would. */
export function normalizeQuery(query: LocationQueryRaw | undefined): LocationQuery {
  const normalized: LocationQuery = {}
  if (!query) return normalized

  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      normalized[key] = value.filter((item) => item !== undefined).map(toQueryValue)
    } else if (value !== undefined) {
      normalized[key] = toQueryValue(value as LocationQueryValueRaw)
    }
  }

  return normalized
}

export function parseURL(location: string) {
  const hashIndex = location.indexOf('#')
  let searchIndex = location.indexOf('?')
  if (hashIndex >= 0 && searchIndex > hashIndex) searchIndex = -1

  const pathEnd = searchIndex >= 0 ? searchIndex : hashIndex >= 0 ? hashIndex : undefined
  const searchEnd = hashIndex >= 0 ? hashIndex : undefined

  return {
    path: location.slice(0, pathEnd),
    query: searchIndex >= 0 ? parseQuery(location.slice(searchIndex + 1, searchEnd)) : {},
    hash: hashIndex >= 0 ? location.slice(hashIndex) : '',
  }
}

export function stringifyURL(path: string, query: LocationQuery, hash: string): string {
  const search = stringifyQuery(query)
  return path + (search ? `?${search}` : '') + hash
}

function toQueryValue(value: LocationQueryValueRaw): LocationQueryValue {
  return value === null || value === undefined ? null : String(value)
}

function encode(text: string): string {
  return encodeURIComponent(text).replace(/%20/g, '+')
}

function decode(text: string): string {
  try {
    return decodeURIComponent(text.replace(/\+/g, ' '))
  } catch {
    return text
  }
}
