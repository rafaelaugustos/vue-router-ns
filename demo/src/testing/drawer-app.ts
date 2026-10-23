// Built only with `ns build ios|android --env.drawerTest`.
import {
  Application,
  ApplicationSettings,
  File,
  Folder,
  knownFolders,
  isIOS,
} from '@nativescript/core'
import { ActionBar, createApp, defineComponent, h, nextTick, ref } from 'nativescript-vue'
import {
  createRouter,
  onBeforeRouteLeave,
  RouterDrawer,
  RouterTab,
  RouterTabs,
  RouterView,
  usePageState,
  useRouter,
  type RouterDrawerHandle,
  type RouteRecordRaw,
} from 'vue-router-ns'

const drawer = ref<RouterDrawerHandle>()
const closeOnNavigate = ref(true)
const selected = ref('home')
const result = ref('none')
const rtl = ref(false)
const modelOpen = ref(false)
const paneWidth = ref(280)
const generation = ref(0)
const events = { opened: 0, closed: 0 }
const button = (text: string, onTap: () => unknown) => h('Button', { text, onTap })

const page = (title: string, detail = false, modal = false, swipe = false) =>
  defineComponent({
    setup() {
      const router = useRouter()
      const draft = ref('')
      const blocked = ref(false)
      usePageState('draft', {
        save: () => draft.value,
        restore: (value) => {
          draft.value = String(value)
        },
      })
      if (!swipe) onBeforeRouteLeave(() => false, { when: blocked })
      return () =>
        h('Page', { backgroundColor: '#ffffff' }, [
          h(ActionBar, { title }, () => [
            h('ActionItem', { text: 'Menu', onTap: () => drawer.value?.open() }),
          ]),
          h('StackLayout', { padding: 16 }, [
            h('Label', { text: `route ${router.currentRoute.value.path}` }),
            h('Label', {
              text: `history ${router.stack.value.map((entry) => entry.path).join(' > ')}`,
            }),
            h('Label', { text: `modal result ${result.value}` }),
            !modal &&
              !swipe &&
              h('TextField', {
                hint: 'Draft',
                text: draft.value,
                onTextChange: (event: { value: string }) => {
                  draft.value = event.value
                },
              }),
            button('Push detail', () => router.push('/detail')),
            button('Push swipe page', () => router.push('/swipe')),
            button(rtl.value ? 'Use LTR' : 'Use RTL', () => {
              rtl.value = !rtl.value
            }),
            button(blocked.value ? 'Unblock leaving' : 'Block leaving', () => {
              blocked.value = !blocked.value
            }),
            ...(modal
              ? [button('Return result', () => router.back({ result: 'accepted' }))]
              : []),
            ...(detail ? [button('Back to root', () => router.back())] : []),
          ]),
        ])
    },
  })

const routes: RouteRecordRaw[] = [
  { path: '/', component: page('Drawer home') },
  { path: '/detail', component: page('Drawer detail', true) },
  { path: '/swipe', component: page('Drawer swipe', true, false, true) },
  { path: '/settings', component: page('Drawer settings') },
  { path: '/account', component: page('Drawer account') },
  { path: '/modal', component: page('Drawer modal', false, true), modal: true },
]
if (isIOS && NSProcessInfo.processInfo.arguments.containsObject('drawer-reset'))
  ApplicationSettings.remove('drawer-state')
const router = createRouter({
  routes,
  restore: {
    save: (value) => ApplicationSettings.setString('drawer-state', JSON.stringify(value)),
    load: () => JSON.parse(ApplicationSettings.getString('drawer-state', 'null')),
  },
  links: {
    schemes: ['vuerouterns'],
    frame: (location) => (location.path.startsWith('/settings') ? 'settings' : 'home'),
  },
})

