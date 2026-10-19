// Opt-in process-death acceptance fixture: ns build android --env.stateTest.
import { ApplicationSettings, type ScrollView, type Frame } from '@nativescript/core'
import { ActionBar, createApp, defineComponent, h, ref, type Ref } from 'nativescript-vue'
import {
  createRouter,
  RouterView,
  useNativeHost,
  usePageState,
  type SavedStacks,
} from 'vue-router-ns'

const storageKey = 'state-acceptance'
const mode = ApplicationSettings.getString('state-mode', 'prepare')
const status = ref('Running state checks')
const checks: string[] = []
const editors: EditorCapture[] = []
let frozen = false
let frame: Frame
const pause = () => new Promise<void>((done) => setTimeout(done, 50))
const read = (): SavedStacks | null =>
  JSON.parse(ApplicationSettings.getString(storageKey, 'null'))

interface EditorCapture {
  text: Ref<string>
  scroll?: ScrollView
  restored: number
}
function check(name: string, ok: boolean) {
  if (!ok) throw new Error(`State acceptance failed: ${name}`)
  checks.push(name)
  console.log(`STATE_CHECK ${name}`)
}
async function until(condition: () => boolean) {
  for (let i = 0; i < 160 && !condition(); i++) await pause()
  if (!condition()) throw new Error('Timed out waiting for native page state')
}
function fail(error: unknown) {
  status.value = `FAIL: ${String(error)}`
  console.error(
    `STATE_RESULT ${JSON.stringify({ mode, ok: false, error: String(error) })}`,
  )
}
function passed(stage: string) {
  status.value = `PASS: ${stage}`
  console.log(`STATE_RESULT ${JSON.stringify({ mode, stage, ok: true, checks })}`)
}
function controls() {
  return [
    h('Label', { text: status.value, textWrap: true }),
    h('Button', {
      text: 'Verify previous',
      onTap: () => void previous().catch(fail),
    }),
    h('Button', { text: 'Next scenario', onTap: nextScenario }),
  ]
}
const Home = defineComponent({
  setup() {
    const host = useNativeHost<Frame>()
    return () => {
      if (host.native) frame = host.native
      return h('Page', [
        h(ActionBar, { title: 'State home' }),
        h('StackLayout', { padding: 12 }, controls()),
      ])
    }
  },
})
const Editor = defineComponent({
  setup() {
    const capture: EditorCapture = { text: ref(''), restored: 0 }
    editors.push(capture)
    const host = useNativeHost<Frame>()
    usePageState<{ text: string; offset: number }>('draft', {
      version: 2,
      save: () => ({
        text: capture.text.value,
        offset: capture.scroll?.verticalOffset ?? 0,
      }),
      migrate: (old, version) =>
        version === 1 ? { text: (old as { body: string }).body, offset: 0 } : undefined,
      restore(value, context) {
        check('restore runs with a loaded native Page', context.page.isLoaded)
        capture.restored++
        capture.text.value = value.text
        const view = capture.scroll!
        // Page.loaded precedes measurement on some platforms. The application
        // applies its reading position once the content has a scrollable range.
        const apply = () => {
          if (view.scrollableHeight < value.offset) return
          view.off('layoutChanged', apply)
          view.scrollToVerticalOffset(value.offset, false)
        }
        view.on('layoutChanged', apply)
        apply()
      },
    })
    return () => {
      if (host.native) frame = host.native
      return h('Page', [
        h(ActionBar, { title: 'State editor' }),
        h('GridLayout', { rows: 'auto, *', padding: 12 }, [
          h('StackLayout', [
            ...controls(),
            h('TextField', {
              text: capture.text.value,
              hint: 'Restored draft',
              onTextChange: (event: { value: string }) => {
                capture.text.value = event.value
              },
            }),
          ]),
          h(
            'ScrollView',
            {
              row: 1,
              onLoaded: (event: { object: ScrollView }) => {
                capture.scroll = event.object
              },
            },
            [
              h(
                'StackLayout',
                Array.from({ length: 80 }, (_, index) =>
                  h('Label', { text: `Reading line ${index + 1}`, height: 40 }),
                ),
              ),
            ],
          ),
        ]),
      ])
    }
  },
})
const router = createRouter({
  restore: {
    save: (state) => {
      if (!frozen) ApplicationSettings.setString(storageKey, JSON.stringify(state))
    },
    load: read,
  },
  routes: [
    { path: '/', component: Home },
    { path: '/edit', component: Editor },
    { path: '/private', component: Editor },
  ],
})
router.beforeEach((to) => (mode === 'signed-out' && to.path === '/private' ? '/' : true))

