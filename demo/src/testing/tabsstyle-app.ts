// Runnable public styling example and native acceptance: --env.tabsstyleTest.
import {
  Application,
  Color,
  File,
  Folder,
  knownFolders,
  path,
  isAndroid,
  type Frame,
  type View,
} from '@nativescript/core'
import { ActionBar, createApp, defineComponent, h, ref, nextTick } from 'nativescript-vue'
import {
  createRouter,
  RouterTabs,
  RouterTab,
  RouterView,
  useRoute,
  useNativeHost,
  type TabLabelVisibility,
  type Router,
} from 'vue-router-ns'

Application.addCss(`
.tabs-light { tab-background-color: #f1f5f9; tab-text-color: #475569; selected-tab-text-color: #2563eb; }
.tabs-dark { tab-background-color: #172033; tab-text-color: #cbd5e1; selected-tab-text-color: #38bdf8; }
`)
const theme = ref('native')
const labels = ref<TabLabelVisibility>('labeled')
const rail = ref(false)
const override = ref<string>()
const selected = ref('inbox')
const frames = new Map<string, Frame>()
let root: View
let mounts = 0
const button = (text: string, onTap: () => unknown) => h('Button', { text, onTap })
const Page = defineComponent({
  setup() {
    mounts++
    const route = useRoute()
    const name = route.path.split('/')[1]!
    const host = useNativeHost<Frame>()
    const draft = ref('My saved draft')
    return () =>
      h('Page', { onLoaded: () => frames.set(name, host.native!) }, [
        h(ActionBar, {
          title: route.path.endsWith('detail')
            ? 'Message details'
            : name === 'inbox'
              ? 'Inbox'
              : 'Saved',
        }),
        h('StackLayout', { padding: 20, spacing: 8 }, [
          h('Label', { text: 'Native tab appearance', fontSize: 24, fontWeight: 'bold' }),
          h('Label', { text: `${theme.value} · ${labels.value}`, marginBottom: 10 }),
          h('TextField', {
            text: draft.value,
            'onUpdate:text': (text: string) => (draft.value = text),
          }),
          button('Open details', () => router.push(`/${name}/detail`, { frame: name })),
          button(
            'Light / dark colors',
            () => (theme.value = theme.value === 'light' ? 'dark' : 'light'),
          ),
          button(
            'Show / hide labels (Material)',
            () => (labels.value = labels.value === 'labeled' ? 'unlabeled' : 'labeled'),
          ),
          button('Bottom bar / rail (Android)', () => (rail.value = !rail.value)),
          button(
            'Selected color override',
            () => (override.value = override.value ? undefined : '#e11d48'),
          ),
          h('Label', {
            text: 'Change appearance while keeping your page and draft.',
            textWrap: true,
            marginTop: 12,
          }),
        ]),
      ])
  },
})
const router: Router = createRouter({
  routes: ['inbox', 'saved'].flatMap((name) => [
    { path: `/${name}`, component: Page },
    { path: `/${name}/detail`, component: Page },
  ]),
})
const app = createApp({
  render: () =>
    h(
      RouterTabs,
      {
        class: `tabs-${theme.value}`,
        selected: selected.value,
        'onUpdate:selected': (name: string) => (selected.value = name),
        selectedTabTextColor: override.value,
        labelVisibility: labels.value,
        rail: rail.value ? 1 : 0,
        onLoaded: (args: { object: View }) => (root = args.object),
      },
      () => [
        h(
          RouterTab,
          {
            name: 'inbox',
            title: 'Inbox',
            icon: 'tray.fill',
            androidIcon: 'sys://ic_dialog_email',
            badge: 2,
          },
          () => h(RouterView, { name: 'inbox', initial: '/inbox' }),
        ),
        h(
          RouterTab,
          {
            name: 'saved',
            title: 'Saved',
            icon: 'bookmark.fill',
            androidIcon: 'sys://ic_menu_save',
          },
          () => h(RouterView, { name: 'saved', initial: '/saved' }),
        ),
      ],
    ),
})
app.use(router)
app.start()

