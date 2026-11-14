import {
  File,
  knownFolders,
  Utils,
  type Frame,
  type Page,
  type TextField,
  type View,
} from '@nativescript/core'
import { createApp, defineComponent, h, ref, nextTick } from 'nativescript-vue'
import {
  createRouter,
  RouterTabs,
  RouterTab,
  RouterView,
  useRoute,
  onBeforeRouteLeave,
  NavigationCommandScope,
  useNavigationCommands,
  NavigationFailureType,
  type Router,
  type SuspendedIntent,
  type IntentResult,
} from 'vue-router-ns'
import {
  createDropPolicy,
  destinationType,
  type DropItem,
  type DropOwner,
} from '../../../examples/drag-drop/policy'
import { createDropLogin } from '../../../examples/drag-drop/login'
import {
  installAndroidDragSource,
  installAndroidDropTarget,
  type AndroidDragOrigin,
} from '../../../examples/drag-drop/android'

const selected = ref('source'),
  status = ref('STARTING'),
  detail = ref('Drag a protected document to Inbox. Login belongs to the receiving tab.'),
  hover = ref(false)
const processId = java.util.UUID.randomUUID().toString(),
  frames: Record<string, Frame> = {}
let mode = 'success',
  sequence = 0,
  ids = 0,
  drags = 0,
  drops = 0,
  collections = 0,
  guards = 0,
  loads = 0
let signedIn = false,
  permitted = true,
  session: object = {}
let sourcePage: Page | undefined, inboxPage: Page | undefined, dropView: View | undefined
let drag: ReturnType<typeof installAndroidDragSource> | undefined,
  drop: ReturnType<typeof installAndroidDropTarget> | undefined
let commands: ReturnType<typeof useNavigationCommands> | undefined,
  active: SuspendedIntent | undefined,
  old: SuspendedIntent | undefined,
  lastAttempt: Promise<IntentResult> | undefined,
  release: (() => void) | undefined
let lastOrigin: AndroidDragOrigin | undefined
let lastId = '',
  beforeDrag = ''
const pause = (ms = 180) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const check = (ok: unknown, message: string) => {
  if (!ok) throw new Error(message)
}
const collect = () =>
  setTimeout(() => {
    Utils.GC()
    collections++
  }, 0)
const payload = (id = 7) =>
  JSON.stringify({
    version: 1,
    destination: { route: { name: 'document', params: { id } } },
  })
const button = (title: string, name: string, run: () => unknown) =>
  h('Button', {
    text: title,
    automationText: `droplogin:${name}`,
    accessibilityLabel: `droplogin:${name}`,
    margin: 1,
    padding: 3,
    fontSize: 12,
    onTap: run,
  })
