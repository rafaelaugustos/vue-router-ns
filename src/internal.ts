import type { NativeHost } from './host.js'
import type { RouteLocation, RouteLocationRaw } from './types.js'

/** What `<RouterView>` and `mountNativeHost()` need from the router, kept off the public API. */
export interface RouterInternals {
  mount(
    name: string,
    host: NativeHost,
    initial: RouteLocationRaw,
    reveal?: () => void,
    selected?: () => boolean,
    present?: (route: RouteLocation | undefined) => void,
  ): Promise<void>
  unmount(name: string): void
}

export const INTERNAL = Symbol(__DEV__ ? 'router internals' : '')
