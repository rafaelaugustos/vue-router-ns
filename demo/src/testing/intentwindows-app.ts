import {
  Application,
  ApplicationSettings,
  File,
  Frame,
  Label,
  knownFolders,
  type NativeWindow,
  type Page,
  type TextField,
  type WindowContentRequest,
} from '@nativescript/core'
import { ActionBar, createApp, defineComponent, h, ref } from 'nativescript-vue'
import {
  createRouter,
  NavigationFailureType,
  RouterView,
  useRoute,
  type NavigationIntent,
  type Router,
  type SavedStacks,
} from 'vue-router-ns'
import {
  createWindowIntentPolicy,
  type IntentWindow,
} from '../../../examples/intent-windows/policy'

const sessions = new Map<string, Session>()
const pending = new Map<
  string,
  { key: string; current(): boolean; restore: 'saved' | 'fresh' }
>()
const status = ref('READY'),
  detail = ref(
    'Explicit app policy: reuse, focus or create. Each scene owns its history.',
  ),
  overview = ref('')
let allocations = 0,
  focusRequests = 0
let requestingScene: UIWindowScene | undefined
const wait = (ms = 400) => new Promise<void>((r) => setTimeout(r, ms))
const check = (value: unknown, message: string) => {
  if (!value) throw new Error(message)
}
async function until(predicate: () => unknown, message: string) {
  const start = Date.now()
  while (!predicate()) {
    if (Date.now() - start > 15000) throw new Error(message)
    await wait(50)
  }
}
interface Session extends IntentWindow {
  router: Router
  app: ReturnType<typeof createApp>
  frame?: Frame
  source?: Page
  guards: number
}
const commands = [
  'create-saved',
  'repeat',
  'reuse',
  'focus-a',
  'focus-b',
  'reset',
  'wrong-owner',
  'create-fresh',
  'close-b',
  'guard',
  'dispose',
]
function makeSession(
  key: string,
  window?: NativeWindow,
  restore: 'saved' | 'fresh' = 'fresh',
): Session {
  let session: Session
  const screen = defineComponent({
    setup() {
      const route = useRoute()
      return () =>
        h('Page', { backgroundColor: '#f1f5fa' }, [
          h(ActionBar, { title: `Window ${key}` }),
          h('StackLayout', { verticalAlignment: 'center', padding: 20 }, [
            h('Label', {
              id: 'intent-window-route',
              text: route.fullPath,
              fontSize: 28,
              textAlignment: 'center',
              color: '#183b58',
            }),
            ...(route.path === '/'
              ? [
                  h('TextField', {
                    id: 'intent-window-draft',
                    text: `Unsent draft ${key}`,
                    marginTop: 20,
                  }),
                ]
              : []),
          ]),
        ])
    },
  })
  const router = createRouter({
    window,
    routes: [
      { path: '/', component: screen },
      { path: '/saved', component: screen },
      { path: '/items/:id', component: screen },
      { path: '/blocked', component: screen },
    ],
    diagnostics: true,
    restore: {
      key,
      load: () =>
        restore === 'saved'
          ? (JSON.parse(
              ApplicationSettings.getString(`intent-windows:${key}`, 'null'),
            ) as SavedStacks | null)
          : null,
      save: (state) =>
        ApplicationSettings.setString(`intent-windows:${key}`, JSON.stringify(state)),
    },
  })
  router.beforeEach((to) => {
    session.guards++
    if (to.path === '/blocked') return false
  })
  const app = createApp({
    render: () =>
      h('GridLayout', { rows: 'auto,auto,auto,auto,*', backgroundColor: '#e4ecf6' }, [
        h('Label', {
          row: 0,
          text: `${status.value}`,
          margin: '12 20',
          fontSize: 24,
          fontWeight: 'bold',
          color: '#17656c',
        }),
        h('Label', {
          row: 1,
          text: `Selected scene: ${key.toUpperCase()} · ${detail.value}`,
          margin: '0 20 8',
          fontSize: 17,
          textWrap: true,
        }),
        h('Label', {
          row: 2,
          text: overview.value,
          margin: '0 20 8',
          fontSize: 16,
          textWrap: true,
        }),
        h(
          'WrapLayout',
          { row: 3, margin: '0 12 10' },
          commands.map((name) =>
            h('Button', {
              text: name,
              accessibilityLabel: `intent-window:${name}`,
              margin: 3,
              padding: 8,
              onTap: () => void command(name, key),
            }),
          ),
        ),
        h(RouterView, {
          row: 4,
          onLoaded: (event: { object: Frame }) => {
            session.frame = event.object
          },
        }),
      ]),
  })
  session = { key, router: router as Router, app, guards: 0 }
  sessions.set(key, session)
  app.use(router)
  window?.on('close', () => {
    app.unmount()
    if (sessions.get(key) === session) sessions.delete(key)
  })
  return session
}
Application.setWindowContentResolver((request: WindowContentRequest) => {
  if (request.window.rootView) return request.window.rootView
  if (request.isPrimary) return undefined
  const key = String(request.data?.documentKey ?? '')
  const handoff = pending.get(String(request.data?.requestId ?? ''))
  // Each OS request has its own token. Late arrivals cannot replace a newer owner.
  if (!handoff || handoff.key !== key || !handoff.current() || sessions.has(key)) {
    const placeholder = new Label()
    placeholder.text = 'This window request is no longer active.'
    setTimeout(() => request.window.close(), 0)
    return placeholder
  }
  const session = makeSession(key, request.window, handoff.restore)
  return session.app.mount().$el.nativeView
})
const first = makeSession('a')
first.app.start()

