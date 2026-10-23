// Public route metadata example + opt-in native acceptance (--env.tabsvisibilityTest).
import {
  ApplicationSettings,
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
  onBeforeRouteLeave,
  type Router,
} from 'vue-router-ns'

const selected = ref('inbox')
const rail = ref(false)
const sidebar = ref(false)
const guarded = ref(false)
const status = ref('Ready')
const frames = new Map<string, Frame>()
let root: View
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const button = (text: string, onTap: () => unknown) => h('Button', { text, onTap })
const Page = defineComponent({
  setup() {
    const route = useRoute()
    const host = useNativeHost<Frame>()
    const name = route.path.split('/')[1]!
    onBeforeRouteLeave(() => false, { when: guarded })
    return () =>
      h(
        'Page',
        {
          onLoaded: () => {
            if (!route.path.includes('modal')) frames.set(name, host.native!)
          },
        },
        [
          h(ActionBar, {
            title: route.path.endsWith('detail') ? 'Message details' : 'Inbox',
          }),
          h(
            'GridLayout',
            { rows: 'auto,*,auto', padding: 20, backgroundColor: '#f1f5f9' },
            [
              h('StackLayout', { row: 0 }, [
                h('Label', { text: route.path, fontSize: 22, fontWeight: 'bold' }),
                h('Label', { text: 'Tabs follow the committed page.', marginTop: 8 }),
                button('Open details', () =>
                  router.push(`/${name}/detail`, { frame: name }),
                ),
                button('Go back', () => router.back()),
                button('Toggle guard', () => (guarded.value = !guarded.value)),
                h('Label', { text: guarded.value ? 'Guard enabled' : 'Guard disabled' }),
                h('Label', {
                  text: status.value,
                  automationText: 'visibility-status',
                  textWrap: true,
                }),
              ]),
              h('Label', {
                row: 2,
                text: 'Content reaches the bottom safe area',
                backgroundColor: '#dbeafe',
                padding: 12,
                textWrap: true,
              }),
            ],
          ),
        ],
      )
  },
})
const router: Router = createRouter({
  routes: ['inbox', 'saved'].flatMap((name) => [
    { path: `/${name}`, component: Page },
    { path: `/${name}/detail`, component: Page, meta: { tabBarVisibility: 'hidden' } },
    { path: `/${name}/visible`, component: Page, meta: { tabBarVisibility: 'visible' } },
    { path: `/${name}/modal`, component: Page, meta: { tabBarVisibility: 'visible' } },
    {
      path: `/${name}/blocked`,
      component: Page,
      meta: { tabBarVisibility: 'hidden' },
      beforeEnter: () => false,
    },
    {
      path: `/${name}/broken`,
      component: async () => {
        throw new Error('Expected load failure')
      },
      meta: { tabBarVisibility: 'hidden' },
    },
  ]),
  links: { schemes: ['vuerouterns'], frame: (route) => route.path.split('/')[1]! },
  restore: {
    load: () => {
      const saved = ApplicationSettings.getString('tabs-visibility')
      return saved ? JSON.parse(saved) : undefined
    },
    save: (state) =>
      ApplicationSettings.setString('tabs-visibility', JSON.stringify(state)),
  },
})
const app = createApp({
  render: () =>
    h(
      RouterTabs,
      {
        selected: selected.value,
        'onUpdate:selected': (name: string) => (selected.value = name),
        rail: rail.value ? 1 : 0,
        sidebar: sidebar.value,
        onLoaded: (args: { object: View }) => (root = args.object),
      },
      () =>
        ['inbox', 'saved'].map((name) =>
          h(
            RouterTab,
            {
              name,
              title: name === 'inbox' ? 'Inbox' : 'Saved',
              icon: name === 'inbox' ? 'tray.fill' : 'bookmark.fill',
              androidIcon: 'sys://ic_dialog_email',
            },
            () => h(RouterView, { name, initial: `/${name}` }),
          ),
        ),
    ),
})
app.use(router)
app.start()

// Fixture-only file bridge; lets acceptance inspect actual native layout and pages.
const folder = path.join(knownFolders.documents().path, 'tabs-visibility')
Folder.fromPath(folder)
const commandFile = path.join(folder, 'command.json')
const result = File.fromPath(path.join(folder, 'result.json'))
let busy = false
let remembered: unknown
setInterval(async () => {
  if (busy || !root || !File.exists(commandFile)) return
  busy = true
  let id: unknown
  try {
    const request = JSON.parse(File.fromPath(commandFile).readTextSync())
    File.fromPath(commandFile).removeSync()
    id = request.id
    const name = selected.value
    const options = { frame: name }
    switch (request.action) {
      case 'push':
        await router.push(`/${name}/${request.value || 'detail'}`, options)
        break
      case 'replace':
        await router.replace(`/${name}/${request.value}`, options)
        break
      case 'root':
        await router.backToRoot(options)
        break
      case 'back':
        await router.back()
        break
      case 'modal':
        await router.push(`/${name}/modal`, { ...options, modal: true })
        break
      case 'select':
        selected.value = request.value
        break
      case 'rail':
        rail.value = request.value
        break
      case 'sidebar':
        sidebar.value = request.value
        break
      case 'guard':
        guarded.value = request.value
        break
      case 'remember':
        remembered = frames.get(name)?.currentPage
        break
      case 'broken':
        try {
          await router.push(`/${name}/broken`, options)
        } catch {}
        break
      case 'link':
        await router.openLink(request.value)
        break
    }
    await nextTick()
    await pause(600)
    const frame = frames.get(selected.value)
    const page = frame?.currentPage
    let kind: string,
      hidden: boolean,
      inset = 0,
      accessible: boolean
    if (isAndroid && (root as any).routerTabsHost) {
      const bar = (root as any).getChildAt((root as any).getChildrenCount() - 1)
      kind = bar.rail ? 'rail' : 'bottom'
      hidden = bar.nativeViewProtected.getVisibility() === 8
      accessible = !bar.accessibilityHidden
    } else if (!isAndroid) {
      const controller = (root as any).ios
      kind = 'uikit'
      hidden = !!controller.tabBarHidden
      accessible = !controller.tabBar.hidden
      inset = page?.ios.view.safeAreaInsets.bottom ?? 0
    } else {
      kind = 'core'
      hidden = false
      accessible = true
    }
    const report = {
      id,
      kind,
      hidden,
      accessible,
      selected: selected.value,
      preserved: !remembered || remembered === page,
      current: router.currentRoute.value.path,
      stacks: Object.fromEntries(
        [...frames].map(([key, value]) => [key, value.backStack.length + 1]),
      ),
      width: frame?.getActualSize().width,
      height: frame?.getActualSize().height,
      inset,
    }
    result.writeTextSync(JSON.stringify(report))
    status.value = `${kind}: ${hidden ? 'hidden' : 'visible'}`
  } catch (error) {
    result.writeTextSync(JSON.stringify({ id, error: String(error) }))
    status.value = String(error)
  } finally {
    busy = false
  }
}, 100)
