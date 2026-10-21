// Real OS entrypoints; no patched dependencies. scripts/native/entrypoints/README.md.
import {
  Application,
  ApplicationSettings,
  File,
  Frame,
  isAndroid,
  knownFolders,
  type NativeWindow,
  type WindowContentRequest,
} from '@nativescript/core'
import { ActionBar, createApp, defineComponent, h, ref } from 'nativescript-vue'
import {
  createRouter,
  RouterView,
  useRoute,
  useRouter,
  type Router,
  type LinkResult,
  type RouteRecordRaw,
} from 'vue-router-ns'
import { createSystemSearch } from 'vue-router-ns/system-search'

const sessions = new Map<string, Session>()
const reportFile = File.fromPath(`${knownFolders.documents().path}/entrypoints.json`)
let sequence = 0
const events: {
  key: string
  href: string
  source: string
  ignored?: string
  path?: string
}[] = []
const pause = (ms = 50) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const checks: string[] = []
interface Session {
  key: string
  router: Router
  app: ReturnType<typeof createApp>
  window?: NativeWindow
  frames: Record<string, Frame>
  selected: ReturnType<typeof ref<number>>
  status: ReturnType<typeof ref<string>>
  search: ReturnType<typeof createSystemSearch>
}
function snapshot() {
  return [...sessions.values()].map((s) => ({
    key: s.key,
    window: s.window?.id,
    task: isAndroid
      ? (s.window?.android?.activity as android.app.Activity)?.getTaskId()
      : undefined,
    current: s.router.currentRoute.value.fullPath,
    history: s.router.stack.value.map((route) => route.fullPath),
    selected: s.selected.value,
    frames: Object.fromEntries(
      Object.entries(s.frames).map(([name, frame]) => [
        name,
        {
          loaded: frame.isLoaded,
          history: [
            ...frame.backStack.map((entry) => entry.resolvedPage),
            frame.currentPage,
          ]
            .filter(Boolean)
            .map((page) => (page!.getViewById('entry-route') as any)?.text),
        },
      ]),
    ),
  }))
}
function windowHistory(key: string) {
  const value = snapshot().find((session) => session.key === key)
  return (
    value && {
      ...value,
      // Activity pause/unload timing may change while another window opens.
      frames: Object.fromEntries(
        Object.entries(value.frames).map(([name, frame]) => [name, frame.history]),
      ),
    }
  )
}
function report(command: string, error?: unknown, announce = true) {
  ApplicationSettings.flush()
  sequence++
  const value = {
    sequence,
    command,
    ok: !error,
    error: error ? String(error) : undefined,
    checks,
    events,
    sessions: snapshot(),
    pid: isAndroid
      ? android.os.Process.myPid()
      : NSProcessInfo.processInfo.processIdentifier,
    quickActions: isAndroid
      ? undefined
      : (UIApplication.sharedApplication.shortcutItems?.count ?? 0),
  }
  reportFile.writeTextSync(JSON.stringify(value))
  File.fromPath(
    `${knownFolders.documents().path}/entrypoints-${value.pid}-${sequence}.json`,
  ).writeTextSync(JSON.stringify(value))
  if (announce)
    for (const session of sessions.values())
      session.status.value = `${error ? 'FAIL' : 'PASS'} ${command}`
  console.log(`ENTRYPOINT_RESULT ${JSON.stringify(value)}`)
}
function check(value: unknown, label: string): asserts value {
  if (!value) throw new Error(label)
  checks.push(label)
}
async function until(test: () => unknown, label: string) {
  const deadline = Date.now() + 20000
  while (!test()) {
    if (Date.now() > deadline) throw new Error(`Timeout: ${label}`)
    await pause()
  }
}
function makeSession(key: string, initial?: WindowContentRequest) {
  const selected = ref(0)
  const status = ref('Starting')
  let session: Session
  const Page = defineComponent({
    setup() {
      const router = useRouter() as unknown as Router
      const route = useRoute()
      return () =>
        h('Page', {}, [
          h(ActionBar, { title: `${key} ${route.fullPath}` }),
          h('StackLayout', { padding: 8 }, [
            h('Label', {
              id: 'entry-route',
              text: route.fullPath,
              accessibilityLabel: `entry:${key}:${route.path}`,
            }),
            h('Label', { text: status.value }),
            ...[
              'back',
              'login',
              'publish',
              'pin',
              'rename',
              'remove-route',
              'signout',
              'search-index',
              'search-clear',
              'second',
              'second-link',
              'capture',
            ].map((name) =>
              h('Button', {
                text: name,
                accessibilityLabel: `entry:${key}:${name}`,
                height: 36,
                onTap: () => void command(name, session, router),
              }),
            ),
          ]),
        ])
    },
  })
  const renamed = ApplicationSettings.getBoolean('entrypoints:renamed')
  const routes: RouteRecordRaw[] = [
    { path: '/', name: 'home', component: Page },
    {
      path: '/settings',
      component: Page,
      children: [
        { path: 'account', name: 'account', component: Page },
        { path: 'items/:id', name: 'item', component: Page },
      ],
    },
    { path: renamed ? '/renamed' : '/legacy', name: 'stable', component: Page },
    { path: '/login', component: Page },
    { path: '/compose', name: 'compose', component: Page, modal: { animated: false } },
  ]
  const search = createSystemSearch({
    domain: 'org.nativescript.routerentries.public',
    resolve: (id) =>
      id === 'guide' && ApplicationSettings.getBoolean('entrypoints:search')
        ? '/settings/account'
        : null,
  })
  const router = createRouter({
    routes,
    backPreview: false,
    motion: 'reduced',
    links: {
      schemes: ['routerentries', 'https'],
      hosts: ['example.com'],
      options: { withParents: false },
      initial,
      window: initial?.window,
      activity: search.url,
      frame(location) {
        const target = location.path.startsWith('/settings') ? 'settings' : 'home'
        selected.value = target === 'settings' ? 1 : 0
        return target
      },
    },
  })
  router.beforeEach((to) =>
    to.path === '/settings/account' &&
    !ApplicationSettings.getBoolean('entrypoints:login')
      ? { path: '/login', query: { next: to.fullPath } }
      : undefined,
  )
  router.onLink((result: LinkResult) => {
    events.push({
      key,
      href: result.link.href,
      source: result.link.source,
      ignored: result.ignored,
      path: result.location?.fullPath,
    })
    report(result.ignored ? `link:${result.ignored}` : 'link')
  })
  router.onError((error) => report('router-error', error))
  const app = createApp({
    render: () =>
      h(
        'TabView',
        {
          selectedIndex: selected.value,
          onSelectedIndexChange: (args: any) => (selected.value = args.value),
        },
        [
          h('TabViewItem', { title: 'Home' }, [
            h(RouterView, {
              name: 'home',
              initial: '/',
              ref: (view: any) => {
                if (view) session.frames.home = view.$el.nativeView
              },
            }),
          ]),
          h('TabViewItem', { title: 'Settings' }, [
            h(RouterView, {
              name: 'settings',
              initial: '/settings',
              ref: (view: any) => {
                if (view) session.frames.settings = view.$el.nativeView
              },
            }),
          ]),
        ],
      ),
  })
  session = {
    key,
    router,
    app,
    window: initial?.window,
    frames: {},
    selected,
    status,
    search,
  }
  sessions.set(key, session)
  app.use(router)
  void router.isReady().then(async () => {
    await pause(100)
    session.window ??= session.frames.home?.getNativeWindow()
    report('ready', undefined, session.status.value === 'Starting')
  })
  return session
}
Application.setWindowContentResolver((request) => {
  if (request.window.rootView) return request.window.rootView
  if (request.isPrimary) return undefined
  return makeSession('b', request).app.mount().$el.nativeView
})
const first = makeSession('a')
first.app.start()

