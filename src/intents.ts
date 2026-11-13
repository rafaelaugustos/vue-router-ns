import type { NavigationFailure } from './errors.js'
import type { RouteLocation } from './types.js'

type Value = string | number | boolean | null
/** Serializable route address. Names must be strings; paths must be absolute. */
export type IntentRoute =
  | string
  | ((
      | { path: string }
      | {
          name: string
          params?: Record<string, string | number | null | readonly (string | number)[]>
        }
    ) & {
      query?: Record<string, Value | readonly Value[]>
      hash?: string
    })

/** Experimental, transport-neutral request. Source and delivery scope are app-defined. */
export interface NavigationIntent {
  readonly version: 1
  readonly source: string
  readonly destination: { readonly route: IntentRoute } | { readonly url: string }
  /** Same scope/id is one delivery across sources, within this router's lifetime. */
  readonly delivery?: { readonly scope: string; readonly id: string }
  /** Assertions on this router's owner; this API never chooses another window. */
  readonly target?: { readonly windowId?: string; readonly frame?: string }
  /** Unix milliseconds. Checked before admission, including after readiness waits. */
  readonly expiresAt?: number
  readonly options?: {
    readonly replace?: boolean
    readonly withParents?: boolean
    readonly clearHistory?: boolean
  }
}

export type IntentIgnoredReason =
  | 'invalid'
  | 'version'
  | 'expired'
  | 'unmatched'
  | 'scheme'
  | 'host'
  | 'repeat'
  | 'owner-closed'
  | 'wrong-window'
  | 'target-unavailable'
  | 'busy'

export interface IgnoredIntent {
  readonly status: 'ignored'
  readonly reason: IntentIgnoredReason
}
export type IntentResolution =
  | IgnoredIntent
  | {
      readonly status: 'resolved'
      /** Detached, recursively frozen validated input. */
      readonly intent: NavigationIntent
      readonly location: RouteLocation
    }
export type IntentResult =
  | IgnoredIntent
  | {
      /** The navigation pipeline settled. A guard may redirect or refuse it. */
      readonly status: 'handled'
      readonly intent: NavigationIntent
      /** Requested location, not necessarily the final route after a redirect. */
      readonly location: RouteLocation
      readonly failure?: NavigationFailure
    }

const invalid = () => {
  throw new Error('Invalid navigation intent')
}
type Data = Record<string, any>
function object(value: unknown): value is Data {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
function fields(value: unknown, allowed: string[]): value is Data {
  return object(value) && Object.keys(value).every((key) => allowed.includes(key))
}
function text(value: unknown, max = 256): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= max &&
    value.trim() === value &&
    !/[\u0000-\u001f\u007f]/.test(value)
  )
}
function path(value: unknown): value is string {
  return (
    text(value, 8192) &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.includes('\\')
  )
}
function values(value: unknown, query: boolean): boolean {
  const scalar = (v: unknown) =>
    typeof v === 'string' ||
    typeof v === 'number' ||
    v === null ||
    (query && typeof v === 'boolean')
  return (
    object(value) &&
    Object.values(value).every((v) =>
      Array.isArray(v)
        ? v.every((item) => scalar(item) && (query || item !== null))
        : scalar(v),
    )
  )
}
function route(value: unknown): boolean {
  if (typeof value === 'string') return path(value)
  if (!fields(value, ['path', 'name', 'params', 'query', 'hash'])) return false
  if (
    'path' in value
      ? !path(value.path) || 'name' in value || 'params' in value
      : !text(value.name)
  )
    return false
  return (
    (value.params === undefined || values(value.params, false)) &&
    (value.query === undefined || values(value.query, true)) &&
    (value.hash === undefined ||
      (typeof value.hash === 'string' &&
        (value.hash === '' || value.hash.startsWith('#'))))
  )
}

/** Copy bounded JSON data without invoking accessors or toJSON. Not a JSON text parser. */
function copy(input: unknown): unknown {
  let count = 0
  const visit = (value: unknown, depth: number): any => {
    if (++count > 1024 || depth > 7) return invalid()
    if (value === null || typeof value === 'boolean') return value
    if (typeof value === 'number') return Number.isFinite(value) ? value : invalid()
    if (typeof value === 'string') return value.length <= 8192 ? value : invalid()
    if (!value || typeof value !== 'object') return invalid()
    const proto = Object.getPrototypeOf(value)
    const array = Array.isArray(value)
    if (
      array
        ? proto !== Array.prototype || value.length > 64
        : proto !== Object.prototype && proto !== null
    )
      return invalid()
    const keys = Reflect.ownKeys(value)
    if (keys.length > (array ? 65 : 32)) return invalid()
    const result: any = array ? [] : {}
    for (const key of keys) {
      if (array && key === 'length') continue
      if (
        typeof key !== 'string' ||
        key.length > 256 ||
        ['__proto__', 'prototype', 'constructor'].includes(key)
      )
        return invalid()
      if (array && !/^(0|[1-9]\d*)$/.test(key)) return invalid()
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!
      if (!('value' in descriptor) || !descriptor.enumerable) return invalid()
      result[key] = visit(descriptor.value, depth + 1)
    }
    if (array && Object.keys(result).length !== value.length) return invalid()
    return Object.freeze(result)
  }
  const result = visit(input, 0)
  // Native runtimes do not necessarily supply TextEncoder. JSON escapes lone surrogates.
  if (
    encodeURIComponent(JSON.stringify(result)).replace(/%[A-F\d]{2}/gi, 'x').length >
    16384
  )
    invalid()
  return result
}

export function parseIntent(input: unknown): NavigationIntent | IgnoredIntent {
  try {
    const value = copy(input)
    if (
      !fields(value, [
        'version',
        'source',
        'destination',
        'delivery',
        'target',
        'expiresAt',
        'options',
      ])
    )
      return { status: 'ignored', reason: 'invalid' }
    if (value.version !== 1) return { status: 'ignored', reason: 'version' }
    if (!text(value.source, 128) || !fields(value.destination, ['route', 'url']))
      invalid()
    const destination = value.destination
    if (
      'url' in destination
        ? !text(destination.url, 8192) || 'route' in destination
        : !route(destination.route)
    )
      invalid()
    if (
      value.delivery !== undefined &&
      (!fields(value.delivery, ['scope', 'id']) ||
        !text(value.delivery.scope) ||
        !text(value.delivery.id))
    )
      invalid()
    if (
      value.target !== undefined &&
      (!fields(value.target, ['windowId', 'frame']) ||
        (value.target.windowId !== undefined && !text(value.target.windowId)) ||
        (value.target.frame !== undefined && !text(value.target.frame)))
    )
      invalid()
    if (
      value.expiresAt !== undefined &&
      (!Number.isSafeInteger(value.expiresAt) || value.expiresAt < 0)
    )
      invalid()
    if (
      value.options !== undefined &&
      (!fields(value.options, ['replace', 'withParents', 'clearHistory']) ||
        Object.values(value.options).some((v) => typeof v !== 'boolean'))
    )
      invalid()
    return value as NavigationIntent
  } catch {
    return { status: 'ignored', reason: 'invalid' }
  }
}