const Source = defineComponent({
  setup() {
    commands = useNavigationCommands([
      {
        id: 'protected-open',
        title: 'Open protected document in Inbox',
        shortcut: { input: 'o', modifiers: ['ctrl'] },
        action: () =>
          receive(
            `${processId}:${++ids}`,
            items(),
            { windowId: owner.windowId, frame: 'source' },
            true,
          ),
      },
    ])
    return () =>
      h('Page', { actionBarHidden: true, backgroundColor: '#f4f7fb' }, [
        h(NavigationCommandScope, { commands: commands!, padding: 24 }, () =>
          h('StackLayout', { verticalAlignment: 'center' }, [
            h('Label', { text: 'Library · retained source', fontSize: 23 }),
            h('Label', { id: 'drop-route', text: '/library', fontSize: 20 }),
            h('TextField', { id: 'drop-draft', text: 'Library draft', marginTop: 14 }),
            h(
              'GridLayout',
              {
                height: 95,
                margin: '16 12',
                borderRadius: 16,
                backgroundColor: '#17656c',
                accessible: true,
                accessibilityLabel: 'Protected document 7. Drag to Inbox.',
                onLoaded: (e: { object: View }) => {
                  drag ??= installAndroidDragSource(e.object, {
                    origin: () => ({ windowId: owner.windowId, frame: 'source' }),
                    items: () => {
                      collect()
                      return [payload()]
                    },
                    began: () => {
                      collect()
                      drags++
                      beforeDrag = JSON.stringify(retained())
                      status.value = 'DRAG · no navigation'
                    },
                    ended: (accepted) => {
                      if (!accepted)
                        void report(
                          'unexpected-cancel',
                          undefined,
                          new Error('Expected an accepting target'),
                        )
                    },
                    error: (error) => void report('source', undefined, error),
                  })
                },
                onUnloaded: () => {
                  drag = undefined
                },
              },
              [
                h('Label', {
                  text: 'Protected document 7\nDrag this card',
                  textWrap: true,
                  color: 'white',
                  fontSize: 20,
                  textAlignment: 'center',
                }),
              ],
            ),
            button(
              'Open protected document in Inbox',
              'open',
              () =>
                void receive(
                  `${processId}:${++ids}`,
                  items(),
                  { windowId: owner.windowId, frame: 'source' },
                  true,
                ),
            ),
            h('Label', {
              text: 'Keyboard: Control–O. Copy/open only.',
              fontSize: 12,
              textWrap: true,
              textAlignment: 'center',
              marginTop: 10,
            }),
          ]),
        ),
      ])
  },
})
const Target = defineComponent({
  setup() {
    const route = useRoute()
    onBeforeRouteLeave(() => {
      if (route.path === '/login' && active?.state.value.status === 'pending')
        login.cancel()
    })
    return () =>
      h('Page', { actionBarHidden: true, backgroundColor: '#f4f7fb' }, [
        h('StackLayout', { padding: 24, verticalAlignment: 'center' }, [
          h('Label', {
            text:
              route.path === '/login'
                ? 'Sign in to continue'
                : route.path === '/inbox'
                  ? 'Inbox · independent draft'
                  : `Document ${route.path.split('/').at(-1)} · Inbox`,
            fontSize: 24,
            textAlignment: 'center',
          }),
          h('Label', {
            id: 'drop-route',
            text: route.path,
            fontSize: 24,
            textAlignment: 'center',
            marginTop: 8,
          }),
          ...(route.path === '/inbox'
            ? [h('TextField', { id: 'drop-draft', text: 'Inbox draft', marginTop: 20 })]
            : []),
          ...(route.path === '/login'
            ? [
                h('Label', {
                  text: 'Controlled fixture sign-in; no credentials or external provider.',
                  textWrap: true,
                  fontSize: 14,
                  textAlignment: 'center',
                  margin: '16 0',
                }),
                button('Sign in (fixture)', 'sign-in', () => void signIn()),
                button('Try before sign-in', 'early', () => void action('early')),
                button('Cancel login', 'cancel-login', () => void action('cancel-login')),
                ...(mode === 'race'
                  ? [
                      button('Revoke access during guard', 'revoke', () => {
                        permitted = false
                        release?.()
                        release = undefined
                      }),
                    ]
                  : []),
                ...(mode === 'dispose'
                  ? [
                      button(
                        'Remove drop target',
                        'dispose-target',
                        () => void action('dispose-target'),
                      ),
                    ]
                  : []),
              ]
            : [
                h('Label', {
                  text: 'Library Page and both drafts stay retained.',
                  textWrap: true,
                  textAlignment: 'center',
                  marginTop: 20,
                }),
              ]),
        ]),
      ])
  },
})
const router = createRouter({
  routes: [
    { path: '/library', component: Source },
    { path: '/inbox', component: Target },
    { path: '/login', component: Target },
    { path: '/documents/:id', name: 'document', component: Target },
  ],
}) as unknown as Router
router.beforeEach((to) => {
  if (to.name !== 'document') return
  guards++
  if (!signedIn || !permitted) return false
  if (mode === 'guard') return false
  if (mode === 'race')
    return new Promise<void>((resolve) => {
      release = resolve
      detail.value = 'Guard is waiting. Revoke access before it completes.'
      void report('guard-waiting')
    })
})
router.afterEach((to, from, failure) => {
  if (
    mode === 'back' &&
    active &&
    from.path === '/login' &&
    to.path === '/inbox' &&
    !failure
  )
    void finishNativeBack(active)
})
async function finishNativeBack(request: SuspendedIntent) {
  let result: unknown, error: unknown
  try {
    await pause()
    signedIn = true
    result = await request.resume()
    check(
      (result as any).reason === 'cancelled',
      'Native Back cancels late login completion',
    )
    check(
      frames.target!.currentPage === inboxPage,
      'Native Back restored exact Inbox root',
    )
    retained()
    detail.value =
      'Native Back dismissed login. A late completion cannot open the document.'
  } catch (e) {
    error = e
  }
  await report('native-back', result, error)
}
const owner: DropOwner = {
  router,
  scope: `account:a:${processId}`,
  windowId: '',
  frame: 'target',
}
let login = makeLogin(),
  policy = makePolicy()
