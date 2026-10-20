import { isAndroid, isIOS, type Page } from '@nativescript/core'
import { defineComponent, h, registerElement, type Component } from 'nativescript-vue'
import type { Entry } from './stack.js'
import type { NavigationFailure } from './errors.js'
import type { NavigationGuard, RouteLocation } from './types.js'
import { assertNativeInstance, nativeDestinationView } from './destinations/view.js'

/** Callbacks belong to one history entry; callbacks from a disposed entry are ignored. */
export interface NativeDestinationContext<Input, Output> {
  readonly input: Input
  readonly route: RouteLocation
  /** Available after mounting. Present SDK-owned dialogs from this page's window. */
  readonly page: Page | null
  /** Goes back through the router's guards, with a typed result. */
  complete(value: Output): Promise<NavigationFailure | undefined>
  /** Goes back through the router's guards without a result. */
  cancel(): Promise<NavigationFailure | undefined>
  /**
   * Report an irreversible external removal. Guards cannot veto an operation
   * the SDK already committed. UIKit navigation pops are observed automatically.
   */
  dismissed(): Promise<void>
  /** Registers a leave guard for this entry. Returns its removal function. */
  beforeLeave(guard: NavigationGuard): () => void
}

export interface NativeDestinationInstance {
  /** An unparented UIViewController on iOS, or AndroidX Fragment on Android. */
  native: object
  /** Release SDK listeners/resources. Called once per factory instance, after detaching. */
  dispose?(): void
}

export interface NativeDestinationOptions<Input, Output> {
  /** Stable factory identifier for diagnostics. Keep its route identity stable for restoration. */
  id: string
  /** Reconstruct serializable input from the route on every new entry/restoration. */
  input(route: RouteLocation, props: Readonly<Record<string, unknown>>): Input
  ios?(context: NativeDestinationContext<Input, Output>): NativeDestinationInstance
  android?(context: NativeDestinationContext<Input, Output>): NativeDestinationInstance
}

const definitions = new WeakMap<object, NativeDestinationOptions<any, any>>()
const sessions = new WeakMap<Entry, NativeDestinationSession>()
let registered = false

/**
 * Use as a route's `component`. The Page owns native containment, while the
 * supplied controller/Fragment owns its UI. No Vue rendering of the SDK screen.
 */
export function defineNativeDestination<Input, Output = void>(
  options: NativeDestinationOptions<Input, Output>,
): Component {
  if (!options.id.trim()) throw new Error('A native destination needs a stable id')
  if (!options.ios && !options.android)
    throw new Error(`Native destination "${options.id}" needs a platform factory`)
  const component = defineComponent({
    name: `NativeDestination(${options.id})`,
    setup() {
      throw new Error('A native destination must be mounted by vue-router-ns')
    },
  })
  definitions.set(component, options)
  return component
}

export function assertNativeDestination(component: Component): boolean {
  const options = definitions.get(component)
  if (!options) return false
  if (!(isIOS ? options.ios : isAndroid ? options.android : undefined))
    throw new Error(
      `Native destination "${options.id}" is not supported on ${isIOS ? 'iOS' : isAndroid ? 'Android' : 'this platform'}`,
    )
  return true
}

/** Internal lifecycle shared by the page and its native container. */
export interface NativeDestinationSession {
  readonly id: string
  readonly entry: Entry
  instance: NativeDestinationInstance | undefined
  detach?: () => void
  attached(): void
  failed(error: unknown): void
  readonly ready: Promise<void>
  create(): NativeDestinationInstance
  release(): void
  dismissed(): Promise<void>
}

export function nativeDestinationPage(entry: Entry): Component | undefined {
  const options = definitions.get(entry.component)
  if (!options) return
  assertNativeDestination(entry.component)
  if (entry.layout)
    throw new Error(
      `Native destination "${options.id}" owns its Page; set meta.layout to false`,
    )
  if (!registered) {
    registerElement('RouterNativeDestination', nativeDestinationView)
    registered = true
  }
  let closing: Promise<NavigationFailure | undefined> | undefined
  let dismissing: Promise<void> | undefined
  let generation = 0
  const input = options.input(entry.route, entry.props)
  const registrations = new Set<{ guard: NavigationGuard; when: undefined }>()
  let attached!: () => void
  let failed!: (error: unknown) => void
  const ready = new Promise<void>((resolve, reject) => {
    attached = resolve
    failed = reject
  })
  // Mounting can fail before commit reaches its await.
  void ready.catch(() => {})
  const close = (result: unknown) => {
    if (entry.disposed || entry.stack.entries.value.at(-1) !== entry)
      return Promise.resolve(undefined)
    return (closing ??= entry.stack.router.back({ result }).finally(() => {
      closing = undefined
    }))
  }
  const makeContext = (token: number): NativeDestinationContext<any, any> => ({
    input,
    route: entry.route,
    get page() {
      return entry.disposed || token !== generation ? null : entry.page
    },
    complete: (value) =>
      token === generation ? close(value) : Promise.resolve(undefined),
    cancel: () => (token === generation ? close(undefined) : Promise.resolve(undefined)),
    dismissed: () => (token === generation ? session.dismissed() : Promise.resolve()),
    beforeLeave(guard) {
      if (entry.disposed || token !== generation) return () => {}
      const registration = { guard, when: undefined }
      registrations.add(registration)
      entry.leaveGuards.add(registration)
      return () => {
        registrations.delete(registration)
        entry.leaveGuards.delete(registration)
      }
    },
  })
  const session: NativeDestinationSession = {
    id: options.id,
    entry,
    ready,
    attached,
    failed,
    instance: undefined,
    create() {
      if (entry.disposed) throw new Error('Native destination is disposed')
      if (!session.instance) {
        const instance = (isIOS ? options.ios! : options.android!)(
          makeContext(++generation),
        )
        try {
          assertNativeInstance(instance?.native, options.id)
        } catch (error) {
          instance?.dispose?.()
          throw error
        }
        session.instance = instance
      }
      return session.instance
    },
    release() {
      generation++
      const instance = session.instance
      session.instance = undefined
      const detach = session.detach
      session.detach = undefined
      for (const registration of registrations) entry.leaveGuards.delete(registration)
      registrations.clear()
      try {
        detach?.()
      } finally {
        instance?.dispose?.()
      }
    },
    dismissed() {
      if (entry.disposed || entry.stack.entries.value.at(-1) !== entry)
        return Promise.resolve()
      const entries = entry.stack.entries.value
      const target = entries.at(-2)?.page
      if (!target && !entry.stack.modal)
        return Promise.reject(new Error('Cannot remove the root native destination'))
      // The external action is already committed. Reflect it in the Page host,
      // which reports native completion and settles results through normal sync.
      return (dismissing ??= Promise.resolve(
        entry.stack.host?.back(target ?? null, { animated: false }),
      ))
    },
  }
  // Fail a throwing factory before a Page enters the native history.
  session.create()
  sessions.set(entry, session)
  return defineComponent({
    name: `NativePage(${options.id})`,
    setup() {
      return () =>
        h('Page', { actionBarHidden: true }, [h('RouterNativeDestination', { session })])
    },
  })
}

export function disposeNativeDestination(entry: Entry) {
  const session = sessions.get(entry)
  sessions.delete(entry)
  if (session) {
    session.failed(
      new Error(`Native destination "${session.id}" was disposed before mounting`),
    )
    session.release()
  }
}

export function nativeDestinationReady(entry: Entry): Promise<void> | undefined {
  return sessions.get(entry)?.ready
}
