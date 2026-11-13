// --env.preloaddataTest: real HTTP, controlled 900ms server delay; not a benchmark.
import {
  File,
  Frame,
  knownFolders,
  type Page,
  type TouchGestureEventData,
} from '@nativescript/core'
import { ActionBar, createApp, defineComponent, h, nextTick, ref } from 'nativescript-vue'
import {
  createRouter,
  defineRouteLoader,
  NavigationFailureType,
  RouterView,
  useRouteData,
  useRouteDataPreload,
  useRouter,
  type RouteData,
  type RoutePreload,
} from 'vue-router-ns'
import { counts, delay, snapshot } from './preload/metrics'

type Product = { id: string; account: string; title: string }
const mode = ref('cold'),
  status = ref('READY'),
  visible = ref(true)
const description = ref(
  'Real HTTP with a controlled 900 ms server delay. No performance claim.',
)
const allocation = ref('No prepared native views.')
let session = { account: 'A' },
  switched = false,
  abandoned = false,
  cancels = 0
let frame: Frame,
  original: Page,
  before = snapshot(),
  beforeCancels = 0,
  beforeHistory: string[] = []
let state: RouteData<Product> | undefined, handle: RoutePreload | undefined
let pending: Promise<unknown> = Promise.resolve(),
  prepare: ReturnType<typeof useRouteDataPreload>
const errors: string[] = []
const history = () => router.getHistory()?.entries.map((entry) => entry.id) ?? []
const delta = () =>
  Object.fromEntries(
    Object.entries(snapshot()).map(([key, value]) => [
      key,
      value - before[key as keyof typeof before],
    ]),
  )
