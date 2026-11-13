// --env.intentsTest: real Frames and OS URL delivery; no native navigation shims.
import { File, Frame, knownFolders } from '@nativescript/core'
import { ActionBar, createApp, defineComponent, h, ref } from 'nativescript-vue'
import {
  createRouter,
  NavigationFailureType,
  RouterView,
  useRoute,
  type NavigationIntent,
  type IntentResult,
} from 'vue-router-ns'

const status = ref('READY'),
  detail = ref('Resolve a destination, then deliver it to an explicit stack.')
const comparison = ref(''),
  frames: Record<string, Frame> = {}
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const check = (value: unknown, message: string) => {
  if (!value) throw new Error(message)
}
const screen = defineComponent({
  setup() {
    const route = useRoute()
    return () =>
      h('Page', { backgroundColor: '#f1f5fa' }, [
        h(ActionBar, { title: route.path === '/' ? 'Retained home' : 'Destination' }),
        h('Label', {
          id: 'intent-route',
          text: route.fullPath,
          textWrap: true,
          fontSize: 28,
          color: '#183b58',
          textAlignment: 'center',
        }),
      ])
  },
})
let reveals = 0
const router = createRouter({
  routes: [
    { path: '/', component: screen },
    { path: '/items/:id', name: 'item', component: screen },
    { path: '/blocked', component: screen, beforeEnter: () => false },
    { path: '/modal', component: screen, modal: true },
  ],
  diagnostics: true,
  links: {
    schemes: ['routerentries'],
    frame() {
      reveals++
      return 'target'
    },
  },
})
let release: (() => void) | undefined
router.beforeEach((to) =>
  to.params.id === 'slow'
    ? new Promise<void>((resolve) => {
        release = resolve
      })
    : undefined,
)
const intent = (
  destination: NavigationIntent['destination'],
  extra: Partial<NavigationIntent> = {},
): NavigationIntent => ({
  version: 1,
  source: 'internal',
  destination,
  target: { frame: 'target' },
  ...extra,
})
const state = () =>
  Object.fromEntries(
    ['source', 'target'].map((name) => [
      name,
      {
        logical: router
          .getHistory({ frame: name })
          ?.entries.map((entry) => entry.route.path),
        native: [
          ...frames[name]!.backStack.map((entry) => entry.resolvedPage),
          frames[name]!.currentPage,
        ]
          .filter(Boolean)
          .map((page) => (page!.getViewById('intent-route') as any)?.text),
      },
    ]),
  )
