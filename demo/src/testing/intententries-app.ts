import {
  Application,
  ApplicationSettings,
  File,
  Frame,
  knownFolders,
  type Page,
  type TextField,
} from '@nativescript/core'
import { ActionBar, createApp, defineComponent, h, ref } from 'nativescript-vue'
import {
  createRouter,
  RouterView,
  useRoute,
  notificationIntent,
  NavigationFailureType,
  type Router,
  type NavigationIntent,
  type SuspendedIntent,
} from 'vue-router-ns'
import { createSystemSearch } from 'vue-router-ns/system-search'
import {
  installSceneIntentIngress,
  type EntryOwner,
  type EntryReceipt,
} from '../../../examples/intent-entrypoints/ios'

const status = ref('READY'),
  detail = ref('Open real quick actions and Spotlight results to resume message 7.'),
  overview = ref('')
const process = NSUUID.UUID().UUIDString,
  scope = {}
const frames: Record<string, Frame> = {}
let signedIn = false,
  handle: SuspendedIntent | undefined,
  last: NavigationIntent | undefined,
  sourcePage: Page | undefined
let nativeCallbacks = 0,
  guarded = 0,
  ids = 0,
  sequence = 0,
  lastLabel = ''
const pause = (ms = 400) => new Promise<void>((resolve) => setTimeout(resolve, ms))
async function mountedFrames() {
  const deadline = Date.now() + 15000
  while (!frames.source?.currentPage || !frames.target?.currentPage) {
    if (Date.now() >= deadline) throw new Error('Named frames did not mount')
    await pause(50)
  }
}
const check = (value: unknown, message: string) => {
  if (!value) throw new Error(message)
}
const phase = () => ApplicationSettings.getString('intententries:phase', 'warm')
const path = () =>
  ApplicationSettings.getBoolean('intententries:renamed') ? '/articles/7' : '/messages/7'
