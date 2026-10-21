// Opt-in native acceptance: ns build <platform> --env.filesTest.
import { Page, isIOS, type Frame } from '@nativescript/core'
import { ActionBar, createApp, defineComponent, h } from 'nativescript-vue'
import { createRouter, isNavigationFailure, RouterView } from 'vue-router-ns'
import { createFileRouteUpdater, mergeFileRoutes } from 'vue-router-ns/file-routing'
import { routes } from './file-generated/initial'
import { routes as added } from './file-generated/added'
import { routes as renamed } from './file-generated/renamed'
import { routes as removed } from './file-generated/removed'
import { captures, FilePage, status } from './file-state'

const checks: string[] = []
const pause = () => new Promise<void>((resolve) => setTimeout(resolve, 30))
async function until(condition: () => boolean) {
  for (let i = 0; i < 200 && !condition(); i++) await pause()
  if (!condition()) throw new Error('File route native wait timed out')
}
function check(name: string, value: boolean) {
  if (!value) throw new Error(`File route acceptance failed: ${name}`)
  checks.push(name)
  console.log(`FILES_CHECK ${name}`)
}
let middlewareCalls = 0
const router = createRouter({
  routes: mergeFileRoutes(routes, [
    { path: '/manual', name: 'manual', component: () => FilePage },
  ] as const),
  layouts: {
    sheet: defineComponent({
      setup(_, { slots }) {
        return () =>
          h('Page', [
            h(ActionBar, { title: 'Generated native modal' }),
            ...slots.default!(),
          ])
      },
    }),
  },
})
router.addRouteMiddleware('deny', () => false)
router.addRouteMiddleware('allowModal', () => {
  middlewareCalls++
})
const updater = createFileRouteUpdater(router, routes)

async function run() {
  await router.isReady()
  await until(() => captures.length > 0)
  const root = captures[0]!,
    frame = root.host.native as Frame,
    rootPage = frame.currentPage
  check(
    'generated-index-native-page',
    rootPage instanceof Page && root.route.name === 'index',
  )
  await router.push(
    { name: 'product', params: { id: 42 } },
    { withParents: true, animated: false },
  )
  const product = captures.at(-1)!,
    productPage = frame.currentPage
  product.draft.value = 'retained generated draft'
  check(
    'generated-parent-native-history',
    router.stack.value.map((r) => r.path).join(',') === '/,/products,/products/42' &&
      frame.backStack.length === 2,
  )
  check(
    'typed-dynamic-route-and-metadata',
    product.route.params.id === '42' && product.route.meta.revision === 1,
  )
  updater.update(added)
  check(
    'add-and-metadata-edit-retains-page',
    frame.currentPage === productPage &&
      product.route.meta.revision === 1 &&
      product.draft.value === 'retained generated draft' &&
      router.hasRoute('added'),
  )
  await router.push('/added', { animated: false })
  const addedPage = frame.currentPage
  updater.update(renamed)
  check(
    'rename-retains-current-native-entry',
    frame.currentPage === addedPage &&
      !router.hasRoute('added') &&
      router.hasRoute('renamed'),
  )
  await router.push('/renamed', { animated: false })
  await router.back({ animated: false })
  check(
    'back-returns-to-renamed-away-page',
    frame.currentPage === addedPage && router.currentRoute.value.path === '/added',
  )
  await router.back({ animated: false })
  check(
    'back-retains-original-draft',
    frame.currentPage === productPage &&
      product.draft.value === 'retained generated draft',
  )
  await router.push('/products/43', { animated: false })
  check(
    'future-navigation-uses-updated-metadata',
    captures.at(-1)!.route.meta.revision === 2 && captures.at(-1)! !== product,
  )
  await router.back({ animated: false })
  updater.update(removed)
  check(
    'removed-destination-keeps-open-page',
    !router.hasRoute('product') &&
      frame.currentPage === productPage &&
      product.route.path === '/products/42',
  )
  await router.back({ animated: false })
  await router.back({ animated: false })
  check(
    'back-after-removal-keeps-root-identity',
    frame.currentPage === rootPage && frame.backStack.length === 0,
  )
  await router.push('/settings', { animated: false })
  check(
    'optional-parameter-absent',
    captures.at(-1)!.route.name === 'settings-tab' &&
      captures.at(-1)!.route.params.tab === undefined,
  )
  await router.back({ animated: false })
  await router.push('/files/a/b', { animated: false })
  check(
    'catch-all-native-page',
    JSON.stringify(captures.at(-1)!.route.params.path) === '["a","b"]',
  )
  await router.back({ animated: false })
  await router.push('/any', { animated: false })
  check(
    'optional-catch-all-empty',
    captures.at(-1)!.route.name === 'any-path' &&
      captures.at(-1)!.route.params.path === undefined,
  )
  await router.back({ animated: false })
  await router.push('/platform', { animated: false })
  check(
    'platform-specific-sfc',
    captures.at(-1)!.route.meta.platform === (isIOS ? 'ios' : 'android'),
  )
  await router.back({ animated: false })
  const count = captures.length
  check(
    'metadata-middleware-aborts-before-mount',
    isNavigationFailure(await router.push('/guarded')) &&
      captures.length === count &&
      frame.currentPage === rootPage,
  )
  await until(() => !isIOS || !!frame.currentPage?.ios?.viewIfLoaded?.window)
  const result = router.pushForResult<string>('/modal')
  await until(() => captures.at(-1)!.route.path === '/modal')
  const modal = captures.at(-1)!
  await until(() => !!modal.host.native?.currentPage)
  check(
    'metadata-native-modal-and-layout',
    modal.host.native !== frame &&
      modal.host.native!.currentPage instanceof Page &&
      middlewareCalls === 1,
  )
  await router.back({ result: 'generated-result', animated: false })
  check(
    'native-modal-result-once',
    (await result) === 'generated-result' && frame.currentPage === rootPage,
  )
  await router.push('/manual', { animated: false })
  check(
    'explicit-route-coexists',
    captures.at(-1)!.route.name === 'manual' && router.hasRoute('manual'),
  )
  await router.back({ animated: false })
  status.value = `${checks.length} generated file-route checks passed`
  console.log(
    `FILES_RESULT ${JSON.stringify({ ok: true, checks, platform: isIOS ? 'ios' : 'android' })}`,
  )
}
const App = defineComponent({
  setup() {
    setTimeout(() => {
      void run().catch((error) => {
        status.value = String(error)
        console.log(
          `FILES_RESULT ${JSON.stringify({ ok: false, checks, error: String(error), stack: error?.stack })}`,
        )
      })
    }, 0)
    return () => h(RouterView)
  },
})
createApp(App).use(router).start()
