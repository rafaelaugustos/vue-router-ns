// Opt-in native acceptance fixture: --env.adaptivedrawerTest.
import {
  Application,
  ApplicationSettings,
  File,
  Folder,
  Frame,
  knownFolders,
  isIOS,
  type Page,
} from '@nativescript/core'
import {
  ActionBar,
  createApp,
  defineComponent,
  h,
  nextTick,
  onBeforeUnmount,
  ref,
  type Ref,
} from 'nativescript-vue'
import {
  createRouter,
  onBeforeRouteLeave,
  RouterDrawer,
  RouterTab,
  RouterTabs,
  RouterView,
  usePageState,
  useRouter,
  type DrawerPresentation,
  type RouterDrawerHandle,
} from 'vue-router-ns'
import { observeWindowFolds, splitViewport, type WindowFold } from '../../../dist/folding'

const handle = ref<RouterDrawerHandle>()
const presentation = ref<DrawerPresentation>('auto')
const resolved = ref('overlay')
const breakpoint = ref(840)
const containerWidth = ref<number | string>('100%')
const rtl = ref(false),
  open = ref(false),
  foldAware = ref(true)
const selected = ref('home'),
  result = ref('none')
const events = { opened: 0, closed: 0, presentations: [] as string[] }
let host: any
let folds: readonly WindowFold[] = []
const captures: {
  page?: Page
  draft: Ref<string>
  blocked: Ref<boolean>
  title: string
  alive: boolean
}[] = []
let baseline:
  | {
      captures: typeof captures
      pages: unknown[]
      frames: Frame[]
      native: unknown[]
      entries: unknown[]
    }
  | undefined
const button = (text: string, onTap: () => unknown) =>
  h('Button', { text, onTap, fontSize: 14, height: 44 })
const page = (title: string, modal = false) =>
  defineComponent({
    setup() {
      const router = useRouter()
      const state: (typeof captures)[number] = {
        title,
        alive: true,
        draft: ref(''),
        blocked: ref(false),
      }
      captures.push(state)
      onBeforeUnmount(() => {
        state.alive = false
      })
      usePageState('draft', {
        save: () => state.draft.value,
        restore: (value) => {
          state.draft.value = String(value)
        },
      })
      onBeforeRouteLeave(() => false, { when: state.blocked })
      return () =>
        h(
          'Page',
          {
            backgroundColor: '#f8fafc',
            ref: (node: any) => {
              if (node) state.page = node.nativeView
            },
          },
          [
            h(ActionBar, { title }, () => [
              h('ActionItem', { text: 'Menu', onTap: () => handle.value?.open() }),
            ]),
            h('StackLayout', { padding: 16 }, [
              h('Label', {
                text: `route ${router.currentRoute.value.path}`,
                color: '#64748b',
              }),
              h('Label', { text: `result ${result.value}` }),
              h('TextField', {
                hint: 'Retained draft',
                text: state.draft.value,
                onTextChange: (event: { value: string }) => {
                  state.draft.value = event.value
                },
              }),
              button('Push detail', () => router.push('/detail')),
              button(state.blocked.value ? 'Unblock leaving' : 'Block leaving', () => {
                state.blocked.value = !state.blocked.value
              }),
              button(modal ? 'Return result' : 'Back', () =>
                router.back({ result: 'accepted' }),
              ),
            ]),
          ],
        )
    },
  })
if (isIOS && NSProcessInfo.processInfo.arguments.containsObject('adaptive-reset'))
  ApplicationSettings.remove('adaptive-state')
