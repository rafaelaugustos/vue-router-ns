// --env.preloadTest. Controlled factory delay is shown explicitly; this is not an import benchmark.
import {
  File,
  Frame,
  knownFolders,
  isIOS,
  type Page,
  type TouchGestureEventData,
} from '@nativescript/core'
import {
  ActionBar,
  createApp,
  defineComponent,
  h,
  nextTick,
  ref,
  watch,
} from 'nativescript-vue'
import {
  createRouter,
  defineRouteLoader,
  NavigationFailureType,
  RouterView,
  useRoutePreload,
  useRouter,
  type RoutePreload,
} from 'vue-router-ns'
import { counts, delay, snapshot } from './preload/metrics'

const status = ref('READY'),
  mode = ref('cold'),
  visible = ref(true)
const detail = ref('Tap for cold navigation. Hold to prepare, or drag out to abandon.')
const allocation = ref('No speculative native allocations.')
const errors: string[] = [],
  reports: object[] = []
let frame: Frame,
  original: Page,
  before = snapshot(),
  baselineHistory: string[] = []
let handle: RoutePreload | undefined,
  pendingFactory: Promise<unknown> = Promise.resolve()
let abandoned = false,
  sourcePreload: ReturnType<typeof useRoutePreload>
const delta = () =>
  Object.fromEntries(
    Object.entries(snapshot()).map(([key, value]) => [
      key,
      value - before[key as keyof typeof before],
    ]),
  )
