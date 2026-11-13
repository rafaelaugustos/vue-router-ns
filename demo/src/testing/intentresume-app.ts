// Explicit app-owned login with real Pages; no external identity provider is simulated.
import { File, Frame, knownFolders, type Page, type TextField } from '@nativescript/core'
import { ActionBar, createApp, defineComponent, h, ref } from 'nativescript-vue'
import {
  createRouter,
  NavigationFailureType,
  RouterView,
  useRoute,
  type NavigationIntent,
  type SuspendedIntent,
} from 'vue-router-ns'

const status = ref('READY'),
  detail = ref(
    'Open an OS URL to begin. Sign-in is controlled by this fixture, without an external provider.',
  ),
  comparison = ref('')
const frames: Record<string, Frame> = {}
let scope = {},
  signedIn = false,
  handle: SuspendedIntent | undefined,
  lastAttempt: Promise<unknown> | undefined,
  sourcePage: Page | undefined
let release: (() => void) | undefined
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const check = (value: unknown, message: string) => {
  if (!value) throw new Error(message)
}
const policy = { scope: () => scope, authorize: () => signedIn }
const screen = defineComponent({
  setup() {
    const route = useRoute(),
      draft = ref('Unsent source draft')
    return () =>
      h('Page', { backgroundColor: '#f1f5fa' }, [
        h(ActionBar, {
          title:
            route.path === '/login'
              ? 'Sign in to continue'
              : route.path === '/'
                ? 'Retained draft'
                : 'Private destination',
        }),
        h('StackLayout', { verticalAlignment: 'center', padding: 16 }, [
          h('Label', {
            id: 'resume-route',
            text: route.fullPath,
            fontSize: 25,
            color: '#183b58',
            textAlignment: 'center',
          }),
          ...(route.path === '/'
            ? [
                h('TextField', {
                  id: 'source-draft',
                  text: draft.value,
                  onTextChange: (e: { value: string }) => {
                    draft.value = e.value
                  },
                  marginTop: 16,
                }),
              ]
            : []),
          ...(route.path === '/login'
            ? [
                h('Label', {
                  text: 'Fixture sign-in · no external provider',
                  textWrap: true,
                  textAlignment: 'center',
                  marginTop: 14,
                }),
                h('Button', {
                  text: 'Sign in and resume',
                  accessibilityLabel: 'resume:login',
                  onTap: () => void run('login'),
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
    { path: '/private/:id', name: 'private', component: screen },
  ],
  diagnostics: true,
  links: { schemes: ['routerentries'], frame: () => 'target' },
})
router.beforeEach((to) => {
  if (to.params.id === 'slow')
    return new Promise<void>((resolve) => {
      release = resolve
    })
  if (to.path.startsWith('/private/') && !signedIn) return '/login'
})
function suspend(destination: NavigationIntent['destination'], maxAge = 300000) {
  const request: NavigationIntent = {
    version: 1,
    source: 'fixture',
    destination,
    target: { frame: 'target' },
    options: { replace: true },
  }
  const result = router.suspendIntent(request, { ...policy, maxAge })
  check(result.status === 'suspended', 'Request suspended')
  return result as SuspendedIntent
}
const snapshot = () =>
  Object.fromEntries(
    ['source', 'target'].map((name) => [
      name,
      {
        logical: router.getHistory({ frame: name })?.entries.map((e) => e.route.path),
        native: [
          ...frames[name]!.backStack.map((e) => e.resolvedPage),
          frames[name]!.currentPage,
        ]
          .filter(Boolean)
          .map((page) => (page!.getViewById('resume-route') as any)?.text),
      },
    ]),
  )
function retained() {
  const stacks = snapshot()
  for (const stack of Object.values(stacks))
    check(
      JSON.stringify(stack.logical) === JSON.stringify(stack.native),
      'Native/logical histories agree',
    )
  sourcePage ??= frames.source!.currentPage
  check(sourcePage === frames.source!.currentPage, 'Exact source Page retained')
  check(
    (sourcePage!.getViewById('source-draft') as TextField).text === 'Unsent source draft',
    'Independent source draft retained',
  )
  return stacks
}
async function report(command: string, result?: unknown, error?: unknown) {
  const stacks = snapshot()
  comparison.value = `Source: ${stacks.source!.native.join(' → ')}\nTarget: ${stacks.target!.native.join(' → ')}`
  await File.fromPath(
    `${knownFolders.documents().path}/intent-resume-${command}.json`,
  ).writeText(
    JSON.stringify(
      {
        command,
        ok: !error,
        error: error ? String(error) : undefined,
        result,
        state: handle?.state.value,
        windowId: router.window.value?.id,
        stacks,
        sourceDraft: (
          frames.source!.currentPage!.getViewById('source-draft') as TextField
        ).text,
      },
      null,
      2,
    ),
  )
  status.value = `${error ? 'FAIL' : 'PASS'} ${command}`
}
async function begin(id: string, maxAge?: number) {
  handle?.cancel()
  scope = {}
  signedIn = false
  await router.backToRoot({ frame: 'target', animated: false })
  handle = suspend({ route: { name: 'private', params: { id } } }, maxAge)
  await router.push('/login', { frame: 'target' })
  await wait(450)
}
async function run(command: string) {
  status.value = `RUN ${command}`
  let result: unknown, error: unknown
  try {
    if (command === 'login') {
      signedIn = true
      lastAttempt = handle!.resume()
      check(handle!.resume() === lastAttempt, 'Repeated resume shares exact promise')
      result = await lastAttempt
      check(
        frames.target!.currentPage!.getViewById('resume-route') &&
          snapshot().target!.native.at(-1) === '/private/url',
        'Original URL destination reached',
      )
      check(
        !snapshot().target!.native.includes('/login'),
        'Login replaced in target only',
      )
      detail.value =
        'Signed in: the original URL resumed once through normal guards. Source draft retained.'
    } else if (command === 'again') {
      const page = frames.target!.currentPage
      check(handle!.resume() === lastAttempt, 'Settled resume remains idempotent')
      await handle!.resume()
      check(frames.target!.currentPage === page, 'No repeated native presentation')
      detail.value =
        'A repeated completion callback reused the same attempt. No new Page was created.'
    } else if (command === 'cancel') {
      await begin('cancel')
      handle!.cancel()
      await router.back({ frame: 'target' })
      signedIn = true
      result = await handle!.resume()
      check((result as any).reason === 'cancelled', 'Cancelled login cannot resume later')
      detail.value =
        'Login cancelled: a later completion callback cannot open the private destination.'
    } else if (command === 'account') {
      await begin('account-a')
      scope = {}
      signedIn = true
      result = await handle!.resume()
      check(
        (result as any).reason === 'scope-changed',
        'Another account cannot consume this flow',
      )
      detail.value =
        'Account changed: the old pending destination was rejected before navigation.'
    } else if (command === 'expired') {
      await begin('expired', 900)
      await wait(1000)
      signedIn = true
      result = await handle!.resume()
      check((result as any).reason === 'expired', 'Expired request cannot resume')
      detail.value = 'The pending login expired. Completing it cannot revive the request.'
    } else if (command === 'superseded') {
      await begin('old')
      const old = handle!
      handle = suspend({ route: '/private/new' })
      signedIn = true
      result = await old.resume()
      check((result as any).reason === 'superseded', 'Old destination superseded')
      await handle.resume()
      check(
        snapshot().target!.native.at(-1) === '/private/new',
        'Only newer destination presented',
      )
      detail.value =
        'A newer intent replaced the pending login destination; only the new destination opened.'
    } else if (command === 'race') {
      await begin('slow')
      signedIn = true
      const resultPromise = handle!.resume()
      for (let i = 0; !release && i < 100; i++) await wait(10)
      check(release, 'Async guard started')
      const page = frames.target!.currentPage
      scope = {}
      signedIn = false
      release!()
      release = undefined
      result = await resultPromise
      check(
        (result as any).failure?.type === NavigationFailureType.cancelled &&
          frames.target!.currentPage === page,
        'Sign-out during guard prevents presentation',
      )
      detail.value =
        'Sign-out during an async guard cancelled admission. The private Page never appeared.'
    } else if (command === 'removed') {
      await begin('placeholder')
      const remove = router.addRoute({
        path: '/temporary',
        name: 'temporary',
        component: screen,
      })
      handle = suspend({ route: { name: 'temporary' } })
      remove()
      signedIn = true
      result = await handle.resume()
      check((result as any).reason === 'unmatched', 'Removed target revalidated')
      detail.value =
        'The destination disappeared during login. Resume resolved it again and rejected it.'
    }
    retained()
  } catch (value) {
    error = value
  }
  const answer = result as any
  await report(
    command,
    answer && {
      status: answer.status,
      reason: answer.reason,
      failure: answer.failure?.type,
    },
    error,
  )
}
router.onLink((result) => {
  if (result.location?.path !== '/private/url') return
  let error: unknown
  try {
    check(router.currentRoute.value.path === '/login', 'OS URL guard opened login')
    handle = suspend({ url: result.link.href })
    retained()
    detail.value =
      'A real OS URL reached the auth guard. The app retained its destination for explicit sign-in.'
  } catch (value) {
    error = value
  }
  void report('request', { source: result.link.source }, error)
})
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
        color: '#183b58',
        textWrap: true,
      }),
      h(
        'WrapLayout',
        { row: 3, margin: '0 12 10' },
        ['again', 'cancel', 'account', 'expired', 'superseded', 'race', 'removed'].map(
          (name) =>
            h('Button', {
              text: name,
              accessibilityLabel: `resume:${name}`,
              margin: 4,
              padding: 10,
              onTap: () => void run(name),
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