function makeLogin() {
  return createDropLogin({
    owner: () => owner,
    session: () => session,
    authenticated: () => signedIn,
    authorize: () => permitted,
    maxAge: mode === 'expire' ? 1500 : 300000,
    async presentLogin(receiving, request) {
      check(
        receiving === owner && receiving.frame === 'target',
        'Login belongs to receiving registration',
      )
      active = request
      const current = frames.target?.currentPage?.getViewById<any>('drop-route')?.text
      if (current !== '/login') {
        const failure = await router.push('/login', {
          frame: receiving.frame,
          animated: false,
        })
        check(!failure, 'Login presentation succeeded')
      } else selected.value = 'target'
      await pause()
      check(
        frames.target!.currentPage.getViewById<any>('drop-route').text === '/login',
        'Native Login Page visible',
      )
      check(selected.value === 'target', 'Login revealed target tab')
    },
  })
}
function makePolicy() {
  return createDropPolicy({
    owner: () => owner,
    authorize: (location) => location.name === 'document',
    handoff: login.handoff,
    stage: (stage) => {
      if (stage === 'loaded') loads++
    },
  })
}
function items(id = 7): readonly DropItem[] {
  return [
    {
      type: destinationType,
      load: () => ({ value: Promise.resolve(payload(id)), cancel() {} }),
    },
  ]
}
function snapshot() {
  return Object.fromEntries(
    ['source', 'target'].map((name) => [
      name,
      {
        logical: router.getHistory({ frame: name })?.entries.map((e) => e.route.path),
        native: [
          ...(frames[name]?.backStack.map((e) => e.resolvedPage) ?? []),
          frames[name]?.currentPage,
        ]
          .filter(Boolean)
          .map((p) => p!.getViewById<any>('drop-route')?.text),
      },
    ]),
  )
}
function retained() {
  sourcePage ??= frames.source!.currentPage
  inboxPage ??= frames.target!.currentPage
  check(frames.source!.currentPage === sourcePage, 'Exact source Page retained')
  check(
    frames.target!.currentPage === inboxPage ||
      frames.target!.backStack.some((e) => e.resolvedPage === inboxPage),
    'Exact Inbox root retained',
  )
  for (const [page, draft] of [
    [sourcePage, 'Library draft'],
    [inboxPage, 'Inbox draft'],
  ] as const)
    check(
      (page!.getViewById('drop-draft') as TextField).text === draft,
      `${draft} retained`,
    )
  const stacks = snapshot()
  for (const s of Object.values(stacks))
    check(
      JSON.stringify(s.logical) === JSON.stringify(s.native),
      'Native/logical histories agree',
    )
  return stacks
}
async function report(command: string, result?: unknown, error?: unknown) {
  const value = {
    command,
    ok: !error,
    error: error ? String(error) : undefined,
    sequence: ++sequence,
    process: processId,
    mode,
    selected: selected.value,
    drags,
    drops,
    loads,
    guards,
    collections,
    signedIn,
    permitted,
    suspension: active?.state.value,
    intent: active?.intent,
    result,
    origin: lastOrigin,
    target: { windowId: owner.windowId, frame: owner.frame, scope: owner.scope },
    stacks: snapshot(),
    sourceDraft: (sourcePage?.getViewById('drop-draft') as TextField)?.text,
    targetDraft: (inboxPage?.getViewById('drop-draft') as TextField)?.text,
  }
  await File.fromPath(`${knownFolders.documents().path}/drop-login.json`).writeText(
    JSON.stringify(value, null, 2),
  )
  status.value = `${error ? 'FAIL' : 'PASS'} ${command}`
}
async function receive(
  id: string,
  entries: readonly DropItem[],
  origin: AndroidDragOrigin,
  internal = false,
) {
  if (!internal) drops++
  lastOrigin = origin
  let error: unknown, result: unknown
  try {
    check(
      origin.windowId === owner.windowId && origin.frame === 'source',
      'Source window/frame captured',
    )
    check(
      android.os.Looper.myLooper() === android.os.Looper.getMainLooper(),
      'Drop handoff uses main thread',
    )
    lastId = id
    const outcome = await policy.drop(id, entries, internal ? 'internal' : 'drag-drop')
    result =
      outcome.status === 'settled'
        ? { status: outcome.navigation.status, intent: outcome.intent }
        : outcome
    check(outcome.status === 'settled', 'Validated drop reached app handoff')
    if (outcome.status === 'settled') {
      if (mode === 'direct')
        check(
          outcome.navigation.status === 'handled' &&
            !outcome.navigation.failure &&
            frames.target!.currentPage.getViewById<any>('drop-route').text ===
              '/documents/7',
          'Authenticated drop opened directly',
        )
      else
        check(
          outcome.navigation.status === 'suspended',
          'Accepted transfer is waiting for sign-in',
        )
    }
    retained()
    detail.value =
      mode === 'direct'
        ? 'Already signed in: the ordinary guard opened the document.'
        : 'Transfer accepted. The document has not opened; login is waiting in Inbox.'
  } catch (e) {
    error = e
  }
  await report(`${internal ? 'command' : 'drop'}-${mode}`, result, error)
}
function installTarget() {
  drop?.dispose()
  drop = installAndroidDropTarget(dropView!, {
    accepts: (types) => policy.accepts(types),
    nextId: () => `${processId}:${++ids}`,
    hover: (active) => {
      hover.value = active
      if (active) {
        check(JSON.stringify(retained()) === beforeDrag, 'Hover preserves both stacks')
        check(selected.value === 'source', 'Hover does not select target')
      }
    },
    receive,
    error: (error) => void report('bridge', undefined, error),
  })
}
async function signIn() {
  let result: IntentResult | undefined, error: unknown
  try {
    const handle = active!,
      page = frames.target!.currentPage
    if (mode === 'expire') await pause(1600)
    if (mode === 'account') {
      session = {}
      owner.scope = `account:b:${processId}`
    }
    if (mode === 'removed') router.removeRoute('document')
    signedIn = true
    lastAttempt = handle.resume()
    if (!['account', 'removed', 'expire'].includes(mode))
      check(handle.resume() === lastAttempt, 'Authorized completion shares exact promise')
    result = await lastAttempt
    if (['account', 'removed', 'expire'].includes(mode)) {
      check(
        result.status === 'ignored' &&
          result.reason ===
            (
              {
                account: 'scope-changed',
                removed: 'unmatched',
                expire: 'expired',
              } as Record<string, string>
            )[mode],
        'Stale destination rejected',
      )
      check(frames.target!.currentPage === page, 'No stale native presentation')
    } else if (['guard', 'race'].includes(mode)) {
      check(
        result.status === 'handled' &&
          result.failure?.type ===
            (mode === 'guard'
              ? NavigationFailureType.aborted
              : NavigationFailureType.cancelled),
        'Guard refusal/admission invalidation reported',
      )
      check(frames.target!.currentPage === page, 'Private Page never appeared')
    } else {
      check(
        result.status === 'handled' && !result.failure,
        'Destination opened through guards',
      )
      check(
        frames.target!.currentPage.getViewById<any>('drop-route').text ===
          `/documents/${mode === 'supersede' ? 8 : 7}`,
        'Original destination reached',
      )
      check(!snapshot().target!.native.includes('/login'), 'Login replaced')
      if (old)
        check((await old.resume()).status === 'ignored', 'Old request remains rejected')
    }
    retained()
    detail.value =
      result.status === 'ignored'
        ? `Login completion rejected: ${result.reason}. Source and drafts unchanged.`
        : result.failure
          ? 'Transfer succeeded, navigation refused. The private Page never appeared.'
          : 'Signed in: opened once in Inbox and replaced its Login Page. Both drafts retained.'
  } catch (e) {
    error = e
  }
  await report(`sign-in-${mode}`, result, error)
}
async function action(name: string) {
  let result: unknown, error: unknown
  try {
    if (name === 'early') {
      result = await active!.resume()
      check(
        (result as any).reason === 'unauthorized' &&
          active!.state.value.status === 'pending',
        'Early callback cannot authenticate',
      )
    }
    if (name === 'replay') {
      const before = JSON.stringify(retained())
      result = await policy.drop(lastId, items())
      check(
        (result as any).reason === 'repeat' && before === JSON.stringify(retained()),
        'Repeated delivery does not create login',
      )
    }
    if (name === 'again') {
      const page = frames.target!.currentPage
      check(active!.resume() === lastAttempt, 'Settled attempt reused')
      result = await active!.resume()
      check(frames.target!.currentPage === page, 'No duplicate native Page')
    }
    if (name === 'cancel-login' || name === 'dispose-target') {
      if (name === 'dispose-target') {
        login.dispose()
        policy.dispose()
        drop?.dispose()
      } else login.cancel()
      await router.back({ frame: 'target', animated: false })
      signedIn = true
      result = await active!.resume()
      check((result as any).reason === 'cancelled', 'Late completion remains cancelled')
    }
    if (name === 'newer') {
      const page = frames.target!.currentPage
      old = active
      result = await policy.drop(`${processId}:${++ids}`, items(8), 'internal')
      check(old!.state.value.reason === 'superseded', 'New request superseded old login')
      check(frames.target!.currentPage === page, 'One Login Page reused')
    }
    if (name === 'clear') {
      login.dispose()
      policy.dispose()
      drop?.dispose()
      drag?.dispose()
    }
    retained()
    detail.value = `Checked ${name}. Source Page, Inbox root and both drafts stay retained.`
  } catch (e) {
    error = e
  }
  const serializable =
    (result as any)?.navigation?.status === 'suspended'
      ? { status: 'suspended', oldState: old?.state.value }
      : result
  await report(name, serializable, error)
}
async function prepare(name: string) {
  let error: unknown
  try {
    login.dispose()
    policy.dispose()
    mode = name
    active = undefined
    old = undefined
    lastAttempt = undefined
    session = {}
    signedIn = name === 'direct'
    permitted = true
    owner.scope = `account:a:${processId}`
    if (!router.hasRoute('document'))
      router.addRoute({ path: '/documents/:id', name: 'document', component: Target })
    if (frames.target!.canGoBack())
      await router.backToRoot({ frame: 'target', animated: false })
    login = makeLogin()
    policy = makePolicy()
    installTarget()
    selected.value = 'source'
    await nextTick()
    await pause()
    if (name === 'keyboard') check(commands!.focus(), 'Keyboard scope focused')
    retained()
    detail.value = `Ready: ${name}. Drag the protected card to Inbox.`
  } catch (e) {
    error = e
  }
  await report(`prepare-${name}`, undefined, error)
}
createApp({
  render: () =>
    h(
      'GridLayout',
      {
        rows: 'auto,auto,auto,*',
        backgroundColor: '#e5edf7',
        androidOverflowEdge: 'none,cutout',
      },
      [
        h('StackLayout', { row: 0, padding: '8 16' }, [
          h('Label', {
            text: status.value,
            fontSize: 20,
            fontWeight: 'bold',
            color: '#17656c',
          }),
          h('Label', { text: detail.value, fontSize: 14, textWrap: true, marginTop: 8 }),
        ]),
        h('Label', {
          row: 1,
          text: hover.value ? 'Release to request access' : 'Drop here → Inbox tab',
          height: 60,
          margin: '0 24 8',
          backgroundColor: hover.value ? '#bde5cf' : '#d0e0ef',
          fontSize: 18,
          textAlignment: 'center',
          accessible: true,
          accessibilityLabel: 'Drop protected document into Inbox',
          onLoaded: (e: { object: View }) => {
            dropView = e.object
            installTarget()
          },
        }),
        h('WrapLayout', { row: 2, margin: '0 8 2' }, [
          ...[
            'success',
            'cancel',
            'back',
            'account',
            'removed',
            'expire',
            'guard',
            'race',
            'dispose',
            'supersede',
            'direct',
            'button',
            'keyboard',
          ].map((name) => button(name, `mode-${name}`, () => void prepare(name))),
          ...['repeat', 'newer', 'clear'].map((name) =>
            button(
              name,
              name,
              () =>
                void action(
                  name === 'repeat'
                    ? active?.state.value.status === 'pending'
                      ? 'replay'
                      : 'again'
                    : name,
                ),
            ),
          ),
        ]),
        h(
          RouterTabs,
          {
            row: 3,
            selected: selected.value,
            'onUpdate:selected': (name: string) => {
              selected.value = name
            },
          },
          () =>
            ['source', 'target'].map((name) =>
              h(RouterTab, { name, title: name === 'source' ? 'Library' : 'Inbox' }, () =>
                h(RouterView, {
                  name,
                  initial: name === 'source' ? '/library' : '/inbox',
                  onLoaded: (e: { object: Frame }) => {
                    frames[name] = e.object
                  },
                }),
              ),
            ),
        ),
      ],
    ),
})
  .use(router)
  .start()
void (async () => {
  try {
    await router.isReady()
    selected.value = 'target'
    const deadline = Date.now() + 15000
    while (!frames.source?.currentPage || !frames.target?.currentPage) {
      if (Date.now() > deadline) throw new Error('Frames did not mount')
      await pause(50)
    }
    owner.windowId = router.window.value!.id
    selected.value = 'source'
    await pause()
    retained()
    await report('ready')
  } catch (error) {
    await report('ready', undefined, error)
  }
})()
