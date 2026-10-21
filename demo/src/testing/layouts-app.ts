// Opt-in native acceptance fixture: ns build <platform> --env.layoutsTest.
import {
  Page,
  isIOS,
  ActionBar as NativeActionBar,
  type Frame,
  type ViewBase,
} from '@nativescript/core'
import {
  ActionBar,
  createApp,
  defineComponent,
  h,
  onMounted,
  onUnmounted,
  ref,
  type Component,
  type Ref,
} from 'nativescript-vue'
import {
  createRouter,
  isNavigationFailure,
  NavigationFailureType,
  onBeforeRouteLeave,
  RouterTabs,
  RouterTab,
  RouterView,
  useRoute,
  useRouter,
  useNavigateTo,
  useNativeHost,
  useNavigationFocus,
  type NativeHostHandle,
  type RegisteredRouter,
  type RouteLocation,
  type NavigateTo,
  type NavigationFocus,
} from 'vue-router-ns'

interface Capture {
  route: RouteLocation
  router: RegisteredRouter
  navigate: NavigateTo
  host: NativeHostHandle<Frame>
  draft: Ref<string>
  focus: NavigationFocus
}
interface LayoutCapture {
  route: RouteLocation
  draft: Ref<string>
  mounted: boolean
  disposed: boolean
}
const pages = new Map<string, Capture[]>()
const layouts = new Map<string, LayoutCapture[]>()
const checks = ref<string[]>([])
const status = ref('Running native layout checks')
const blocked = ref(true)
const pause = () => new Promise<void>((resolve) => setTimeout(resolve, 50))
const last = (path: string) => pages.get(path)!.at(-1)!
const lastLayout = (path: string) => layouts.get(path)!.at(-1)!

function check(name: string, condition: boolean) {
  if (!condition) throw new Error(`Layout acceptance failed: ${name}`)
  checks.value = [...checks.value, name]
  console.log(`LAYOUT_CHECK ${name}`)
}
async function until(condition: () => boolean) {
  for (let i = 0; i < 100 && !condition(); i++) await pause()
  if (!condition()) throw new Error('Timed out waiting for native layout operation')
}
function hierarchy(page: Page) {
  let pageCount = 0,
    barCount = 0
  const visit = (view: ViewBase) => {
    if (view instanceof Page) pageCount++
    if (view instanceof NativeActionBar) barCount++
    view.eachChild((child) => {
      visit(child)
      return true
    })
  }
  visit(page)
  return pageCount === 1 && barCount === 1
}

function nativeLayout(title: string) {
  return defineComponent({
    name: `Layout${title}`,
    setup(_, { slots }) {
      const route = useRoute()
      const owned = useRouter()
      const draft = ref('layout draft')
      const capture = { route, draft, mounted: false, disposed: false }
      layouts.set(route.path, [...(layouts.get(route.path) ?? []), capture])
      onMounted(() => {
        capture.mounted = true
      })
      onUnmounted(() => {
        capture.disposed = true
      })
      onBeforeRouteLeave(
        async () => {
          await pause()
          return !blocked.value
        },
        {
          when: () =>
            (route.path === '/guarded' || route.path === '/modal') && blocked.value,
        },
      )
      return () =>
        h('Page', { backgroundColor: '#ffffff' }, [
          h(ActionBar, { title: `${title} ${route.path}` }),
          h('StackLayout', { padding: 12 }, [
            h('Label', { text: status.value, textWrap: true }),
            h('Label', { text: `${checks.value.length} layout checks passed` }),
            h('Label', { text: `layout ${title}` }),
            h('TextField', {
              hint: 'Layout draft',
              text: draft.value,
              onTextChange: (event: { value: string }) => {
                draft.value = event.value
              },
            }),
            ...slots.default!(),
            ...(route.path === '/guarded' || route.path === '/modal'
              ? [
                  h('Button', {
                    text: blocked.value ? 'Allow leaving' : 'Block leaving',
                    onTap: () => {
                      blocked.value = !blocked.value
                    },
                  }),
                  h('Button', { text: 'Back', onTap: () => owned.back() }),
                ]
              : []),
          ]),
        ])
    },
  })
}

