// Actual OS edge-drag creation. No scene activation is called by a drag callback.
import {
  Application,
  File,
  Label,
  Utils,
  knownFolders,
  type Frame,
  type NativeWindow,
  type Page,
  type TextField,
  type View,
  type WindowContentRequest,
} from '@nativescript/core'
import { ActionBar, createApp, defineComponent, h, ref } from 'nativescript-vue'
import {
  createRouter,
  RouterView,
  useRoute,
  NavigationCommandScope,
  useNavigationCommands,
  type Router,
  type IntentResult,
} from 'vue-router-ns'
import type { DropOwner } from '../../../examples/drag-drop/policy'
import {
  createWindowDropOffers,
  type ClaimedWindowDrop,
  type WindowDropOffer,
} from '../../../examples/drag-drop/new-window'
import { installWindowDragSource } from '../../../examples/drag-drop/new-window-source.ios'

const activityType = 'org.nativescript.vuerouterns.window-drag'
const status = ref('STARTING'),
  detail = ref('Drag Document 7 to the right screen edge. iPadOS creates a new window.')
const processId = NSUUID.UUID().UUIDString
const live = new Map<string, Session>(),
  connections: { id: string; type: string; data: unknown }[] = [],
  closed: unknown[] = []
let mode = 'valid',
  sequence = 0,
  drags = 0,
  collections = 0,
  copyEnds = 0,
  cancelEnds = 0,
  allocations = 0,
  explicitRequests = 0,
  sourceGuards = 0
let identity: object = {},
  permitted = true,
  lastData: WindowDropOffer['data'] | undefined,
  lastOrigin: ClaimedWindowDrop['origin'] | undefined
let beforeDrag = '',
  beforeConnections = 0,
  releaseGuard: (() => void) | undefined,
  commands: ReturnType<typeof useNavigationCommands> | undefined
let destination: Session | undefined, grants: ReturnType<typeof createWindowDropOffers>
const pause = (ms = 300) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const check = (ok: unknown, message: string) => {
  if (!ok) throw new Error(message)
}
async function until(test: () => unknown, message: string) {
  const deadline = Date.now() + 15000
  while (!test()) {
    if (Date.now() > deadline) throw new Error(message)
    await pause(50)
  }
}
const collect = () =>
  setTimeout(() => {
    Utils.GC()
    collections++
  }, 0)
interface Session {
  window?: NativeWindow
  key: string
  router: Router
  owner: DropOwner
  app: ReturnType<typeof createApp>
  frame?: Frame
  root?: Page
  closed: boolean
  guarded: number
  claim?: ClaimedWindowDrop
  drag?: ReturnType<typeof installWindowDragSource>
  restoreDocument(): void
}
const button = (text: string, id: string, action: () => unknown) =>
  h('Button', {
    text,
    automationText: `windowcreate:${id}`,
    accessibilityLabel: text,
    margin: 3,
    fontSize: 15,
    onTap: action,
  })
