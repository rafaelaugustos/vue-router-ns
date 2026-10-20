// Native acceptance fixture: ns build ios --env.uikitsplitTest.
import {
  ApplicationSettings,
  File,
  Frame,
  knownFolders,
  type Page,
  type SplitView,
} from '@nativescript/core'
import {
  ActionBar,
  createApp,
  defineComponent,
  h,
  onMounted,
  ref,
  shallowRef,
} from 'nativescript-vue'
import {
  createRouter,
  RouterUIKitSplitView,
  useRoute,
  onBeforeRouteLeave,
  usePageState,
  useRouter,
  type Router,
} from 'vue-router-ns'

const status = ref('starting')
const blocked = ref(false)
const checks: string[] = []
const drafts = new Map<string, ReturnType<typeof ref<string>>>()
let guardAttempts = 0
let guardStart = 0
let stackRouter: Router<any>
let split: SplitView
let primary: Frame
let secondary: Frame
let number = 0
let reportNumber = 0
let busy = false
let modalResults = 0
let modalResult: unknown
const pageIds = new WeakMap<Page, number>()
let pageSequence = 0
let pinned: Page | undefined
let retained: Page[] = []
const pause = (ms: number) => new Promise<void>((done) => setTimeout(done, ms))
const commands = [
  'push',
  'back',
  'capture',
  'guard',
  'guarded',
  'modal',
  'close',
  'hold',
  'identities',
  'replace',
  'clear',
  'restore',
  'restored',
]
function check(name: string, condition: unknown) {
  if (!condition) throw new Error(name)
  checks.push(name)
}
function nativePages(frame: Frame) {
  return [
    ...frame.backStack.map((entry) => entry.resolvedPage),
    frame.currentPage,
  ].filter(Boolean) as Page[]
}
const Screen = defineComponent({
  setup() {
    const route = useRoute()
    const owned = useRouter()
    if (route.path === '/') stackRouter = owned
    const draft = ref('')
    drafts.set(route.path, draft)
    usePageState<string>('draft', {
      version: 1,
      save: () => draft.value,
      restore: (value) => {
        draft.value = value
      },
    })
    onBeforeRouteLeave(
      () => {
        guardAttempts++
        return !blocked.value
      },
      { when: blocked },
    )
    return () =>
      h('Page', { automationText: `page:${route.path}`, backgroundColor: '#ffffff' }, [
        h(ActionBar, { title: route.path }, [
          h('ActionItem', {
            text: 'App action',
            'ios.position': 'right',
            automationText: 'app-action',
          }),
        ]),
        h('StackLayout', { padding: 16 }, [
          h('Label', { text: route.path, automationText: `heading:${route.path}` }),
          h('Label', { text: status.value, textWrap: true }),
          h('Label', { text: draft.value, automationText: `draft:${route.path}` }),
          h(
            'GridLayout',
            {
              columns: '*,*',
              rows: Array(Math.ceil(commands.length / 2))
                .fill('28')
                .join(','),
            },
            commands.map((command, index) =>
              h('Button', {
                col: index % 2,
                row: Math.floor(index / 2),
                height: 28,
                fontSize: 12,
                text: command,
                automationText: `split:${route.path}:${command}`,
                onTap: () => void run(command, owned),
              }),
            ),
          ),
        ]),
      ])
  },
})
const router = createRouter({
  diagnostics: { maxEvents: 1000 },
  routes: [
    { path: '/', component: Screen },
    { path: '/detail/:id', component: Screen },
    { path: '/modal', component: Screen, modal: true },
  ],
  restore: {
    load: () => JSON.parse(ApplicationSettings.getString('split-history', 'null')),
    save: (state) =>
      ApplicationSettings.setString('split-history', JSON.stringify(state)),
  },
})
function report(command: string, error?: unknown) {
  const controller = split?.viewController as UISplitViewController
  const frame = (value: Frame) => ({
    loaded: value?.isLoaded,
    pages: nativePages(value).map((page) => {
      if (!pageIds.has(page)) pageIds.set(page, ++pageSequence)
      return { path: page.automationText, id: pageIds.get(page) }
    }),
    controllers: value?.ios?.controller?.viewControllers?.count,
    parent: String(value?.ios?.controller?.parentViewController),
  })
  const data = {
    command,
    sequence: ++reportNumber,
    pid: NSProcessInfo.processInfo.processIdentifier,
    error: error ? String(error) : undefined,
    checks: [...checks],
    collapsed: controller?.collapsed,
    displayMode: controller?.displayMode,
    width: controller?.view?.window?.bounds.size.width,
    height: controller?.view?.window?.bounds.size.height,
    splitRoot: controller?.view?.window?.rootViewController === controller,
    primary: frame(primary),
    secondary: frame(secondary),
    paths: stackRouter.stack.value.map((entry) => entry.fullPath),
    blocked: blocked.value,
    guardAttempts,
    modalResults,
    drafts: Object.fromEntries([...drafts].map(([key, value]) => [key, value.value])),
    diagnostics: router.diagnostics!.snapshot(),
  }
  const path = `${knownFolders.documents().path}/uikitsplit-${data.pid}-${reportNumber}.json`
  File.fromPath(path).writeTextSync(JSON.stringify(data, null, 2), (error) => {
    throw error
  })
  status.value = error ? `FAIL ${command}: ${error}` : `PASS ${command}`
  console.log('UIKIT_SPLIT', JSON.stringify(data))
}
function history() {
  const pages = [
    ...nativePages(primary),
    ...nativePages(secondary).filter((page) => page.automationText),
  ]
  const paths = pages.map((page) => page.automationText.slice(5))
  const routes = stackRouter.stack.value
    .filter((entry) => entry.path !== '/modal')
    .map((entry) => entry.fullPath)
  check(
    'logical history matches the native Frames',
    JSON.stringify(paths) === JSON.stringify(routes),
  )
  check('native Pages are unique', new Set(pages).size === pages.length)
  check('the pinned list Page is retained', primary.currentPage === pinned)
  for (const frame of [primary, secondary]) {
    const controllers = frame.ios.controller.viewControllers
    for (const page of nativePages(frame))
      check(
        'each Page stays in its owning UINavigationController',
        controllers.containsObject(page.ios),
      )
  }
  check(
    'SplitView owns the window root',
    split.viewController.view.window.rootViewController === split.viewController,
  )
}
async function run(command: string, owned: Router<any> = router) {
  if (busy) return
  busy = true
  try {
    status.value = `RUN ${command}`
    if (command === 'push') await router.push(`/detail/${++number}`)
    else if (command === 'back') await owned.back()
    else if (command === 'guard') {
      blocked.value = !blocked.value
      guardStart = guardAttempts
    } else if (command === 'guarded')
      check(
        'native dismissal reaches and is refused by the guard',
        blocked.value && guardAttempts > guardStart,
      )
    else if (command === 'modal') {
      blocked.value = false
      void router.pushForResult('/modal').then((value) => {
        modalResults++
        modalResult = value
      })
      for (let i = 0; i < 100 && router.currentRoute.value.path !== '/modal'; i++)
        await pause(50)
      check('modal is presented', router.currentRoute.value.path === '/modal')
      guardStart = guardAttempts
      blocked.value = true
    } else if (command === 'close') {
      blocked.value = false
      await owned.back({ result: 'split-result' })
      await pause(100)
      check(
        'modal result settles once',
        modalResults === 1 && modalResult === 'split-result',
      )
    } else if (command === 'hold') {
      retained = [...nativePages(primary), ...nativePages(secondary)]
      drafts.get(router.currentRoute.value.path)!.value = 'retained draft'
    } else if (command === 'identities') {
      const now = [...nativePages(primary), ...nativePages(secondary)]
      check(
        'column adaptation preserves every Page identity',
        retained.length === now.length &&
          retained.every((page, index) => page === now[index]),
      )
      check(
        'column adaptation preserves the draft',
        drafts.get(router.currentRoute.value.path)?.value === 'retained draft',
      )
    } else if (command === 'replace') {
      await router.replace('/detail/replaced')
      check(
        'replace removes the former detail',
        stackRouter.stack.value.at(-1)?.path === '/detail/replaced',
      )
    } else if (command === 'clear') {
      await router.push('/detail/cleared', { clearHistory: true })
      check(
        'clearHistory retains only list and new detail',
        stackRouter.stack.value.length === 2,
      )
    } else if (command === 'restore') {
      await router.backToRoot({ animated: false })
      await router.push('/detail/saved', { animated: false })
      drafts.get('/detail/saved')!.value = 'saved draft'
      await router.push('/detail/top', { animated: false })
      ApplicationSettings.setNumber(
        'split-old-pid',
        NSProcessInfo.processInfo.processIdentifier,
      )
    } else if (command === 'restored') {
      check(
        'restoration runs in another process',
        NSProcessInfo.processInfo.processIdentifier !==
          ApplicationSettings.getNumber('split-old-pid'),
      )
      check(
        'restored history has exactly three Pages',
        JSON.stringify(stackRouter.stack.value.map((entry) => entry.path)) ===
          JSON.stringify(['/', '/detail/saved', '/detail/top']),
      )
      await router.back({ animated: false })
      check(
        'restored Page draft is recovered',
        drafts.get('/detail/saved')?.value === 'saved draft',
      )
    }
    await pause(450)
    history()
    report(command)
  } catch (error) {
    report(command, error)
  } finally {
    busy = false
  }
}
const App = defineComponent({
  setup() {
    const view = shallowRef<any>()
    onMounted(() => {
      split = view.value.$el.nativeView
      primary = split.getChildAt(0) as Frame
      secondary = split.getChildAt(1) as Frame
    })
    return () => h(RouterUIKitSplitView, { ref: view, list: '/' })
  },
})
createApp(App).use(router).start()
void router
  .isReady()
  .then(async () => {
    await pause(700)
    pinned = primary.currentPage
    history()
    report('ready')
  })
  .catch((error) => report('ready', error))
