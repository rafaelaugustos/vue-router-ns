import type { Page, View } from '@nativescript/core'
import { toValue, type MaybeRefOrGetter, type ShallowRef } from 'nativescript-vue'
import type { BackGestureTarget } from './android.js'
import type { NativeHost } from './host.js'
import type { PageStateHooks } from './page-state.js'
import type { Router } from './router.js'
import type {
  ModalOptions,
  NavigationGuard,
  RouteComponent,
  RouteLocation,
  RouteLocationRaw,
  SavedState,
} from './types.js'

/**
 * One native back stack: the host of a `<RouterView>`, or the frame a modal
 * route is presented in. Its entries mirror what the host reports in `pages()`.
 */
export interface Stack {
  readonly name: string
  readonly modal: ModalOptions | false
  /** Where the stack started: a `<RouterView>`'s `initial`, a split view's `list`. */
  readonly initial: RouteLocationRaw
  readonly entries: ShallowRef<readonly Entry[]>
  /** Router bound to this stack: what `useRouter()` returns inside its pages. */
  readonly router: Router
  /** `null` while a modal is being presented, and once the stack has closed. */
  host: NativeHost | null
  /** The navigation running guards here; a newer one cancels it. */
  attempt: object | undefined
  /** Settles once the native navigation the router started here is done. */
  pending: Deferred<void> | undefined
  /** Navigations committed here, including ones waiting for the frame to load. */
  settled: Promise<unknown>
  closed: boolean
}

/** A page in a stack, alive from the moment it is pushed until it leaves the stack. */
export interface Entry {
  readonly id: number
  /** Stable identity, kept across process death by `restore`. */
  readonly key: string
  readonly route: RouteLocation
  readonly stack: Stack
  readonly component: RouteComponent
  readonly props: Record<string, unknown>
  readonly leaveGuards: Set<LeaveGuard>
  readonly backGesture: BackGestureTarget
  /** iOS 18 zoom: the view the page grows out of. */
  readonly zoomFrom: View | undefined
  /** Top of its stack and not covered by a modal. */
  readonly isActive: () => boolean
  page: Page | null
  /** What the page's `usePageState()` hooks save, by key. */
  readonly state: Map<string, PageStateHooks>
  /** State saved by a previous life of this page, consumed as hooks restore it. */
  saved: Record<string, SavedState> | undefined
  result: unknown
  settle: ((result: unknown) => void) | undefined
  disposed: boolean
}

export interface LeaveGuard {
  guard: NavigationGuard
  when: MaybeRefOrGetter<boolean> | undefined
}

export interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason: unknown) => void
}

export function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

export function topOf(stack: Stack | undefined): Entry | undefined {
  return stack?.entries.value.at(-1)
}

export function isGuardActive({ when }: LeaveGuard): boolean {
  return when === undefined || toValue(when)
}

export function isBlocked(entry: Entry): boolean {
  return [...entry.leaveGuards].some(isGuardActive)
}
