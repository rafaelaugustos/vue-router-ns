import type { Component } from 'nativescript-vue'
import type { NavigationTransition, ShowModalOptions, View } from '@nativescript/core'
import type { NavigationFailure } from './errors.js'

export type RouteRecordName = string | symbol

/**
 * Extend it to type `meta` across the app:
 *
 * ```ts
 * declare module 'vue-router-ns' {
 *   interface RouteMeta {
 *     requiresAuth?: boolean
 *   }
 * }
 * ```
 */
export interface RouteMeta extends Record<PropertyKey, unknown> {}

export type RouteParamValue = string
export type RouteParams = Record<string, RouteParamValue | RouteParamValue[]>

export type RouteParamValueRaw = string | number
export type RouteParamsRaw = Record<
  string,
  RouteParamValueRaw | readonly RouteParamValueRaw[] | null | undefined
>

export type LocationQueryValue = string | null
export type LocationQuery = Record<string, LocationQueryValue | LocationQueryValue[]>

export type LocationQueryValueRaw = LocationQueryValue | number | boolean | undefined
export type LocationQueryRaw = Record<
  string | number,
  LocationQueryValueRaw | readonly LocationQueryValueRaw[]
>

/**
 * A function that gives the component: `() => import('./Page.vue')`, or
 * `() => Page` for a page already imported. Either way, the route table's
 * type doesn't depend on the page's, which keeps typed routes free of cycles.
 */
export type Lazy<T> = () => T | Promise<T | { default: T }>
export type RouteComponent = Component<any>
export type RawRouteComponent = RouteComponent | Lazy<RouteComponent>

/** `'medium'`, `'large'`, or a fraction of the screen height (iOS 16 and later). */
export type SheetDetent = 'medium' | 'large' | number

/** How an iOS sheet behaves. Android has no equivalent in `showModal`, and ignores these. */
export interface SheetOptions {
  /** Heights the sheet can rest at. The system default is a single `'large'`. */
  detents?: SheetDetent[]
  /** The detent to open at. Defaults to the first. */
  selectedDetent?: SheetDetent
  /** Up to this detent, the page behind stays undimmed and usable, like Maps. */
  largestUndimmedDetent?: SheetDetent
  grabber?: boolean
  cornerRadius?: number
}

/** Options forwarded to `showModal` when a route is presented modally. */
export interface ModalOptions extends Partial<
  Omit<ShowModalOptions, 'context' | 'closeCallback' | 'ios'>
> {
  ios?: NonNullable<ShowModalOptions['ios']> & SheetOptions
}

/**
 * A transition name such as `'slide'` or `'fade'`, or a full NativeScript
 * transition, including `SharedTransition.custom(...)`.
 */
export type TransitionOption = string | NavigationTransition

/** A view to zoom from: a NativeScript view, a template ref's element, or a component. */
export type ZoomSource =
  View | { readonly nativeView: View } | { readonly $el: { nativeView: View } }

export type RouteProps =
  boolean | Record<string, unknown> | ((to: RouteLocation) => Record<string, unknown>)

export interface RouteRecordRaw {
  path: string
  name?: RouteRecordName
  component?: RawRouteComponent
  redirect?: RouteLocationRaw | ((to: RouteLocation) => RouteLocationRaw)
  children?: readonly RouteRecordRaw[]
  meta?: RouteMeta
  /** `true` passes the params as props, an object is passed as-is, a function maps the route. */
  props?: RouteProps
  beforeEnter?: NavigationGuard | readonly NavigationGuard[]
  /** Present the route modally, inside its own frame. */
  modal?: boolean | ModalOptions
  /** Default transition used when navigating to this route. */
  transition?: TransitionOption
}

export interface RouteRecord {
  path: string
  name: RouteRecordName | undefined
  component: RawRouteComponent | undefined
  redirect: RouteRecordRaw['redirect']
  meta: RouteMeta
  props: RouteProps | undefined
  beforeEnter: NavigationGuard[]
  modal: ModalOptions | false
  transition: TransitionOption | undefined
  children: RouteRecord[]
  parent: RouteRecord | undefined
}