function aligned() {
  const snapshot = state()
  for (const stack of Object.values(snapshot))
    check(
      JSON.stringify(stack.logical) === JSON.stringify(stack.native),
      'Native and logical paths agree',
    )
  check(JSON.stringify(snapshot.source.native) === '["/"]', 'Source Frame retained')
  return snapshot
}
async function report(name: string, error?: unknown, result?: unknown) {
  const snapshot = state()
  comparison.value = `Source: ${snapshot.source!.native.join(' → ')}\nTarget: ${snapshot.target!.native.join(' → ')}`
  await File.fromPath(`${knownFolders.documents().path}/intents-${name}.json`).writeText(
    JSON.stringify(
      {
        command: name,
        ok: !error,
        error: error ? String(error) : undefined,
        result,
        windowId: router.window.value?.id,
        stacks: snapshot,
        diagnostics: JSON.parse(router.diagnostics!.export()),
      },
      null,
      2,
    ),
  )
  status.value = `${error ? 'FAIL' : 'PASS'} ${name}`
}
async function run(name: string) {
  status.value = `RUN ${name}`
  let error: unknown, result: IntentResult | undefined
  try {
    if (name === 'preview') {
      await router.isReady()
      const original = frames.target!.currentPage
      const named = router.resolveIntent(
        intent({ route: { name: 'item', params: { id: 7 } } }),
      )
      const url = router.resolveIntent(intent({ url: 'routerentries://items/7' }))
      check(
        named.status === 'resolved' &&
          url.status === 'resolved' &&
          named.location.fullPath === url.location.fullPath,
        'Route and URL resolve identically',
      )
      check(
        frames.target!.currentPage === original && reveals === 0,
        'Resolution never presents or selects',
      )
      detail.value =
        'Named route and URL resolve to /items/7. Both native stacks are unchanged.'
    } else if (name === 'route') {
      result = await router.openIntent(
        intent({ route: { name: 'item', params: { id: 7 } } }),
      )
      check(result.status === 'handled', 'Route intent handled')
      detail.value =
        'A named destination opened in the target Frame. The source page is retained.'
    } else if (name === 'url') {
      result = await router.openIntent(
        intent({ url: 'routerentries://items/8' }, { source: 'url', target: {} }),
      )
      check(
        result.status === 'handled' && reveals === 1,
        'Existing URL policy selects target',
      )
      detail.value =
        'The URL adapter uses the existing link policy and guarded navigation.'
    } else if (name === 'repeat') {
      const request = intent(
        { route: '/items/delivery' },
        { delivery: { scope: 'fixture-session', id: 'tap-1' } },
      )
      await router.openIntent(request)
      const page = frames.target!.currentPage
      result = await router.openIntent({ ...request, source: 'app-adapter' })
      check(
        result.status === 'ignored' &&
          result.reason === 'repeat' &&
          frames.target!.currentPage === page,
        'Repeated delivery does not navigate twice',
      )
      detail.value =
        'Same delivery scope/id from a second source: ignored. No duplicate native Page.'
    } else if (name === 'blocked') {
      const page = frames.target!.currentPage
      result = await router.openIntent(intent({ route: '/blocked' }))
      check(
        result.status === 'handled' &&
          result.failure?.type === NavigationFailureType.aborted &&
          frames.target!.currentPage === page,
        'Guard preserves exact native Page',
      )
      detail.value =
        'The normal guard refused the request. The exact native Page stayed in place.'
    } else if (name === 'cancelled') {
      const pending = router.openIntent(intent({ route: '/items/slow' }))
      for (let i = 0; !release && i < 100; i++) await wait(10)
      check(release, 'Async guard started')
      await router.openIntent(intent({ route: '/items/fast' }))
      release!()
      result = await pending
      check(
        result.status === 'handled' &&
          result.failure?.type === NavigationFailureType.cancelled,
        'Normal overlapping-request cancellation',
      )
      detail.value =
        'A newer request cancelled the pending guard. Only /items/fast was presented.'
    } else if (name === 'owner') {
      result = await router.openIntent(
        intent(
          { route: '/items/wrong' },
          { target: { windowId: 'absent-window', frame: 'target' } },
        ),
      )
      check(
        result.status === 'ignored' && result.reason === 'wrong-window',
        'Owner mismatch rejected',
      )
      detail.value =
        'A different window ID is rejected. The API does not guess another owner.'
    } else if (name === 'expired') {
      result = await router.openIntent(
        intent({ route: '/items/expired' }, { expiresAt: Date.now() - 1 }),
      )
      check(
        result.status === 'ignored' && result.reason === 'expired',
        'Expired request rejected',
      )
      detail.value = 'Expired requests are ignored before native navigation.'
    } else if (name === 'removed') {
      const remove = router.addRoute({
        path: '/temporary',
        name: 'temporary',
        component: screen,
      })
      const request = intent({ route: { name: 'temporary' } })
      check(
        router.resolveIntent(request).status === 'resolved',
        'Preview valid before removal',
      )
      remove()
      result = await router.openIntent(request)
      check(
        result.status === 'ignored' && result.reason === 'unmatched',
        'Removed route revalidated',
      )
      detail.value =
        'A preview is not authorization: execution resolves again after a route is removed.'
    } else if (name === 'modal') {
      const page = frames.target!.currentPage
      result = await router.openIntent(intent({ route: '/modal' }))
      check(
        result.status === 'handled' && router.currentRoute.value.path === '/modal',
        'Native modal presented',
      )
      await wait(900)
      await router.back()
      check(frames.target!.currentPage === page, 'Modal disposal retains target Page')
      detail.value =
        'The intent presented a real native modal, then normal Back dismissed it.'
    }
    aligned()
  } catch (value) {
    error = value
  }
  await report(
    name,
    error,
    result && {
      status: result.status,
      ...(result.status === 'ignored'
        ? { reason: result.reason }
        : { failure: result.failure?.type, requested: result.location.fullPath }),
    },
  )
}
router.onLink((result) => {
  if (result.location?.path !== '/items/os-link') return
  let error: unknown
  try {
    aligned()
    check(!result.ignored && !result.failure, 'Real OS link handled by shared executor')
  } catch (value) {
    error = value
  }
  detail.value =
    'A real OS URL arrived through openLink: same native destination executor.'
  void report('os-link', error, {
    source: result.link.source,
    path: result.location.path,
  })
})
const app = createApp({
  render: () =>
    h('GridLayout', { rows: 'auto,auto,auto,auto,*', backgroundColor: '#e4ecf6' }, [
      h('Label', {
        row: 0,
        text: status.value,
        fontSize: 24,
        fontWeight: 'bold',
        color: '#17656c',
        margin: '12 20',
      }),
      h('Label', {
        row: 1,
        text: detail.value,
        textWrap: true,
        fontSize: 18,
        margin: '0 20 10',
      }),
      h('Label', {
        row: 2,
        text: comparison.value,
        textWrap: true,
        fontSize: 17,
        margin: '0 20 10',
        color: '#183b58',
      }),
      h(
        'WrapLayout',
        { row: 3, margin: '0 12 10' },
        [
          'preview',
          'route',
          'url',
          'repeat',
          'blocked',
          'cancelled',
          'owner',
          'expired',
          'removed',
          'modal',
        ].map((name) =>
          h('Button', {
            text: name,
            accessibilityLabel: `intents:${name}`,
            padding: 10,
            margin: 4,
            onTap: () => void run(name),
          }),
        ),
      ),
      h(
        'GridLayout',
        { row: 4, columns: '*,*' },
        ['source', 'target'].map((name, col) =>
          h(RouterView, {
            col,
            name,
            onLoaded: (event: { object: Frame }) => {
              frames[name] = event.object
            },
          }),
        ),
      ),
    ]),
})
app.use(router).start()
