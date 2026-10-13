import type { RouteParams } from './types.js'

/**
 * Path patterns use the same syntax as Vue Router:
 *
 *   /users/:id            required param
 *   /users/:id?           optional param
 *   /files/:path+         one or more segments, as an array
 *   /files/:path*         zero or more segments, as an array
 *   /orders/:id(\\d+)     custom regex
 *   /:pathMatch(.*)*      catch-all
 */

interface StaticToken {
  type: 'static'
  value: string
}

export interface ParamToken {
  type: 'param'
  name: string
  pattern: string
  optional: boolean
  repeatable: boolean
}

type Token = StaticToken | ParamToken
type Segment = Token[]

export interface PathPattern {
  readonly keys: readonly ParamToken[]
  readonly score: readonly (readonly number[])[]
  match(path: string): RouteParams | null
  stringify(params: RouteParams): string
}

const DEFAULT_PATTERN = '[^/]+?'

// higher scores win; mirrors Vue Router's ranking closely enough for real-world tables
const Score = {
  Root: 90,
  Segment: 40,
  Static: 40,
  Dynamic: 20,
  CustomRegExp: 10,
  Wildcard: -50,
  Repeatable: -20,
  Optional: -8,
} as const

export function compilePath(path: string): PathPattern {
  const segments = tokenize(path)
  const keys: ParamToken[] = []
  let source = '^'

  for (const segment of segments) {
    const lone = segment.length === 1 ? segment[0] : undefined

    // `/:id?` and `/:path*` take their leading slash with them when absent
    if (lone?.type === 'param' && lone.optional) {
      keys.push(lone)
      source += `(?:/(${paramSource(lone)}))?`
      continue
    }

    source += '/'
    for (const token of segment) {
      if (token.type === 'static') {
        source += escapeRegExp(token.value)
      } else {
        keys.push(token)
        source += `(${paramSource(token)})${token.optional ? '?' : ''}`
      }
    }
  }

  const re = new RegExp(`${source}/?$`, 'i')
  const score = segments.length ? segments.map(scoreSegment) : [[Score.Root]]

  return {
    keys,
    score,

    match(target) {
      const match = re.exec(target)
      if (!match) return null

      const params: RouteParams = {}
      keys.forEach((key, index) => {
        const value = match[index + 1]
        if (value === undefined || value === '') return
        params[key.name] = key.repeatable ? value.split('/').map(decode) : decode(value)
      })
      return params
    },

    stringify(params) {
      let result = ''

      for (const segment of segments) {
        let part = ''
        let skipped = false

        for (const token of segment) {
          if (token.type === 'static') {
            part += token.value
            continue
          }

          const value = params[token.name]
          const values = (Array.isArray(value) ? value : value == null ? [] : [value])
            .map(String)
            .filter(Boolean)

          if (!values.length) {
            if (!token.optional) {
              throw new Error(`Missing required param "${token.name}" for "${path}"`)
            }
            skipped = segment.length === 1
            continue
          }
          if (values.length > 1 && !token.repeatable) {
            throw new Error(`Param "${token.name}" of "${path}" is not repeatable`)
          }
          part += values.map(encodeURIComponent).join('/')
        }

        if (!skipped) result += `/${part}`
      }

      return result || '/'
    },
  }
}

export function comparePatterns(a: PathPattern, b: PathPattern): number {
  const length = Math.min(a.score.length, b.score.length)

  for (let i = 0; i < length; i++) {
    const diff = compareSegments(a.score[i]!, b.score[i]!)
    if (diff) return diff
  }

  // same prefix: the pattern with fewer segments is the more specific one
  return a.score.length - b.score.length
}

function compareSegments(a: readonly number[], b: readonly number[]): number {
  const length = Math.min(a.length, b.length)

  for (let i = 0; i < length; i++) {
    const diff = b[i]! - a[i]!
    if (diff) return diff
  }
  return b.length - a.length
}

function tokenize(path: string): Segment[] {
  if (!path.startsWith('/')) {
    throw new Error(`Route paths must start with "/", got "${path}"`)
  }

  const segments: Segment[] = []
  let segment: Segment = []
  let buffer = ''
  let i = 1

  const flush = () => {
    if (buffer) segment.push({ type: 'static', value: buffer })
    buffer = ''
  }

  while (i < path.length) {
    const char = path[i]!

    if (char === '\\') {
      buffer += path[i + 1] ?? ''
      i += 2
    } else if (char === '/') {
      flush()
      segments.push(segment)
      segment = []
      i++
    } else if (char === ':') {
      flush()
      i++

      let name = ''
      while (i < path.length && /\w/.test(path[i]!)) name += path[i++]
      if (!name) throw new Error(`Missing param name after ":" in "${path}"`)

      let pattern = ''
      if (path[i] === '(') {
        let depth = 1
        i++
        while (i < path.length) {
          const c = path[i]!
          if (c === '\\') {
            pattern += c + (path[i + 1] ?? '')
            i += 2
            continue
          }
          if (c === '(') depth++
          if (c === ')' && --depth === 0) break
          pattern += c
          i++
        }
        if (depth) throw new Error(`Unterminated regex for param "${name}" in "${path}"`)
        i++
        assertNoCapturingGroups(pattern, name, path)
      }

      const modifier = path[i]
      const optional = modifier === '?' || modifier === '*'
      const repeatable = modifier === '*' || modifier === '+'
      if (optional || repeatable) i++

      segment.push({
        type: 'param',
        name,
        pattern: pattern || DEFAULT_PATTERN,
        optional,
        repeatable,
      })
    } else {
      buffer += char
      i++
    }
  }

  flush()
  // "/" and trailing slashes produce no empty segment
  if (segment.length) segments.push(segment)

  return segments
}

function paramSource({ pattern, repeatable }: ParamToken): string {
  return repeatable ? `(?:${pattern})(?:/(?:${pattern}))*` : pattern
}

function scoreSegment(segment: Segment): number[] {
  return segment.map((token) => {
    if (token.type === 'static') return Score.Segment + Score.Static

    let score = Score.Segment + Score.Dynamic
    if (token.pattern !== DEFAULT_PATTERN) {
      score += token.pattern === '.*' ? Score.Wildcard : Score.CustomRegExp
    }
    if (token.repeatable) score += Score.Repeatable
    if (token.optional) score += Score.Optional
    return score
  })
}

function assertNoCapturingGroups(pattern: string, name: string, path: string) {
  const groups = new RegExp(`${pattern}|`).exec('')!.length - 1
  if (groups) {
    throw new Error(
      `The regex of param "${name}" in "${path}" has a capturing group. Use "(?:...)" instead.`,
    )
  }
}

function escapeRegExp(text: string): string {
  return text.replace(/[.+*?^${}()[\]|\\]/g, '\\$&')
}

function decode(text: string): string {
  try {
    return decodeURIComponent(text)
  } catch {
    return text
  }
}
