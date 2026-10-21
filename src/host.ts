import type { NavigationTransition, Page } from '@nativescript/core'
import type { Component } from 'nativescript-vue'
import type { BackGestureSession } from './android.js'
import type { BackPreview } from './back-preview.js'

/**
 * The contract version this router speaks. A host declares the one it
 * implements, and the router refuses a different one instead of guessing.
 * The contract is experimental: the version moves with any incompatible change.
 */
export const NATIVE_HOST_VERSION = 1

export type NativeHostVersion = typeof NATIVE_HOST_VERSION

/** What a host can do natively. The router reports the rest instead of faking it. */
export interface NativeHostCapabilities {
  /** `replace` drops the page on top natively, in the same step as the push. */
  readonly replace: boolean
  /** `clearHistory` drops every page below natively, in the same step as the push. */
  readonly clearHistory: boolean
  /** The first page stays put, like a pinned list: `clearHistory` keeps it and back never removes it. */
  readonly pinnedRoot: boolean
  /** The host as a whole can be closed, like a modal. `back(null)` closes it. */
  readonly close: boolean
  /** The host can hold a dismissal the user starts until the leave guards have run. */
  readonly cancellableDismissal: boolean
  /** More than one page can be on screen at once. `visible()` says which. */
  readonly multipleVisible: boolean
}

export interface NativeHostPushOptions {
  /** The first page of the host. It never animates. */
  readonly initial: boolean
  /** `undefined` leaves the choice to the host. */
  readonly animated: boolean | undefined
  readonly transition: NavigationTransition | undefined
  /** Drop the page on top. Only sent to a host with the `replace` capability. */
  readonly replace: boolean
  /** Drop every page below. Only sent to a host with the `clearHistory` capability. */
  readonly clearHistory: boolean
}

export interface NativeHostBackOptions {
  /** `undefined` leaves the choice to the host: usually how the page came in. */
  readonly animated: boolean | undefined
}

export type NativeHostRole = 'main' | 'list' | 'detail'

/** One native container, for diagnostics. Most hosts have one; a split host has two. */
export interface NativeHostPart {
  readonly role: NativeHostRole
  readonly native: object | null
  readonly loaded: boolean
  /** Pages in native order, bottom to top, without the host's own scaffolding. */
  readonly pages: readonly Page[]
}

/**
 * How a host talks back to the router. The router hands it over in
 * `attach()` and stops listening in `dispose()`.
 */
export interface NativeHostDelegate {
  /**
   * After every native change: a push or back the router asked for, or one the
   * platform made on its own. The router re-reads `pages()` and reconciles.
   */
  changed(): void
  /** The host went away on its own, like a modal swiped down. */
  closed(): void
  /** The user tried to dismiss a held host. The leave guards decide. */
  dismissAttempted(): void
  /** The system back landed on this host. The router goes back through its guards. */
  backPressed(): void
  /** An interactive back is starting. `undefined` leaves it to the platform. */
  backGesture(): BackGestureSession | undefined
}

/**
 * A native container the router drives a stack in. The router keeps matching,
 * guards, results, history and reconciliation; the host owns presentation,
 * gestures and the native handles.
 *
 * Experimental: see the native hosts guide for the versioning policy.
 */
export interface NativeHost<TNative extends object = object> {
  readonly version: NativeHostVersion
  /** A short name for diagnostics and error messages, like `'frame'`. */
  readonly kind: string
  readonly capabilities: NativeHostCapabilities
  /** The native container. `null` once disposed; never keep it across navigations. */
  readonly native: TNative | null
  /** A host that isn't loaded yet, like a tab iOS hasn't shown, queues its own pushes without holding up the others. */
  readonly loaded: boolean
  /** Called once, before the first push. */
  attach(delegate: NativeHostDelegate): void
  /** Pages in native order, bottom to top, whether the router mounted them or not. */
  pages(): readonly Page[]
  /** The pages on screen right now. Without it, only the one on top is. */
  visible?(): readonly Page[]
  /**
   * Mounts `component` as a new page on top. Completion is reported through
   * `delegate.changed()`; a rejection or throw fails the navigation.
   */
  push(component: Component, options: NativeHostPushOptions): void | Promise<void>
  /**
   * Returns to `target`, a page from `pages()`, dropping everything above it.
   * `null` closes the host. Completion is reported through `delegate.changed()`
   * or `delegate.closed()`.
   */
  back(target: Page | null, options: NativeHostBackOptions): void | Promise<void>
  /** Holds or releases the user's own dismissal. Only with `cancellableDismissal`. */
  holdDismissal?(hold: boolean): void
  /**
   * Android 14 and later: shows `below` while the back swipe moves, and goes
   * back through `commit` when it lands. `undefined` leaves the swipe without a preview.
   */
  previewBack?(
    top: Page,
    below: Page,
    commit: () => Promise<unknown>,
    onDispose: () => void,
    options?: { preferCore?: boolean },
  ): BackPreview | undefined
  /** Whether the system back of the current window belongs to this host. */
  ownsSystemBack?(): boolean
  /** Whether the next push shows with its animation. `false` for a pane that isn't on screen yet. */
  willAnimate?(options: { clearHistory: boolean }): boolean
  /** The native containers, for diagnostics. Defaults to one `'main'` part. */
  parts?(): readonly NativeHostPart[]
  /** Stops listening and releases native handles. Safe to call twice. */
  dispose(): void
}

/** The host a page lives in, as `useNativeHost()` sees it. */
export interface NativeHostHandle<TNative extends object = object> {
  readonly kind: string
  readonly capabilities: NativeHostCapabilities
  /** `null` once the page has left its stack or the host is gone. */
  readonly native: TNative | null
}

export function assertHostVersion(host: NativeHost) {
  if (host.version !== NATIVE_HOST_VERSION) {
    throw new Error(
      `[vue-router-ns] The "${host.kind}" host implements native host contract ` +
        `version ${String(host.version)}; this router needs ${NATIVE_HOST_VERSION}`,
    )
  }
}

export function unsupportedOperation(host: NativeHost, operation: string): Error {
  return new Error(`[vue-router-ns] The "${host.kind}" host doesn't support ${operation}`)
}
