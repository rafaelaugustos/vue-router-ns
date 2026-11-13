// Opt-in acceptance fixture: ns build ios --env.historyTest --no-hmr.
import { File, Frame, knownFolders, type Page } from '@nativescript/core'
import {
  ActionBar,
  createApp,
  defineComponent,
  h,
  nextTick,
  onUnmounted,
  ref,
} from 'nativescript-vue'
import {
  createRouter,
  NavigationFailureType,
  RouterView,
  useRoute,
  useRouter,
  type NavigationHistoryEntry,
} from 'vue-router-ns'

const status = ref('READY')
const detail = ref('Two stacks. Two identical routes. One exact destination.')
const visible = ref(true)
const frames: Record<string, Frame> = {}
const checks: string[] = []
const lifetimes: { instance: number; path: string; event: string }[] = []
const results: { label: string; value: unknown }[] = []
const errors: string[] = []
let sequence = 0,
  busy = false,
  block = false
let older: NavigationHistoryEntry, stale: NavigationHistoryEntry
let olderPage: Page, archivePages: Page[], beforeGesture: Page[]
let observer: NSObject | undefined,
  gestureEvents = 0,
  gesturePeak = 0
const pause = () => new Promise<void>((resolve) => setTimeout(resolve, 25))
async function until(test: () => unknown) {
  const end = Date.now() + 10000
  while (!test()) {
    if (Date.now() > end) throw new Error('Native state did not settle')
    await pause()
  }
}
function check(ok: unknown, name: string): asserts ok {
  if (!ok) throw new Error(name)
  checks.push(name)
}
const pages = (name: string) => {
  const frame = frames[name]
  return frame
    ? [...frame.backStack.map((e) => e.resolvedPage), frame.currentPage].filter(
        (p): p is Page => !!p,
      )
    : []
}
const same = (a: readonly unknown[], b: readonly unknown[]) =>
  a.length === b.length && a.every((value, i) => value === b[i])
