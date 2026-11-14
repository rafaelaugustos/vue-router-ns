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
  type Router,
  type NavigationIntent,
} from 'vue-router-ns'
import {
  createDropPolicy,
  destinationType,
  type DropItem,
  type DropOwner,
  type DropResult,
} from '../../../examples/drag-drop/policy'
import {
  installDragSource,
  installDropTarget,
  type DragOrigin,
} from '../../../examples/drag-drop/ios'
import { requestAdjacentWindow } from '../../../examples/drag-drop/windows.ios'

const live = new Map<string, Session>()
const status = ref('STARTING'),
  detail = ref('Open Inbox beside Library, then drag the document across windows.')
const processId = NSUUID.UUID().UUIDString
let mode = 'valid',
  sequence = 0,
  actions = 0,
  drags = 0,
  accepted = 0,
  loaded = 0,
  collections = 0,
  allocations = 0
let pendingRequest: string | undefined,
  last: NavigationIntent | undefined,
  beforeDrag = ''
let destination: Session | undefined
const pause = (ms = 350) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const check = (ok: unknown, message: string) => {
  if (!ok) throw new Error(message)
}
async function until(predicate: () => unknown, message: string) {
  const deadline = Date.now() + 15000
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(message)
    await pause(50)
  }
}
const collect = () =>
  setTimeout(() => {
    Utils.GC()
    collections++
  }, 0)
const payload = () =>
  JSON.stringify({
    version: 1,
    destination: { route: { name: 'document', params: { id: 7 } } },
  })
interface Session {
  key: string
  router: Router
  owner: DropOwner
  app: ReturnType<typeof createApp>
  frame?: Frame
  root?: Page
  policy: ReturnType<typeof createDropPolicy>
  drop?: ReturnType<typeof installDropTarget>
  drag?: ReturnType<typeof installDragSource>
  dropView?: View
  closed: boolean
  canRead: boolean
  guarded: number
  beforeClose?: ReturnType<typeof snapshotSession>
}
const button = (text: string, id: string, run: () => unknown) =>
  h('Button', {
    text,
    automationText: `windowdrop:${id}`,
    accessibilityLabel: text,
    margin: 3,
    onTap: run,
  })
