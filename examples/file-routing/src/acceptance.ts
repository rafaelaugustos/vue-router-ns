import { Page, isIOS } from '@nativescript/core'
import {
  isNavigationFailure,
  NavigationFailureType,
  type RegisteredRouter,
} from 'vue-router-ns'
import {
  captures,
  focusOwners,
  globalVisits,
  navigationLocked,
  signedIn,
  status,
} from './state'

const pause = () => new Promise<void>((resolve) => setTimeout(resolve, 50))
async function until(test: () => boolean, timeout = 15000) {
  const end = Date.now() + timeout
  while (!test() && Date.now() < end) await pause()
  if (!test()) throw new Error('Timed out waiting for native file-routing operation')
}
const last = (path: string) => captures.get(path)!.at(-1)!

/** Uses actual Page/Frame identities. Watch phases are delivered by ns run/HMR. */
export async function run(router: RegisteredRouter, watch: boolean) {
  const checks: string[] = []
  const check = (name: string, condition: unknown) => {
    if (!condition) throw new Error(`File-routing setup: ${name}`)
    checks.push(name)
    console.log(`CONVENTIONS_CHECK ${name}`)
  }
  const phase = (name: string) =>
    console.log(`CONVENTIONS_PHASE ${__FILE_ROUTING_RUN__} ${name}`)
  try {
    await router.isReady()
    const home = last('/'),
      frame = home.host.native!,
      homePage = frame.currentPage
    home.draft.value = 'Retained home draft'
    check(
      'generated-root-and-native-layout',
      homePage instanceof Page && homePage.actionBar.title === 'Discover',
    )
    check('discovered-global-middleware', globalVisits.value > 0)
    await router.push('/saved', { frame: 'saved' })
    await until(() => !!captures.get('/saved')?.length)
    const saved = last('/saved'),
      savedFrame = saved.host.native!,
      savedPage = savedFrame.currentPage
    saved.draft.value = 'Retained other stack'
    await router.push('/products/7', { frame: 'default' })
    const product = last('/products/7'),
      productPage = frame.currentPage
    product.draft.value = 'Retained product draft'
    check(
      'typed-params-and-native-push',
      product.route.params.id === '7' && frame.backStack.length === 1,
    )
    check(
      'layout-focus-owner-and-target',
      focusOwners.has('/products/7') && !!productPage.getViewById('page-heading'),
    )
    const result = router.pushForResult<string>('/color')
    await until(
      () => captures.get('/color')?.at(-1)?.host.native?.currentPage instanceof Page,
    )
    const modal = last('/color'),
      modalFrame = modal.host.native!
    check(
      'metadata-native-modal',
      modalFrame !== frame && modalFrame.currentPage instanceof Page,
    )
    check('covered-page-hidden-from-accessibility', productPage.accessibilityHidden)
    await modal.router.back({ result: 'Terracotta' })
    check('typed-modal-result', (await result) === 'Terracotta')
    check(
      'return-restores-native-page-and-visibility',
      frame.currentPage === productPage &&
        !productPage.accessibilityHidden &&
        !!productPage.getViewById('page-heading')?.isLoaded,
    )
    navigationLocked.value = true
    const blocked = await router.push('/account')
    check(
      'discovered-middleware-cancels-before-mount',
      isNavigationFailure(blocked, NavigationFailureType.aborted) &&
        !captures.has('/account') &&
        frame.currentPage === productPage,
    )
    navigationLocked.value = false
    await router.push('/account')
    check(
      'auth-redirects-to-native-login',
      router.currentRoute.value.name === 'login' && !captures.has('/account'),
    )
    signedIn.value = true
    await router.replace('/account')
    check('auth-session-allows-destination', router.currentRoute.value.name === 'account')
    await router.back()
    check(
      'back-retains-product-draft',
      frame.currentPage === productPage &&
        product.draft.value === 'Retained product draft',
    )
    await router.push('/about')
    check('explicit-route-coexists', router.currentRoute.value.name === 'about')
    await router.back()
    check(
      'unrelated-stack-retained',
      savedFrame.currentPage === savedPage &&
        saved.draft.value === 'Retained other stack',
    )

    if (watch) {
      phase('ready')
      await until(
        () =>
          router.hasRoute('live-added' as never) &&
          router
            .getRoutes()
            .some((r) => r.name === 'products-id' && r.meta.revision === 2),
        180000,
      )
      check(
        'watch-add-and-metadata-retain-open-page',
        frame.currentPage === productPage &&
          product.route.meta.revision === 1 &&
          product.draft.value === 'Retained product draft',
      )
      await router.push('/live-added')
      const addedPage = frame.currentPage
      phase('added')
      await until(
        () =>
          router.hasRoute('live-renamed' as never) &&
          !router.hasRoute('live-added' as never),
        180000,
      )
      check(
        'watch-rename-retains-native-page',
        frame.currentPage === addedPage &&
          router.currentRoute.value.path === '/live-added',
      )
      await router.push('/live-renamed')
      const renamedPage = frame.currentPage
      phase('renamed')
      await until(() => !router.hasRoute('live-renamed' as never), 180000)
      check('watch-removal-retains-native-page', frame.currentPage === renamedPage)
      await router.back()
      check('back-returns-to-renamed-away-entry', frame.currentPage === addedPage)
      await router.back()
      check(
        'watch-keeps-original-product-and-other-stack',
        frame.currentPage === productPage &&
          product.draft.value === 'Retained product draft' &&
          savedFrame.currentPage === savedPage,
      )
      phase('removed')
      await until(() => router.hasRoute('recovered' as never), 180000)
      check(
        'watch-recovers-after-invalid-source',
        frame.currentPage === productPage &&
          product.draft.value === 'Retained product draft',
      )
      await router.push('/products/8')
      check(
        'future-visit-uses-updated-metadata',
        last('/products/8').route.meta.revision === 2,
      )
      await router.back()
      phase('recovered')
    }
    await router.back()
    check(
      'back-retains-home-page-and-draft',
      frame.currentPage === homePage && home.draft.value === 'Retained home draft',
    )
    status.value = `${checks.length} native setup checks passed`
    console.log(
      `CONVENTIONS_RESULT ${JSON.stringify({ id: __FILE_ROUTING_RUN__, ok: true, checks, watch, platform: isIOS ? 'ios' : 'android' })}`,
    )
  } catch (error) {
    status.value = String(error)
    console.log(
      `CONVENTIONS_RESULT ${JSON.stringify({ id: __FILE_ROUTING_RUN__, ok: false, checks, error: String(error), platform: isIOS ? 'ios' : 'android' })}`,
    )
  }
}
