import {
  File,
  knownFolders,
  Utils,
  type Frame,
  type Page,
  type TextField,
  type View,
} from '@nativescript/core'
import { ActionBar, createApp, defineComponent, h, ref, nextTick } from 'nativescript-vue'
import {
  createRouter,
  RouterTabs,
  RouterTab,
  RouterView,
  useRoute,
  NavigationCommandScope,
  useNavigationCommands,
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

const selected = ref('source'),
  status = ref('STARTING'),
  detail = ref(
    'Drag Document 7 to the Inbox target. Copy/open only; the source stays intact.',
  ),
  hover = ref(false)
const frames: Record<string, Frame> = {}
const processId = NSUUID.UUID().UUIDString
let mode = 'valid',
  sequence = 0,
  actionIds = 0,
  drags = 0,
  drops = 0,
  accepted = 0,
  loaded = 0,
  guarded = 0,
  collections = 0
let sourcePage: Page | undefined,
  inboxPage: Page | undefined,
  last: NavigationIntent | undefined
let beforeDrag = '',
  dropView: View | undefined
let dragRegistration: ReturnType<typeof installDragSource> | undefined
let dropRegistration: ReturnType<typeof installDropTarget> | undefined
let commands: ReturnType<typeof useNavigationCommands> | undefined
const pause = (ms = 350) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const collectBetweenCallbacks = () =>
  setTimeout(() => {
    Utils.GC()
    collections++
  }, 0)
const check = (ok: unknown, message: string) => {
  if (!ok) throw new Error(message)
}
const payload = () =>
  JSON.stringify({
    version: 1,
    destination: { route: { name: 'document', params: { id: 7 } } },
  })
const button = (title: string, name: string, run: () => unknown) =>
  h('Button', {
    text: title,
    automationText: `drop:${name}`,
    accessibilityLabel: title,
    margin: 4,
    onTap: run,
  })
const Source = defineComponent({
  setup() {
    commands = useNavigationCommands([
      {
        id: 'open-inbox',
        title: 'Open document in Inbox',
        shortcut: { input: 'o', modifiers: ['ctrl'] },
        action: () => accessibleOpen(),
      },
    ])
    return () =>
      h('Page', { backgroundColor: '#f4f7fb' }, [
        h(ActionBar, { title: '' }),
        h(NavigationCommandScope, { commands: commands!, padding: 24 }, () =>
          h('StackLayout', { verticalAlignment: 'center' }, [
            h('Label', { text: 'Library · retained source', fontSize: 24 }),
            h('Label', { id: 'drop-route', text: '/library', fontSize: 22 }),
            h('TextField', { id: 'drop-draft', text: 'Library draft', marginTop: 16 }),
            h(
              'GridLayout',
              {
                height: 130,
                margin: '26 40',
                borderRadius: 16,
                backgroundColor: '#17656c',
                automationText: 'drop:card',
                accessibilityLabel:
                  'Document 7. Drag to Inbox, or use Open document in Inbox.',
                accessible: true,
                onLoaded: (e: { object: View }) => {
                  dragRegistration ??= installDragSource(e.object, {
                    origin: () => ({
                      windowId: router.window.value!.id,
                      frame: 'source',
                    }),
                    items: () => {
                      collectBetweenCallbacks()
                      const data = {
                        json:
                          mode === 'invalid'
                            ? '{broken'
                            : mode === 'expired'
                              ? JSON.stringify({
                                  version: 1,
                                  destination: { route: '/documents/7' },
                                  expiresAt: 1,
                                })
                              : payload(),
                        delay: mode === 'slow' ? 1800 : 150,
                      }
                      return mode === 'multiple' ? [data, data] : [data]
                    },
                    began: () => {
                      collectBetweenCallbacks()
                      drags++
                      beforeDrag = JSON.stringify(retained())
                      status.value = 'DRAG · no navigation'
                    },
                    ended: (operation) => {
                      if (operation !== UIDropOperation.Copy)
                        void finishCancelled(operation)
                    },
                  })
                },
              },
              [
                h('Label', {
                  text: 'Document 7\nDrag this card',
                  color: 'white',
                  fontSize: 24,
                  textAlignment: 'center',
                  textWrap: true,
                }),
              ],
            ),
            button('Open document in Inbox', 'accessible', () => void accessibleOpen()),
            h('Label', {
              text: 'Keyboard: Control–O. No document is moved or deleted.',
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
    return () =>
      h('Page', { backgroundColor: '#f4f7fb' }, [
        h(ActionBar, { title: '' }),
        h('StackLayout', { padding: 28, verticalAlignment: 'center' }, [
          h('Label', {
            text: route.path.startsWith('/documents/')
              ? 'Document 7 · Inbox'
              : 'Inbox · independent draft',
            fontSize: 24,
            textAlignment: 'center',
          }),
          h('Label', {
            id: 'drop-route',
            text: route.path,
            fontSize: 28,
            textAlignment: 'center',
          }),
          ...(route.path === '/inbox'
            ? [h('TextField', { id: 'drop-draft', text: 'Inbox draft', marginTop: 20 })]
            : []),
          h('Label', {
            text: 'The source Library Page and both drafts remain retained.',
            textWrap: true,
            textAlignment: 'center',
            marginTop: 24,
          }),
        ]),
      ])
  },
})
const router = createRouter({
  routes: [
    { path: '/library', component: Source },
    { path: '/inbox', component: Target },
    { path: '/documents/:id', name: 'document', component: Target },
  ],
}) as unknown as Router
router.beforeEach((to) => {
  if (to.name === 'document') {
    guarded++
    if (mode === 'guard') return false
  }
})
const owner: DropOwner = {
  router,
  scope: `account:a:${processId}`,
  windowId: '',
  frame: 'target',
}
let policy = makePolicy()
function makePolicy() {
  return createDropPolicy({
    owner: () => owner,
    authorize: () => true,
    stage: (stage) => {
      if (stage === 'accepted') {
        accepted++
        status.value = 'ACCEPTED · loading provider'
        if (mode === 'slow')
          setTimeout(() => {
            policy.dispose()
            dropRegistration?.dispose()
          }, 200)
      }
      if (stage === 'loaded') {
        loaded++
        status.value = 'TRANSFERRED · validating destination'
      }
    },
  })
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
          .map((p) => (p!.getViewById('drop-route') as any)?.text),
      },
    ]),
  )
}
function retained() {
  sourcePage ??= frames.source!.currentPage
  inboxPage ??= frames.target!.currentPage
  check(sourcePage === frames.source!.currentPage, 'Exact source Page retained')
  check(
    inboxPage === frames.target!.currentPage ||
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
      JSON.stringify(s.native) === JSON.stringify(s.logical),
      'Native/logical histories agree',
    )
  return stacks
}
async function report(
  name: string,
  result?: unknown,
  error?: unknown,
  origin?: DragOrigin,
) {
  const value = {
    command: name,
    ok: !error,
    error: error ? String(error) : undefined,
    sequence: ++sequence,
    process: processId,
    mode,
    selected: selected.value,
    drags,
    drops,
    accepted,
    loaded,
    guarded,
    collections,
    result,
    origin,
    target: { windowId: router.window.value?.id, frame: 'target' },
    stacks: snapshot(),
    sourceDraft: (sourcePage?.getViewById('drop-draft') as TextField)?.text,
    targetDraft: (inboxPage?.getViewById('drop-draft') as TextField)?.text,
  }
  await File.fromPath(`${knownFolders.documents().path}/drop-${sequence}.json`).writeText(
    JSON.stringify(value, null, 2),
  )
  status.value = `${error ? 'FAIL' : 'PASS'} ${name}`
}
async function finishCancelled(operation: number) {
  let error: unknown
  try {
    await pause()
    check(
      JSON.stringify(retained()) === beforeDrag,
      'Cancelled drag preserves both stacks',
    )
    check(
      mode === 'cancel' || mode === 'multiple',
      'Only intentional cancellation or unsupported multi-item drag cancels',
    )
  } catch (e) {
    error = e
  }
  detail.value =
    'The native drag was cancelled or unsupported. No provider was loaded and neither history changed.'
  await report(`cancel-${mode}`, { operation }, error)
}
async function receive(
  id: string,
  items: readonly DropItem[],
  origin: DragOrigin | undefined,
  internal = false,
) {
  if (!internal) drops++
  let result: DropResult | undefined, error: unknown
  const before = JSON.stringify(retained())
  try {
    check(NSThread.isMainThread, 'Drop handoff on main thread')
    check(
      origin?.windowId === owner.windowId && origin.frame === 'source',
      'Actual source window/stack retained',
    )
    result = await policy.drop(id, items, internal ? 'internal' : 'drag-drop')
    if (result.status === 'settled') {
      last = result.intent
      check(result.navigation.status === 'handled', 'Navigation pipeline settled')
      if (mode === 'guard') {
        check(
          result.navigation.status === 'handled' && result.navigation.failure?.type === 4,
          'Ordinary guard refused navigation',
        )
        check(before === JSON.stringify(retained()), 'Refusal leaves histories unchanged')
      } else {
        check(
          frames.target!.currentPage.getViewById<any>('drop-route').text ===
            '/documents/7',
          'Target document visible',
        )
        check(selected.value === 'target', 'Target tab revealed')
      }
      detail.value =
        mode === 'guard'
          ? 'Transfer accepted; ordinary guard refused navigation. Copy/open never deletes the source.'
          : 'Document opened in the explicit Inbox stack. Library Page and both drafts remain intact.'
    } else {
      check(
        result.reason ===
          (
            {
              invalid: 'invalid',
              expired: 'expired',
              removed: 'unmatched',
              slow: 'disposed',
            } as Record<string, string>
          )[mode],
        'Explicit rejection outcome',
      )
      check(
        before === JSON.stringify(retained()),
        'Rejected drop leaves histories intact',
      )
      detail.value = `Drop accepted, navigation rejected: ${result.reason}. No document was moved.`
    }
    await pause()
    retained()
  } catch (e) {
    error = e
  }
  await report(`${internal ? 'command' : 'drop'}-${mode}`, result, error, origin)
}
function installTarget() {
  dropRegistration?.dispose()
  dropRegistration = installDropTarget(dropView!, {
    accepts: (types) => policy.accepts(types),
    nextId: () => `${processId}:${++actionIds}`,
    hover: (active) => {
      hover.value = active
      if (active) {
        check(JSON.stringify(retained()) === beforeDrag, 'Hover does not navigate')
        check(selected.value === 'source', 'Hover does not switch tabs')
        status.value = 'HOVER · no navigation'
      }
    },
    receive,
    error: (error) => void report('bridge', undefined, error),
  })
}
async function accessibleOpen() {
  await receive(
    `${processId}:${++actionIds}`,
    [
      {
        type: destinationType,
        load: () => ({ value: Promise.resolve(payload()), cancel() {} }),
      },
    ],
    { windowId: owner.windowId, frame: 'source' },
    true,
  )
}
async function command(name: string) {
  let error: unknown, result: unknown
  try {
    if (name === 'clear') {
      policy.dispose()
      dragRegistration?.dispose()
      dropRegistration?.dispose()
      detail.value =
        'Removed both native interactions and disposed pending drop policy. Both drafts are retained.'
    } else if (name === 'replay') {
      const before = JSON.stringify(retained())
      result = await router.openIntent(last)
      check((result as any).reason === 'repeat', 'Captured delivery deduplicated')
      check(before === JSON.stringify(retained()), 'Replay preserves histories')
    } else {
      mode = name
      if (name !== 'repeat' && frames.target!.canGoBack())
        await router.back({ frame: 'target', animated: false })
      if (!router.hasRoute('document'))
        router.addRoute({ path: '/documents/:id', name: 'document', component: Target })
      if (name === 'removed') router.removeRoute('document')
      policy.dispose()
      policy = makePolicy()
      installTarget()
      selected.value = 'source'
      await nextTick()
      await pause()
      if (name === 'keyboard')
        check(commands!.focus(), 'Native keyboard command scope focused')
      detail.value = `Ready: ${name}. Drag the card to Inbox, or use its accessible command.`
    }
    retained()
  } catch (e) {
    error = e
  }
  await report(`prepare-${name}`, result, error)
}
createApp({
  render: () =>
    h('GridLayout', { rows: 'auto,auto,auto,*', backgroundColor: '#e5edf7' }, [
      h('StackLayout', { row: 0, padding: '16 24' }, [
        h('Label', {
          text: status.value,
          fontSize: 24,
          fontWeight: 'bold',
          color: '#17656c',
        }),
        h('Label', { text: detail.value, fontSize: 17, textWrap: true, marginTop: 8 }),
      ]),
      h('GridLayout', { row: 1, columns: '*,*', margin: '0 24 8', height: 80 }, [
        h('Label', {
          col: 0,
          text: hover.value ? 'Release to open in Inbox' : 'Drop here → Inbox tab',
          backgroundColor: hover.value ? '#bde5cf' : '#d0e0ef',
          fontSize: 21,
          textAlignment: 'center',
          automationText: 'drop:target',
          accessible: true,
          accessibilityLabel: 'Drop target: open document in Inbox',
          onLoaded: (e: { object: View }) => {
            dropView = e.object
            if (!dropRegistration) installTarget()
          },
        }),
        h('Label', {
          col: 1,
          text: 'Cancel area\nRelease here to keep both stacks',
          textAlignment: 'center',
          textWrap: true,
          automationText: 'drop:cancel-area',
          marginLeft: 12,
          backgroundColor: '#f0e2db',
        }),
      ]),
      h(
        'WrapLayout',
        { row: 2, margin: '0 18 8' },
        [
          'valid',
          'repeat',
          'cancel',
          'multiple',
          'invalid',
          'expired',
          'removed',
          'slow',
          'guard',
          'accessible',
          'keyboard',
          'replay',
          'clear',
        ].map((name) => button(name, `mode-${name}`, () => void command(name))),
      ),
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
            h(
              RouterTab,
              {
                name,
                title: name === 'source' ? 'Library' : 'Inbox',
                icon: name === 'source' ? 'doc.text' : 'tray',
              },
              () =>
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
    ]),
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
