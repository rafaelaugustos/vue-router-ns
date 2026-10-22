// Opt-in native acceptance fixture. See scripts/native/windows/README.md.
import {
  Application,
  ApplicationSettings,
  File,
  Frame,
  knownFolders,
  isAndroid,
  isIOS,
  type NativeWindow,
  type WindowContentRequest,
} from '@nativescript/core'
import {
  ActionBar,
  createApp,
  defineComponent,
  h,
  nextTick,
  onUnmounted,
  ref,
  type Ref,
} from 'nativescript-vue'
import {
  createRouter,
  RouterView,
  getWindowRoute,
  useRouter,
  usePageState,
  type Router,
  type SavedStacks,
} from 'vue-router-ns'

const sessions = new Map<string, Session>()
const reportFile = File.fromPath(`${knownFolders.documents().path}/windows-result.json`)
const pause = (ms = 50) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const checks: string[] = []
const sceneEvents: { event: string; window?: string }[] = []
if (isIOS)
  for (const event of [
    'sceneDidDisconnect',
    'sceneWillConnect',
    'sceneDidEnterBackground',
    'sceneDidActivate',
  ]) {
    Application.ios.on(event, (args: any) =>
      sceneEvents.push({ event, window: args.window?.id }),
    )
  }
let stage = 'boot'
let busy = false
let recreation: { before: number; after?: number } | undefined
interface Session {
  key: string
  router: Router
  app: ReturnType<typeof createApp>
  frame?: Frame
  drafts: Ref<string>[]
  status: Ref<string>
  unmounted: number
}
function check(condition: unknown, name: string): asserts condition {
  if (!condition) throw new Error(name)
  checks.push(name)
  console.log(`WINDOWS_CHECK ${name}`)
}
async function until(predicate: () => unknown, label: string) {
  const end = Date.now() + 20000
  while (!predicate()) {
    if (Date.now() > end) throw new Error(`Timeout: ${label}`)
    await pause()
  }
}
function paths(session: Session) {
  return session.router.stack.value.map((route) => route.fullPath)
}
function snapshot() {
  return [...sessions.values()].map((session) => ({
    key: session.key,
    paths: paths(session),
    drafts: session.drafts.map((draft) => draft.value),
    unmounted: session.unmounted,
    entryKeys: (
      JSON.parse(
        ApplicationSettings.getString(`windows-46:${session.key}`, 'null'),
      ) as SavedStacks | null
    )?.entries?.default?.map((entry) => entry.key),
    window: session.router.window.value?.id,
    state: session.router.window.value?.state,
    task: (
      session.router.window.value?.android?.activity as android.app.Activity | undefined
    )?.getTaskId(),
    activity: (
      session.router.window.value?.android?.activity as android.app.Activity | undefined
    )?.hashCode(),
    loaded: session.frame?.isLoaded,
    nativePages: session.frame
      ? session.frame.backStack.length + (session.frame.currentPage ? 1 : 0)
      : 0,
    diagnostics: session.router.diagnostics?.export(),
  }))
}
function report(command: string, error?: unknown) {
  const result = {
    command,
    stage,
    ok: !error,
    error: error ? String(error) : undefined,
    pid: isAndroid
      ? android.os.Process.myPid()
      : NSProcessInfo.processInfo.processIdentifier,
    sceneEvents,
    checks,
    recreation,
    sessions: snapshot(),
  }
  reportFile.writeTextSync(JSON.stringify(result))
  File.fromPath(`${knownFolders.documents().path}/windows-${command}.json`).writeTextSync(
    JSON.stringify(result),
  )
  for (const session of sessions.values())
    session.status.value = `${error ? 'FAIL' : 'PASS'} ${command}`
  console.log(`WINDOWS_RESULT ${JSON.stringify(result)}`)
}
const Page = defineComponent({
  setup() {
    const router = useRouter()
    const session = sessions.get(router.options.restore!.key!)!
    const draft = ref('')
    session.drafts.push(draft)
    onUnmounted(() => session.unmounted++)
    usePageState('draft', {
      save: () => draft.value,
      restore: (value: string) => {
        draft.value = value
      },
    })
    return () =>
      h('Page', {}, [
        h(ActionBar, { title: `Window ${session.key}` }),
        h('StackLayout', { padding: 20 }, [
          h('Label', { text: session.status.value, textWrap: true }),
          h('Label', { text: router.currentRoute.value.fullPath }),
          h('TextField', {
            text: draft.value,
            onTextChange: (event: any) => {
              draft.value = event.value
            },
          }),
          ...['prepare', 'resume', 'close'].map((name) =>
            h('Button', {
              text: name,
              accessibilityIdentifier: `windows:${name}`,
              onTap: () => void command(name),
            }),
          ),
        ]),
      ])
  },
})
const routes = [
  { path: '/', component: Page },
  { path: '/edit', component: Page },
  { path: '/items/:id', component: Page },
  { path: '/compose', component: Page, modal: { animated: false } },
]
function makeSession(key: string, window?: NativeWindow, initial = '/') {
  const storageKey = `windows-46:${key}`
  const router = createRouter({
    routes,
    window,
    links: { schemes: ['windows46'] },
    backPreview: false,
    diagnostics: true,
    restore: {
      key,
      load: () =>
        JSON.parse(
          ApplicationSettings.getString(storageKey, 'null'),
        ) as SavedStacks | null,
      save: (state, context) => {
        check(context?.key === key, `snapshot scope ${key}`)
        ApplicationSettings.setString(storageKey, JSON.stringify(state))
      },
    },
  })
  const app = createApp({
    render: () =>
      h(RouterView, {
        initial,
        ref: (view: any) => {
          if (view) session.frame = view.$el.nativeView
        },
      }),
  })
  const session: Session = {
    key,
    router,
    app,
    drafts: [],
    status: ref('Ready'),
    unmounted: 0,
  }
  sessions.set(key, session)
  app.use(router)
  window?.on('close', () => {
    app.unmount()
    sessions.delete(key)
  })
  return session
}
Application.setWindowContentResolver((request: WindowContentRequest) => {
  if (request.window.rootView) return request.window.rootView
  if (request.isPrimary && !request.data?.documentId) return undefined
  const key = String(request.data?.documentId ?? 'b')
  const session = makeSession(key, request.window, getWindowRoute(request.data) ?? '/')
  // A resolver runs after Core emits the initial URL event. Explicit handoff
  // applies the incoming URL after restoration and native host readiness.
  const url =
    !request.android?.savedInstanceState && request.android?.intent?.getDataString()
  if (url) void session.router.openLink(url, { source: 'launch' })
  return session.app.mount().$el.nativeView
})
const first = makeSession('a')
first.app.start()