const router = createRouter({
  diagnostics: true,
  routes: [
    { path: '/', component: page('Adaptive navigation') },
    { path: '/detail', component: page('Your draft') },
    { path: '/settings', component: page('Settings') },
    { path: '/modal', component: page('Pending result', true), modal: true },
  ],
  restore: {
    save: (value) =>
      ApplicationSettings.setString('adaptive-state', JSON.stringify(value)),
    load: () => JSON.parse(ApplicationSettings.getString('adaptive-state', 'null')),
  },
})
async function modal() {
  result.value = 'pending'
  result.value = String(await router.pushForResult('/modal'))
}
const App = defineComponent({
  setup() {
    return () =>
      h('GridLayout', { rows: 'auto, auto, *', backgroundColor: '#e2e8f0' }, [
        h('Label', {
          text: `Native navigation · ${resolved.value}`,
          padding: '12 16',
          fontSize: 20,
          fontWeight: 'bold',
          color: '#0f172a',
        }),
        h('GridLayout', { row: 1, columns: '*, *, *, *' }, [
          ...(['auto', 'overlay', 'permanent'] as const).map((mode, col) =>
            h('Button', {
              col,
              text: mode,
              fontSize: 13,
              onTap: () => {
                presentation.value = mode
              },
            }),
          ),
          h('Button', {
            col: 3,
            text: rtl.value ? 'LTR' : 'RTL',
            fontSize: 13,
            onTap: () => {
              rtl.value = !rtl.value
            },
          }),
        ]),
        h(
          RouterDrawer,
          {
            row: 2,
            width: 280,
            style: { width: containerWidth.value },
            horizontalAlignment: 'left',
            ref: handle,
            presentation: presentation.value,
            breakpoint: breakpoint.value,
            foldAware: foldAware.value,
            direction: rtl.value ? 'rtl' : 'ltr',
            open: open.value,
            'onUpdate:open': (value: boolean) => {
              open.value = value
            },
            closeOnNavigate: false,
            onOpened: () => events.opened++,
            onClosed: () => events.closed++,
            onPresentationChange: (value: string) => {
              resolved.value = value
              events.presentations.push(value)
            },
          },
          {
            drawer: () =>
              h('StackLayout', { padding: 16, backgroundColor: '#dbeafe' }, [
                h('Label', {
                  text: 'Destinations',
                  fontSize: 24,
                  fontWeight: 'bold',
                  marginBottom: 16,
                }),
                button('Home stack', () => {
                  selected.value = 'home'
                }),
                button('Settings stack', () => {
                  selected.value = 'settings'
                }),
                button('Open result modal', modal),
                button('Close drawer', () => handle.value?.close()),
                h('Label', {
                  text: 'Same pages. Same history.',
                  textWrap: true,
                  marginTop: 24,
                  color: '#334155',
                }),
              ]),
            default: () =>
              h(
                RouterTabs,
                {
                  selected: selected.value,
                  'onUpdate:selected': (value: string) => {
                    selected.value = value
                  },
                },
                () => [
                  h(RouterTab, { name: 'home', title: 'Home' }, () =>
                    h(RouterView, { name: 'home' }),
                  ),
                  h(RouterTab, { name: 'settings', title: 'Settings' }, () =>
                    h(RouterView, { name: 'settings', initial: '/settings' }),
                  ),
                ],
              ),
          },
        ),
      ])
  },
})
createApp(App).use(router).start()
const directory = Folder.fromPath(`${knownFolders.documents().path}/adaptive`)
const commandPath = `${directory.path}/command.json`
const output = File.fromPath(`${directory.path}/result.json`)
const pause = (ms = 500) => new Promise((resolve) => setTimeout(resolve, ms))
let busy = false
function findHost() {
  const visit = (view: any) => {
    if (typeof view.openDrawer === 'function') host = view
    view.eachChildView?.((child: any) => {
      visit(child)
      return true
    })
  }
  visit(Application.getRootView())
}
function frames() {
  const found: Frame[] = []
  const visit = (view: any) => {
    if (view instanceof Frame) found.push(view)
    view.eachChildView?.((child: any) => {
      visit(child)
      return true
    })
  }
  visit(host)
  return found
}
function entries() {
  return router
    .diagnostics!.snapshot()
    .stacks.filter((stack) => !stack.modal)
    .map((stack) => ({
      id: stack.id,
      logical: stack.logical.map(({ active: _active, ...entry }) => entry),
      native: stack.native.map((item) => ({ id: item.id, entries: item.entries })),
    }))
}
setInterval(async () => {
  if (busy || !handle.value || !File.exists(commandPath)) return
  busy = true
  let id: unknown
  try {
    const request = JSON.parse(File.fromPath(commandPath).readTextSync())
    File.fromPath(commandPath).removeSync()
    id = request.id
    if (!host) {
      findHost()
      observeWindowFolds(host, (value) => {
        folds = value
      })
    }
    switch (request.action) {
      case 'mode':
        presentation.value = request.value
        break
      case 'resize':
        containerWidth.value = request.value
        break
      case 'breakpoint':
        breakpoint.value = request.value
        break
      case 'foldAware':
        foldAware.value = request.value
        break
      case 'rtl':
        rtl.value = request.value
        break
      case 'open':
        handle.value.open()
        break
      case 'close':
        handle.value.close()
        break
      case 'model':
        open.value = request.value
        break
      case 'interrupt':
        handle.value.open()
        await pause(40)
        presentation.value = 'permanent'
        break
      case 'modal':
        void modal()
        break
      case 'back':
        await router.back({ result: 'accepted' })
        break
      case 'guard':
        captures
          .filter((state) => state.page?.frame?.currentPage === state.page)
          .forEach((state) => {
            state.blocked.value = request.value
          })
        break
      case 'push':
        await router.push('/detail', { frame: request.value ?? 'home' })
        break
      case 'select':
        selected.value = request.value
        break
      case 'draft':
        captures
          .filter((state) => state.page?.frame?.currentPage === state.page)
          .forEach((state) => {
            state.draft.value = request.value
          })
        break
      case 'remember': {
        const current = frames()
        baseline = {
          captures: [...captures],
          pages: captures.map((state) => state.page),
          frames: current,
          native: current.map((frame) => frame.nativeViewProtected),
          entries: entries(),
        }
        break
      }
      case 'escape':
        if (isIOS) host.nativeViewProtected.accessibilityPerformEscape()
        break
    }
    await nextTick()
    await pause()
    resolved.value = handle.value.presentation
    const current = frames()
    const residentPages = current.flatMap((frame) => [
      frame.currentPage,
      ...frame.backStack.map((entry) => entry.resolvedPage),
    ])
    const native = host.nativeViewProtected
    const pane = host.getChildAt(1).nativeViewProtected
    const content = host.getChildAt(0).nativeViewProtected
    output.writeTextSync(
      JSON.stringify({
        id,
        reduceMotion: isIOS && UIAccessibilityIsReduceMotionEnabled(),
        mode: handle.value.presentation,
        open: handle.value.isOpen,
        model: open.value,
        result: result.value,
        events,
        geometry: host.drawerGeometry,
        viewport: splitViewport(host),
        folds,
        preserved:
          !baseline ||
          (baseline.captures.every(
            (state, i) =>
              state.alive &&
              state === captures[i] &&
              state.page === baseline!.pages[i] &&
              state.page !== undefined &&
              residentPages.includes(state.page),
          ) &&
            baseline.frames.every(
              (frame, i) =>
                frame === current[i] && frame.nativeViewProtected === baseline!.native[i],
            )),
        entries: entries(),
        entriesPreserved:
          !baseline || JSON.stringify(entries()) === JSON.stringify(baseline.entries),
        drafts: captures.map((state) => ({
          title: state.title,
          value: state.draft.value,
        })),
        issues: router.diagnostics!.snapshot().issues,
        contentHidden: isIOS
          ? content.accessibilityElementsHidden
          : content.getImportantForAccessibility() === 4,
        paneHidden: isIOS
          ? pane.accessibilityElementsHidden
          : pane.getImportantForAccessibility() === 4,
        paneVisible: isIOS ? !pane.hidden : pane.getVisibility() === 0,
        modalPane: isIOS ? pane.accessibilityViewIsModal : null,
        recognizers: isIOS ? native.gestureRecognizers.count : null,
        contentBounds: isIOS
          ? { x: content.frame.origin.x, width: content.bounds.size.width }
          : { x: content.getLeft(), width: content.getWidth() },
        paneBounds: isIOS
          ? { x: pane.frame.origin.x, width: pane.bounds.size.width }
          : { x: pane.getLeft(), width: pane.getWidth() },
      }),
    )
  } catch (error) {
    output.writeTextSync(JSON.stringify({ id, error: String(error) }))
  } finally {
    busy = false
  }
}, 100)