async function command(name: string, session = first, scoped = session.router) {
  try {
    const router = session.router
    if (name === 'back') await scoped.back({ animated: false })
    else if (name === 'login') {
      ApplicationSettings.setBoolean('entrypoints:login', true)
      await scoped.replace(
        String(scoped.currentRoute.value.query.next ?? '/settings/account'),
        { animated: false },
      )
    } else if (name === 'publish') {
      const ids = router.setShortcuts([
        {
          id: 'entry-stable',
          title: 'Stable route',
          to: { name: 'stable' },
          icon: { ios: 'star.fill' },
        },
        {
          id: 'entry-account',
          title: 'Private account',
          to: { name: 'account' },
          icon: { ios: 'person.fill' },
        },
        {
          id: 'entry-compose',
          title: 'Compose message',
          to: { name: 'compose' },
          icon: { ios: 'square.and.pencil' },
        },
      ])
      check(ids.includes('entry-stable'), 'native shortcuts published')
    } else if (name === 'pin') {
      check(
        router.pinShortcut({
          id: 'entry-pin',
          title: 'Pinned route',
          to: { name: 'stable' },
        }),
        'launcher accepted pin request',
      )
    } else if (name === 'rename') {
      ApplicationSettings.setBoolean('entrypoints:renamed', true)
      const old = router.getRoutes().find((route) => route.name === 'stable')!
      router.removeRoute('stable')
      router.addRoute({ path: '/renamed', name: 'stable', component: old.component })
    } else if (name === 'remove-route') router.removeRoute('stable')
    else if (name === 'signout') {
      ApplicationSettings.remove('entrypoints:login')
      router.setShortcuts([])
      ApplicationSettings.setBoolean('entrypoints:search', false)
      await session.search.remove()
    } else if (name === 'search-index') {
      ApplicationSettings.setBoolean('entrypoints:search', true)
      check(
        await session.search.index([
          {
            id: 'guide',
            title: 'Router Entry Guide',
            description: 'Native router public acceptance guide',
            keywords: ['routerentryguide'],
          },
        ]),
        'Core Spotlight indexed explicit content',
      )
    } else if (name === 'search-clear') {
      await session.search.remove()
      ApplicationSettings.setBoolean('entrypoints:search', false)
    } else if (name === 'second') {
      const before = JSON.stringify(windowHistory('a'))
      if (isAndroid) {
        const activity = session.window!.android!.activity as android.app.Activity
        const intent = new android.content.Intent(activity as any, activity.getClass())
        intent.setAction(android.content.Intent.ACTION_VIEW)
        intent.setData(android.net.Uri.parse('routerentries://settings/items/second'))
        intent.addFlags(
          android.content.Intent.FLAG_ACTIVITY_NEW_TASK |
            android.content.Intent.FLAG_ACTIVITY_MULTIPLE_TASK |
            android.content.Intent.FLAG_ACTIVITY_NEW_DOCUMENT,
        )
        activity.startActivity(intent)
      } else {
        const activity = NSUserActivity.alloc().initWithActivityType(
          NSUserActivityTypeBrowsingWeb,
        )
        activity.webpageURL = NSURL.URLWithString(
          'https://example.com/settings/items/second',
        )
        UIApplication.sharedApplication.requestSceneSessionActivationUserActivityOptionsErrorHandler(
          null,
          activity,
          null,
          (error) => report('second', error),
        )
      }
      await until(
        () =>
          sessions.get('b')?.router.currentRoute.value.path === '/settings/items/second',
        'cold secondary link',
      )
      check(
        JSON.stringify(windowHistory('a')) === before,
        'cold secondary link leaves primary history unchanged',
      )
      check(sessions.get('b')!.window !== session.window, 'two real native windows')
    } else if (name === 'second-link') {
      const second = sessions.get('b')!
      const before = JSON.stringify(windowHistory('a'))
      if (isAndroid) {
        const activity = second.window!.android!.activity as android.app.Activity
        const intent = new android.content.Intent(activity as any, activity.getClass())
        intent.setAction(android.content.Intent.ACTION_VIEW)
        intent.setData(android.net.Uri.parse('routerentries://settings/items/warm'))
        intent.addFlags(android.content.Intent.FLAG_ACTIVITY_SINGLE_TOP)
        activity.startActivity(intent)
      } else {
        const activity = NSUserActivity.alloc().initWithActivityType(
          NSUserActivityTypeBrowsingWeb,
        )
        activity.webpageURL = NSURL.URLWithString(
          'https://example.com/settings/items/warm',
        )
        UIApplication.sharedApplication.requestSceneSessionActivationUserActivityOptionsErrorHandler(
          second.window!.ios!.scene!.session,
          activity,
          null,
          (error) => report('second-link', error),
        )
      }
      await until(
        () => second.router.currentRoute.value.path === '/settings/items/warm',
        'warm secondary link',
      )
      check(
        JSON.stringify(windowHistory('a')) === before,
        'warm secondary link leaves primary history unchanged',
      )
    }
    report(name)
  } catch (error) {
    report(name, error)
  }
}
if (isAndroid)
  Application.android.registerBroadcastReceiver(
    'org.nativescript.vuerouterns.ENTRYPOINT_TEST',
    (_context, intent) => {
      const key = intent.getStringExtra('window') ?? 'a'
      const session = sessions.get(key)
      if (session) void command(intent.getStringExtra('command')!, session)
    },
  )