function body(bare = false) {
  return defineComponent({
    setup() {
      const route = useRoute()
      const owned = useRouter()
      const draft = ref('page draft')
      const focus = useNavigationFocus({ initial: 'heading', return: 'trigger' })
      const capture = {
        route,
        router: owned,
        navigate: useNavigateTo(),
        host: useNativeHost<Frame>(),
        draft,
        focus,
      }
      pages.set(route.path, [...(pages.get(route.path) ?? []), capture])
      return () => {
        const content = h('StackLayout', [
          h('Label', { id: 'heading', text: `route ${route.path}` }),
          h('TextField', {
            hint: 'Page draft',
            text: draft.value,
            onTextChange: (event: { value: string }) => {
              draft.value = event.value
            },
          }),
          h('Button', { id: 'trigger', text: 'Modal initiator' }),
          h('Label', {
            text: `history ${owned.stack.value.map((entry) => entry.path).join(' > ')}`,
            textWrap: true,
          }),
        ])
        return bare ? h('Page', [h(ActionBar, { title: 'Own Page' }), content]) : content
      }
    },
  })
}

const Default = Object.assign(nativeLayout('Default'), {
  __hmrId: 'native-default-layout-90',
})
const Alternate = nativeLayout('Alternate')
const Root = Object.assign(body(), { __hmrId: 'native-layout-body-90' })
const hmr = (
  globalThis as unknown as {
    __VUE_HMR_RUNTIME__: {
      createRecord(id: string, component: Component): void
      reload(id: string, component: Component): void
    }
  }
).__VUE_HMR_RUNTIME__
hmr.createRecord(Default.__hmrId, Default)
hmr.createRecord(Root.__hmrId, Root)
const router = createRouter({
  diagnostics: true,
  layouts: { default: () => Promise.resolve({ default: Default }), alternate: Alternate },
  defaultLayout: 'default',
  routes: [
    { path: '/', component: Root },
    { path: '/secondary', component: body() },
    { path: '/item/:id', component: body() },
    { path: '/alternate', component: body(), meta: { layout: 'alternate' } },
    { path: '/bare', component: body(true), meta: { layout: false } },
    { path: '/guarded', component: body() },
    { path: '/modal', component: body(), meta: { layout: 'alternate' }, modal: true },
    { path: '/missing', component: body(), meta: { layout: 'missing' } },
  ],
})
let errors = 0
router.onError(() => {
  errors++
})

