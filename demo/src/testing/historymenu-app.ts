// Opt-in real iOS/Android menu fixture: --env.historymenuTest --no-hmr.
import {
  ActionItem,
  Dialogs,
  File,
  Frame,
  knownFolders,
  type Page,
  type View,
} from '@nativescript/core'
import { ActionBar, createApp, defineComponent, h, nextTick, ref } from 'nativescript-vue'
import {
  createRouter,
  onBeforeRouteLeave,
  RouterView,
  useRouter,
  useRoute,
  useBackHistoryMenu,
  useNavigationCommands,
  NavigationCommandScope,
  type BackHistoryMenu,
} from 'vue-router-ns'

const status = ref('READY'),
  detail = ref('Hold Back, or open history with the keyboard.')
const visible = ref(true),
  frames: Record<string, Frame> = {},
  menus: Record<string, BackHistoryMenu> = {}
const sources: Record<string, View> = {},
  checks: string[] = [],
  errors: string[] = []
declare const __HISTORY_GUARDS__: boolean
const block = ref(false),
  guardOnly = ref<string | null>(null)
let confirmChoice = false,
  toolsTapped = 0,
  callsBeforeSingle = 0
const guardCalls: string[] = []
let older: Page,
  archive: Page[],
  before: string[],
  sequence = 0
const pages = (name: string) =>
  [
    ...frames[name]!.backStack.map((e) => e.resolvedPage),
    frames[name]!.currentPage,
  ] as Page[]
const ids = () => router.getHistory({ frame: 'inbox' })!.entries.map((e) => e.id)
const same = (a: readonly unknown[], b: readonly unknown[]) =>
  a.length === b.length && a.every((x, i) => x === b[i])
