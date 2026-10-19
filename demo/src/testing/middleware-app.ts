// Opt-in native acceptance fixture: ns build <platform> --env.middlewareTest.
import type { Frame } from '@nativescript/core'
import { ActionBar, createApp, defineComponent, h, ref } from 'nativescript-vue'
import {
  createRouter,
  defineRouteMiddleware,
  isNavigationFailure,
  navigateTo,
  NavigationFailureType,
  onBeforeRouteLeave,
  RouterView,
  useNavigateTo,
  useNativeHost,
  useRoute,
  useRouter,
  type NavigateTo,
  type RouteLocation,
  type RegisteredRouter,
  type NativeHostHandle,
  type Router,
} from 'vue-router-ns'

interface Capture {
  route: RouteLocation
  router: RegisteredRouter
  navigate: NavigateTo
  host: NativeHostHandle<Frame>
}

const captures = new Map<string, Capture[]>()
const checks = ref<string[]>([])
const status = ref('Running native middleware checks')
const dirty = ref(true)
const log: string[] = []
const capture = (path: string) => captures.get(path)!.at(-1)!
const pause = () => new Promise<void>((resolve) => setTimeout(resolve, 50))

const page = (title: string, guarded = false) =>
  defineComponent({
    setup() {
      const route = useRoute()
      const owned = useRouter()
      const navigate = useNavigateTo()
      captures.set(route.path, [
        ...(captures.get(route.path) ?? []),
        { route, router: owned, navigate, host: useNativeHost<Frame>() },
      ])
      if (guarded)
        onBeforeRouteLeave(
          async () => {
            await pause()
            return !dirty.value
          },
          { when: dirty },
        )
      return () =>
        h('Page', { backgroundColor: '#ffffff' }, [
          h(ActionBar, { title }),
          h('StackLayout', { padding: 12 }, [
            h('Label', { text: status.value, textWrap: true }),
            h('Label', { text: `route ${route.path}` }),
            h('Label', {
              text: `history ${owned.stack.value.map((entry) => entry.path).join(' > ')}`,
              textWrap: true,
            }),
            h('Label', { text: `${checks.value.length} checks passed`, textWrap: true }),
            ...(guarded
              ? [
                  h('Button', {
                    text: dirty.value ? 'Allow leaving' : 'Block leaving',
                    onTap: () => {
                      dirty.value = !dirty.value
                    },
                  }),
                  h('Button', { text: 'Back', onTap: () => owned.back() }),
                ]
              : []),
          ]),
        ])
    },
  })

const router = createRouter({
  diagnostics: true,
  routes: [
    { path: '/', component: page('Middleware acceptance') },
    { path: '/other', component: page('Other stack') },
    { path: '/login', component: page('Login') },
    {
      path: '/account',
      component: page('Account'),
      meta: { middleware: ['auth', 'auth'] },
    },
    {
      path: '/refused',
      component: page('Must not mount'),
      meta: {
        middleware: async () => {
          await pause()
          return false
        },
      },
    },
    {
      path: '/error',
      component: page('Must not mount'),
      meta: {
        middleware: () => {
          throw new Error('expected middleware error')
        },
      },
    },
    { path: '/item/:id', component: page('Item') },
    { path: '/guarded', component: page('Guarded page', true) },
    { path: '/modal', component: page('Guarded modal', true), modal: true },
  ],
})

let authCalls = 0
let errors = 0
router.beforeEach(() => {
  log.push('beforeEach')
})
router.addRouteMiddleware(
  'global',
  () => {
    log.push('global')
  },
  { global: true },
)
router.addRouteMiddleware(
  'auth',
  defineRouteMiddleware((to) => {
    authCalls++
    log.push('auth')
    return { path: '/login', query: { next: to.fullPath } }
  }),
)
router.beforeResolve(() => {
  log.push('beforeResolve')
})
router.onError(() => {
  errors++
})

const pathList = (owned: Pick<Router, 'stack'>) =>
  owned.stack.value.map((entry) => entry.path)
function check(name: string, condition: boolean) {
  if (!condition) throw new Error(`Native acceptance failed: ${name}`)
  checks.value = [...checks.value, name]
  console.log(`MIDDLEWARE_CHECK ${name}`)
}