const history = () => router.getHistory()?.entries.map((entry) => entry.id) ?? []
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
function check(value: unknown, message: string) {
  if (!value) throw new Error(message)
}
function refresh() {
  const d = delta()
  allocation.value = `Since touch: Pages ${d.pages} · controllers ${d.controllers} · Vue apps ${d.vueApps} · Frames ${d.frames}`
}
function noAllocation() {
  const d = delta()
  for (const key of [
    'pages',
    'frames',
    'controllers',
    'vueApps',
    'detailSetups',
    'data',
    'guards',
  ])
    check(d[key] === 0, `No speculative ${key}`)
  check(equal(history(), baselineHistory), 'Preparation preserves exact history')
  check(frame.currentPage === original, 'Preparation retains the original native Page')
}
async function record(name: string, test: () => void, extra: object = {}) {
  let error: unknown
  try {
    test()
  } catch (caught) {
    error = caught
  }
  refresh()
  const report = {
    command: name,
    ok: !error,
    error: error ? String(error) : undefined,
    delta: delta(),
    counts: snapshot(),
    history: history(),
    beforeHistory: baselineHistory,
    errors,
    ...extra,
  }
  reports.push(report)
  await File.fromPath(`${knownFolders.documents().path}/preload-${name}.json`).writeText(
    JSON.stringify(report, null, 2),
  )
  status.value = `${error ? 'FAIL' : 'PASS'} ${name}`
  if (error) errors.push(String(error))
}
async function configure(name: string) {
  handle?.cancel()
  router.clearPreloads()
  await router.backToRoot({ animated: false })
  router.removeRoute('detail')
  router.addRoute({
    path: '/detail',
    name: 'detail',
    component: () => {
      counts.factories++
      pendingFactory = delay(900)
        .then(() => import('./preload/Detail'))
        .finally(() => {
          counts.factorySettlements++
        })
      return pendingFactory as Promise<typeof import('./preload/Detail')>
    },
    meta: {
      loaders: defineRouteLoader(() => {
        counts.data++
        return 'authorized'
      }),
    },
  })
  mode.value = name
  abandoned = false
  original = frame.currentPage!
  before = snapshot()
  baselineHistory = history()
  status.value = `READY ${name}`
  detail.value =
    name === 'cold'
      ? 'Tap the card. Code starts loading after the guard.'
      : name === 'abandon'
        ? 'Touch the card, then drag outside. History stays intact.'
        : name === 'blocked'
          ? 'Hold to prepare. Releasing still runs the refusing guard.'
          : name === 'dispose'
            ? 'Hold the card. Its owner will close while the import is pending.'
            : 'Hold for one second: prepare code with zero Pages, then release to navigate.'
  refresh()
}
async function abandon() {
  if (abandoned) return
  abandoned = true
  handle?.cancel()
  detail.value =
    'Interest cancelled. The executing import may finish; no page is created.'
  await pendingFactory
  await record('abandon', () => {
    noAllocation()
    check(
      handle?.state.value.status === 'cancelled',
      'Abandoned lease stays cancelled after late completion',
    )
    check(
      delta().factories === 1 && delta().factorySettlements === 1,
      'Actual executing factory finishes once',
    )
  })
}
const Home = defineComponent({
  setup() {
    const bound = useRouter()
    sourcePreload = useRoutePreload()
    async function commit() {
      if (abandoned) return
      const started = Date.now(),
        name = mode.value
      const outcome = await bound.push('/detail', { animated: false })
      const milliseconds = Date.now() - started
      await record(
        name,
        () => {
          const d = delta()
          check(d.factories === 1, 'Navigation uses one factory invocation')
          check(d.guards === 1, 'Normal navigation still runs authorization')
          if (name === 'blocked') {
            check(
              outcome?.type === NavigationFailureType.aborted,
              'Prepared code cannot bypass a guard',
            )
            for (const key of [
              'pages',
              'frames',
              'controllers',
              'vueApps',
              'detailSetups',
              'data',
            ])
              check(d[key] === 0, `Refusal allocates no ${key}`)
            check(
              equal(history(), baselineHistory) && frame.currentPage === original,
              'Refusal preserves Page and history',
            )
          } else {
            check(
              !outcome &&
                d.pages === 1 &&
                d.frames === 0 &&
                d.detailSetups === 1 &&
                d.data === 1 &&
                d.vueApps > 0,
              'Native Page, Vue app and data start only on commit',
            )
            if (isIOS)
              check(d.controllers === 1, 'Exactly one destination UIViewController')
            check(
              history().length === 2 && frame.backStack[0]?.resolvedPage === original,
              'Committed navigation retains original source Page',
            )
          }
        },
        { navigationMilliseconds: milliseconds, factoryDelayMilliseconds: 900 },
      )
      handle?.cancel()
      detail.value = `${name}: ${milliseconds} ms from release to completed native navigation. Factory delay: 900 ms.`
    }
    function touch(event: TouchGestureEventData) {
      if (event.action === 'down') {
        abandoned = false
        before = snapshot()
        baselineHistory = history()
        original = frame.currentPage!
        if (mode.value === 'cold') return
        handle?.cancel()
        const owned = (handle = sourcePreload('/detail'))
        const stop = watch(
          owned.state,
          (state) => {
            refresh()
            if (state.status === 'cancelled' || state.status === 'error') stop()
          },
          { flush: 'sync' },
        )
        void owned.ready.then(async (result) => {
          if (result.status === 'ready' && ['prepared', 'blocked'].includes(mode.value)) {
            await record(`${mode.value}-before`, noAllocation)
            detail.value =
              'Code ready. Zero native allocations; release still requires navigation guards.'
          }
        })
        if (mode.value === 'dispose')
          void (async () => {
            await delay(250)
            visible.value = false
            await nextTick()
            await pendingFactory
            await record('dispose', () => {
              const d = delta()
              for (const key of [
                'pages',
                'frames',
                'controllers',
                'vueApps',
                'detailSetups',
                'data',
                'guards',
              ])
                check(d[key] === 0, `Disposed owner allocates no ${key}`)
              check(
                owned.state.value.status === 'cancelled',
                'Owner releases its pending interest',
              )
              check(!router.history.value, 'No history after owner disposal')
              check(
                sourcePreload('/detail').state.value.status === 'cancelled',
                'Retired source cannot prepare new code',
              )
              check(
                errors.length === 0 && !router.diagnostics!.snapshot().issues.length,
                'No Vue/reconciliation errors',
              )
            })
          })()
      } else if (event.action === 'cancel') {
        if (mode.value !== 'dispose') void abandon()
      } else if (event.action === 'move') {
        const size = event.view.getActualSize()
        if (
          event.getX() < 0 ||
          event.getY() < 0 ||
          event.getX() > size.width ||
          event.getY() > size.height
        )
          void abandon()
      } else if (event.action === 'up' && mode.value !== 'dispose') {
        if (mode.value === 'abandon') void abandon()
        else void commit()
      }
    }
    return () =>
      h('Page', { backgroundColor: '#f3f6fb' }, [
        h(ActionBar, { title: 'Route code preloading' }),
        h('StackLayout', { padding: 28 }, [
          h('Label', {
            text: 'Explore a destination',
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
              accessibilityLabel: 'preload:card',
              onTouch: touch,
            },
            [
              h('Label', {
                text: 'Open the detail page\nTouch · hold · release',
                color: 'white',
                fontSize: 24,
                textAlignment: 'center',
                textWrap: true,
              }),
            ],
          ),
          h('Label', {
            text: 'Drag outside the card to abandon preparation.',
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
  diagnostics: true,
  preload: { concurrency: 2, maxEntries: 4, ttl: 30_000 },
})
router.beforeEach((to) => {
  if (to.path === '/detail') {
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
        text: detail.value,
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
        ['cold', 'prepared', 'abandon', 'blocked', 'dispose'].map((name) =>
          h('Button', {
            text: name,
            accessibilityLabel: `preload:${name}`,
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
