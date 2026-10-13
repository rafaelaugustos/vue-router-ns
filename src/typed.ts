import type { Router } from './router.js'
import type {
  LocationQueryRaw,
  RouteLocation,
  RouteLocationNamedRaw,
  RouteLocationPathRaw,
  RouteLocationRelativeRaw,
  RouteParamValueRaw,
  RouteParams,
  RouteRecordName,
} from './types.js'

/**
 * Register your router once and every API picks up its route names and params:
 *
 * ```ts
 * declare module 'vue-router-ns' {
 *   interface Register {
 *     router: typeof router
 *   }
 * }
 * ```
 */
export interface Register {}

export interface RouteMapGeneric {
  [name: RouteRecordName]: { path: string; params: RouteParams }
}

/** What a route map looks like, inferred or not. */
export interface RouteMapLike {
  [name: RouteRecordName]: { path: string; params: object }
}

export type RegisteredRouter = Register extends { router: infer R extends Router<any> }
  ? R
  : Router

export type RegisteredRouteMap =
  RegisteredRouter extends Router<infer M> ? M : RouteMapGeneric

export type RouteNames<M extends RouteMapLike = RegisteredRouteMap> = keyof M &
  RouteRecordName

/** The route of a page, narrowed by name when the map knows it. */
export type RouteLocationOf<M extends RouteMapLike, N extends keyof M = keyof M> = [
  keyof M,
] extends [never]
  ? RouteLocation
  : N extends keyof M
    ? Omit<RouteLocation, 'name' | 'params'> & { name: N; params: M[N]['params'] }
    : never

export type RouteLocationNamedRawOf<M extends RouteMapLike> = {
  [N in keyof M]: {
    name: N
    query?: LocationQueryRaw
    hash?: string
    replace?: boolean
    force?: boolean
    path?: never
  } & ParamsField<RawParams<M[N]['params']>>
}[keyof M]

export type RouteLocationRawOf<M extends RouteMapLike> =
  | string
  | RouteLocationPathRaw
  | RouteLocationRelativeRaw
  | (string extends keyof M ? RouteLocationNamedRaw : RouteLocationNamedRawOf<M>)

/** Builds a route map from a `routes` array declared inline in `createRouter`. */
export type RouteMapFrom<R extends readonly unknown[]> =
  // routes typed as RouteRecordRaw[] (not declared inline) carry no literal paths
  string extends PathOf<R[number]>
    ? RouteMapGeneric
    : {
        [E in Entries<R[number], ''> as E['name']]: {
          path: E['path']
          params: ParamsFromPath<E['path']>
        }
      }

type PathOf<R> = R extends { path: infer P } ? P : never

type Entries<R, Base extends string> = R extends { path: infer P extends string }
  ? | (R extends { name: infer N extends RouteRecordName }
        ? { name: N; path: JoinPath<Base, P> }
        : never)
    | (R extends { children: infer C extends readonly unknown[] }
        ? Entries<C[number], JoinPath<Base, P>>
        : never)
  : never

type JoinPath<Base extends string, P extends string> = P extends `/${string}`
  ? P
  : P extends ''
    ? Base
    : Base extends `${infer Head}/`
      ? `${Head}/${P}`
      : `${Base}/${P}`

/**
 * ParamsFromPath<'/users/:id/files/:path*'>
 *   → { id: string; path?: string[] }
 */
export type ParamsFromPath<P extends string> = Simplify<CollectParams<P>>

type CollectParams<P extends string> = P extends `${string}:${infer Rest}`
  ? ReadName<Rest> extends [infer Name extends string, infer After extends string]
    ? ParamEntry<Name, Modifier<UntilBoundary<After>>> & CollectParams<After>
    : {}
  : {}

type ParamEntry<Name extends string, M extends string> = M extends '?'
  ? { [K in Name]?: string }
  : M extends '*'
    ? { [K in Name]?: string[] }
    : M extends '+'
      ? { [K in Name]: string[] }
      : { [K in Name]: string }

type ReadName<
  S extends string,
  Name extends string = '',
> = S extends `${infer C}${infer Rest}`
  ? C extends WordChar
    ? ReadName<Rest, `${Name}${C}`>
    : [Name, S]
  : [Name, S]

type UntilBoundary<
  S extends string,
  Acc extends string = '',
> = S extends `${infer C}${infer Rest}`
  ? C extends '/' | ':'
    ? Acc
    : UntilBoundary<Rest, `${Acc}${C}`>
  : Acc

type Modifier<S extends string> = S extends `${string}?`
  ? '?'
  : S extends `${string}*`
    ? '*'
    : S extends `${string}+`
      ? '+'
      : ''

type ParamsField<P> = {} extends P ? { params?: P } : { params: P }

type RawParams<P> = {
  [K in keyof P]: P[K] extends readonly string[]
    ? readonly RouteParamValueRaw[]
    : P[K] extends string
      ? RouteParamValueRaw
      : P[K]
}

type Simplify<T> = { [K in keyof T]: T[K] } & {}

type WordChar =
  | 'a'
  | 'b'
  | 'c'
  | 'd'
  | 'e'
  | 'f'
  | 'g'
  | 'h'
  | 'i'
  | 'j'
  | 'k'
  | 'l'
  | 'm'
  | 'n'
  | 'o'
  | 'p'
  | 'q'
  | 'r'
  | 's'
  | 't'
  | 'u'
  | 'v'
  | 'w'
  | 'x'
  | 'y'
  | 'z'
  | 'A'
  | 'B'
  | 'C'
  | 'D'
  | 'E'
  | 'F'
  | 'G'
  | 'H'
  | 'I'
  | 'J'
  | 'K'
  | 'L'
  | 'M'
  | 'N'
  | 'O'
  | 'P'
  | 'Q'
  | 'R'
  | 'S'
  | 'T'
  | 'U'
  | 'V'
  | 'W'
  | 'X'
  | 'Y'
  | 'Z'
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '_'
