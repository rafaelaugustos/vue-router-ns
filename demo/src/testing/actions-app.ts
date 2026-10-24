// Native acceptance fixture: --env.actionsTest. No polling ships in the library.
import { File, Folder, knownFolders, isIOS, type Page } from '@nativescript/core'
import {
  ActionBar,
  createApp,
  computed,
  defineComponent,
  getCurrentInstance,
  h,
  nextTick,
  onBeforeUnmount,
  ref,
  withDirectives,
} from 'nativescript-vue'
import {
  createRouter,
  onBeforeRouteLeave,
  PageActionItem,
  RouterTab,
  RouterTabs,
  RouterView,
  usePageActions,
  useRouter,
  vRoutePreview,
  type PageActions,
  type Router,
} from 'vue-router-ns'

interface Capture {
  title: string
  actions: PageActions
  router: Router
  page?: Page
  reload?: () => void
  alive: boolean
  started: number
  saved: number
  aborted: number
  errors: number
  completions: boolean[]
  lastError: string
}
const captures: Capture[] = []
const selected = ref('home')
const button = (text: string, onTap: () => unknown) =>
  h('Button', { text, onTap, height: 42, fontSize: 14 })
const screen = (title: string, modal = false) =>
  defineComponent({
    setup() {
      const router = useRouter() as unknown as Router
      const label = ref('Save'),
        allowed = ref(true),
        shown = ref(true),
        blocked = ref(false)
      const saved = ref(0),
        errors = ref(0),
        message = ref('Ready'),
        legacy = ref(0)
      const item = ref('A'),
        marked = ref('none')
      const context = getCurrentInstance()!.appContext as { reload?: () => void }
      let capture: Capture
      const actions = usePageActions(
        [
          {
            id: 'save',
            title: label,
            busyTitle: 'Saving…',
            enabled: allowed,
            visible: shown,
            image: 'square.and.arrow.down',
            run: ({ signal }) => {
              capture.started++
              message.value = 'Saving…'
              return new Promise<void>((resolve, reject) => {
                const abort = () => {
                  clearTimeout(timer)
                  capture.aborted++
                  const error = new Error('Page disposed')
                  error.name = 'AbortError'
                  reject(error)
                }
                const timer = setTimeout(() => {
                  signal.removeEventListener('abort', abort)
                  capture.saved++
                  saved.value++
                  message.value = 'Saved successfully'
                  resolve()
                }, 3000)
                signal.addEventListener('abort', abort, { once: true })
              })
            },
          },
          {
            id: 'delete',
            title: 'Delete',
            image: 'trash',
            destructive: true,
            run: async () => {
              await new Promise((done) => setTimeout(done, 100))
              throw new Error('Demo delete failure')
            },
          },
          {
            id: 'detail',
            title: 'Details',
            image: 'arrow.right',
            run: ({ router }) => router.push('/detail'),
          },
          {
            id: 'modal',
            title: 'Inspect',
            image: 'info.circle',
            run: async ({ router }) => {
              const result = await router.pushForResult('/modal')
              message.value = `Result ${String(result)}`
            },
          },
          {
            id: 'done',
            title: 'Done',
            run: ({ router }) => router.back({ result: 'accepted' }),
          },
          {
            id: 'mark',
            title: () => `Mark ${item.value}`,
            run: () => {
              marked.value = item.value
            },
          },
        ],
        {
          onError(error) {
            capture.errors++
            capture.lastError = String(error)
            errors.value++
            message.value = String(error)
          },
        },
      )
      capture = {
        title,
        router,
        actions,
        alive: true,
        started: 0,
        saved: 0,
        aborted: 0,
        errors: 0,
        completions: [],
        lastError: '',
        reload: () => context.reload?.(),
      }
      captures.push(capture)
      onBeforeUnmount(() => {
        capture.alive = false
      })
      onBeforeRouteLeave(() => false, { when: blocked })
      const menu = {
        to: '/detail',
        actions: actions.menu(['save', 'delete', 'detail', 'modal']),
      }
      const rowMenu = computed(() => ({
        to: '/detail',
        openTitle: `Open ${item.value}`,
        actions: actions.menu(['mark']),
      }))
      return () =>
        h(
          'Page',
          {
            backgroundColor: '#f8fafc',
            ref: (node: any) => {
              if (node) capture.page = node.nativeView
            },
          },
          [
            h(ActionBar, { title }, () => [
              h(PageActionItem, {
                actions,
                action: modal ? 'done' : 'save',
                'ios.position': 'right',
              }),
              h('ActionItem', {
                text: 'Legacy',
                onTap: () => {
                  legacy.value++
                },
              }),
            ]),
            h('ScrollView', [
              h('StackLayout', { padding: 20 }, [
                h('Label', {
                  text: 'One action. Native surfaces.',
                  fontSize: 24,
                  fontWeight: 'bold',
                  color: '#0f172a',
                }),
                h('Label', {
                  text: `route ${router.currentRoute.value.path}`,
                  marginTop: 8,
                }),
                h('Label', {
                  text: `Saved ${saved.value} · errors ${errors.value}`,
                  fontSize: 18,
                  marginTop: 12,
                }),
                h('Label', {
                  text: message.value,
                  textWrap: true,
                  color: errors.value ? '#b91c1c' : '#334155',
                  marginBottom: 16,
                }),
                withDirectives(
                  h(
                    'GridLayout',
                    { height: 76, backgroundColor: '#dbeafe', borderRadius: 12 },
                    [
                      h('Label', {
                        text: 'Hold for actions',
                        horizontalAlignment: 'center',
                        verticalAlignment: 'middle',
                        fontSize: 18,
                      }),
                    ],
                  ),
                  [[vRoutePreview, menu]],
                ),
                button(allowed.value ? 'Disable save' : 'Enable save', () => {
                  allowed.value = !allowed.value
                }),
                button(label.value === 'Save' ? 'Rename save' : 'Restore name', () => {
                  label.value = label.value === 'Save' ? 'Salvar' : 'Save'
                }),
                button(shown.value ? 'Hide save' : 'Show save', () => {
                  shown.value = !shown.value
                }),
                button(blocked.value ? 'Unblock leaving' : 'Block leaving', () => {
                  blocked.value = !blocked.value
                }),
                withDirectives(
                  h(
                    'GridLayout',
                    {
                      height: 56,
                      backgroundColor: '#e2e8f0',
                      borderRadius: 8,
                      marginTop: 12,
                    },
                    [
                      h('Label', {
                        text: `Row ${item.value}`,
                        horizontalAlignment: 'center',
                        verticalAlignment: 'middle',
                      }),
                    ],
                  ),
                  [[vRoutePreview, rowMenu.value]],
                ),
                button('Reuse row soon', () => {
                  setTimeout(() => {
                    item.value = item.value === 'A' ? 'B' : 'A'
                  }, 4500)
                }),
                h('Label', { text: `Marked ${marked.value} · legacy ${legacy.value}` }),
              ]),
            ]),
          ],
        )
    },
  })
