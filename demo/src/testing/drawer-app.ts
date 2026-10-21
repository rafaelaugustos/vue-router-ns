// Built only with `ns build android --env.drawerTest`.
import { ApplicationSettings } from '@nativescript/core'
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
const button = (text: string, onTap: () => unknown) => h('Button', { text, onTap })

const page = (title: string, detail = false, modal = false) =>
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
      onBeforeRouteLeave(() => !blocked.value)
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
              h('TextField', {
                hint: 'Draft',
                text: draft.value,
                onTextChange: (event: { value: string }) => {
                  draft.value = event.value
                },
              }),
            button('Push detail', () => router.push('/detail')),
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
  { path: '/settings', component: page('Drawer settings') },
  { path: '/account', component: page('Drawer account') },
  { path: '/modal', component: page('Drawer modal', false, true), modal: true },
]
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
          width: 280,
          closeOnNavigate: closeOnNavigate.value,
          direction: rtl.value ? 'rtl' : 'ltr',
          onOpened: () => console.log('[drawer-test] opened'),
          onClosed: () => {
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
