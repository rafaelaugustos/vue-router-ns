// Optional iPad sidebar recipe acceptance: --env.sidebardropTest.
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
  RouterDrawer,
  RouterTabs,
  RouterTab,
  RouterView,
  useRoute,
  NavigationCommandScope,
  useNavigationCommands,
  type Router,
  type NavigationIntent,
  type RouterDrawerHandle,
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

type Destination = 'inbox' | 'archive'
const destinations: Destination[] = ['inbox', 'archive']
const names = ['source', ...destinations] as const
const titles = { source: 'Library', inbox: 'Inbox', archive: 'Archive' }
const selected = ref('source'),
  status = ref('STARTING'),
  detail = ref(
    'Drag a document to a sidebar destination. Each row owns its receiving stack.',
  )
const highlighted = ref<Destination>(),
  disabled = ref<Destination>()
const drawer = ref<RouterDrawerHandle>()
const frames: Record<string, Frame> = {},
  roots: Record<string, Page> = {}
const views: Partial<Record<Destination, View>> = {}
const registrations: Partial<Record<Destination, ReturnType<typeof installDropTarget>>> =
  {}
const policies: Partial<Record<Destination, ReturnType<typeof createDropPolicy>>> = {}
const owners: Partial<Record<Destination, DropOwner>> = {}
const processId = NSUUID.UUID().UUIDString
let mode = 'valid',
  sequence = 0,
  actionIds = 0,
  drags = 0,
  drops = 0,
  accepted = 0,
  loaded = 0,
  collections = 0
let permission = true,
  beforeDrag = '',
  beforeAccepted = 0,
  beforeLoaded = 0,
  hoverTimer: ReturnType<typeof setTimeout> | undefined
let hovered: {
  destination: Destination
  selected: string
  accepted: number
  loaded: number
}[] = []
let last: NavigationIntent | undefined,
  dragRegistration: ReturnType<typeof installDragSource> | undefined