const app = defineComponent({
  setup() {
    async function modal(sheet = false) {
      closeOnNavigate.value = false
      await nextTick()
      const value = await router.pushForResult<string>('/modal', {
        modal: sheet ? { android: { sheet: { height: 520, state: 'expanded' } } } : true,
      })
      result.value = String(value)
    }
    return () =>
      h(
        RouterDrawer,
        {
          ref: drawer,
          key: generation.value,
          width: paneWidth.value,
          open: modelOpen.value,
          'onUpdate:open': (value: boolean) => {
            modelOpen.value = value
          },
          closeOnNavigate: closeOnNavigate.value,
          direction: rtl.value ? 'rtl' : 'ltr',
          onOpened: () => {
            events.opened++
            console.log('[drawer-test] opened')
          },
          onClosed: () => {
            events.closed++
            closeOnNavigate.value = true
            console.log('[drawer-test] closed')
          },
        },
        {
          drawer: () =>
            h('StackLayout', { paddingTop: 32 }, [
              h('Label', { text: 'Drawer destinations', accessibilityRole: 'header' }),
              button('Go home', () => router.backToRoot({ frame: 'home' })),
              button('Go detail', () => router.openLink('/detail')),
              button('Go settings', () => router.openLink('/settings')),
              button('Keep drawer under modal', () => modal()),
              button('Keep drawer under sheet', () => modal(true)),
              button('Close drawer', () => drawer.value?.close()),
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
                  h(RouterView, { name: 'home', backToRootOnReselect: true }),
                ),
                h(RouterTab, { name: 'settings', title: 'Settings' }, () =>
                  h(RouterView, { name: 'settings', initial: '/settings' }),
                ),
                h(RouterTab, { name: 'account', title: 'Account' }, () =>
                  h(RouterView, { name: 'account', initial: '/account' }),
                ),
              ],
            ),
        },
      )
  },
})
createApp(app).use(router).start()

// Fixture-only acceptance bridge. The production component has no file polling.
if (isIOS) {
  const directory = Folder.fromPath(`${knownFolders.documents().path}/drawer`)
  const commandPath = `${directory.path}/command.json`
  const output = File.fromPath(`${directory.path}/result.json`)
  let busy = false
  let remembered: unknown
  const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
  const findHost = () => {
    let host: any
    const visit = (view: any) => {
      if (typeof view.openDrawer === 'function') host = view
      view.eachChildView?.((child: any) => {
        visit(child)
        return true
      })
    }
    visit(Application.getRootView())
    return host
  }
  setInterval(async () => {
    if (busy || !drawer.value || !File.exists(commandPath)) return
    busy = true
    let id: unknown
    try {
      const request = JSON.parse(File.fromPath(commandPath).readTextSync())
      File.fromPath(commandPath).removeSync()
      id = request.id
      switch (request.action) {
        case 'open':
          drawer.value.open()
          break
        case 'close':
          drawer.value.close()
          break
        case 'toggle':
          drawer.value.toggle()
          break
        case 'model':
          modelOpen.value = request.value
          break
        case 'width':
          paneWidth.value = request.value
          break
        case 'rtl':
          rtl.value = request.value
          break
        case 'remount':
          generation.value++
          break
        case 'rapid':
          drawer.value.open()
          drawer.value.close()
          drawer.value.open()
          break
        case 'push':
          await router.push(request.value)
          break
        case 'remember':
          remembered = findHost()?.getChildAt(0)
          break
        case 'escape':
          findHost().nativeViewProtected.accessibilityPerformEscape()
          break
      }
      const settledAtCommand = drawer.value.isOpen
      await nextTick()
      await pause(500)
      const host = findHost()
      const native = host.nativeViewProtected
      const pane = host.getChildAt(1).nativeViewProtected
      const content = host.getChildAt(0).nativeViewProtected
      output.writeTextSync(
        JSON.stringify({
          id,
          open: drawer.value.isOpen,
          model: modelOpen.value,
          events,
          current: router.currentRoute.value.path,
          history: router.stack.value.map((entry) => entry.path),
          preserved: !remembered || remembered === host.getChildAt(0),
          width: pane.bounds.size.width,
          x: pane.frame.origin.x,
          hostWidth: native.bounds.size.width,
          contentHidden: content.accessibilityElementsHidden,
          paneHidden: pane.accessibilityElementsHidden,
          modal: pane.accessibilityViewIsModal,
          recognizers: native.gestureRecognizers.count,
          controllerChildren: host.viewController?.childViewControllers.count ?? -1,
          reduceMotion: UIAccessibilityIsReduceMotionEnabled(),
          settledAtCommand,
        }),
      )
    } catch (error) {
      output.writeTextSync(JSON.stringify({ id, error: String(error) }))
    } finally {
      busy = false
    }
  }, 100)
}
