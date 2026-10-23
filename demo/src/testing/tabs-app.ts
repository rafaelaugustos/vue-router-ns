// Opt-in real-tap regression fixture: --env.tabsTest.
import { File, knownFolders, path, type Frame } from '@nativescript/core'
import {
  ActionBar,
  createApp,
  defineComponent,
  h,
  ref,
  type Component,
} from 'nativescript-vue'
import {
  createRouter,
  RouterTabs,
  RouterTab,
  RouterView,
  useRoute,
  type Router,
  useNativeHost,
  onBeforeRouteLeave,
} from 'vue-router-ns'

const selected = ref('a')
const blocked = ref(false)
const veto = ref(false)
const events = ref<string[]>([])
const hosts = new Map<string, ReturnType<typeof useNativeHost<Frame>>>()
const report = () => {
  const data = {
    selected: selected.value,
    events: events.value,
    stacks: Object.fromEntries(
      [...hosts].map(([name, host]) => [
        name,
        {
          back: host.native?.backStack.length,
          page: host.native?.currentPage?.actionBar.title,
        },
      ]),
    ),
  }
  File.fromPath(
    path.join(knownFolders.documents().path, 'tabs-result.json'),
  ).writeTextSync(JSON.stringify(data, null, 2))
}
function event(value: string) {
  events.value = [...events.value, value]
  setTimeout(report, 100)
}
const button = (text: string, action: () => unknown) =>
  h('Button', { text, automationText: text, onTap: action })
const Content: Component = defineComponent({
  setup() {
    const route = useRoute()
    const name = route.path.split('/')[1]!
    const label = route.path
    const host = useNativeHost<Frame>()
    if (!hosts.has(name)) hosts.set(name, host)
    onBeforeRouteLeave(() => !blocked.value)
    return () =>
      h('Page', {}, [
        h(ActionBar, { title: label }),
        h('StackLayout', { padding: 12 }, [
          h('Label', { text: label, automationText: label }),
          h('Label', {
            text: `reselects:${events.value.filter((value) => value.startsWith('reselect:')).length}`,
            automationText: 'reselect-count',
          }),
          h('Label', { text: events.value.at(-1), automationText: 'last-event' }),
          button('Push detail', () => router.push(`/${name}/detail`, { frame: name })),
          button('Select A', () => {
            selected.value = 'a'
          }),
          button('Select B', () => {
            selected.value = 'b'
          }),
          button('Deep link B', () => router.openLink('tabstest://b/detail')),
          button('Toggle guard', () => {
            blocked.value = !blocked.value
          }),
          button('Toggle veto', () => {
            veto.value = !veto.value
          }),
          button('Snapshot', report),
          h('Label', { text: `guard:${blocked.value};veto:${veto.value}` }),
        ]),
      ])
  },
})
const router: Router = createRouter({
  routes: ['a', 'b', 'c'].flatMap((name) => [
    { path: `/${name}`, component: Content },
    { path: `/${name}/detail`, component: Content },
  ]),
  links: { schemes: ['tabstest'], frame: () => 'b' },
})
const app = createApp({
  render: () =>
    h(
      RouterTabs,
      {
        selected: selected.value,
        'onUpdate:selected': (name: string) => {
          selected.value = name
        },
        canSelect: () => !veto.value,
        onSelect: (name: string) => event(`select:${name}`),
        onReselect: (name: string) => event(`reselect:${name}`),
      },
      () =>
        ['a', 'b', 'c'].map((name) =>
          h(
            RouterTab,
            {
              name,
              title: name.toUpperCase(),
              icon: 'square',
              androidIcon: 'sys://ic_menu_view',
            },
            () =>
              h(RouterView, {
                name,
                initial: `/${name}`,
                backToRootOnReselect: name !== 'c',
              }),
          ),
        ),
    ),
})
app.use(router)
app.start()

setTimeout(() => event('ready'), 1500)