const Screen = defineComponent({
  setup() {
    const route = useRoute()
    const bound = useRouter()
    const instance = ++sequence
    lifetimes.push({ instance, path: route.fullPath, event: 'setup' })
    onUnmounted(() =>
      lifetimes.push({ instance, path: route.fullPath, event: 'unmounted' }),
    )
    return () =>
      h('Page', { backgroundColor: '#f4f7fb' }, [
        h(ActionBar, {
          title:
            route.path === '/item'
              ? 'Item'
              : route.path === '/'
                ? 'Home'
                : route.path.slice(1),
        }),
        h('StackLayout', { padding: 26 }, [
          h('Label', {
            text:
              route.path === '/item'
                ? 'Same route, own identity'
                : 'Retained native page',
            fontSize: 24,
            fontWeight: 'bold',
            textWrap: true,
            color: '#132c49',
          }),
          h('Label', {
            id: 'history-path',
            text: route.fullPath,
            fontSize: 21,
            marginTop: 20,
            color: '#17656c',
          }),
          h('Label', {
            id: 'history-instance',
            text: `Page instance ${instance}`,
            fontSize: 18,
            marginTop: 10,
          }),
          h('Label', {
            text: `${bound.history.value?.scope.name ?? 'Loading'} · ${bound.history.value?.entries.length ?? 0} retained entries`,
            fontSize: 16,
            marginTop: 20,
            textWrap: true,
          }),
          h('Label', {
            text: 'Back keeps this page alive. A repeated path creates a different entry.',
            fontSize: 16,
            textWrap: true,
            marginTop: 24,
            color: '#53677e',
          }),
        ]),
      ])
  },
})
const router = createRouter({
  routes: ['/', '/item', '/between', '/last'].map((path) => ({
    path,
    component: Screen,
  })),
  diagnostics: true,
  motion: 'full',
})
router.beforeEach((_to, _from, info) =>
  info.type === 'back' && block ? false : undefined,
)
const history = (name: string) => router.getHistory({ frame: name })!
async function pushResult(path: string, label: string, animated = false) {
  const length = history('inbox').entries.length
  void router
    .pushForResult(path, { frame: 'inbox', animated })
    .then((value) => results.push({ label, value }))
  await until(() => history('inbox').entries.length === length + 1)
}
function observe() {
  const Observer = (NSObject as any).extend(
    {
      observe(recognizer: UIPanGestureRecognizer) {
        if (
          recognizer.state === UIGestureRecognizerState.Began ||
          recognizer.state === UIGestureRecognizerState.Changed
        ) {
          gestureEvents++
          gesturePeak = Math.max(
            gesturePeak,
            recognizer.translationInView(recognizer.view).x /
              recognizer.view!.bounds.size.width,
          )
        }
      },
    },
    {
      exposedMethods: {
        observe: { returns: interop.types.void, params: [UIGestureRecognizer] },
      },
    },
  )
  observer = Observer.new()
  frames.inbox!.ios.controller.interactivePopGestureRecognizer.addTargetAction(
    observer,
    'observe',
  )
}
async function command(name: string) {
  if (busy) return
  busy = true
  let error: unknown
  try {
    if (name === 'seed') {
      await until(
        () => history('inbox')?.entries.length && history('archive')?.entries.length,
      )
      await router.push('/item', { frame: 'inbox', animated: false })
      older = history('inbox').entries[1]!
      olderPage = pages('inbox')[1]!
      await pushResult('/between', 'between')
      await pushResult('/item', 'newer duplicate')
      stale = history('inbox').entries[3]!
      await pushResult('/last', 'last')
      await router.setStack(['/', '/item', '/last'], {
        frame: 'archive',
        animated: false,
      })
      archivePages = pages('archive')
      check(
        older.route.fullPath === stale.route.fullPath && older.id !== stale.id,
        'duplicate routes have distinct live addresses',
      )
      check(
        pages('inbox').length === 5 && archivePages.length === 3,
        'both native stacks match retained history',
      )
      check(
        router.history.value!.scope.name === 'archive',
        'other stack owns focus before selection',
      )
      block = true
      detail.value = 'Inbox contains two /item entries. Archive currently owns focus.'
    } else if (name === 'blocked') {
      const before = pages('inbox')
      check(
        (await router.backToEntry(older))?.type === NavigationFailureType.aborted,
        'guard refuses exact selection',
      )
      check(
        same(pages('inbox'), before) && results.length === 0,
        'refused selection preserves native pages and pending results',
      )
      detail.value = 'Guard refused: both stacks and all pending results are unchanged.'
    } else if (name === 'jump') {
      block = false
      check(
        (await router.backToEntry(older, { result: 'chosen' })) === undefined,
        'exact selection completes',
      )
      await nextTick()
      check(
        pages('inbox').length === 2 && pages('inbox')[1] === olderPage,
        'older duplicate keeps its original native Page',
      )
      check(
        history('inbox').entries[1]!.id === older.id,
        'logical address still identifies the retained Page',
      )
      check(
        same(pages('archive'), archivePages),
        'other stack preserves every native Page',
      )
      check(
        results.length === 3 &&
          results.filter((r) => r.value === 'chosen').length === 1 &&
          results.find((r) => r.value === 'chosen')?.label === 'last',
        'removed results settle once, only top receives chosen value',
      )
      detail.value =
        'Returned to the FIRST /item. Three pages closed. Archive is unchanged.'
    } else if (name === 'stale') {
      await router.push('/item', { frame: 'inbox', animated: false }) // duplicate is deliberately rejected
      const before = pages('inbox')
      let rejected = false
      try {
        await router.backToEntry(stale)
      } catch {
        rejected = true
      }
      check(
        rejected && same(pages('inbox'), before),
        'removed address cannot select the surviving identical path',
      )
      detail.value =
        'The removed /item address is rejected. It cannot select another occurrence.'
    } else if (name === 'prepare') {
      await pushResult('/last', 'gesture', true)
      beforeGesture = pages('inbox')
      observe()
      detail.value = 'Native swipe next: cancellation must retain all entry identities.'
    } else if (name === 'cancelled') {
      check(
        gestureEvents > 0 && gesturePeak > 0.2,
        'cancelled swipe moved a real UIKit transition',
      )
      check(
        same(pages('inbox'), beforeGesture) &&
          history('inbox').entries.length === 3 &&
          results.length === 3,
        'cancelled native swipe preserves history and results',
      )
      gestureEvents = 0
      gesturePeak = 0
      detail.value = 'Swipe cancelled: all native Pages, addresses and results remain.'
    } else if (name === 'native') {
      await until(() => history('inbox').entries.length === 2)
      check(
        gestureEvents > 0 && gesturePeak > 0.5,
        'committed swipe moved a real UIKit transition',
      )
      check(
        pages('inbox')[1] === olderPage && history('inbox').entries[1]!.id === older.id,
        'native Back reconciles the same retained identity',
      )
      check(
        results.length === 4 && results.filter((r) => r.label === 'gesture').length === 1,
        'native Back settles its result once',
      )
      check(
        same(pages('archive'), archivePages),
        'native Back leaves the other stack unchanged',
      )
      detail.value =
        'Native Back committed: history reconciled; the original /item still lives.'
    } else if (name === 'dispose') {
      frames.inbox!.ios.controller.interactivePopGestureRecognizer.removeTargetAction(
        observer,
        'observe',
      )
      observer = undefined
      visible.value = false
      await nextTick()
      check(
        router.history.value === undefined && !router.getHistory({ frame: 'archive' }),
        'owner disposal removes both public histories',
      )
      let rejected = false
      try {
        await router.backToEntry(older)
      } catch {
        rejected = true
      }
      check(rejected, 'closed owner invalidates its saved selection')
      const mounted = lifetimes.filter((e) => e.event === 'setup')
      check(
        mounted.every(
          (e) =>
            lifetimes.filter((x) => x.instance === e.instance && x.event === 'unmounted')
              .length === 1,
        ),
        'every destination app unmounts exactly once',
      )
      check(
        errors.length === 0 && router.diagnostics!.snapshot().issues.length === 0,
        'no Vue or reconciliation errors',
      )
      detail.value =
        'Both owners closed. Every page unmounted once. Old addresses are invalid.'
    }
  } catch (caught) {
    error = caught
  }
  const report = {
    command: name,
    ok: !error,
    error: error ? String(error) : undefined,
    checks: [...checks],
    results: [...results],
    lifetimes: [...lifetimes],
    errors,
    history: {
      inbox: router.getHistory({ frame: 'inbox' }),
      archive: router.getHistory({ frame: 'archive' }),
    },
    native: Object.fromEntries(
      ['inbox', 'archive'].map((name) => [name, pages(name).map((p) => p._domId)]),
    ),
    gestureEvents,
    gesturePeak,
  }
  File.fromPath(`${knownFolders.documents().path}/history-${name}.json`).writeTextSync(
    JSON.stringify(report),
  )
  status.value = `${error ? 'FAIL' : 'PASS'} ${name}`
  if (error) detail.value = String(error)
  busy = false
}
const commands = [
  'seed',
  'blocked',
  'jump',
  'stale',
  'prepare',
  'cancelled',
  'native',
  'dispose',
]
const app = createApp({
  render: () =>
    h('GridLayout', { rows: 'auto, auto, *', backgroundColor: '#e7edf5' }, [
      h('StackLayout', { padding: '24 20 8 20' }, [
        h('Label', {
          text: 'Retained navigation history',
          fontSize: 29,
          fontWeight: 'bold',
          color: '#132c49',
        }),
        h('Label', { text: detail.value, fontSize: 16, textWrap: true, marginTop: 8 }),
        h('Label', { text: status.value, fontSize: 16, color: '#17656c', marginTop: 8 }),
      ]),
      h(
        'WrapLayout',
        { row: 1, padding: '4 12 12 12' },
        commands.map((name) =>
          h('Button', {
            text: name,
            accessibilityIdentifier: `history:${name}`,
            width: 120,
            height: 42,
            fontSize: 15,
            margin: 3,
            onTap: () => void command(name),
          }),
        ),
      ),
      visible.value
        ? h(
            'GridLayout',
            { row: 2, columns: '*, *' },
            ['inbox', 'archive'].map((name, col) =>
              h('GridLayout', { col, rows: 'auto, *' }, [
                h('StackLayout', { padding: 16 }, [
                  h('Label', {
                    text: name.toUpperCase(),
                    fontWeight: 'bold',
                    fontSize: 20,
                    color: '#132c49',
                  }),
                  h('Label', {
                    text:
                      history(name)
                        ?.entries.map(
                          (e) => `${e.id.split(':').at(-1)}  ${e.route.fullPath}`,
                        )
                        .join('  →  ') ?? 'Closed',
                    fontSize: 15,
                    textWrap: true,
                    marginTop: 8,
                    color: '#53677e',
                  }),
                ]),
                h(RouterView, {
                  row: 1,
                  name,
                  onLoaded: (event: { object: Frame }) => {
                    frames[name] = event.object
                  },
                }),
              ]),
            ),
          )
        : h('Label', {
            row: 2,
            text: 'All native page owners released',
            horizontalAlignment: 'center',
            verticalAlignment: 'middle',
            fontSize: 24,
            color: '#17656c',
          }),
    ]),
})
app.config.errorHandler = (error) => errors.push(String(error))
app.use(router).start()