function makePolicy(s: Session) {
  return createDropPolicy({
    owner: () => (live.get(s.key) === s && !s.closed ? s.owner : undefined),
    authorize: () => s.canRead,
    stage: (stage) => {
      if (stage === 'loaded') {
        loaded++
        status.value = 'TRANSFERRED · validating'
      }
      if (stage === 'accepted') {
        accepted++
        status.value = 'ACCEPTED · loading provider'
        if (mode === 'account')
          setTimeout(() => {
            s.owner.scope = `account:b:${processId}`
          }, 150)
        if (mode === 'removed')
          setTimeout(() => {
            s.canRead = false
          }, 150)
        if (mode === 'close')
          setTimeout(() => {
            s.beforeClose = snapshotSession(s)
            s.frame!.getNativeWindow()!.close()
          }, 150)
      }
    },
  })
}
function attachTarget(s: Session) {
  s.drop?.dispose()
  s.drop = installDropTarget(s.dropView!, {
    accepts: s.policy.accepts,
    nextId: () => `${processId}:${++actions}`,
    hover: (active) => {
      s.dropView!.backgroundColor = active ? '#bde5cf' : '#d0e0ef'
      if (active) {
        check(JSON.stringify(retained()) === beforeDrag, 'Hover preserves both windows')
        status.value = 'HOVER · no navigation'
      }
    },
    receive: (id, items, origin) => receive(s, id, items, origin),
    error: (error) => void report('bridge', undefined, error),
  })
}
function makeSession(key: string, window?: NativeWindow): Session {
  const s = { key, closed: false, canRead: true, guarded: 0 } as Session
  const screen = defineComponent({
    setup() {
      const route = useRoute()
      return () =>
        h('Page', { backgroundColor: '#f4f7fb' }, [
          h(ActionBar, {
            title: key === 'a' ? 'Library · window A' : 'Inbox · window B',
          }),
          h('StackLayout', { padding: 20, verticalAlignment: 'center' }, [
            h('Label', {
              id: 'windowdrop-route',
              text: route.path,
              fontSize: 26,
              textAlignment: 'center',
            }),
            ...(!route.path.startsWith('/documents/')
              ? [
                  h('TextField', {
                    id: 'windowdrop-draft',
                    text: `Independent draft ${key.toUpperCase()}`,
                    marginTop: 15,
                  }),
                ]
              : []),
            ...(key === 'a'
              ? [
                  h(
                    'GridLayout',
                    {
                      height: 140,
                      margin: '24 10',
                      backgroundColor: '#17656c',
                      borderRadius: 16,
                      automationText: 'windowdrop:card',
                      accessible: true,
                      accessibilityLabel:
                        'Document 7. Drag to the Inbox window, or use Open in Inbox window.',
                      onLoaded: (e: { object: View }) => {
                        s.drag ??= installDragSource(e.object, {
                          origin: () => ({
                            windowId: e.object.getNativeWindow()!.id,
                            frame: 'main',
                          }),
                          items: () => {
                            collect()
                            return [
                              {
                                json: payload(),
                                delay: ['account', 'removed', 'close'].includes(mode)
                                  ? 1800
                                  : 150,
                              },
                            ]
                          },
                          began: () => {
                            collect()
                            drags++
                            beforeDrag = JSON.stringify(retained())
                            status.value = 'DRAG · across real windows'
                          },
                          ended: (operation) => {
                            if (operation !== UIDropOperation.Copy)
                              void cancelled(operation)
                          },
                        })
                      },
                    },
                    [
                      h('Label', {
                        text: 'Document 7\nDrag to Inbox →',
                        textWrap: true,
                        textAlignment: 'center',
                        color: 'white',
                        fontSize: 24,
                      }),
                    ],
                  ),
                  button(
                    'Open in Inbox window',
                    'accessible',
                    () => void accessibleOpen(),
                  ),
                ]
              : [
                  h('Label', {
                    text: 'Only this window receives the destination. Library stays intact.',
                    textWrap: true,
                    textAlignment: 'center',
                    marginTop: 20,
                  }),
                ]),
          ]),
        ])
    },
  })
  s.router = createRouter({
    window,
    routes: [
      { path: '/library', component: screen },
      { path: '/inbox', component: screen },
      { path: '/documents/:id', name: 'document', component: screen },
    ],
  }) as unknown as Router
  s.router.beforeEach((to) => {
    if (to.name === 'document') {
      s.guarded++
      if (mode === 'guard') return false
    }
  })
  s.owner = {
    router: s.router,
    scope: `account:a:${processId}`,
    windowId: window?.id ?? '',
    frame: 'main',
  }
  s.policy = makePolicy(s)
  s.app = createApp({
    render: () =>
      h('GridLayout', { rows: 'auto,auto,auto,*', backgroundColor: '#e5edf7' }, [
        h('StackLayout', { row: 0, padding: '14 16' }, [
          h('Label', {
            text: status.value,
            fontSize: 22,
            fontWeight: 'bold',
            color: '#17656c',
            textWrap: true,
          }),
          h('Label', { text: detail.value, marginTop: 8, textWrap: true }),
        ]),
        ...(key === 'a'
          ? [
              h(
                'WrapLayout',
                { row: 1, margin: '0 10' },
                [
                  'create',
                  'repeat',
                  'replay',
                  'guard',
                  'account',
                  'removed',
                  'cancel',
                  'accessible',
                  'close',
                  'clear',
                ].map((name) => button(name, `mode-${name}`, () => void command(name))),
              ),
              h('Label', {
                row: 2,
                text: 'Cancel area\nRelease here to keep both windows unchanged',
                textWrap: true,
                height: 80,
                margin: '8 16',
                textAlignment: 'center',
                backgroundColor: '#f0e2db',
                automationText: 'windowdrop:cancel-area',
              }),
            ]
          : [
              h('Label', {
                row: 1,
                text: 'Drop here → Inbox window',
                textWrap: true,
                height: 140,
                margin: '8 16',
                textAlignment: 'center',
                fontSize: 23,
                backgroundColor: '#d0e0ef',
                automationText: 'windowdrop:target',
                accessible: true,
                accessibilityLabel: 'Drop target: Inbox window',
                onLoaded: (e: { object: View }) => {
                  s.dropView = e.object
                  if (!s.drop) attachTarget(s)
                },
              }),
            ]),
        h(RouterView, {
          row: 3,
          name: 'main',
          initial: key === 'a' ? '/library' : '/inbox',
          onLoaded: (e: { object: Frame }) => {
            s.frame = e.object
          },
        }),
      ]),
  })
  live.set(key, s)
  s.app.use(s.router)
  window?.on('close', () => {
    s.closed = true
    s.policy.dispose()
    s.drop?.dispose()
    s.drag?.dispose()
    if (live.get(key) === s) live.delete(key)
    s.app.unmount()
  })
  return s
}
Application.setWindowContentResolver((request: WindowContentRequest) => {
  if (request.window.rootView) return request.window.rootView
  if (request.isPrimary) return undefined
  if (
    !pendingRequest ||
    request.data?.dropWindowRequest !== pendingRequest ||
    live.has('b')
  ) {
    const placeholder = new Label()
    placeholder.text = 'This window request is no longer active.'
    setTimeout(() => request.window.close(), 0)
    return placeholder
  }
  pendingRequest = undefined
  destination = makeSession('b', request.window)
  return destination.app.mount().$el.nativeView
})
const first = makeSession('a')
first.app.start()