async function focus(session: Session) {
  if (isIOS) {
    const scene = session.router.window.value?.ios?.scene as UIWindowScene
    if (scene.activationState !== UISceneActivationState.ForegroundActive)
      UIApplication.sharedApplication.requestSceneSessionActivationUserActivityOptionsErrorHandler(
        scene.session,
        null,
        null,
        (error) => console.error(error),
      )
    await until(
      () =>
        scene.activationState === UISceneActivationState.ForegroundActive &&
        session.frame?.isLoaded,
      `focus ${session.key}`,
    )
    await pause(250)
    return
  }
  const activity = session.router.window.value?.android?.activity as android.app.Activity
  const tasks = (
    activity.getSystemService(
      android.content.Context.ACTIVITY_SERVICE,
    ) as android.app.ActivityManager
  ).getAppTasks()
  for (let i = 0; i < tasks.size(); i++) {
    const task = tasks.get(i)
    if (task.getTaskInfo()!.taskId === activity.getTaskId()) task.moveToFront()
  }
  await until(
    () => Application.android.foregroundActivity === activity,
    `focus ${session.key}`,
  )
  await pause(200)
}
async function openSecond() {
  first.router.openWindow('/', { data: { documentId: 'b' } })
  await until(() => sessions.has('b'), 'second window created')
  const second = sessions.get('b')!
  await Promise.race([
    second.router.isReady(),
    pause(20000).then(() => {
      throw new Error('Second router readiness timed out')
    }),
  ])
  await until(() => second.frame?.isLoaded, 'second window loaded')
  if (isIOS) {
    await until(
      () =>
        (second.router.window.value?.ios?.scene as UIWindowScene)?.activationState ===
        UISceneActivationState.ForegroundActive,
      'second scene foreground',
    )
    await pause(500)
  }
  return second
}
async function prepare() {
  await first.router.push('/edit', { animated: false })
  first.drafts[1]!.value = 'draft A first'
  await first.router.push({ path: '/edit', force: true }, { animated: false })
  first.drafts[2]!.value = 'draft A second'
  const second = await openSecond()
  await second.router.push('/edit', { animated: false })
  second.drafts[1]!.value = 'draft B'
  await second.router.push('/items/2', { animated: false })
  check(paths(first).join(',') === '/,/edit,/edit', 'A history isolated')
  check(paths(second).join(',') === '/,/edit,/items/2', 'B history isolated')
  check(first.router.window.value !== second.router.window.value, 'two native windows')
  let allow = false
  const stop = second.router.beforeEach(() => allow)
  await second.router.back({ animated: false })
  check(paths(second).at(-1) === '/items/2', 'B guard blocks back')
  allow = true
  stop()
  await second.router.back({ animated: false })
  check(
    paths(first).length === 3 && paths(second).length === 2,
    'B back leaves A unchanged',
  )
  // Each window presents from its own Page; no global Frame/modal target.
  await focus(first)
  const resultA = first.router.pushForResult('/compose')
  await until(() => first.router.currentRoute.value.path === '/compose', 'A modal')
  await focus(second)
  const resultB = second.router.pushForResult('/compose')
  await until(() => second.router.currentRoute.value.path === '/compose', 'B modal')
  await first.router.back({ result: 'A', animated: false })
  check(
    (await resultA) === 'A' && second.router.currentRoute.value.path === '/compose',
    'A modal result does not close B',
  )
  await second.router.back({ result: 'B', animated: false })
  check((await resultB) === 'B', 'B modal result')
  // Backgrounding in the driver persists the latest app-owned page state.
}
async function restored() {
  const second = await openSecond()
  await until(
    () =>
      first.drafts[2]?.value === 'draft A second' &&
      second.drafts[1]?.value === 'draft B',
    'draft restoration',
  )
  check(paths(first).join(',') === '/,/edit,/edit', 'A duplicate history restored')
  check(paths(second).join(',') === '/,/edit', 'B history restored')
  await focus(first)
  await first.router.back({ animated: false })
  check(first.drafts[1]!.value === 'draft A first', 'A previous duplicate draft restored')
  check(second.drafts[1]!.value === 'draft B', 'B state remains independent')
}
async function recreate() {
  const second = sessions.get('b')!
  await focus(second)
  await second.router.push('/items/9', { animated: false })
  const old = second.router.window.value!.android!.activity as android.app.Activity
  recreation = { before: old.hashCode() }
  stage = 'activity-recreate'
  const unmounted = second.unmounted
  old.recreate()
  await until(
    () =>
      second.router.window.value?.android?.activity !== old &&
      second.frame?.isLoaded &&
      second.frame.navigationQueueIsEmpty(),
    'replacement Activity',
  )
  await pause(500)
  recreation.after = (
    second.router.window.value!.android!.activity as android.app.Activity
  ).hashCode()
  check(
    recreation.before !== recreation.after,
    'Activity was replaced in the same JS process',
  )
  check(second.unmounted === unmounted, 'Activity recreation retains all Vue pages')
  stage = 'back-after-recreate'
  await Promise.race([
    second.router.back({ animated: false }),
    pause(15000).then(() => {
      throw new Error('Back timed out after Activity recreation')
    }),
  ])
  check(paths(second).join(',') === '/,/edit', 'logical history after recreation')
  check(second.frame!.backStack.length === 1, 'native history after recreation')
  const draft = second.drafts[1]!
  draft.value = 'reactive after recreate'
  await nextTick()
  let found = false
  const walk = (view: any) => {
    if (view.text === 'reactive after recreate') found = true
    view.eachChild?.((child: any) => {
      walk(child)
      return true
    })
  }
  walk(second.frame!.currentPage)
  check(found, 'retained Vue page remains reactive')
  await second.router.push('/items/10', { animated: false })
  check(paths(first).join(',') === '/,/edit', 'other window survives recreation')
}
async function command(name: string) {
  if (busy) return
  busy = true
  stage = name
  try {
    await first.router.isReady()
    if (name === 'prepare') await prepare()
    else if (name === 'restore') await restored()
    else if (name === 'recreate') await recreate()
    else if (name === 'resume') {
      const second = sessions.get('b')!
      await focus(second)
      check(paths(first).join(',') === '/,/edit,/edit', 'A history after scene resume')
      check(paths(second).join(',') === '/,/edit', 'B history after scene resume')
      check(second.drafts[1]?.value === 'draft B', 'B draft after scene resume')
      await second.router.push('/items/9', { animated: false })
      await second.router.back({ animated: false })
      second.drafts[1]!.value = 'reactive after scene resume'
      await nextTick()
      let found = false
      const walk = (view: any) => {
        if (view.text === 'reactive after scene resume') found = true
        view.eachChild?.((child: any) => {
          walk(child)
          return true
        })
      }
      walk(second.frame!.currentPage)
      check(found, 'B reactivity after scene resume')
      await focus(first)
      await first.router.back({ animated: false })
      await focus(second)
    } else if (name === 'link') {
      const second = sessions.get('b')!
      await focus(second)
      const activity = second.router.window.value!.android!
        .activity as android.app.Activity
      const intent = new android.content.Intent(activity as any, activity.getClass())
      intent.setAction(android.content.Intent.ACTION_VIEW)
      intent.setData(android.net.Uri.parse('windows46://items/42'))
      intent.addFlags(android.content.Intent.FLAG_ACTIVITY_SINGLE_TOP)
      activity.startActivity(intent)
      await until(
        () => second.router.currentRoute.value.path === '/items/42',
        'OS link delivered',
      )
      check(paths(first).join(',') === '/,/edit', 'OS link leaves A unchanged')
      await second.router.back({ animated: false })
    } else if (name === 'launcher') {
      first.router.openWindow('/items/11', { data: { documentId: 'b' } })
      await until(
        () => sessions.get('b')?.router.currentRoute.value.path === '/items/11',
        'B reopened',
      )
      const second = sessions.get('b')!
      await focus(second)
      const original = first.router.window.value as NativeWindow
      ;(original.android!.activity as android.app.Activity).finish()
      await until(() => original.state === 'closed', 'original window closed')
      second.router.openWindow('/items/12', {
        data: { documentId: 'c', nested: { value: 42 } },
      })
      await until(
        () => sessions.get('c')?.router.currentRoute.value.path === '/items/12',
        'C opened by surviving Activity',
      )
      check(paths(second).join(',') === '/items/11', 'surviving window history unchanged')
      check(
        sessions.get('c')!.router.window.value!.id !== second.router.window.value!.id,
        'new native window after original Activity closes',
      )
      check(
        paths(sessions.get('c')!).join(',') === '/items/12',
        'typed handoff after original Activity closes',
      )
    } else if (name === 'close') {
      const second = sessions.get('b')!
      const owner = second.router.window.value as NativeWindow
      owner.close()
      await until(() => owner.state === 'closed', 'window close')
      await nextTick()
      check(
        second.unmounted === second.drafts.length,
        'closed window releases all Vue page apps',
      )
      check(
        ApplicationSettings.getString('windows-46:b') === 'null',
        'closed B snapshot cleared',
      )
      check(
        JSON.parse(ApplicationSettings.getString('windows-46:a')).stacks.default
          .length === 2,
        'A snapshot retained',
      )
    }
    report(name)
  } catch (error) {
    report(name, error)
  } finally {
    busy = false
  }
}
if (isAndroid) {
  Application.android.registerBroadcastReceiver(
    'org.nativescript.vuerouterns.WINDOWS_TEST',
    (_context, intent) => {
      const name = intent.getStringExtra('command')
      if (name) void command(name)
    },
  )
}
void first.router
  .isReady()
  .then(() => report('ready'))
  .catch((error) => report('ready', error))