async function scrollTo(editor: EditorCapture, offset: number) {
  await until(() => !!editor.scroll && editor.scroll.scrollableHeight >= offset)
  editor.scroll!.scrollToVerticalOffset(offset, false)
  await until(() => Math.abs(editor.scroll!.verticalOffset - offset) <= 1)
}
async function previous() {
  if (mode !== 'duplicates' || status.value !== 'PASS: duplicate top') return
  await router.back({ animated: false })
  const first = editors[0]!
  await until(() => Math.abs((first.scroll?.verticalOffset ?? -1) - 240) <= 1)
  check(
    'previous duplicate retains its own draft and scroll',
    first.text.value === 'first draft',
  )
  check(
    'each duplicate restores once',
    editors.every((editor) => editor.restored === 1),
  )
  check('native Back reveals the first duplicate', frame.backStack.length === 1)
  passed('duplicate previous')
}
const scenarios = [
  'duplicates',
  'migration',
  'expired',
  'missing',
  'signed-out',
  'legacy',
]
function nextScenario() {
  const next = scenarios[scenarios.indexOf(mode) + 1]
  if (!next) return
  const path =
    next === 'missing' ? '/removed' : next === 'signed-out' ? '/private' : '/edit'
  const state: SavedStacks = {
    version: 2,
    savedAt: Date.now() - (next === 'expired' ? 31 * 60 * 1000 : 0),
    stacks: { default: ['/', path] },
    entries: {
      default: [
        { key: 'seed-home' },
        {
          key: 'seed-editor',
          state: {
            draft: {
              version: 1,
              value: { body: next === 'migration' ? 'migrated draft' : 'private draft' },
            },
          },
        },
      ],
    },
  }
  if (next === 'legacy') {
    delete state.version
    delete state.entries
  }
  // Emulates data written by an older app version. Freeze this process's save
  // callback so backgrounding cannot replace the deliberately seeded snapshot.
  frozen = true
  ApplicationSettings.setString(storageKey, JSON.stringify(state))
  ApplicationSettings.setString('state-mode', next)
  status.value = `READY: ${next}`
}
async function run() {
  await router.isReady()
  if (mode === 'prepare') {
    await router.push('/edit', { animated: false })
    editors[0]!.text.value = 'first draft'
    await scrollTo(editors[0]!, 240)
    await router.push({ path: '/edit', force: true }, { animated: false })
    editors[1]!.text.value = 'second draft'
    await scrollTo(editors[1]!, 840)
    check('same path has two native back-stack entries', frame.backStack.length === 2)
    const keys = read()!.entries!.default!.map((entry) => entry.key)
    check('duplicate paths have distinct identities', new Set(keys).size === 3)
    ApplicationSettings.setString('state-keys', JSON.stringify(keys))
    ApplicationSettings.setString('state-mode', 'duplicates')
    passed('prepared')
  } else if (mode === 'duplicates') {
    const top = editors.at(-1)!
    await until(() => Math.abs((top?.scroll?.verticalOffset ?? -1) - 840) <= 1)
    check(
      'top duplicate restores its own draft and scroll',
      top.text.value === 'second draft',
    )
    check(
      'both duplicate paths restore into native history',
      frame.backStack.length === 2 && editors.length === 2,
    )
    check(
      'entry identities survive process death',
      JSON.stringify(read()!.entries!.default!.map((entry) => entry.key)) ===
        ApplicationSettings.getString('state-keys'),
    )
    passed('duplicate top')
  } else if (mode === 'migration') {
    await until(() => editors[0]?.text.value === 'migrated draft')
    check('old schema migrates once after native load', editors[0]!.restored === 1)
    check(
      'migration preserves entry identity',
      read()!.entries!.default![1]!.key === 'seed-editor',
    )
    passed(mode)
  } else if (mode === 'legacy') {
    check(
      'path-only snapshot rebuilds native history',
      frame.backStack.length === 1 && editors.length === 1,
    )
    check(
      'path-only snapshot starts with fresh page state',
      editors[0]!.text.value === '' && editors[0]!.restored === 0,
    )
    check('legacy snapshot upgrades to version 2', read()!.version === 2)
    passed(mode)
  } else {
    check(`${mode} does not restore the saved editor`, editors.length === 0)
    check(
      `${mode} returns to a native root`,
      frame.backStack.length === 0 && frame.currentPage?.actionBar.title === 'State home',
    )
    check(
      `${mode} discards sensitive saved state`,
      !JSON.stringify(read()).includes('private draft'),
    )
    passed(mode)
  }
}
createApp({ render: () => h(RouterView) })
  .use(router)
  .start()
void run().catch(fail)