function snapshotSession(s: Session) {
  const frame = s.frame!,
    window = s.router.window.value!
  const scene = window.ios?.scene as UIWindowScene
  return {
    windowId: window.id,
    frame: 'main',
    state: window.state,
    sceneId: scene.session.persistentIdentifier,
    guarded: s.guarded,
    logical: s.router.getHistory({ frame: 'main' })?.entries.map((e) => e.route.path),
    native: [...frame.backStack.map((e) => e.resolvedPage), frame.currentPage]
      .filter(Boolean)
      .map((p) => p!.getViewById<any>('windowdrop-route')?.text),
    draft: (s.root?.getViewById('windowdrop-draft') as TextField)?.text,
  }
}
function retained() {
  const result: Record<string, ReturnType<typeof snapshotSession>> = {}
  for (const [key, s] of live) {
    s.root ??= s.frame!.currentPage
    check(
      s.root === s.frame!.currentPage ||
        s.frame!.backStack.some((e) => e.resolvedPage === s.root),
      `Exact Page ${key} retained`,
    )
    check(
      s.frame!.getNativeWindow()?.id === s.owner.windowId,
      `Frame belongs to window ${key}`,
    )
    const value = snapshotSession(s)
    check(
      value.draft === `Independent draft ${key.toUpperCase()}`,
      `Draft ${key} retained`,
    )
    check(
      JSON.stringify(value.logical) === JSON.stringify(value.native),
      `Histories ${key} agree`,
    )
    result[key] = value
  }
  check(
    new Set(Object.values(result).map((s) => s.windowId)).size === live.size,
    'Distinct native window owners',
  )
  check(JSON.stringify(result.a!.native) === '["/library"]', 'Library history unchanged')
  return result
}
async function report(
  name: string,
  result?: unknown,
  error?: unknown,
  origin?: DragOrigin,
) {
  const data = {
    command: name,
    ok: !error,
    error: error ? String(error) : undefined,
    sequence: ++sequence,
    process: processId,
    mode,
    drags,
    accepted,
    loaded,
    collections,
    allocations,
    origin,
    target: destination
      ? {
          windowId: destination.owner.windowId,
          frame: 'main',
          closed: destination.closed,
        }
      : undefined,
    owners: Object.fromEntries([...live].map(([key, s]) => [key, snapshotSession(s)])),
    closedTarget: destination?.closed ? destination.beforeClose : undefined,
    result,
  }
  await File.fromPath(
    `${knownFolders.documents().path}/windowdrop-${sequence}.json`,
  ).writeText(JSON.stringify(data, null, 2))
  status.value = `${error ? 'FAIL' : 'PASS'} ${name}`
}
async function receive(
  s: Session,
  id: string,
  items: readonly DropItem[],
  origin?: DragOrigin,
  internal = false,
) {
  let result: DropResult | undefined, error: unknown
  const before = JSON.stringify(retained())
  try {
    check(NSThread.isMainThread, 'Main-thread handoff')
    check(
      origin?.windowId === first.owner.windowId &&
        origin.windowId !== s.owner.windowId &&
        origin.frame === 'main',
      'Actual cross-window origin',
    )
    result = await s.policy.drop(id, items, internal ? 'internal' : 'drag-drop')
    if (result.status === 'settled') {
      last = result.intent
      check(result.navigation.status === 'handled', 'Normal router pipeline')
      if (mode === 'guard') {
        check(
          result.navigation.status === 'handled' && result.navigation.failure?.type === 4,
          'Target guard refusal',
        )
        // Guard counters change; compare histories and exact retained Pages below.
        check(
          s.frame!.currentPage.getViewById<any>('windowdrop-route').text === '/inbox',
          'Guard preserves target root',
        )
      } else {
        check(
          s.frame!.currentPage.getViewById<any>('windowdrop-route').text ===
            '/documents/7',
          'Target document visible',
        )
        if (mode === 'repeat')
          check(
            result.navigation.status === 'handled' &&
              result.navigation.failure?.type === 16,
            'New drag gets ordinary duplicate result',
          )
      }
      detail.value =
        mode === 'guard'
          ? 'Transfer accepted; Inbox guard refused navigation.'
          : 'Opened in window B. Window A and both independent drafts stay intact.'
    } else {
      check(
        result.reason ===
          (
            {
              account: 'owner-changed',
              removed: 'unauthorized',
              close: 'disposed',
            } as Record<string, string>
          )[mode],
        'Expected rejection after asynchronous provider',
      )
      if (mode === 'close') {
        await until(() => s.closed, 'Target window closed')
        await pause(2200)
        check(
          live.size === 1 && Application.getWindows().length === 1,
          'No replacement or orphan window',
        )
      } else
        check(
          before === JSON.stringify(retained()),
          'Rejected transfer preserves both owners',
        )
      detail.value = `Rejected: ${result.reason}. Source document stays in Library.`
    }
    await pause()
    retained()
  } catch (e) {
    error = e
  }
  await report(`${internal ? 'command' : 'drop'}-${mode}`, result, error, origin)
}
async function cancelled(operation: number) {
  let error: unknown
  try {
    await pause()
    check(mode === 'cancel', 'Intentional cancellation')
    check(
      beforeDrag === JSON.stringify(retained()),
      'Cancelled drag preserves both owners',
    )
  } catch (e) {
    error = e
  }
  detail.value = 'Cancelled native drag. Neither window navigated.'
  await report('cancel-cancel', { operation }, error)
}
async function accessibleOpen() {
  if (!destination || destination.closed) return
  await receive(
    destination,
    `${processId}:${++actions}`,
    [
      {
        type: destinationType,
        load: () => ({ value: Promise.resolve(payload()), cancel() {} }),
      },
    ],
    { windowId: first.owner.windowId, frame: 'main' },
    true,
  )
}
async function command(name: string) {
  let error: unknown, result: unknown
  try {
    if (name === 'create') {
      check(!destination && !pendingRequest, 'Only one target allocation')
      const token = (pendingRequest = NSUUID.UUID().UUIDString)
      let nativeError: NSError | undefined
      allocations++
      requestAdjacentWindow(first.frame!.getNativeWindow()!, token, (e) => {
        nativeError = e
      })
      try {
        await until(() => destination || nativeError, 'Create adjacent window')
      } finally {
        pendingRequest = undefined
      }
      if (nativeError) throw new Error(nativeError.localizedDescription)
      await destination!.router.isReady()
      await until(() => destination!.frame?.currentPage, 'Target Frame ready')
      retained()
      await pause(800)
      detail.value = 'Two real windows. Drag Document 7 from Library to the Inbox target.'
    } else if (name === 'clear') {
      first.drag?.dispose()
      first.policy.dispose()
      destination?.policy.dispose()
      destination?.drop?.dispose()
      detail.value =
        'Target closed; source draft retained. Native interactions cleaned up.'
    } else if (name === 'replay') {
      result = await destination!.router.openIntent(last)
      check((result as any).reason === 'repeat', 'Captured intent deduplicated in target')
    } else {
      const s = destination!
      mode = name
      if (name !== 'repeat' && s.frame!.canGoBack())
        await s.router.back({ frame: 'main', animated: false })
      s.policy.dispose()
      s.canRead = true
      s.owner.scope = `account:a:${processId}`
      s.policy = makePolicy(s)
      attachTarget(s)
      detail.value = `Ready: ${name}. Drag into the other window, or use the open command.`
      await pause()
    }
    retained()
  } catch (e) {
    error = e
  }
  await report(name === 'create' ? 'create-target' : `prepare-${name}`, result, error)
}
void (async () => {
  try {
    await first.router.isReady()
    first.owner.windowId = first.router.window.value!.id
    await until(() => first.frame?.currentPage, 'Source Frame ready')
    retained()
    await report('ready')
  } catch (error) {
    await report('ready', undefined, error)
  }
})()
