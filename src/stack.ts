import type { Frame, Page } from '@nativescript/core'
import { toValue, type MaybeRefOrGetter, type ShallowRef } from 'nativescript-vue'
import type { BackGestureTarget } from './android.js'
import type { Router } from './router.js'
import type {
  ModalOptions,
  NavigationGuard,
  RouteComponent,
  RouteLocation,
} from './types.js'

/**
 * One native back stack: the frame of a `<RouterView>`, or the frame a modal
 * route is presented in. Its entries mirror `frame.backStack` + `frame.currentPage`.
 */
export interface Stack {
  readonly name: string
  readonly modal: ModalOptions | false
  readonly entries: ShallowRef<readonly Entry[]>
  /** Router bound to this stack: what `useRouter()` returns inside its pages. */
  readonly router: Router
  frame: Frame | null
  /** The navigation running guards here; a newer one cancels it. */
  attempt: object | undefined
  /** Settles once the native navigation the router started here is done. */
  pending: Deferred<void> | undefined
  closed: boolean
}

/** A page in a stack, alive from the moment it is pushed until it leaves the stack. */
export interface Entry {
  readonly id: number
  readonly route: RouteLocation
  readonly stack: Stack
  readonly component: RouteComponent
  readonly props: Record<string, unknown>
  readonly leaveGuards: Set<LeaveGuard>
  readonly backGesture: BackGestureTarget
  /** Top of its stack and not covered by a modal. */
  readonly isActive: () => boolean
  page: Page | null
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