const router = createRouter({
  diagnostics: true,
  routes: [
    { path: '/', component: screen('Shared actions') },
    { path: '/settings', component: screen('Settings actions') },
    { path: '/detail', component: screen('Action details') },
    { path: '/modal', component: screen('Action result', true), modal: true },
  ],
})
createApp({
  render: () =>
    h(
      RouterTabs,
      {
        selected: selected.value,
        'onUpdate:selected': (value: string) => {
          selected.value = value
        },
      },
      () => [
        h(RouterTab, { name: 'home', title: 'Home' }, () =>
          h(RouterView, { name: 'home' }),
        ),
        h(RouterTab, { name: 'settings', title: 'Settings' }, () =>
          h(RouterView, { name: 'settings', initial: '/settings' }),
        ),
      ],
    ),
})
  .use(router)
  .start()

const directory = Folder.fromPath(`${knownFolders.documents().path}/actions`)
const commandPath = `${directory.path}/command.json`
const output = File.fromPath(`${directory.path}/result.json`)
let busy = false
const pause = (ms: number) => new Promise((done) => setTimeout(done, ms))
setInterval(async () => {
  if (busy || !captures.length || !File.exists(commandPath)) return
  busy = true
  let id: unknown
  try {
    const request = JSON.parse(File.fromPath(commandPath).readTextSync())
    File.fromPath(commandPath).removeSync()
    id = request.id
    const target = captures[request.value?.owner ?? 0]!
    let result: unknown
    switch (request.action) {
      case 'execute':
        result = await target.actions.execute(request.value.id)
        break
      case 'dispatch':
        result = await target.actions.dispatch(request.value.id)
        break
      case 'start':
        void target.actions
          .dispatch(request.value.id)
          .then((value) => target.completions.push(value))
        break
      case 'select':
        selected.value = request.value
        break
      case 'push':
        await router.push('/detail', { frame: 'home' })
        break
      case 'back':
        await router.back()
        break
      case 'reload':
        target.reload?.()
        break
      case 'wait':
        await pause(request.value ?? 3200)
        break
    }
    await nextTick()
    await pause(150)
    output.writeTextSync(
      JSON.stringify({
        id,
        result,
        selected: selected.value,
        current: router.currentRoute.value.path,
        issues: router.diagnostics!.snapshot().issues,
        captures: captures.map((capture) => ({
          title: capture.title,
          alive: capture.alive,
          started: capture.started,
          saved: capture.saved,
          aborted: capture.aborted,
          errors: capture.errors,
          lastError: capture.lastError,
          completions: capture.completions,
          busy: capture.actions.busy.value ?? null,
          states: capture.actions.list(),
          history: capture.router.stack.value.map((entry) => entry.path),
          header: capture.page?.actionBar.actionItems.getItems().map((item) => ({
            title: (item.actionView as any)?.text ?? item.text,
            visible: item.visibility,
            enabled: (item.actionView as any)?.isEnabled,
            nativeEnabled: isIOS
              ? item.actionView?.ios?.enabled
              : item.actionView?.android?.isEnabled(),
            loaded: item.actionView?.isLoaded,
            recognizers: isIOS
              ? (item.actionView?.ios?.gestureRecognizers?.count ?? 0)
              : null,
          })),
        })),
      }),
    )
  } catch (error) {
    output.writeTextSync(JSON.stringify({ id, error: String(error) }))
  } finally {
    busy = false
  }
}, 100)