const screen = defineComponent({
  setup() {
    const route = useRoute()
    return () =>
      h('Page', { backgroundColor: '#f1f5fa' }, [
        h(ActionBar, {
          title:
            route.path === '/login'
              ? 'Sign in to continue'
              : route.path === '/'
                ? 'Retained draft'
                : 'Message 7',
        }),
        h('StackLayout', { padding: 18, verticalAlignment: 'center' }, [
          h('Label', {
            id: 'intent-entry-route',
            text: route.fullPath,
            fontSize: 25,
            textAlignment: 'center',
            color: '#183b58',
          }),
          ...(route.path === '/'
            ? [
                h('TextField', {
                  id: 'intent-entry-draft',
                  text: 'Unsent source draft',
                  marginTop: 20,
                }),
              ]
            : []),
          ...(route.path === '/login'
            ? [
                h('Label', {
                  text: 'Fixture sign-in · no identity provider',
                  textWrap: true,
                  marginTop: 16,
                }),
                h('Button', {
                  text: 'Sign in and resume',
                  accessibilityLabel: 'intent-entry:login',
                  onTap: () => void command('login'),
                }),
              ]
            : []),
        ]),
      ])
  },
})
const router = createRouter({
  routes: [
    { path: '/', component: screen },
    { path: '/login', component: screen },
    {
      path: ApplicationSettings.getBoolean('intententries:renamed')
        ? '/articles/:id'
        : '/messages/:id',
      name: 'message',
      component: screen,
    },
  ],
  // The app owns scene ingress; legacy automatic links would navigate a second time.
  links: { system: false, schemes: ['routerentries'], frame: () => 'target' },
  diagnostics: true,
}) as unknown as Router
router.beforeEach((to) => {
  if (to.name === 'message') {
    guarded++
    if (!signedIn) return false
  }
})
const search = createSystemSearch({
  domain: 'org.nativescript.intententries.public',
  resolve: (id) =>
    id === 'guide' && ApplicationSettings.getBoolean('intententries:search')
      ? path()
      : null,
})
const owner: EntryOwner = {
  router,
  scope: `fixture-account:a:${process}`,
  frame: 'target',
}
function snapshot() {
  return Object.fromEntries(
    ['source', 'target'].map((name) => [
      name,
      {
        logical: router.getHistory({ frame: name })?.entries.map((e) => e.route.fullPath),
        native: [
          ...(frames[name]?.backStack.map((e) => e.resolvedPage) ?? []),
          frames[name]?.currentPage,
        ]
          .filter(Boolean)
          .map((p) => (p!.getViewById('intent-entry-route') as any)?.text),
      },
    ]),
  )
}
function retained() {
  sourcePage ??= frames.source!.currentPage
  check(sourcePage === frames.source!.currentPage, 'Exact source Page retained')
  check(
    (sourcePage!.getViewById('intent-entry-draft') as TextField).text ===
      'Unsent source draft',
    'Source draft retained',
  )
  const stacks = snapshot()
  for (const s of Object.values(stacks))
    check(
      JSON.stringify(s.logical) === JSON.stringify(s.native),
      'Logical/native histories agree',
    )
  return stacks
}
async function report(name: string, result?: unknown, error?: unknown) {
  const stacks = snapshot()
  overview.value = `Source: ${stacks.source!.native.join(' → ')}\nTarget: ${stacks.target!.native.join(' → ')}`
  const value = {
    command: name,
    ok: !error,
    error: error ? String(error) : undefined,
    process,
    sequence: ++sequence,
    nativeCallbacks,
    guarded,
    result,
    stacks,
    windowId: router.window.value?.id,
    sourceDraft: (
      frames.source?.currentPage?.getViewById('intent-entry-draft') as TextField
    )?.text,
    quickActions: UIApplication.sharedApplication.shortcutItems?.count ?? 0,
  }
  await File.fromPath(
    `${knownFolders.documents().path}/intent-entry-${process}-${sequence}.json`,
  ).writeText(JSON.stringify(value, null, 2))
  status.value = `${error ? 'FAIL' : 'PASS'} ${name}`
}
async function receive(receipt: EntryReceipt) {
  nativeCallbacks++
  const label = `${receipt.source}-${phase()}-${nativeCallbacks}`
  let result: unknown, error: unknown
  try {
    check(NSThread.isMainThread, 'Scene handoff runs on UI thread')
    await mountedFrames()
    const before = JSON.stringify(retained())
    const input = receipt.request
    if ('status' in input) {
      check(input.reason === 'unmatched', 'Removed native destination is unmatched')
      result = input
      detail.value =
        'Native result rejected: content or route was removed. Both histories remain intact.'
      check(
        JSON.stringify(retained()) === before,
        'Rejected native receipt leaves histories intact',
      )
    } else {
      check(
        input.target?.windowId === router.window.value?.id,
        'Native receiving scene asserted',
      )
      const resolved = router.resolveIntent(input)
      check(
        resolved.status === 'resolved' && resolved.location.path === path(),
        'Transport resolves current message route',
      )
      last = input
      lastLabel = label
      if (!signedIn) {
        const suspended = router.suspendIntent(input, {
          scope: () => scope,
          authorize: () => signedIn,
        })
        check(suspended.status === 'suspended', 'Destination suspended for login')
        handle = suspended as SuspendedIntent
        await router.push('/login', { frame: 'target', animated: false })
        result = { status: 'suspended', source: input.source, delivery: input.delivery }
        detail.value = `Real ${receipt.source} → validated intent → sign in to resume. Native completion is already finished.`
      } else {
        const answer = await router.openIntent(input)
        check(
          answer.status === 'handled' &&
            answer.failure?.type === NavigationFailureType.duplicated,
          'New intentional tap reaches normal duplicate navigation',
        )
        result = {
          status: answer.status,
          failure: answer.status === 'handled' ? answer.failure?.type : undefined,
          source: input.source,
          delivery: input.delivery,
        }
        detail.value =
          'A new native tap has a new delivery identity; normal navigation reports the destination already visible.'
      }
    }
    await pause()
    retained()
  } catch (value) {
    error = value
  }
  await report(`received-${label}`, result, error)
}
const stop = installSceneIntentIngress({
  // Explicit single-primary-window policy. Never select by focused/global Frame.
  owner: (id) => (Application.primaryWindow?.id === id ? owner : undefined),
  activity: search.url,
  nextId: () => `${process}:${++ids}`,
  receive,
  error: (error) => void report('ingress', undefined, error),
})
async function command(name: string) {
  status.value = `RUN ${name}`
  let result: unknown, error: unknown
  try {
    await router.isReady()
    retained()
    if (name === 'publish') {
      result = router.setShortcuts([
        {
          id: 'message',
          title: 'Intent message',
          to: { name: 'message', params: { id: 7 } },
          icon: { ios: 'doc.text' },
        },
      ])
      check((result as string[]).length === 1, 'One native quick action published')
      detail.value =
        'Published a named-route quick action. Next, rename its route without republishing it.'
    } else if (name === 'rename') {
      router.removeRoute('message')
      router.addRoute({ path: '/articles/:id', name: 'message', component: screen })
      ApplicationSettings.setBoolean('intententries:renamed', true)
      detail.value =
        'The existing native shortcut still targets the stable route name after its path changes.'
    } else if (name === 'login') {
      check(handle, 'Pending native destination exists')
      signedIn = true
      const promise = handle!.resume()
      check(handle!.resume() === promise, 'Resume promise reused')
      const answer = await promise
      check(answer.status === 'handled', 'Authorized native request resumed')
      await pause()
      check(snapshot().target!.native.at(-1) === path(), 'Resumed destination visible')
      check(
        !snapshot().target!.native.includes('/login'),
        'Explicit replace removes login Page',
      )
      result = {
        status: answer.status,
        source: answer.status === 'handled' ? answer.intent.source : undefined,
      }
      name = `login-${lastLabel}`
      detail.value =
        'Sign-in resumed once through the ordinary guard. The source Page and draft remain unchanged.'
    } else if (name === 'replay') {
      const before = JSON.stringify(retained())
      result = await router.openIntent(last)
      check(
        (result as any).reason === 'repeat',
        'Same actual native receipt is deduplicated',
      )
      check(before === JSON.stringify(retained()), 'Replay leaves histories intact')
      detail.value =
        'Replayed the same captured native receipt: repeat. This is an app replay, not a second OS callback.'
    } else if (name === 'prepare-cold') {
      ApplicationSettings.setString('intententries:phase', 'cold')
      ApplicationSettings.flush()
      detail.value =
        'Terminate the app, then tap its real quick action. The next process starts signed out.'
    } else if (name === 'index') {
      ApplicationSettings.setBoolean('intententries:search', true)
      ApplicationSettings.setString('intententries:phase', 'search')
      ApplicationSettings.flush()
      check(
        await search.index([
          {
            id: 'guide',
            title: 'Router Intent Atlas',
            description:
              'Public routing guide; opening its destination requires sign-in.',
            keywords: ['Router', 'Intent', 'Atlas'],
          },
        ]),
        'Native Spotlight index completed',
      )
      detail.value =
        'Indexed one explicitly selected public item. Terminate and open the actual Spotlight result.'
    } else if (name === 'revoke-search') {
      ApplicationSettings.setBoolean('intententries:search', false)
      detail.value =
        'The indexed result is stale: the app now refuses its content id. Tap it again in Spotlight.'
    } else if (name === 'compare') {
      const requests = [
        {
          version: 1,
          source: 'internal',
          destination: { route: { name: 'message', params: { id: 7 } } },
        },
        notificationIntent({
          version: 1,
          destination: { route: { name: 'message', params: { id: 7 } } },
        }),
      ]
      for (const request of requests) {
        const resolved = router.resolveIntent(request)
        check(
          resolved.status === 'resolved' && resolved.location.path === path(),
          'Internal/notification contract matches native destinations',
        )
      }
      result = { sources: ['internal', 'notification'], path: path() }
      detail.value =
        'Internal and normalized notification controls resolve the same route as the actual native entries.'
    } else if (name === 'remove-route') {
      router.removeRoute('message')
      detail.value =
        'Removed the named route. Its existing quick action must now yield unmatched.'
    } else if (name === 'clear') {
      check(await search.remove(), 'Only this Spotlight domain cleared')
      router.setShortcuts([])
      stop()
      check(
        (UIApplication.sharedApplication.shortcutItems?.count ?? 0) === 0,
        'Quick actions cleared',
      )
      detail.value =
        'Application cleanup removed its Spotlight domain, quick action and ingress listeners.'
    }
    await pause()
    retained()
  } catch (value) {
    error = value
  }
  await report(name, result, error)
}
createApp({
  render: () =>
    h('GridLayout', { rows: 'auto,auto,auto,auto,*', backgroundColor: '#e4ecf6' }, [
      h('Label', {
        row: 0,
        text: status.value,
        margin: '12 20',
        fontSize: 23,
        fontWeight: 'bold',
        color: '#17656c',
      }),
      h('Label', {
        row: 1,
        text: detail.value,
        margin: '0 20 10',
        fontSize: 17,
        textWrap: true,
      }),
      h('Label', {
        row: 2,
        text: overview.value,
        margin: '0 20 10',
        fontSize: 16,
        textWrap: true,
      }),
      h(
        'WrapLayout',
        { row: 3, margin: '0 12 10' },
        [
          'publish',
          'rename',
          'replay',
          'prepare-cold',
          'index',
          'revoke-search',
          'compare',
          'remove-route',
          'clear',
        ].map((name) =>
          h('Button', {
            text: name,
            accessibilityLabel: `intent-entry:${name}`,
            margin: 3,
            padding: 8,
            onTap: () => void command(name),
          }),
        ),
      ),
      h(
        'GridLayout',
        { row: 4, columns: '*,*' },
        ['source', 'target'].map((name, col) =>
          h(RouterView, {
            col,
            name,
            onLoaded: (e: { object: Frame }) => {
              frames[name] = e.object
            },
          }),
        ),
      ),
    ]),
})
  .use(router)
  .start()