function snapshot(s: Session) {
  const window = s.router.window.value,
    frame = s.frame
  return {
    key: s.key,
    windowId: s.owner.windowId,
    sceneId: (window?.ios?.scene as UIWindowScene | undefined)?.session
      .persistentIdentifier,
    frame: 'main',
    guarded: s.guarded,
    closed: s.closed,
    logical:
      s.router.getHistory({ frame: 'main' })?.entries.map((e) => e.route.path) ?? [],
    native: [...(frame?.backStack.map((e) => e.resolvedPage) ?? []), frame?.currentPage]
      .filter(Boolean)
      .map((p) => p!.getViewById<any>('windowcreate-route')?.text),
    draft: (s.root?.getViewById('windowcreate-draft') as TextField)?.text,
  }
}
function retained() {
  check(first.root === first.frame?.currentPage, 'Exact source Page retained')
  check(
    (first.root!.getViewById('windowcreate-draft') as TextField).text === 'Library draft',
    'Source draft unchanged',
  )
  const values = [...live.values()].map((s) => {
    const value = snapshot(s)
    check(
      JSON.stringify(value.logical) === JSON.stringify(value.native),
      'Native/logical histories agree',
    )
    if (s.root) {
      check(
        s.root === s.frame?.currentPage ||
          s.frame?.backStack.some((e) => e.resolvedPage === s.root),
        `Exact ${s.key} root retained`,
      )
      check(
        value.draft === (s.key === 'source' ? 'Library draft' : 'New window draft'),
        'Independent root draft retained',
      )
    }
    return value
  })
  check(
    JSON.stringify(snapshot(first).native) === '["/library"]',
    'Source history unchanged',
  )
  check(sourceGuards === 0, 'Source router never receives document navigation')
  check(
    new Set(values.map((s) => s.windowId)).size === values.length,
    'Each router has a distinct native owner',
  )
  return values
}
function report(command: string, result?: unknown, error?: unknown) {
  const value = {
    command,
    sequence: ++sequence,
    ok: !error,
    error: error ? String(error) : undefined,
    process: processId,
    mode,
    drags,
    collections,
    copyEnds,
    cancelEnds,
    allocations,
    explicitRequests,
    pending: grants?.pending,
    origin: lastOrigin,
    connections: [...connections],
    closed: [...closed],
    owners: [...live.values()].map(snapshot),
    nativeWindowIds: Application.ios.getWindows().map((w) => w.id),
    result,
  }
  File.fromPath(
    `${knownFolders.documents().path}/windowcreate-${sequence}.json`,
  ).writeTextSync(JSON.stringify(value, null, 2))
  status.value = `${error ? 'FAIL' : 'PASS'} ${command}`
}
function activityFor(offered: WindowDropOffer) {
  const activity = NSUserActivity.alloc().initWithActivityType(activityType)
  activity.title = 'Document 7'
  activity.userInfo = Utils.dataSerialize(offered.data)
  activity.targetContentIdentifier = `window-drag:${offered.data.windowDrag}`
  activity.eligibleForHandoff = false
  activity.eligibleForSearch = false
  activity.eligibleForPublicIndexing = false
  return activity
}
function offer(source: 'drag-drop' | 'internal') {
  const offered = grants.offer({ route: { name: 'document', params: { id: 7 } } }, source)
  check(
    offered.status === 'offered',
    'Destination authorized before providing a native item',
  )
  if (offered.status !== 'offered') throw new Error(offered.reason)
  lastData = offered.data
  return offered
}
function make(key: string, window?: NativeWindow): Session {
  const s = { key, window, closed: false, guarded: 0 } as Session
  const screen = defineComponent({
    setup() {
      const route = useRoute()
      if (key === 'source')
        commands = useNavigationCommands([
          {
            id: 'new-window',
            title: 'Open document in new window',
            shortcut: { input: 'o', modifiers: ['ctrl'] },
            action: () => alternative(),
          },
        ])
      const content = () =>
        h('StackLayout', { padding: 20, verticalAlignment: 'center' }, [
          h('Label', {
            id: 'windowcreate-route',
            text: route.path,
            fontSize: 26,
            textAlignment: 'center',
          }),
          ...(!route.path.startsWith('/documents/')
            ? [
                h('TextField', {
                  id: 'windowcreate-draft',
                  text: key === 'source' ? 'Library draft' : 'New window draft',
                  marginTop: 15,
                }),
              ]
            : []),
          ...(key === 'source'
            ? [
                h(
                  'GridLayout',
                  {
                    height: 150,
                    margin: '25 10',
                    borderRadius: 16,
                    backgroundColor: '#17656c',
                    automationText: 'windowcreate:card',
                    accessible: true,
                    accessibilityLabel:
                      'Document 7. Drag to screen edge for a new window.',
                    onLoaded: (e: { object: View }) => {
                      s.drag ??= installWindowDragSource(e.object, () => {
                        const offered = offer('drag-drop')
                        collect()
                        return {
                          activity: activityFor(offered),
                          title: 'Document 7',
                          cancel: offered.cancel,
                          began() {
                            collect()
                            drags++
                            beforeDrag = JSON.stringify(retained())
                            beforeConnections = connections.length
                            status.value = 'DRAG · system chooses the new window'
                            if (mode === 'account')
                              setTimeout(() => {
                                identity = {}
                              }, 150)
                            if (mode === 'permission')
                              setTimeout(() => {
                                permitted = false
                              }, 150)
                            if (mode === 'removed')
                              setTimeout(() => s.router.removeRoute('document'), 150)
                          },
                          ended(operation) {
                            if (operation === UIDropOperation.Copy) {
                              copyEnds++
                              status.value = 'TRANSFERRED · waiting for scene connection'
                            } else {
                              cancelEnds++
                              offered.cancel()
                              void cancelled(operation)
                            }
                          },
                        }
                      })
                    },
                  },
                  [
                    h('Label', {
                      text: 'Document 7\nDrag to the screen edge →',
                      color: 'white',
                      fontSize: 24,
                      textAlignment: 'center',
                      textWrap: true,
                    }),
                  ],
                ),
                button(
                  'Open document in new window',
                  'alternative',
                  () => void alternative(),
                ),
                h('Label', {
                  text: 'Control–O also opens a new window. The source is never moved.',
                  textWrap: true,
                  textAlignment: 'center',
                }),
              ]
            : [
                h('Label', {
                  text: 'This new window owns its router, history and draft.',
                  textWrap: true,
                  textAlignment: 'center',
                  marginTop: 24,
                }),
              ]),
        ])
      return () =>
        h('Page', { backgroundColor: '#f4f7fb' }, [
          h(ActionBar, {
            title:
              key === 'source' ? 'Library · original window' : 'New window · document',
          }),
          key === 'source'
            ? h(NavigationCommandScope, { commands: commands! }, content)
            : content(),
        ])
    },
  })
  s.router = createRouter({
    window,
    links: false,
    routes: [
      { path: '/library', component: screen },
      { path: '/inbox', component: screen },
      { path: '/documents/:id', name: 'document', component: screen },
    ],
  }) as unknown as Router
  s.restoreDocument = () => {
    if (!s.router.hasRoute('document'))
      s.router.addRoute({ path: '/documents/:id', name: 'document', component: screen })
  }
  s.router.beforeEach((to) => {
    if (key !== 'source' && to.path === '/inbox' && mode === 'close')
      return new Promise<boolean>((resolve) => {
        releaseGuard = () => resolve(false)
      })
    if (to.name !== 'document') return
    if (key === 'source') {
      sourceGuards++
      return false
    }
    s.guarded++
    if (mode === 'guard') return false
    if (mode === 'race')
      return new Promise<void>((resolve) => {
        releaseGuard = resolve
        report('guard-waiting')
      })
    if (!permitted) return false
  })
  s.owner = {
    router: s.router,
    scope: `account:a:${processId}`,
    windowId: window?.id ?? '',
    frame: 'main',
  }
  s.app = createApp({
    render: () =>
      h('GridLayout', { rows: 'auto,auto,*', backgroundColor: '#e5edf7' }, [
        h('StackLayout', { row: 0, padding: 14 }, [
          h('Label', {
            text: status.value,
            fontSize: 22,
            fontWeight: 'bold',
            color: '#17656c',
            textWrap: true,
          }),
          h('Label', { text: detail.value, textWrap: true, marginTop: 8 }),
        ]),
        key === 'source'
          ? h(
              'WrapLayout',
              { row: 1, margin: '0 10' },
              [
                'cancel',
                'guard',
                'account',
                'permission',
                'removed',
                'expired',
                'close',
                'race',
                'button',
                'keyboard',
                'replay',
                'clear',
              ].map((name) => button(name, `mode-${name}`, () => void command(name))),
            )
          : h('StackLayout', { row: 1 }, [
              ...(mode === 'race'
                ? [
                    button('Revoke permission', 'revoke', () => {
                      permitted = false
                      releaseGuard?.()
                    }),
                  ]
                : []),
            ]),
        h(RouterView, {
          row: 2,
          name: 'main',
          initial: key === 'source' ? '/library' : '/inbox',
          onLoaded: (e: { object: Frame }) => {
            s.frame = e.object
          },
        }),
      ]),
  }).use(s.router)
  live.set(key, s)
  window?.on('close', () => {
    if (s.closed) return
    closed.push(snapshot(s))
    s.closed = true
    s.claim?.cancel()
    s.drag?.dispose()
    releaseGuard?.()
    releaseGuard = undefined
    live.delete(key)
    s.app.unmount()
  })
  return s
}
function makeGrants() {
  return createWindowDropOffers({
    owner: () => (!first.closed ? first.owner : undefined),
    session: () => identity,
    authorize: () => permitted,
    nextId: () => NSUUID.UUID().UUIDString,
    maxAge: mode === 'expired' ? 700 : 30000,
  })
}
async function closeWindow(window: NativeWindow) {
  window.close()
  await until(() => window.state === 'closed', 'Native window closes')
  await pause(200)
}
async function disposeDestination() {
  if (destination && !destination.closed) {
    await closeWindow(destination.window!)
  }
  destination = undefined
}
function concise(result: IntentResult) {
  return result.status === 'ignored'
    ? result
    : {
        status: result.status,
        intent: result.intent,
        location: result.location.path,
        failure: result.failure ? { type: result.failure.type } : undefined,
      }
}
async function finish(s: Session, claim: ClaimedWindowDrop) {
  let result: IntentResult | undefined, error: unknown
  try {
    // Start delivery before mount/readiness completes; close mode really interrupts that wait.
    const attempt = claim.deliver(s.owner, () => live.get(s.key)?.owner)
    check(
      claim.deliver(s.owner, () => live.get(s.key)?.owner) === attempt,
      'Repeated delivery shares one attempt',
    )
    if (mode === 'close') setTimeout(() => s.window?.close(), 450)
    else {
      await s.router.isReady()
      await until(() => s.frame?.currentPage, 'New root mounted')
      s.root = s.frame!.currentPage
    }
    result = await attempt
    if (mode === 'close') {
      check(
        result.status === 'ignored' && result.reason === 'cancelled',
        'Closed receiver cancels pending readiness',
      )
      await until(() => s.closed, 'Target closure observed')
    } else {
      if (mode === 'guard' || mode === 'race') {
        check(
          result.status === 'handled' &&
            result.failure?.type === (mode === 'guard' ? 4 : 8),
          'Guard/refused admission does not create private Page',
        )
        check(
          JSON.stringify(snapshot(s).native) === '["/inbox"]',
          'Rejected receiver keeps only its public root',
        )
      } else {
        check(
          result.status === 'handled' && !result.failure,
          'Destination navigation succeeds',
        )
        check(
          JSON.stringify(snapshot(s).native) === '["/inbox","/documents/7"]',
          'New window owns only its own history',
        )
        check(
          result.status === 'handled' &&
            result.intent.target?.windowId === s.owner.windowId &&
            result.intent.target.frame === 'main',
          'Exact new owner bound to intent',
        )
        check(
          s.owner.windowId !== first.owner.windowId,
          'Original and created windows differ',
        )
      }
      await pause()
      retained()
      if (mode === 'guard' || mode === 'race') await closeWindow(s.window!)
    }
    check(grants.pending === 0, 'No grant remains after settlement')
    retained()
    detail.value = ['guard', 'race', 'close'].includes(mode)
      ? 'Failed navigation cleaned up its new window. Library Page and draft are intact.'
      : 'The OS created a new window; only that router opened Document 7.'
  } catch (e) {
    error = e
    if (!s.closed) await closeWindow(s.window!).catch(() => {})
  }
  report(
    `${mode === 'button' || mode === 'keyboard' ? 'command' : 'drop'}-${mode}`,
    result ? concise(result) : undefined,
    error,
  )
}
Application.setWindowContentResolver((request: WindowContentRequest) => {
  if (request.window.rootView) return request.window.rootView
  if (request.isPrimary) return undefined
  const activities = request.ios?.connectionOptions?.userActivities
  const activity =
    activities?.count === 1
      ? (activities.allObjects.objectAtIndex(0) as NSUserActivity)
      : undefined
  const data = activity?.userInfo ? Utils.dataDeserialize(activity.userInfo) : undefined
  connections.push({ id: request.window.id, type: activity?.activityType ?? '', data })
  const claim =
    activity?.activityType === activityType
      ? grants.take(data)
      : { status: 'ignored' as const, reason: 'invalid' as const }
  if (claim.status === 'ignored') {
    const placeholder = new Label()
    placeholder.text = 'This window request is no longer valid.'
    placeholder.textWrap = true
    request.window.on('close', () =>
      closed.push({ windowId: request.window.id, rejected: true }),
    )
    setTimeout(
      () =>
        void (async () => {
          let error: unknown
          try {
            await closeWindow(request.window)
            check(
              claim.reason ===
                (
                  {
                    account: 'scope-changed',
                    permission: 'unauthorized',
                    removed: 'unmatched',
                    expired: 'expired',
                  } as Record<string, string>
                )[mode],
              'Expected rejection at native connection',
            )
            retained()
            check(grants.pending === 0, 'Rejected grant cleaned up')
            check(
              Application.ios.getWindows().length === 1,
              'No rejected native window remains',
            )
          } catch (e) {
            error = e
          }
          detail.value = `New scene rejected: ${claim.reason}. It was closed without exposing a document.`
          report(`drop-${mode}`, claim, error)
        })(),
      400,
    )
    return placeholder
  }
  lastOrigin = claim.origin
  destination = make(`created-${++allocations}`, request.window)
  destination.claim = claim
  const view = destination.app.mount().$el.nativeView
  void finish(destination, claim)
  return view
})
const first = make('source')
grants = makeGrants()
first.app.start()
async function cancelled(operation: UIDropOperation) {
  let error: unknown
  try {
    await pause(1200)
    check(mode === 'cancel', 'Only intentional native cancellation')
    check(connections.length === beforeConnections, 'Cancelled drag creates no scene')
    check(
      JSON.stringify(retained()) === beforeDrag,
      'Cancelled drag leaves all history unchanged',
    )
    check(grants.pending === 0, 'Cancelled grant revoked')
  } catch (e) {
    error = e
  }
  detail.value = 'Drag cancelled. No new scene, no navigation and no pending grant.'
  report('cancel-cancel', { operation }, error)
}
async function alternative() {
  try {
    const offered = offer('internal'),
      scene = first.router.window.value!.ios!.scene as UIWindowScene
    const request = UISceneSessionActivationRequest.requestWithRole(
        UIWindowSceneSessionRoleApplication,
      ),
      options = UIWindowSceneActivationRequestOptions.new()
    options.requestingScene = scene
    options.placement = UIWindowSceneStandardPlacement.standardPlacement()
    request.options = options
    request.userActivity = activityFor(offered)
    explicitRequests++
    UIApplication.sharedApplication.activateSceneSessionForRequestErrorHandler(
      request,
      (error) => {
        offered.cancel()
        report(`command-${mode}`, undefined, error)
      },
    )
  } catch (error) {
    report(`command-${mode}`, undefined, error)
  }
}
async function command(name: string) {
  let result: unknown, error: unknown
  try {
    if (name === 'replay') {
      const count = connections.length,
        before = JSON.stringify(retained())
      result = grants.take(lastData)
      check(
        (result as any).reason === 'repeat',
        'Consumed activity cannot create another owner',
      )
      check(
        before === JSON.stringify(retained()) && connections.length === count,
        'Replay has no native side effect',
      )
    } else {
      await disposeDestination()
      grants.dispose()
      mode = name
      identity = {}
      permitted = true
      first.restoreDocument()
      lastOrigin = undefined
      if (name === 'clear') {
        first.drag?.dispose()
        detail.value =
          'All created windows closed; grants and interactions released. Original Library Page and draft retained.'
      } else {
        grants = makeGrants()
        detail.value = `Ready: ${name}. Drag the card to the right screen edge.`
        if (name === 'keyboard')
          check(commands!.focus(), 'Native keyboard command focused')
      }
      await pause()
      retained()
      check(
        Application.ios.getWindows().length === 1,
        'Only the original native window remains before next action',
      )
    }
  } catch (e) {
    error = e
  }
  report(`prepare-${name}`, result, error)
}
void (async () => {
  try {
    await first.router.isReady()
    await until(() => first.frame?.currentPage, 'Source mounted')
    first.root = first.frame!.currentPage
    first.owner.windowId = first.router.window.value!.id
    first.window = first.frame!.getNativeWindow()!
    retained()
    report('ready')
  } catch (error) {
    report('ready', undefined, error)
  }
})()