let commands: ReturnType<typeof useNavigationCommands> | undefined
const guarded: Record<Destination, number> = { inbox: 0, archive: 0 }
const pause = (ms = 300) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const check = (ok: unknown, message: string) => {
  if (!ok) throw new Error(message)
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
const targetFor = (): Destination =>
  mode === 'archive' || mode === 'accessible' ? 'archive' : 'inbox'
const button = (text: string, id: string, action: () => unknown) =>
  h('Button', {
    text,
    automationText: `sidebar:${id}`,
    accessibilityLabel: text,
    fontSize: 16,
    margin: 3,
    onTap: action,
  })
const Source = defineComponent({
  setup() {
    commands = useNavigationCommands([
      {
        id: 'open-inbox',
        title: 'Open document in Inbox',
        shortcut: { input: 'o', modifiers: ['ctrl'] },
        action: () => accessibleOpen('inbox'),
      },
    ])
    return () =>
      h('Page', { backgroundColor: '#f4f7fb' }, [
        h(ActionBar, { title: '' }),
        h(NavigationCommandScope, { commands: commands!, padding: 24 }, () =>
          h('StackLayout', { verticalAlignment: 'center' }, [
            h('Label', { text: 'Library · retained source', fontSize: 26 }),
            h('Label', { id: 'sidebar-route', text: '/library', fontSize: 22 }),
            h('TextField', { id: 'sidebar-draft', text: 'Library draft', marginTop: 16 }),
            h(
              'GridLayout',
              {
                height: 150,
                margin: '26 20',
                borderRadius: 16,
                backgroundColor: '#17656c',
                automationText: 'sidebar:card',
                accessible: true,
                accessibilityLabel:
                  'Document 7. Drag to Inbox or Archive in the sidebar.',
                onLoaded: (e: { object: View }) => {
                  dragRegistration ??= installDragSource(e.object, {
                    origin: () => ({
                      windowId: router.window.value!.id,
                      frame: 'source',
                    }),
                    items: () => {
                      collect()
                      const item = {
                        json: payload(),
                        delay: ['slow', 'owner', 'permission'].includes(mode)
                          ? 1600
                          : 120,
                      }
                      return mode === 'multiple' ? [item, item] : [item]
                    },
                    began: () => {
                      collect()
                      drags++
                      beforeDrag = JSON.stringify(retained())
                      beforeAccepted = accepted
                      beforeLoaded = loaded
                      hovered = []
                      status.value = 'DRAG · choose a sidebar row'
                    },
                    ended: (operation) => {
                      if (operation !== UIDropOperation.Copy) void cancelled(operation)
                    },
                  })
                },
              },
              [
                h('Label', {
                  text: 'Document 7\nDrag to a sidebar row',
                  color: 'white',
                  fontSize: 26,
                  textAlignment: 'center',
                  textWrap: true,
                }),
              ],
            ),
            h('Label', {
              text: 'The source stays intact. Hover highlights only.\nControl–O opens in Inbox without dragging.',
              fontSize: 17,
              textWrap: true,
              textAlignment: 'center',
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
              ? 'Document 7'
              : `${route.path === '/inbox' ? 'Inbox' : 'Archive'} · independent draft`,
            fontSize: 27,
            textAlignment: 'center',
          }),
          h('Label', {
            id: 'sidebar-route',
            text: route.path,
            fontSize: 28,
            textAlignment: 'center',
          }),
          ...(!route.path.startsWith('/documents/')
            ? [
                h('TextField', {
                  id: 'sidebar-draft',
                  text: route.path === '/inbox' ? 'Inbox draft' : 'Archive draft',
                  marginTop: 20,
                }),
              ]
            : []),
          h('Label', {
            text: 'All three root Pages and their drafts remain retained. The other destination keeps its own history.',
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
    { path: '/archive', component: Target },
    { path: '/documents/:id', name: 'document', component: Target },
  ],
}) as unknown as Router
router.beforeEach((to) => {
  if (to.name !== 'document') return
  const destination = selected.value as Destination
  check(
    destinations.includes(destination),
    'The receiving stack is selected before its guard',
  )
  guarded[destination]++
  if (mode === 'guard' || !permission) return false
})
function mountRow(destination: Destination) {
  disposeRow(destination)
  owners[destination] = {
    router,
    scope: `account:a:${processId}`,
    windowId: router.window.value?.id ?? '',
    frame: destination,
  }
  policies[destination] = createDropPolicy({
    owner: () => owners[destination],
    authorize: () => permission,
    stage: (stage) => {
      if (stage === 'accepted') {
        accepted++
        status.value = `ACCEPTED · ${titles[destination]} provider pending`
        if (['slow', 'owner', 'permission'].includes(mode))
          setTimeout(() => {
            if (mode === 'slow') {
              disposeRow(destination)
              disabled.value = destination
            }
            if (mode === 'owner')
              owners[destination]!.frame = destination === 'inbox' ? 'archive' : 'inbox'
            if (mode === 'permission') permission = false
          }, 150)
      } else {
        loaded++
        status.value = 'TRANSFERRED · validating destination'
      }
    },
  })
  const policy = policies[destination]!
  registrations[destination] = installDropTarget(views[destination]!, {
    accepts: policy.accepts,
    nextId: () => `${processId}:${++actionIds}`,
    hover: (active) => {
      if (!active) {
        if (highlighted.value === destination) highlighted.value = undefined
        return
      }
      highlighted.value = destination
      try {
        check(JSON.stringify(retained()) === beforeDrag, 'Hover preserves all histories')
        check(selected.value === 'source', 'Hover never selects a destination')
        check(
          accepted === beforeAccepted && loaded === beforeLoaded,
          'Hover does not load provider data',
        )
        hovered.push({ destination, selected: selected.value, accepted, loaded })
        status.value = `HOVER · ${titles[destination]} · no navigation`
        if (mode === 'removehover')
          hoverTimer = setTimeout(() => {
            disposeRow(destination)
            disabled.value = destination
          }, 100)
      } catch (error) {
        void report('hover', undefined, error)
      }
    },
    receive: (id, items, origin) => receive(destination, policy, id, items, origin),
    error: (error) => void report('bridge', undefined, error),
  })
}
function disposeRow(destination: Destination) {
  policies[destination]?.dispose()
  registrations[destination]?.dispose()
  delete registrations[destination]
  delete policies[destination]
  delete owners[destination]
}
function snapshot() {
  return Object.fromEntries(
    names.map((name) => [
      name,
      {
        logical: router.getHistory({ frame: name })?.entries.map((e) => e.route.path),
        native: [
          ...(frames[name]?.backStack.map((e) => e.resolvedPage) ?? []),
          frames[name]?.currentPage,
        ]
          .filter(Boolean)
          .map((page) => page!.getViewById<any>('sidebar-route')?.text),
      },
    ]),
  )
}
function retained() {
  for (const name of names) {
    roots[name] ??= frames[name]!.currentPage
    check(
      roots[name] === frames[name]!.currentPage ||
        frames[name]!.backStack.some((e) => e.resolvedPage === roots[name]),
      `Exact ${name} root retained`,
    )
    check(
      (roots[name]!.getViewById('sidebar-draft') as TextField).text ===
        `${titles[name]} draft`,
      `${name} draft retained`,
    )
  }
  check(roots.source === frames.source!.currentPage, 'Source is never navigated or moved')
  check(drawer.value?.presentation === 'permanent', 'Actual permanent sidebar is mounted')
  const stacks = snapshot()
  for (const stack of Object.values(stacks))
    check(
      JSON.stringify(stack.native) === JSON.stringify(stack.logical),
      'Native/logical histories agree',
    )
  return stacks
}
async function report(
  command: string,
  result?: unknown,
  error?: unknown,
  origin?: DragOrigin,
  target?: Destination,
) {
  const value = {
    command,
    sequence: ++sequence,
    process: processId,
    ok: !error,
    error: error ? String(error) : undefined,
    mode,
    selected: selected.value,
    presentation: drawer.value?.presentation,
    drags,
    drops,
    accepted,
    loaded,
    collections,
    guarded: { ...guarded },
    highlighted: highlighted.value ?? null,
    disabled: disabled.value ?? null,
    hovered: [...hovered],
    result,
    origin,
    target: target ? { windowId: router.window.value?.id, frame: target } : undefined,
    stacks: snapshot(),
    drafts: Object.fromEntries(
      names.map((name) => [
        name,
        (roots[name]?.getViewById('sidebar-draft') as TextField)?.text,
      ]),
    ),
  }
  await File.fromPath(
    `${knownFolders.documents().path}/sidebar-drop-${sequence}.json`,
  ).writeText(JSON.stringify(value, null, 2))
  status.value = `${error ? 'FAIL' : 'PASS'} ${command}`
}
async function cancelled(operation: number) {
  let error: unknown
  try {
    await pause()
    check(
      ['cancel', 'multiple', 'removehover'].includes(mode),
      'Only intentionally refused native drags cancel',
    )
    check(
      JSON.stringify(retained()) === beforeDrag,
      'Cancelled native drag preserves every stack',
    )
    check(
      accepted === beforeAccepted && loaded === beforeLoaded,
      'Cancelled native drag never loads the provider',
    )
    check(!highlighted.value, 'Hover highlight is cleared after cancellation')
    if (mode === 'removehover')
      check(
        hovered.length > 0 && disabled.value === 'inbox' && !owners.inbox,
        'Native target disposed after entering hover',
      )
  } catch (e) {
    error = e
  }
  detail.value =
    'No transfer or navigation. All three histories and drafts are unchanged.'
  await report(`cancel-${mode}`, { operation }, error)
}
async function receive(
  destination: Destination,
  policy: ReturnType<typeof createDropPolicy>,
  id: string,
  items: readonly DropItem[],
  origin: DragOrigin | undefined,
  internal = false,
) {
  if (!internal) drops++
  let result: DropResult | undefined, error: unknown
  const before = retained(),
    other = destination === 'inbox' ? 'archive' : 'inbox',
    priorGuards = { ...guarded }
  try {
    check(NSThread.isMainThread, 'Handoff runs on the main thread')
    check(
      origin?.windowId === router.window.value?.id && origin?.frame === 'source',
      'Actual source window and stack recorded',
    )
    result = await policy.drop(id, items, internal ? 'internal' : 'drag-drop')
    if (result.status === 'settled') {
      last = result.intent
      check(
        result.intent.target?.frame === destination &&
          result.intent.target.windowId === router.window.value?.id,
        'Receiving row supplies explicit window/frame',
      )
      check(
        result.navigation.status === 'handled',
        'Ordinary intent pipeline handles delivery',
      )
      if (result.navigation.status === 'handled') {
        check(
          result.navigation.failure?.type ===
            (mode === 'guard' ? 4 : mode === 'repeat' ? 16 : undefined),
          'Expected guard/duplicate/success outcome',
        )
      }
      if (mode === 'guard' || mode === 'repeat')
        check(
          JSON.stringify(before) === JSON.stringify(retained()),
          'Failed navigation leaves every history unchanged',
        )
      else
        check(
          frames[destination]!.currentPage.getViewById<any>('sidebar-route').text ===
            '/documents/7',
          'Correct receiving document visible',
        )
      check(selected.value === destination, 'Drop reveals exactly the receiving tab')
      check(guarded[other] === priorGuards[other], 'Other destination guard is untouched')
      detail.value =
        mode === 'guard'
          ? 'Transfer accepted; navigation refused by the guard. The source is intact.'
          : `Opened in ${titles[destination]}. The other destination keeps its own stack.`
    } else {
      check(
        result.reason ===
          (
            {
              slow: 'disposed',
              owner: 'owner-changed',
              permission: 'unauthorized',
            } as Record<string, string>
          )[mode],
        'Explicit invalidation result',
      )
      check(
        JSON.stringify(before) === JSON.stringify(retained()),
        'Invalidation cannot redirect or navigate either destination',
      )
      check(selected.value === 'source', 'Invalid transfer does not reveal a destination')
      check(
        JSON.stringify(guarded) === JSON.stringify(priorGuards),
        'Rejected transfer never enters guards',
      )
      if (mode === 'slow') await pause(1800)
      detail.value = `Drop accepted; navigation rejected: ${result.reason}. No destination was substituted.`
    }
    await pause()
    const after = retained()
    check(
      JSON.stringify(after[other]) === JSON.stringify(before[other]),
      'Other destination history unchanged',
    )
    check(!highlighted.value, 'Hover highlight cleared on drop')
    if (!internal)
      check(
        hovered.some((event) => event.destination === destination),
        'Actual native hover preceded delivery',
      )
  } catch (e) {
    error = e
  }
  await report(
    `${internal ? 'command' : 'drop'}-${mode}`,
    result,
    error,
    origin,
    destination,
  )
}
async function accessibleOpen(destination: Destination) {
  const policy = policies[destination]
  if (!policy) return
  await receive(
    destination,
    policy,
    `${processId}:${++actionIds}`,
    [
      {
        type: destinationType,
        load: () => ({ value: Promise.resolve(payload()), cancel() {} }),
      },
    ],
    { windowId: router.window.value!.id, frame: 'source' },
    true,
  )
}
async function command(name: string) {
  let error: unknown, result: unknown
  try {
    clearTimeout(hoverTimer)
    if (name === 'clear') {
      destinations.forEach(disposeRow)
      dragRegistration?.dispose()
      check(!highlighted.value, 'Disposal removes hover state')
      detail.value =
        'Native interactions and pending policies disposed. All root Pages and drafts retained.'
    } else if (name === 'replay') {
      const before = JSON.stringify(retained())
      result = await router.openIntent(last)
      check((result as any).reason === 'repeat', 'Captured native delivery deduplicated')
      check(before === JSON.stringify(retained()), 'Replay changes no stack')
    } else {
      mode = name
      permission = true
      disabled.value = undefined
      hovered = []
      const target = targetFor()
      if (name !== 'repeat') await router.backToRoot({ frame: target, animated: false })
      destinations.forEach(mountRow)
      selected.value = 'source'
      await nextTick()
      await pause()
      if (name === 'keyboard')
        check(commands!.focus(), 'Page-owned keyboard scope focused')
      detail.value = `Ready: ${name}. Drag to ${titles[target]} in the sidebar.`
    }
    retained()
  } catch (e) {
    error = e
  }
  await report(`prepare-${name}`, result, error)
}
createApp({
  render: () =>
    h('GridLayout', { rows: 'auto,auto,*', backgroundColor: '#e5edf7' }, [
      h('StackLayout', { row: 0, padding: '16 24' }, [
        h('Label', {
          text: status.value,
          fontSize: 24,
          fontWeight: 'bold',
          color: '#17656c',
        }),
        h('Label', { text: detail.value, fontSize: 17, textWrap: true, marginTop: 8 }),
      ]),
      h(
        'WrapLayout',
        { row: 1, margin: '0 18 8' },
        [
          'valid',
          'archive',
          'repeat',
          'cancel',
          'multiple',
          'removehover',
          'slow',
          'owner',
          'permission',
          'guard',
          'accessible',
          'keyboard',
          'replay',
          'clear',
        ].map((name) => button(name, `mode-${name}`, () => void command(name))),
      ),
      h(
        RouterDrawer,
        { row: 2, ref: drawer, presentation: 'permanent', width: 260 },
        {
          drawer: () =>
            h('StackLayout', { padding: '24 14', backgroundColor: '#eaf0f7' }, [
              h('Label', {
                text: 'Destinations',
                fontSize: 25,
                fontWeight: 'bold',
                marginBottom: 18,
              }),
              ...destinations.flatMap((destination) => [
                h('Label', {
                  text:
                    disabled.value === destination
                      ? `${titles[destination]} · unavailable`
                      : highlighted.value === destination
                        ? `Release → ${titles[destination]}`
                        : `Drop → ${titles[destination]}`,
                  textWrap: true,
                  fontSize: 22,
                  height: 105,
                  marginTop: 18,
                  textAlignment: 'center',
                  verticalAlignment: 'middle',
                  backgroundColor:
                    highlighted.value === destination
                      ? '#bde5cf'
                      : disabled.value === destination
                        ? '#e3d7d0'
                        : '#cfdfef',
                  automationText: `sidebar:target-${destination}`,
                  accessible: true,
                  accessibilityLabel: `Drop target: open document in ${titles[destination]}`,
                  onLoaded: (e: { object: View }) => {
                    views[destination] = e.object
                  },
                  onUnloaded: () => disposeRow(destination),
                }),
                button(
                  `Open in ${titles[destination]}`,
                  `open-${destination}`,
                  () => void accessibleOpen(destination),
                ),
              ]),
              h('Label', {
                text: 'Cancel area\nRelease here to keep all stacks',
                textWrap: true,
                height: 100,
                marginTop: 22,
                backgroundColor: '#f0e2db',
                textAlignment: 'center',
                automationText: 'sidebar:cancel-area',
              }),
              h('Label', {
                text: 'Copy/open only.\nNo document is moved.',
                textWrap: true,
                marginTop: 20,
                fontSize: 16,
              }),
            ]),
          default: () =>
            h(
              RouterTabs,
              {
                selected: selected.value,
                'onUpdate:selected': (value: string) => {
                  selected.value = value
                },
              },
              () =>
                names.map((name) =>
                  h(
                    RouterTab,
                    {
                      name,
                      title: titles[name],
                      icon: name === 'source' ? 'doc.text' : 'tray',
                    },
                    () =>
                      h(RouterView, {
                        name,
                        initial: name === 'source' ? '/library' : `/${name}`,
                        onLoaded: (e: { object: Frame }) => {
                          frames[name] = e.object
                        },
                      }),
                  ),
                ),
            ),
        },
      ),
    ]),
})
  .use(router)
  .start()
void (async () => {
  try {
    await router.isReady()
    for (const name of names) {
      selected.value = name
      await nextTick()
      const deadline = Date.now() + 15000
      while (!frames[name]?.currentPage) {
        if (Date.now() > deadline) throw new Error(`${name} did not mount`)
        await pause(50)
      }
    }
    destinations.forEach(mountRow)
    selected.value = 'source'
    await pause()
    retained()
    await report('ready')
  } catch (error) {
    await report('ready', undefined, error)
  }
})()