export interface RouteLocation {
  path: string
  fullPath: string
  name: RouteRecordName | undefined
  params: RouteParams
  query: LocationQuery
  hash: string
  /** `meta` of every matched record, merged from parent to child. */
  meta: RouteMeta
  matched: RouteRecord[]
  redirectedFrom: RouteLocation | undefined
}

interface LocationOptions {
  replace?: boolean
  /** Navigate even when the target is the page already on top. */
  force?: boolean
}

interface LocationTail {
  query?: LocationQueryRaw
  hash?: string
}

export interface RouteLocationPathRaw extends LocationOptions, LocationTail {
  path: string
  name?: never
  params?: never
}

export interface RouteLocationNamedRaw extends LocationOptions, LocationTail {
  name: RouteRecordName
  params?: RouteParamsRaw
  path?: never
}

/** Same route as the current one, with different params, query or hash. */
export interface RouteLocationRelativeRaw extends LocationOptions, LocationTail {
  params?: RouteParamsRaw
  name?: never
  path?: never
}

export type RouteLocationRaw =
  string | RouteLocationPathRaw | RouteLocationNamedRaw | RouteLocationRelativeRaw

export interface NavigationOptions {
  /** Name of the `<RouterView>` to navigate in. Defaults to the one the caller lives in. */
  frame?: string
  transition?: TransitionOption
  animated?: boolean
  /** Remove every page below the new one. */
  clearHistory?: boolean
  /** Extra props for the page. Unlike params, they can hold any value. */
  props?: Record<string, unknown>
  /** Present modally, regardless of what the route record says. */
  modal?: boolean | ModalOptions
  /**
   * Push the route's parents first, so back walks up the route tree. Parents
   * come from `children` nesting, and only those with a component become pages.
   */
  withParents?: boolean
  /**
   * iOS 18 and later: the page grows out of this view, and shrinks back into
   * it when it closes, dragged down or not. Elsewhere, the usual transition.
   */
  zoomFrom?: ZoomSource | null
}

export interface BackOptions {
  /** Delivered to whoever is awaiting `pushForResult()` for the page being closed. */
  result?: unknown
  /** Name of the `<RouterView>` to go back in. Defaults to the one the caller lives in. */
  frame?: string
  animated?: boolean
}

/** What `restore.save` receives and `restore.load` gives back: the paths of every named stack. */
export interface SavedStacks {
  savedAt: number
  stacks: Record<string, string[]>
}

export interface RestoreOptions {
  /** Called with the stacks after every navigation, and with `null` when the app exits on its own. */
  save(state: SavedStacks | null): void
  /** Called once, when the first `<RouterView>` mounts. */
  load(): SavedStacks | null | undefined | Promise<SavedStacks | null | undefined>
  /** Saves older than this, in milliseconds, are left alone. Defaults to 30 minutes. */
  maxAge?: number
}

export interface SetStackOptions {
  /** Name of the `<RouterView>` whose stack to set. Defaults to the one the caller lives in. */
  frame?: string
  /** Applies to the last step only: the steps before it never animate. */
  animated?: boolean
  /** Transition of the last page pushed. */
  transition?: TransitionOption
}

export type NavigationType = 'push' | 'replace' | 'back'

export interface NavigationInfo {
  type: NavigationType
}

export type NavigationGuardReturn = void | undefined | boolean | RouteLocationRaw

export type NavigationGuard = (
  to: RouteLocation,
  from: RouteLocation,
  info: NavigationInfo,
) => NavigationGuardReturn | Promise<NavigationGuardReturn>

export type NavigationHookAfter = (
  to: RouteLocation,
  from: RouteLocation,
  failure?: NavigationFailure,
) => unknown

export type NavigationErrorHandler = (
  error: unknown,
  to: RouteLocation,
  from: RouteLocation,
) => unknown