async function run() {
  await router.isReady()
  await router.push('/secondary', { frame: 'right', animated: false })
  await until(() => !!last('/secondary')?.host.native?.currentPage)
  let root = last('/')
  const left = root.host.native!
  const right = last('/secondary').host.native!
  const initial = left.currentPage!
  const initialLayout = lastLayout('/')
  check(
    'default layout owns one native Page and ActionBar',
    initial.actionBar.title === 'Default /' && hierarchy(initial),
  )
  check(
    'layout and destination share entry context',
    initialLayout.route === root.route && initialLayout.mounted,
  )
  root.draft.value = 'retained page draft'
  initialLayout.draft.value = 'retained layout draft'
  await root.navigate('/item/1', { animated: false })
  await root.navigate('/item/2', { animated: false })
  await root.navigate({ path: '/item/2', force: true }, { animated: false })
  check(
    'layout instances are distinct for repeated paths',
    layouts.get('/item/2')!.length === 2 &&
      layouts.get('/item/2')![0]!.draft !== layouts.get('/item/2')![1]!.draft,
  )
  check(
    'covered route and state remain fixed',
    root.route.path === '/' &&
      root.draft.value === 'retained page draft' &&
      initialLayout.draft.value === 'retained layout draft',
  )
  await root.router.backToRoot({ animated: false })
  check(
    'back retains native Page and both drafts',
    left.currentPage === initial &&
      root.draft.value === 'retained page draft' &&
      initialLayout.draft.value === 'retained layout draft',
  )
  check(
    'popped layout disposes once with its entry',
    layouts.get('/item/2')!.every((entry) => entry.disposed) && !initialLayout.disposed,
  )
  await root.navigate('/alternate', { animated: false })
  check(
    'named layout owns native title and hierarchy',
    left.currentPage!.actionBar.title === 'Alternate /alternate' &&
      hierarchy(left.currentPage!),
  )
  await root.navigate('/bare', { animated: false })
  check(
    'layout false retains destination owned Page',
    left.currentPage!.actionBar.title === 'Own Page' &&
      hierarchy(left.currentPage!) &&
      !layouts.has('/bare'),
  )
  await root.router.backToRoot({ animated: false })
  const beforeError = left.currentPage
  let rejected = false
  try {
    await root.navigate('/missing')
  } catch (error) {
    rejected = String(error).includes('Unknown native layout')
  }
  check(
    'unknown layout rejects before native mutation',
    rejected &&
      errors === 1 &&
      left.currentPage === beforeError &&
      !pages.has('/missing'),
  )
  await root.navigate('/item/9', { frame: 'right', animated: false })
  await root.router.backToRoot({ animated: false })
  check(
    'selecting layouts retains both native tab stacks',
    root.host.native === left &&
      last('/item/9').host.native === right &&
      right.backStack.length === 1 &&
      left.backStack.length === 0,
  )
  // UIKit attaches the newly selected tab's view on its next native turn.
  // A test driver must wait until its presenter belongs to a window.
  await until(() => !isIOS || !!left.currentPage?.ios?.viewIfLoaded?.window)
  root.focus.remember('trigger')
  const result = root.router.pushForResult<string>('/modal')
  await until(() => router.currentRoute.value.path === '/modal')
  const modal = last('/modal')
  check(
    'modal uses its named layout and own Frame',
    modal.host.native !== left &&
      modal.host.native!.currentPage!.actionBar.title === 'Alternate /modal' &&
      hierarchy(modal.host.native!.currentPage!),
  )
  const refusal = await modal.router.back()
  check(
    'layout leave guard holds native modal',
    isNavigationFailure(refusal, NavigationFailureType.aborted) &&
      router.currentRoute.value.path === '/modal',
  )
  blocked.value = false
  await modal.router.back({ result: 'accepted' })
  check(
    'modal returns result to retained layout entry',
    (await result) === 'accepted' &&
      left.currentPage === initial &&
      !initialLayout.disposed,
  )
  blocked.value = true

  for (const [name, component] of [
    ['layout', Default],
    ['destination', Root],
  ] as const) {
    root = last('/')
    const original = left.currentPage!
    const entryRoute = root.route
    await root.navigate('/alternate', { animated: false })
    const top = left.currentPage
    hmr.reload(component.__hmrId, { ...component })
    await pause()
    check(
      `${name} HMR defers covered native Page`,
      left.currentPage === top && left.backStack[0]!.resolvedPage === original,
    )
    await root.router.back({ animated: false })
    await until(
      () =>
        left.currentPage !== original &&
        left.currentPage?.actionBar.title === 'Default /',
    )
    check(
      `${name} HMR replaces only the native Page on return`,
      left.backStack.length === 0 &&
        last('/').route === entryRoute &&
        hierarchy(left.currentPage!),
    )
  }
  root = last('/')
  await root.navigate('/guarded', { animated: false })
  const held = await last('/guarded').router.back({ animated: false })
  check(
    'layout leave guard holds regular Back',
    isNavigationFailure(held, NavigationFailureType.aborted) &&
      left.currentPage!.actionBar.title === 'Default /guarded',
  )
  status.value = 'PASS: layouts; guarded native Back ready'
  console.log(`LAYOUT_RESULT ${JSON.stringify({ ok: true, checks: checks.value })}`)
}

const App = defineComponent({
  render: () =>
    h(RouterTabs, null, {
      default: () => [
        h(
          RouterTab,
          {
            name: 'left',
            title: 'Layouts',
            icon: 'house.fill',
            androidIcon: 'sys://ic_menu_view',
          },
          { default: () => h(RouterView, { name: 'left' }) },
        ),
        h(
          RouterTab,
          {
            name: 'right',
            title: 'Other',
            icon: 'gearshape.fill',
            androidIcon: 'sys://ic_menu_preferences',
          },
          { default: () => h(RouterView, { name: 'right', initial: '/secondary' }) },
        ),
      ],
    }),
})
createApp(App).use(router).start()
void run().catch((error) => {
  status.value = String(error)
  console.error(
    `LAYOUT_RESULT ${JSON.stringify({ ok: false, checks: checks.value, error: String(error) })}`,
  )
})