async function run() {
  await router.isReady()
  for (let i = 0; !captures.has('/other') && i < 100; i++) await pause()
  const root = capture('/')
  const other = capture('/other')
  log.length = 0
  await root.navigate('/account', { animated: false })
  check(
    'auth redirects once with guard ordering',
    authCalls === 1 &&
      log.join(',') === 'beforeEach,global,auth,beforeEach,global,beforeResolve',
  )
  check(
    'redirect keeps native stack',
    pathList(root.router).join(',') === '/,/login' &&
      root.router.currentRoute.value.redirectedFrom?.path === '/account',
  )
  const refused = await root.navigate('/refused')
  check(
    'async refusal preserves stack',
    isNavigationFailure(refused, NavigationFailureType.aborted) &&
      pathList(root.router).join(',') === '/,/login' &&
      !captures.has('/refused'),
  )
  let errorRejected = false
  try {
    await root.navigate('/error')
  } catch (error) {
    errorRejected = String(error).includes('expected middleware error')
  }
  check(
    'middleware error reported once',
    errorRejected && errors === 1 && !captures.has('/error'),
  )
  await other.navigate('/item/2', { animated: false })
  await root.navigate('/item/1', { animated: false })
  const item = capture('/item/1')
  check(
    'helper retains original stack',
    pathList(root.router).join(',') === '/,/login,/item/1' &&
      pathList(other.router).join(',') === '/other,/item/2',
  )
  check(
    'native Frames match helper stacks',
    root.host.native!.backStack.length === 2 && other.host.native!.backStack.length === 1,
  )
  check(
    'covered page keeps entry route',
    root.route.path === '/' && other.route.path === '/other',
  )
  await item.navigate({ path: '/item/1', force: true }, { animated: false })
  check(
    'repeated path has distinct page entries',
    captures.get('/item/1')!.length === 2 &&
      captures.get('/item/1')![0]!.route !== captures.get('/item/1')![1]!.route,
  )
  const repeated = capture('/item/1')
  await repeated.router.back({ animated: false })
  let disposedRejected = false
  try {
    await repeated.navigate('/login')
  } catch {
    disposedRejected = true
  }
  check(
    'disposed helper rejects',
    disposedRejected && pathList(root.router).join(',') === '/,/login,/item/1',
  )
  await root.navigate('/guarded', { replace: true, animated: false })
  const guarded = capture('/guarded')
  const back = await guarded.router.back({ animated: false })
  check(
    'async leave guard holds back',
    isNavigationFailure(back, NavigationFailureType.aborted) &&
      pathList(root.router).at(-1) === '/guarded',
  )
  dirty.value = false
  await guarded.router.back({ animated: false })
  dirty.value = true
  await root.navigate('/modal', { animated: false })
  const modal = capture('/modal')
  check(
    'helper settles at native modal presentation',
    router.currentRoute.value.path === '/modal',
  )
  const blocked = await modal.router.back({ animated: false })
  check(
    'modal leave refusal keeps presentation',
    isNavigationFailure(blocked, NavigationFailureType.aborted) &&
      router.currentRoute.value.path === '/modal',
  )
  dirty.value = false
  await modal.router.back({ animated: false })
  dirty.value = true
  let resultReturned = false
  const result = root.router
    .pushForResult<string>('/modal', { animated: false })
    .then((value) => {
      resultReturned = true
      return value
    })
  for (let i = 0; router.currentRoute.value.path !== '/modal' && i < 100; i++)
    await pause()
  check('modal result waits for close', !resultReturned)
  dirty.value = false
  await capture('/modal').router.back({ result: 'accepted', animated: false })
  check('native modal result delivered', (await result) === 'accepted')
  await navigateTo(root.router, '/item/9', {
    frame: 'right',
    replace: true,
    animated: false,
  })
  check(
    'explicit helper frame and replace',
    pathList(other.router).join(',') === '/other,/item/9',
  )
  dirty.value = true
  await root.navigate('/guarded', { animated: false })
  status.value = 'PASS: middleware and helpers; guarded Back ready'
  console.log(`MIDDLEWARE_RESULT ${JSON.stringify({ ok: true, checks: checks.value })}`)
}

const App = defineComponent({
  render: () =>
    h('GridLayout', { columns: '*,*' }, [
      h(RouterView, { name: 'left' }),
      h(RouterView, { name: 'right', initial: '/other', col: 1 }),
    ]),
})
createApp(App).use(router).start()
void run().catch((error) => {
  status.value = String(error)
  console.error(
    `MIDDLEWARE_RESULT ${JSON.stringify({ ok: false, checks: checks.value, error: String(error) })}`,
  )
})