const check = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message)
}
const loader = defineRouteLoader(
  ({ to, onCancel }) => {
    counts.data++
    const account = session.account
    onCancel(() => {
      cancels++
    }) // This fetch adapter cannot abort transport; publication still cancels.
    const request = fetch(
      `http://127.0.0.1:18819/products/${account}/${String(to.params.id)}`,
    ).then((response) => {
      if (!response.ok) throw new Error('Product HTTP request failed')
      return response.json() as Promise<Product>
    })
    pending = request
    return request
  },
  { preload: { scope: () => session, authorize: () => mode.value !== 'denied' } },
)
function baseline() {
  before = snapshot()
  beforeCancels = cancels
  beforeHistory = history()
  original = frame.currentPage!
}
function noAllocation() {
  const d = delta()
  for (const key of [
    'pages',
    'frames',
    'controllers',
    'vueApps',
    'detailSetups',
    'factories',
    'guards',
  ])
    check(d[key] === 0, `No speculative ${key}`)
  check(
    JSON.stringify(history()) === JSON.stringify(beforeHistory) &&
      frame.currentPage === original,
    'Exact source Page/history retained',
  )
}
async function record(name: string, assertions: () => void, extra: object = {}) {
  let error: unknown
  try {
    assertions()
  } catch (value) {
    error = value
  }
  const d = delta()
  allocation.value = `Pages ${d.pages} · controllers ${d.controllers} · Vue apps ${d.vueApps} · Frames ${d.frames} · requests ${d.data} · guards ${d.guards}`
  const result = {
    command: name,
    ok: !error,
    error: error ? String(error) : undefined,
    delta: d,
    cancellations: cancels - beforeCancels,
    history: history(),
    beforeHistory,
    account: session.account,
    lease: handle?.state.value,
    data: state?.data.value,
    errors,
    ...extra,
  }
  await File.fromPath(
    `${knownFolders.documents().path}/preloaddata-${name}.json`,
  ).writeText(JSON.stringify(result, null, 2))
  status.value = `${error ? 'FAIL' : 'PASS'} ${name}`
  if (error) errors.push(String(error))
}
async function configure(name: string) {
  handle?.cancel()
  router.clearPreloads()
  await router.backToRoot({ animated: false })
  router.removeRoute('detail')
  router.addRoute({
    path: '/detail/:id',
    name: 'detail',
    component: () => {
      counts.factories++
      return Detail
    },
    meta: { loaders: loader },
  })
  mode.value = name
  session = { account: 'A' }
  switched = false
  abandoned = false
  state = undefined
  baseline()
  status.value = `READY ${name}`
  description.value =
    name === 'cold'
      ? 'Tap: Page opens immediately, then HTTP data arrives.'
      : name === 'denied'
        ? 'Touch: speculative authorization refuses; zero HTTP requests.'
        : name === 'account'
          ? 'Hold: account A closes during HTTP. Then hold again to prepare account B.'
          : name === 'dispose'
            ? 'Hold: the source owner closes during HTTP.'
            : name === 'blocked'
              ? 'Hold to prepare data; release still runs a refusing navigation guard.'
              : name === 'abandon'
                ? 'Touch, then drag outside. HTTP may finish; publication stays cancelled.'
                : 'Hold one second to prepare HTTP data; release to reuse after guards.'
}
const Detail = defineComponent({
  setup() {
    counts.detailSetups++
    state = useRouteData(loader)
    const resource = state,
      router = useRouter()
    return () =>
      h('Page', { backgroundColor: '#edf7f5' }, [
        h(ActionBar, { title: 'Authorized product page' }),
        h('StackLayout', { padding: 32 }, [
          h('Label', {
            text:
              resource.status.value === 'pending'
                ? 'Loading real HTTP data…'
                : (resource.data.value?.title ?? resource.status.value),
            textWrap: true,
            fontSize: 28,
            color: '#164740',
          }),
          h('Label', {
            text: `Account: ${resource.data.value?.account ?? 'pending'}`,
            fontSize: 22,
            marginTop: 24,
          }),
          h('Button', { text: 'Back to cards', onTap: () => router.back() }),
        ]),
      ])
  },
})
async function abandon() {
  if (abandoned) return
  abandoned = true
  handle?.cancel()
  description.value =
    'Interest released. Transport continues; no page or late publication.'
  await pending
  await record('abandon', () => {
    noAllocation()
    check(
      delta().data === 1 && cancels - beforeCancels === 1,
      'One request and one cancellation',
    )
    check(
      handle?.state.value.status === 'cancelled',
      'Late HTTP cannot restore a cancelled lease',
    )
  })
}
const Home = defineComponent({
  setup() {
    const bound = useRouter()
    prepare = useRouteDataPreload()
    async function commit() {
      if (abandoned) return
      const name = mode.value,
        started = Date.now()
      const outcome = await bound.push(`/detail/${name}`, { animated: false })
      const presentedMilliseconds = Date.now() - started
      if (name === 'blocked') {
        await record('blocked', () => {
          check(
            outcome?.type === NavigationFailureType.aborted,
            'Actual navigation guard refuses',
          )
          const d = delta()
          for (const key of [
            'pages',
            'frames',
            'controllers',
            'vueApps',
            'detailSetups',
            'factories',
          ])
            check(d[key] === 0, `Refusal has no ${key}`)
          check(d.guards === 1 && d.data === 1, 'Prepared HTTP does not bypass a guard')
          check(
            frame.currentPage === original &&
              JSON.stringify(history()) === JSON.stringify(beforeHistory),
            'Refusal retains exact source/history',
          )
        })
      } else {
        if (name === 'cold')
          await record(
            'cold-presented',
            () => {
              check(
                !outcome && state?.status.value === 'pending',
                'Native presentation does not wait for HTTP',
              )
            },
            { presentedMilliseconds },
          )
        await state!.ready
        await record(
          name,
          () => {
            const d = delta()
            check(
              !outcome && state?.status.value === 'success',
              'Normal entry receives successful data',
            )
            check(
              state?.data.value?.account === session.account,
              'Only current account data reaches the page',
            )
            check(
              d.data === 1 &&
                d.guards === 1 &&
                d.factories === 1 &&
                d.pages === 1 &&
                d.controllers === 1 &&
                d.frames === 0 &&
                d.vueApps > 0,
              'One request and only committed native construction',
            )
            check(
              history().length === 2 && frame.backStack[0]?.resolvedPage === original,
              'Original Page retained in history',
            )
          },
          {
            presentedMilliseconds,
            dataMilliseconds: Date.now() - started,
            serverDelayMilliseconds: 900,
          },
        )
        description.value = `${name}: Page ${presentedMilliseconds} ms; data ${Date.now() - started} ms after release. Controlled HTTP delay: 900 ms.`
      }
      handle?.cancel()
    }
    function touch(event: TouchGestureEventData) {
      if (event.action === 'down') {
        abandoned = false
        baseline()
        if (mode.value === 'cold') return
        handle?.cancel()
        const owned = (handle = prepare(`/detail/${mode.value}`, loader))
        if (mode.value === 'account' && !switched) {
          void (async () => {
            await delay(250)
            session = { account: 'B' }
            router.clearPreloads()
            switched = true
            await pending
            await record('account-stale', () => {
              noAllocation()
              check(
                owned.state.value.status === 'cancelled',
                'Old account interest cancelled',
              )
              check(
                cancels - beforeCancels === 1 && !state,
                'Old HTTP finishes without publishing to an entry',
              )
            })
            description.value =
              'Old account response discarded. Hold again to prepare account B.'
          })()
        } else if (mode.value === 'dispose') {
          void (async () => {
            await delay(250)
            visible.value = false
            await nextTick()
            await pending
            await record('dispose', () => {
              const d = delta()
              for (const key of [
                'pages',
                'frames',
                'controllers',
                'vueApps',
                'detailSetups',
                'factories',
                'guards',
              ])
                check(d[key] === 0, `No ${key} after disposal`)
              check(
                owned.state.value.status === 'cancelled' && cancels - beforeCancels === 1,
                'Owner releases pending interest',
              )
              check(
                !router.history.value &&
                  prepare('/detail/dispose', loader).state.value.status === 'cancelled',
                'Retired owner has no history or new preparation',
              )
              check(
                !errors.length && !router.diagnostics!.snapshot().issues.length,
                'No Vue/reconciliation errors',
              )
            })
          })()
        } else
          void owned.ready.then(async (result) => {
            if (mode.value === 'denied')
              await record('denied', () => {
                noAllocation()
                check(
                  result.status === 'cancelled' &&
                    result.reason === 'unauthorized' &&
                    delta().data === 0,
                  'No HTTP without explicit permission',
                )
              })
            else if (
              result.status === 'ready' &&
              ['prepared', 'blocked', 'account'].includes(mode.value)
            ) {
              await record(`${mode.value}-before`, () => {
                noAllocation()
                check(delta().data === 1, 'One speculative HTTP request')
              })
              description.value =
                'Data ready with zero native allocations. Release still requires guards.'
            }
          })
      } else if (event.action === 'move' && mode.value === 'abandon') {
        const size = event.view.getActualSize()
        if (
          event.getX() < 0 ||
          event.getY() < 0 ||
          event.getX() > size.width ||
          event.getY() > size.height
        )
          void abandon()
      } else if (event.action === 'cancel' && mode.value === 'abandon') void abandon()
      else if (
        event.action === 'up' &&
        !['dispose', 'denied', 'abandon'].includes(mode.value)
      ) {
        if (mode.value === 'account' && handle?.state.value.status !== 'ready') return
        void commit()
      }
    }
    return () =>
      h('Page', { backgroundColor: '#f3f6fb' }, [
        h(ActionBar, { title: 'Explicit data preparation' }),
        h('StackLayout', { padding: 28 }, [
          h('Label', {
            text: 'A product for the current account',
            textWrap: true,
            fontSize: 28,
            fontWeight: 'bold',
            color: '#19385c',
            marginBottom: 18,
          }),
          h(
            'GridLayout',
            {
              height: 170,
              borderRadius: 18,
              backgroundColor: '#19385c',
              accessible: true,
              accessibilityLabel: 'preloaddata:card',
              onTouch: touch,
            },
            [
              h('Label', {
                text: 'Touch to prepare data\nRelease to navigate',
                color: 'white',
                fontSize: 24,
                textAlignment: 'center',
                textWrap: true,
              }),
            ],
          ),
          h('Label', {
            text: 'Drag outside to abandon. Preparation never creates a hidden Page.',
            textWrap: true,
            fontSize: 18,
            marginTop: 24,
          }),
        ]),
      ])
  },
})
const router = createRouter({
  routes: [{ path: '/', component: Home }],
  preloadData: { concurrency: 2, maxEntries: 4, ttl: 30_000 },
  diagnostics: true,
})
router.beforeEach((to) => {
  if (to.path.startsWith('/detail/')) {
    counts.guards++
    return mode.value !== 'blocked'
  }
})
const app = createApp({
  render: () =>
    h('GridLayout', { rows: 'auto,auto,auto,auto,*', backgroundColor: '#e4ecf6' }, [
      h('Label', {
        row: 0,
        text: status.value,
        fontSize: 22,
        fontWeight: 'bold',
        color: '#17656c',
        margin: '12 20',
      }),
      h('Label', {
        row: 1,
        text: description.value,
        fontSize: 17,
        textWrap: true,
        margin: '0 20 8',
      }),
      h('Label', {
        row: 2,
        text: allocation.value,
        fontSize: 17,
        textWrap: true,
        margin: '0 20 8',
      }),
      h(
        'WrapLayout',
        { row: 3, margin: '0 12 8' },
        ['cold', 'prepared', 'abandon', 'denied', 'blocked', 'account', 'dispose'].map(
          (name) =>
            h('Button', {
              text: name,
              accessibilityLabel: `preloaddata:${name}`,
              margin: 4,
              padding: 10,
              onTap: () => void configure(name),
            }),
        ),
      ),
      ...(visible.value
        ? [
            h(RouterView, {
              row: 4,
              onLoaded: (event: { object: Frame }) => {
                frame = event.object
              },
            }),
          ]
        : []),
    ]),
})
app.config.errorHandler = (error) => {
  errors.push(String(error))
  console.error(error)
}
app.use(router)
app.start()
