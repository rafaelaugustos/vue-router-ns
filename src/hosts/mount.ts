import type { NativeHost } from '../host.js'
import { INTERNAL, type RouterInternals } from '../internal.js'
import type { Router } from '../router.js'
import type { RouteLocationRaw } from '../types.js'

/**
 * Drives a stack named `name` in `host`, the way `<RouterView name>` does with
 * a Frame, starting at `initial`. Navigate there with `{ frame: name }`.
 * Returns the function that unmounts it, closing the stack and its pages.
 *
 * Experimental, like the host contract itself.
 */
export function mountNativeHost(
  router: Router<any>,
  name: string,
  host: NativeHost,
  initial: RouteLocationRaw = '/',
): () => void {
  const internals = (router as unknown as { [INTERNAL]?: RouterInternals })[INTERNAL]
  if (!internals) throw new Error('mountNativeHost() needs a router from createRouter()')
  void internals.mount(name, host, initial)
  return () => internals.unmount(name)
}
