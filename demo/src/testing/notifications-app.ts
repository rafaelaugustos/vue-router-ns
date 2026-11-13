// App-owned UserNotifications integration. Runtime code never installs a delegate.
import {
  File,
  Frame,
  Utils,
  knownFolders,
  type Page,
  type TextField,
} from '@nativescript/core'
import { ActionBar, createApp, defineComponent, h, ref } from 'nativescript-vue'
import {
  createRouter,
  notificationIntent,
  NavigationFailureType,
  RouterView,
  useRoute,
  type NavigationIntent,
  type SuspendedIntent,
} from 'vue-router-ns'

const status = ref('READY'),
  detail = ref('Real iOS notification → validated destination → app-owned login'),
  comparison = ref('')
const frames: Record<string, Frame> = {}
const process = `${Date.now()}`
const scope = {}
let signedIn = false,
  handle: SuspendedIntent | undefined,
  retainedPage: Page | undefined
let lastIntent: NavigationIntent | undefined,
  received = '',
  nativeCallbacks = 0,
  guarded = 0
const wait = (ms = 500) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const assert = (value: unknown, message: string) => {
  if (!value) throw new Error(message)
}
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
                : 'Private message',
        }),
        h('StackLayout', { padding: 16, verticalAlignment: 'center' }, [
          h('Label', {
            id: 'notification-route',
            text: route.fullPath,
            fontSize: 25,
            textAlignment: 'center',
            color: '#183b58',
          }),
          ...(route.path === '/'
            ? [
                h('TextField', {
                  id: 'notification-draft',
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
                  accessibilityLabel: 'notification:login',
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
    { path: '/messages/:id', name: 'message', component: screen },
  ],
  links: { schemes: ['routerentries'], frame: () => 'target' },
  diagnostics: true,
})
router.beforeEach((to) => {
  if (to.path.startsWith('/messages/')) {
    guarded++
    if (!signedIn) return '/login'
  }
})
const snapshot = () =>
  Object.fromEntries(
    ['source', 'target'].map((name) => [
      name,
      {
        logical: router.getHistory({ frame: name })?.entries.map((e) => e.route.fullPath),
        native: [
          ...frames[name]!.backStack.map((e) => e.resolvedPage),
          frames[name]!.currentPage,
        ]
          .filter(Boolean)
          .map((p) => (p!.getViewById('notification-route') as any)?.text),
      },
    ]),
  )
function retained() {
  retainedPage ??= frames.source!.currentPage
  assert(retainedPage === frames.source!.currentPage, 'Exact source Page retained')
  assert(
    (retainedPage!.getViewById('notification-draft') as TextField).text ===
      'Unsent source draft',
    'Source draft retained',
  )
  const stacks = snapshot()
  for (const stack of Object.values(stacks))
    assert(
      JSON.stringify(stack.logical) === JSON.stringify(stack.native),
      'Native/logical stacks agree',
    )
  return stacks
}
async function report(name: string, result?: unknown, error?: unknown) {
  const stacks = snapshot()
  comparison.value = `Source: ${stacks.source!.native.join(' → ')}\nTarget: ${stacks.target!.native.join(' → ')}`
  await File.fromPath(
    `${knownFolders.documents().path}/notification-${name}.json`,
  ).writeText(
    JSON.stringify(
      {
        command: name,
        ok: !error,
        error: error ? String(error) : undefined,
        process,
        result,
        nativeCallbacks,
        guarded,
        stacks,
        sourceDraft: (
          frames.source!.currentPage!.getViewById('notification-draft') as TextField
        ).text,
        windowId: router.window.value?.id,
      },
      null,
      2,
    ),
  )
  Utils.executeOnMainThread(() => {
    status.value = `${error ? 'FAIL' : 'PASS'} ${name}`
  })
}
async function receive(payload: unknown, id: string, action: string) {
  nativeCallbacks++
  const kind = id.replace('notification182-', '')
  let result: any, error: unknown
  try {
    assert(NSThread.isMainThread, 'Native response handed off to the UI thread')
    // The app chooses this scope, stack and history policy, never the notification.
    const intent = notificationIntent(payload, {
      delivery: { scope: 'fixture-account:a', id: `${id}:${action}` },
      target: { frame: 'target' },
      options: { replace: true },
    })
    await router.isReady()
    await wait()
    retained()
    if ('status' in intent) {
      result = intent
      assert(
        intent.reason === (kind === 'expired' ? 'expired' : 'invalid'),
        'Explicit payload rejection',
      )
      detail.value = `${kind}: rejected before routing; existing destination stays intact.`
    } else {
      const resolved = router.resolveIntent(intent)
      if (kind === 'missing') {
        assert(
          resolved.status === 'ignored' && resolved.reason === 'unmatched',
          'Removed destination rejected',
        )
        result = resolved
      } else {
        assert(
          resolved.status === 'resolved' && resolved.location.path === '/messages/7',
          'Native notification resolves message 7',
        )
        lastIntent = intent
        received = kind
        signedIn = false
        const suspended = router.suspendIntent(intent, {
          scope: () => scope,
          authorize: () => signedIn,
        })
        assert(suspended.status === 'suspended', 'Native notification suspended')
        handle = suspended as SuspendedIntent
        await router.push('/login', { frame: 'target', animated: false })
        result = {
          status: handle.status,
          source: intent.source,
          phase: kind,
          nativeAction: action,
        }
        detail.value = `${kind} notification received through iOS. Sign in to resume its validated destination.`
      }
    }
    await wait()
    retained()
  } catch (value) {
    error = value
  }
  await report(`received-${kind}`, result, error)
}

@NativeClass()
class NotificationDelegate extends NSObject implements UNUserNotificationCenterDelegate {
  static ObjCProtocols = [UNUserNotificationCenterDelegate]
  userNotificationCenterWillPresentNotificationWithCompletionHandler(
    _center: UNUserNotificationCenter,
    _notification: UNNotification,
    completion: (options: UNNotificationPresentationOptions) => void,
  ) {
    completion(
      UNNotificationPresentationOptions.Banner | UNNotificationPresentationOptions.List,
    )
  }
  userNotificationCenterDidReceiveNotificationResponseWithCompletionHandler(
    _center: UNUserNotificationCenter,
    response: UNNotificationResponse,
    completion: () => void,
  ) {
    // Bound text before parsing; extract only the app's selected destination field.
    const text =
      response.notification.request.content.userInfo.objectForKey('routerNavigation')
    let payload: unknown
    try {
      if (typeof text === 'string' && text.length <= 16384) payload = JSON.parse(text)
    } catch {}
    const id = response.notification.request.identifier
    const action = response.actionIdentifier
    if (action === UNNotificationDefaultActionIdentifier)
      Utils.executeOnMainThread(() => void receive(payload, id, action))
    // Do not keep the native completion open during login or router readiness.
    completion()
  }
}
const center = UNUserNotificationCenter.currentNotificationCenter()
const delegate = NotificationDelegate.new()
center.delegate = delegate
async function schedule(kind: string) {
  // UNUserNotificationCenter.delegate is weak; the live command closure retains it.
  assert(center.delegate === delegate, 'Application notification delegate retained')
  await new Promise<void>((resolve, reject) =>
    center.requestAuthorizationWithOptionsCompletionHandler(
      UNAuthorizationOptions.Alert,
      (allowed, error) =>
        allowed
          ? resolve()
          : reject(
              new Error(error?.localizedDescription ?? 'Notification permission denied'),
            ),
    ),
  )
  retained()
  const payload: Record<string, unknown> = {
    version: 1,
    destination: { route: { name: 'message', params: { id: '7' } } },
  }
  if (kind === 'invalid') payload.options = { clearHistory: true }
  if (kind === 'expired') payload.expiresAt = Date.now() - 1
  if (kind === 'missing') payload.destination = { route: '/removed' }
  const content = UNMutableNotificationContent.new()
  content.title = `Router ${kind}`
  content.body = 'Tap to open message 7 through the navigation intent contract.'
  content.userInfo = NSDictionary.dictionaryWithObjectForKey(
    JSON.stringify(payload),
    'routerNavigation',
  )
  const request = UNNotificationRequest.requestWithIdentifierContentTrigger(
    `notification182-${kind}`,
    content,
    UNTimeIntervalNotificationTrigger.triggerWithTimeIntervalRepeats(5, false),
  )
  await new Promise<void>((resolve, reject) =>
    center.addNotificationRequestWithCompletionHandler(request, (error) =>
      error ? reject(new Error(error.localizedDescription)) : resolve(),
    ),
  )
  detail.value = `Scheduled real iOS notification: ${kind}. Open it from the system banner.`
  status.value = `SCHEDULED ${kind}`
}
async function command(name: string) {
  let result: unknown, error: unknown
  try {
    if (['warm', 'cold', 'invalid', 'expired', 'missing'].includes(name)) {
      await schedule(name)
      return
    }
    if (name === 'login') {
      assert(handle, 'A native notification is pending')
      signedIn = true
      const first = handle!.resume()
      assert(handle!.resume() === first, 'Resume promise reused')
      result = await first
      await wait()
      assert(
        router.currentRoute.value.path === '/messages/7',
        'Notification resumed after login',
      )
      assert(
        !snapshot().target!.native.includes('/login'),
        'Explicit replace removes login',
      )
      name = `login-${received}`
      detail.value =
        'One native response, one authorized resume. The independent draft remains intact.'
    } else if (name === 'repeat') {
      const before = JSON.stringify(snapshot())
      result = await router.openIntent(lastIntent)
      assert(
        (result as any).reason === 'repeat',
        'Reprocessing native response is deduplicated',
      )
      assert(
        before === JSON.stringify(snapshot()),
        'Duplicate response has no native mutation',
      )
      detail.value =
        'Reprocessed the same actual response: repeat. A new tap needs a new app-owned identity.'
    } else if (name === 'compare') {
      const intents: NavigationIntent[] = [
        {
          version: 1,
          source: 'internal',
          destination: { route: { name: 'message', params: { id: 7 } } },
        },
        { version: 1, source: 'url', destination: { url: 'routerentries://messages/7' } },
        {
          version: 1,
          source: 'shortcut-payload',
          destination: {
            url: router.shortcutURL('message', { name: 'message', params: { id: 7 } }),
          },
        },
      ]
      for (const intent of intents) {
        const resolved = router.resolveIntent(intent)
        assert(
          resolved.status === 'resolved' && resolved.location.path === '/messages/7',
          'Shared resolution',
        )
        const answer = await router.openIntent({ ...intent, target: { frame: 'target' } })
        assert(
          answer.status === 'handled' &&
            answer.failure?.type === NavigationFailureType.duplicated,
          'Same destination through shared navigation',
        )
      }
      result = { sources: ['internal', 'url', 'shortcut-payload'], path: '/messages/7' }
      detail.value =
        'Internal, URL and shortcut payloads resolve to the same destination. These controls do not simulate native shortcut or search callbacks.'
    }
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
        fontSize: 24,
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
        text: comparison.value,
        margin: '0 20 10',
        fontSize: 17,
        textWrap: true,
      }),
      h(
        'WrapLayout',
        { row: 3, margin: '0 12 10' },
        ['warm', 'repeat', 'invalid', 'expired', 'missing', 'compare', 'cold'].map(
          (name) =>
            h('Button', {
              text: name,
              accessibilityLabel: `notification:${name}`,
              margin: 4,
              padding: 10,
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
            onLoaded: (event: { object: Frame }) => {
              frames[name] = event.object
            },
          }),
        ),
      ),
    ]),
})
  .use(router)
  .start()