function check(ok: unknown, label: string) {
  if (!ok) throw new Error(label)
  checks.push(label)
}
const Screen = defineComponent({
  setup() {
    const bound = useRouter(),
      route = useRoute(),
      instance = ++sequence
    onBeforeRouteLeave(
      () => {
        guardCalls.push(route.path)
        return confirmChoice
          ? Dialogs.confirm({
              title: 'Leave protected page?',
              message: route.path,
              okButtonText: 'Leave',
              cancelButtonText: 'Stay',
            })
          : false
      },
      { when: () => block.value && (!guardOnly.value || route.path === guardOnly.value) },
    )
    const menu = useBackHistoryMenu({
      title: 'Retained history',
      cancelTitle: 'Cancel',
      label: (entry, index) =>
        `${entry.route.path === '/' ? 'Home' : entry.route.path.slice(1)} · visit ${index + 1}`,
      onError: (error) => errors.push(String(error)),
    })
    let source: View
    const open = () => menu.show(source)
    const commands = useNavigationCommands([
      {
        id: 'history',
        title: 'Back history',
        shortcut: { input: 'h', modifiers: ['ctrl'] },
        action: open,
      },
      { id: 'escape', title: 'Close', shortcut: { input: 'Escape' }, action: 'back' },
    ])
    return () =>
      h('Page', { backgroundColor: '#f4f7fb' }, [
        h(ActionBar, { title: route.path === '/' ? 'Home' : route.path.slice(1) }),
        h(NavigationCommandScope, { commands }, () =>
          h('StackLayout', { padding: 20 }, [
            h('Label', {
              text: `${bound.history.value?.scope.name ?? '…'} · ${route.fullPath}`,
              fontSize: 24,
              fontWeight: 'bold',
              color: '#132c49',
              textWrap: true,
            }),
            h('Label', {
              text: `Original Page ${instance}`,
              fontSize: 20,
              marginTop: 12,
            }),
            h('Label', {
              text: `${bound.history.value?.entries.length ?? 0} retained entries`,
              fontSize: 18,
              marginTop: 12,
            }),
            h('Button', {
              text: '‹ Back (hold for history)',
              accessibilityLabel: `menu-back:${bound.history.value?.scope.name}`,
              accessible: true,
              minHeight: 48,
              marginTop: 20,
              onLoaded: (event: { object: View }) => {
                source = event.object
                const name = bound.getHistory()!.scope.name
                menus[name] = menu
                sources[name] = source
                commands.focus()
              },
              onTap: () => {
                if (!menu.active.value) void bound.back()
              },
              onLongPress: open,
            }),
            h('Button', {
              text: 'Show history · Ctrl H',
              accessibilityLabel: `menu-open:${bound.history.value?.scope.name}`,
              accessible: true,
              minHeight: 48,
              onTap: open,
            }),
            h('Label', {
              text: menu.active.value ? 'History open' : 'History closed',
              fontSize: 16,
              marginTop: 12,
            }),
            h('Label', {
              text: 'Menu labels identify each visit. Selecting an older duplicate keeps its original Page.',
              fontSize: 16,
              textWrap: true,
              marginTop: 20,
              color: '#53677e',
            }),
          ]),
        ),
      ])
  },
})
const router = createRouter({
  routes: ['/', '/item', '/between', '/last', '/next'].map((path) => ({
    path,
    component: Screen,
  })),
  diagnostics: true,
})
router.beforeEach((_to, _from, info) =>
  info.type === 'back' && block.value && !__HISTORY_GUARDS__ ? false : undefined,
)
async function command(name: string) {
  status.value = `RUN ${name}`
  let error: unknown
  try {
    if (name === 'seed') {
      block.value = false
      confirmChoice = false
      guardOnly.value = null
      for (const frame of ['inbox', 'archive']) {
        await router.backToRoot({ frame, animated: false })
        for (const path of frame === 'inbox'
          ? ['/item', '/between', '/item', '/last']
          : ['/item', '/last'])
          await router.push(path, { frame, animated: false })
      }
      older = pages('inbox')[1]!
      archive = pages('archive')
      before = ids()
      check(before.length === 5, 'five retained inbox entries')
      detail.value = 'Inbox has two /item visits; Archive owns the last navigation.'
    } else if (name === 'protect') {
      guardOnly.value = '/between'
      block.value = true
      detail.value = 'Only /between is protected. The current page has no active guard.'
    } else if (name === 'protected') {
      check(
        same(ids(), before) && same(pages('archive'), archive),
        'guarded native history preserves both stacks',
      )
      check(guardCalls.length > 0, 'native history invokes the page leave guard')
    } else if (name === 'confirm') {
      confirmChoice = true
      detail.value = 'The covered page asks before leaving. Stay refuses; Leave allows.'
    } else if (name === 'header') {
      const bar = frames.inbox!.currentPage!.actionBar
      const action = new ActionItem()
      action.text = 'Tools'
      action.ios.position = 'left'
      action.on('tap', () => {
        toolsTapped++
      })
      bar.actionItems.addItem(action)
      bar.title = 'Edited header'
      detail.value = 'App changed the header. Tools and guarded Back must both work.'
    } else if (name === 'header-ok') {
      check(toolsTapped === 1, 'app-owned header action survives guarded Back updates')
    } else if (name === 'arm') {
      callsBeforeSingle = guardCalls.length
      setTimeout(() => {
        guardOnly.value = '/between'
        block.value = true
        detail.value = 'Guard activated while native history was open'
      }, 6500)
      detail.value =
        'Open native Back history now. A guard will activate while it is open.'
    } else if (name === 'single') {
      check(
        ids().length === 4 && guardCalls.length === callsBeforeSingle,
        'short Back removes only the unguarded top',
      )
      check(same(pages('archive'), archive), 'short Back keeps Archive unchanged')
    } else if (name === 'handoff') {
      block.value = false
      await nextTick()
      detail.value =
        'Guards are inactive: the original UIKit Back and history are restored.'
    } else if (name === 'teardown') {
      block.value = true
      await new Promise((resolve) => setTimeout(resolve, 2500))
      visible.value = false
      await nextTick()
      check(
        !router.history.value && !router.getHistory({ frame: 'inbox' }),
        'owner disposal removes guarded history',
      )
      check(
        errors.length === 0 && router.diagnostics!.snapshot().issues.length === 0,
        'guarded native flow has no Vue or reconciliation errors',
      )
    } else if (name === 'unchanged') {
      check(
        same(ids(), before) && same(pages('archive'), archive),
        'opening and dismissing preserve both stacks',
      )
      check(!menus.inbox!.active.value, 'native dismissal clears active state')
    } else if (name === 'guard') {
      block.value = true
      detail.value =
        'Guard enabled: choose any history entry; both stacks must stay intact.'
    } else if (name === 'refused') {
      check(same(ids(), before), 'guard refused menu selection without popping')
      check(!menus.inbox!.active.value, 'refused selection closes menu')
      block.value = false
    } else if (name === 'selected') {
      check(
        ids().length === 2 && pages('inbox')[1] === older,
        'selected first duplicate retains original native Page',
      )
      check(same(pages('archive'), archive), 'selection leaves every Archive Page intact')
      detail.value = 'Selected visit 2, the FIRST /item. Archive is unchanged.'
    } else if (name === 'invalidate') {
      check(menus.inbox!.show(sources.inbox!), 'menu opens before concurrent push')
      await new Promise((resolve) => setTimeout(resolve, 900))
      await router.push('/next', { frame: 'inbox' })
      check(!menus.inbox!.active.value, 'concurrent navigation dismisses old menu')
    } else if (name === 'native') {
      check(ids().length === 3, 'UIKit Back history selection reconciles native entries')
      detail.value =
        'UIKit’s original Back history still works and reconciles retained entries.'
    } else if (name === 'dispose') {
      const old = menus.inbox!,
        source = sources.inbox!
      check(old.show(source), 'menu opens before owner disposal')
      await new Promise((resolve) => setTimeout(resolve, 600))
      visible.value = false
      await nextTick()
      check(
        !old.active.value && !old.show(source),
        'disposed owner closes and cannot reopen menu',
      )
      check(
        errors.length === 0 && router.diagnostics!.snapshot().issues.length === 0,
        'no Vue or reconciliation errors',
      )
    }
  } catch (caught) {
    error = caught
  }
  await File.fromPath(`${knownFolders.documents().path}/history-${name}.json`).writeText(
    JSON.stringify(
      {
        command: name,
        ok: !error,
        error: error ? String(error) : undefined,
        checks,
        errors,
        guardCalls: [...guardCalls],
        toolsTapped,
        history: {
          inbox: router.getHistory({ frame: 'inbox' }),
          archive: router.getHistory({ frame: 'archive' }),
        },
      },
      null,
      2,
    ),
  )
  status.value = `${error ? 'FAIL' : 'PASS'} ${name}`
}
const App = defineComponent({
  setup: () => () =>
    h('GridLayout', { rows: 'auto,auto,auto,*', backgroundColor: '#e6edf5' }, [
      h('Label', {
        row: 0,
        text: status.value,
        fontSize: 20,
        fontWeight: 'bold',
        margin: '10 20',
        color: '#17656c',
      }),
      h('Label', {
        row: 1,
        text: detail.value,
        textWrap: true,
        margin: '0 20 8',
        fontSize: 16,
      }),
      h(
        'WrapLayout',
        { row: 2, margin: '0 12 8' },
        (__HISTORY_GUARDS__
          ? [
              'seed',
              'guard',
              'protect',
              'protected',
              'header',
              'header-ok',
              'confirm',
              'selected',
              'arm',
              'unchanged',
              'single',
              'handoff',
              'native',
              'teardown',
            ]
          : [
              'seed',
              'unchanged',
              'guard',
              'refused',
              'selected',
              'invalidate',
              'native',
              'dispose',
            ]
        ).map((name) =>
          h('Button', {
            text: name,
            accessibilityLabel: `history:${name}`,
            fontSize: 13,
            minHeight: 40,
            margin: 3,
            padding: 6,
            onTap: () => void command(name),
          }),
        ),
      ),
      ...(visible.value
        ? [
            h(
              'GridLayout',
              { row: 3, columns: '*,*' },
              ['inbox', 'archive'].map((name, col) =>
                h(RouterView, {
                  name,
                  col,
                  initial: '/',
                  onLoaded: (event: { object: Frame }) => {
                    frames[name] = event.object
                  },
                }),
              ),
            ),
          ]
        : []),
    ]),
})
const app = createApp(App)
app.config.errorHandler = (error) => {
  errors.push(String(error))
  console.error(error)
}
app.use(router)
app.start()