// Acceptance-only command bridge. Production consumers use the component above.
declare const android: any
declare const NSForegroundColorAttributeName: string
const folder = path.join(knownFolders.documents().path, 'tabs-style')
Folder.fromPath(folder)
const command = path.join(folder, 'command.json')
const result = File.fromPath(path.join(folder, 'result.json'))
const initialPages = new Map<string, unknown>()
const palettes: Record<string, string[]> = {
  light: ['#f1f5f9', '#475569', '#2563eb'],
  dark: ['#172033', '#cbd5e1', '#38bdf8'],
}
let busy = false
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
setInterval(async () => {
  if (busy || !root || !File.exists(command)) return
  busy = true
  let id: unknown
  try {
    const request = JSON.parse(File.fromPath(command).readTextSync())
    id = request.id
    File.fromPath(command).removeSync()
    if (request.action === 'push') {
      await router.push('/inbox/detail', { frame: 'inbox' })
      await router.push('/saved/detail', { frame: 'saved' })
      for (const [name, frame] of frames) initialPages.set(name, frame.currentPage)
    }
    if (request.action === 'theme') theme.value = request.value
    if (request.action === 'labels') labels.value = request.value
    if (request.action === 'rail') rail.value = request.value
    if (request.action === 'override') override.value = request.value || undefined
    if (request.action === 'select') selected.value = request.value
    await nextTick()
    await pause(500)
    const expected = [...(palettes[theme.value] ?? [])]
    if (override.value) expected[2] = override.value
    const style = root.style
    const resolved = [
      style.tabBackgroundColor,
      style.tabTextColor,
      style.selectedTabTextColor,
    ].map((color) => color?.hex)
    let native: Record<string, unknown>
    if (isAndroid && (root as any).routerTabsHost) {
      const bar = (root as any).getChildAt((root as any).getChildrenCount() - 1)
      const view = bar.nativeViewProtected
      const checked = [android.R.attr.state_enabled, android.R.attr.state_checked]
      const equal = (color: number, hex: string) =>
        !hex || color === new Color(hex).android
      native = {
        kind: bar.rail ? 'rail' : 'bottom',
        raw: [
          view.getBackgroundTintList()?.getDefaultColor(),
          view.getItemIconTintList()?.getDefaultColor(),
          view.getItemTextColor()?.getDefaultColor(),
          view.getItemIconTintList()?.getColorForState(checked, 0),
          view.getItemTextColor()?.getColorForState(checked, 0),
        ],
        background: equal(view.getBackgroundTintList()?.getDefaultColor(), expected[0]!),
        normalIcon: equal(view.getItemIconTintList()?.getDefaultColor(), expected[1]!),
        normalText: equal(view.getItemTextColor()?.getDefaultColor(), expected[1]!),
        selectedIcon: equal(
          view.getItemIconTintList()?.getColorForState(checked, 0),
          expected[2]!,
        ),
        selectedText: equal(
          view.getItemTextColor()?.getColorForState(checked, 0),
          expected[2]!,
        ),
        labels: view.getLabelVisibilityMode(),
        titles: [0, 1].map((i) => String(view.getMenu().getItem(i).getTitle())),
        badge: view.getBadge(0)?.getNumber(),
      }
    } else if (!isAndroid) {
      const bar = (root as any).ios.tabBar
      const equal = (color: any, hex: string) =>
        !hex || !!color?.isEqual(new Color(hex).ios)
      native = {
        kind: 'uikit',
        raw: [
          String(bar.standardAppearance.backgroundColor),
          String(bar.unselectedItemTintColor),
          String(bar.tintColor),
        ],
        background: equal(bar.standardAppearance.backgroundColor, expected[0]!),
        normalText: equal(
          bar.standardAppearance.stackedLayoutAppearance.normal.titleTextAttributes?.objectForKey(
            NSForegroundColorAttributeName,
          ),
          expected[1]!,
        ),
        selectedText: equal(
          bar.standardAppearance.stackedLayoutAppearance.selected.titleTextAttributes?.objectForKey(
            NSForegroundColorAttributeName,
          ),
          expected[2]!,
        ),
        normalIcon: equal(bar.unselectedItemTintColor, expected[1]!),
        selectedIcon: equal(bar.tintColor, expected[2]!),
      }
    } else {
      const tab = (root as any)._tabLayout
      const equal = (color: number, hex: string) =>
        !hex || color === new Color(hex).android
      native = {
        kind: 'core',
        raw: [tab.getTabTextColor(), tab.getSelectedTabTextColor()],
        background: !expected[0] || equal(tab.getBackground().getColor(), expected[0]),
        normalText: equal(tab.getTabTextColor(), expected[1]!),
        selectedText: equal(tab.getSelectedTabTextColor(), expected[2]!),
      }
    }
    result.writeTextSync(
      JSON.stringify({
        id,
        native,
        resolved,
        selected: selected.value,
        mounts,
        preserved: [...initialPages].every(
          ([name, page]) => frames.get(name)?.currentPage === page,
        ),
        stacks: [...frames].map(([name, frame]) => [name, frame.backStack.length]),
      }),
    )
  } catch (error) {
    result.writeTextSync(
      JSON.stringify({ id, error: String(error), stack: (error as Error).stack }),
    )
  } finally {
    busy = false
  }
}, 150)