async function focus(owner: IntentWindow) {
  focusRequests++
  const session = owner as Session,
    scene = owner.router.window.value?.ios?.scene as UIWindowScene
  check(scene, 'Explicit receiving scene exists')
  let nativeError: NSError | undefined
  const request = UISceneSessionActivationRequest.requestWithSession(scene.session)
  const options = UISceneActivationRequestOptions.new()
  options.requestingScene = requestingScene ?? scene
  request.options = options
  // Multiple scenes may already be foreground-active. Still request this identity.
  UIApplication.sharedApplication.activateSceneSessionForRequestErrorHandler(
    request,
    (error) => {
      nativeError = error
    },
  )
  // Let UIKit start its transition before observing an already-active scene.
  await wait(600)
  let activeSince = 0
  await until(
    () =>
      nativeError ||
      (() => {
        if (
          scene.activationState !== UISceneActivationState.ForegroundActive ||
          !session.frame?.isLoaded
        ) {
          activeSince = 0
          return false
        }
        activeSince ||= Date.now()
        return Date.now() - activeSince >= 300
      })(),
    `Scene ${owner.key} became active`,
  )
  await wait()
  if (nativeError) throw new Error(nativeError.localizedDescription)
}
const policy = createWindowIntentPolicy({
  resolve: (request) => first.router.resolveIntent(request),
  find: (key) => sessions.get(key),
  async open(key, restore, current) {
    const requestId = NSUUID.UUID().UUIDString
    pending.set(requestId, { key, restore, current })
    try {
      if (!current()) return undefined
      allocations++
      first.router.openWindow('/', { data: { documentKey: key, requestId } })
      await until(() => !current() || sessions.has(key), `Native creation ${key}`)
      if (!current()) return undefined
      const owner = sessions.get(key)!
      let ready = false,
        failure: unknown
      void owner.router.isReady().then(
        () => {
          ready = true
        },
        (error) => {
          failure = error
          ready = true
        },
      )
      await until(() => !current() || ready, `Router readiness ${key}`)
      if (!current()) return undefined
      if (failure) throw failure
      await until(() => !!owner.frame?.currentPage, `Native page ${key}`)
      return owner
    } finally {
      pending.delete(requestId)
    }
  },
  focus,
})
function seed(key: string) {
  // A controlled saved snapshot, not a process-death reconstruction claim.
  ApplicationSettings.setString(
    `intent-windows:${key}`,
    JSON.stringify({
      version: 2,
      windowKey: key,
      savedAt: Date.now(),
      stacks: { default: ['/', '/saved'] },
    }),
  )
}
function intent(
  id: string,
  path = `/items/${id}`,
  extra: Partial<NavigationIntent> = {},
): NavigationIntent {
  return {
    version: 1,
    source: 'internal',
    destination: { route: path },
    delivery: { scope: 'fixture-account:a', id },
    ...extra,
  }
}
function snapshot() {
  return Object.fromEntries(
    [...sessions].map(([key, owner]) => [
      key,
      {
        windowId: owner.router.window.value?.id,
        primary: owner.router.window.value?.isPrimary,
        state: owner.router.window.value?.state,
        logical: owner.router.stack.value.map((route) => route.fullPath),
        native: [
          ...(owner.frame?.backStack.map((e) => e.resolvedPage) ?? []),
          owner.frame?.currentPage,
        ]
          .filter(Boolean)
          .map((p) => (p!.getViewById('intent-window-route') as any)?.text),
        guards: owner.guards,
      },
    ]),
  )
}
function retained() {
  const stacks = snapshot()
  for (const entry of Object.values(stacks))
    check(
      JSON.stringify(entry.logical) === JSON.stringify(entry.native),
      'Native/logical histories agree',
    )
  check(
    new Set(Object.values(stacks).map((s) => s.windowId)).size === sessions.size,
    'Each router has a different native owner',
  )
  const source = first.frame!.backStack[0]?.resolvedPage ?? first.frame!.currentPage
  first.source ??= source
  check(source === first.source, 'Exact source Page retained in A')
  check(
    (source!.getViewById('intent-window-draft') as TextField).text === 'Unsent draft a',
    'Source draft A retained',
  )
  return stacks
}
async function command(name: string, sourceKey: string) {
  if (status.value.startsWith('RUN ')) return
  requestingScene = sessions.get(sourceKey)?.router.window.value?.ios
    ?.scene as UIWindowScene
  status.value = `RUN ${name}`
  let result: any, error: unknown
  try {
    await first.router.isReady()
    retained()
    const before = snapshot(),
      beforeFocus = focusRequests
    if (name === 'create-saved') {
      seed('b')
      result = await policy.dispatch(intent('first'), {
        mode: 'new',
        key: 'b',
        restore: 'saved',
        history: 'append',
      })
      check(
        snapshot().b!.logical.join(',') === '/,/saved,/items/first',
        'Saved history before intent',
      )
      detail.value =
        'Created B: restored its saved history, then appended the requested destination.'
    } else if (name === 'repeat') {
      result = await policy.dispatch(intent('first'), {
        mode: 'new',
        key: 'b',
        restore: 'saved',
        history: 'append',
      })
      check(
        result.reason === 'repeat' && allocations === 1 && focusRequests === beforeFocus,
        'Duplicate cannot allocate or focus another window',
      )
      detail.value = 'Repeated delivery ignored before creating or focusing a scene.'
    } else if (name === 'reuse') {
      result = await policy.dispatch(intent('reused'), {
        mode: 'reuse',
        key: 'b',
        history: 'append',
      })
      check(
        focusRequests === beforeFocus && allocations === 1,
        'Reuse avoids native focus/allocation',
      )
      detail.value = 'Reused B explicitly; A kept its Page and draft.'
    } else if (name === 'focus-a' || name === 'focus-b') {
      const key = name.slice(-1)
      result = await policy.dispatch(intent(`focused-${key}`), {
        mode: 'focus',
        key,
        history: 'append',
      })
      check(
        (sessions.get(key)!.router.window.value!.ios!.scene as UIWindowScene)
          .activationState === UISceneActivationState.ForegroundActive,
        'Selected scene active',
      )
      detail.value = `Focused ${key.toUpperCase()} through UIKit and navigated only that router.`
    } else if (name === 'reset') {
      result = await policy.dispatch(intent('reset'), {
        mode: 'reuse',
        key: 'b',
        history: 'reset',
      })
      check(
        snapshot().b!.logical.join(',') === '/items/reset',
        'Explicit reset affects B only',
      )
      detail.value =
        'Reset B history explicitly. A still retains its independent history and unsent draft.'
    } else if (name === 'wrong-owner') {
      result = await policy.dispatch(
        intent('wrong', '/items/wrong', {
          target: { windowId: first.router.window.value!.id },
        }),
        { mode: 'focus', key: 'b', history: 'append' },
      )
      check(
        result.reason === 'wrong-window' && focusRequests === beforeFocus,
        'Mismatched identity rejected before focus',
      )
      detail.value = 'A destination asserting owner A cannot be redirected into B.'
    } else if (name === 'create-fresh') {
      seed('c')
      result = await policy.dispatch(intent('fresh'), {
        mode: 'new',
        key: 'c',
        restore: 'fresh',
        history: 'append',
      })
      check(
        snapshot().c!.logical.join(',') === '/,/items/fresh',
        'Fresh policy skips C saved history',
      )
      detail.value =
        'Created C with fresh history. Its older saved snapshot was deliberately skipped.'
    } else if (name === 'close-b') {
      const closing = sessions.get('b')!
      const owner = closing.router.window.value as NativeWindow
      await focus(closing)
      if (owner.isPrimary) {
        // UIKit can promote a scene; its public destruction API can discard it.
        await focus(sessions.get('c')!)
        UIApplication.sharedApplication.requestSceneSessionDestructionOptionsErrorHandler(
          (owner.ios!.scene as UIWindowScene).session,
          null,
          (error) => console.error(error),
        )
      } else owner.close()
      await until(() => !sessions.has('b'), 'B permanently closed')
      await focus(sessions.get('c')!)
      result = await policy.dispatch(intent('closed'), {
        mode: 'focus',
        key: 'b',
        history: 'append',
      })
      check(
        result.reason === 'target-unavailable' && allocations === 2,
        'Closed owner has no fallback/new window',
      )
      detail.value = 'B closed. A stale request is rejected; no other owner is chosen.'
    } else if (name === 'guard') {
      result = await policy.dispatch(intent('guard', '/blocked'), {
        mode: 'reuse',
        key: 'c',
        history: 'reset',
      })
      check(
        result.failure?.type === NavigationFailureType.aborted,
        'Normal guard refuses reset before commit',
      )
      detail.value =
        'Normal route guard refused the destination; C history stayed intact.'
    } else if (name === 'dispose') {
      policy.dispose()
      result = await policy.dispatch(intent('disposed'), {
        mode: 'new',
        key: 'd',
        restore: 'fresh',
        history: 'append',
      })
      check(
        result.reason === 'scope-changed' && allocations === 2,
        'Disposed account policy cannot create a scene',
      )
      detail.value =
        'Account policy disposed. Later work cannot create, focus or navigate a window.'
    }
    await wait()
    const after = retained()
    for (const key of Object.keys(before)) {
      if (
        key === 'b' &&
        ['create-saved', 'reuse', 'focus-b', 'reset', 'close-b'].includes(name)
      )
        continue
      if (key === 'a' && name === 'focus-a') continue
      if (after[key])
        check(
          JSON.stringify(before[key]!.logical) === JSON.stringify(after[key]!.logical),
          `Unselected ${key} history retained`,
        )
    }
  } catch (value) {
    error = value
  }
  const stacks = snapshot()
  overview.value = Object.entries(stacks)
    .map(([key, entry]) => `${key.toUpperCase()}: ${entry.native.join(' → ')}`)
    .join('\n')
  await File.fromPath(
    `${knownFolders.documents().path}/intent-window-${name}.json`,
  ).writeText(
    JSON.stringify(
      {
        command: name,
        ok: !error,
        error: error ? String(error) : undefined,
        result: result && {
          status: result.status,
          reason: result.reason,
          failure: result.failure?.type,
        },
        allocations,
        focusRequests,
        stacks,
        sourceDraft: (first.source!.getViewById('intent-window-draft') as TextField).text,
      },
      null,
      2,
    ),
  )
  status.value = `${error ? 'FAIL' : 'PASS'} ${name}`
}
