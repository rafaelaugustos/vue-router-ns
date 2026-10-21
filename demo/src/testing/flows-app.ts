// Native system UI acceptance: ns build android|ios --env.flowsTest.
import {
  Application,
  ApplicationSettings,
  File,
  knownFolders,
  isAndroid,
  type Page,
} from '@nativescript/core'
import { createApp, defineComponent, h, ref } from 'nativescript-vue'
import {
  createRouter,
  RouterView,
  createDocumentPicker,
  useNativeFlow,
} from 'vue-router-ns'

const status = ref('READY')
const records = ref<string[]>([])
const stackGeneration = ref(0)
const marker = 'router-flow-fixture-pending'
const pid = () =>
  isAndroid ? android.os.Process.myPid() : NSProcessInfo.processInfo.processIdentifier
const pause = (ms: number) => new Promise<void>((done) => setTimeout(done, ms))
let command: (name: string) => Promise<void>
let screen: Page
const report = (name: string, outcome: unknown) => {
  const result = {
    name,
    outcome,
    pid: pid(),
    path: router.currentRoute.value.path,
    stack: router.stack.value.map((r) => r.path),
  }
  console.log(`FLOW_RESULT ${JSON.stringify(result)}`)
  status.value = name
  records.value.push(name)
}
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message)
}
const PickerPage = defineComponent({
  setup() {
    const first = useNativeFlow(createDocumentPicker())
    const second = useNativeFlow(createDocumentPicker())
    const run = async (name: string, handle = first, before?: () => boolean) => {
      const paths = router.stack.value.map((r) => r.path).join(',')
      ApplicationSettings.setString(marker, `${pid()}:${name}`)
      status.value = `PENDING ${name}`
      console.log(`FLOW_PENDING ${name}`)
      const outcome = await handle.run(
        { types: ['text/plain'], multiple: false },
        { before },
      )
      if (outcome.status === 'failed') throw outcome.error
      if (outcome.status === 'completed') {
        assert(outcome.value.uris.length === 1, 'Expected one document')
        assert(/^(content|file):\/\//.test(outcome.value.uris[0]!), 'Expected scoped URI')
      }
      if (outcome.status !== 'cancelled' || outcome.reason !== 'disposed')
        assert(
          router.stack.value.map((r) => r.path).join(',') === paths,
          `System flow changed route history: ${paths} -> ${router.stack.value.map((r) => r.path).join(',')}`,
        )
      ApplicationSettings.remove(marker)
      const suffix = outcome.status === 'completed' ? 'completed' : outcome.reason
      report(`${name}:${suffix}`, outcome)
      return outcome
    }
    const handleCommand = async (name: string) => {
      console.log(`FLOW_COMMAND ${name}`)
      if (name === 'pick') {
        await run('pick')
        return
      }
      if (name === 'guard') {
        await run('guard', first, () => false)
        return
      }
      if (name === 'concurrent') {
        if (!isAndroid) {
          // UIKit has one presentation slot: a second simultaneous picker must fail clearly.
          const pending = run('concurrent-first')
          const collision = await second.run({})
          assert(
            collision.status === 'failed',
            'UIKit concurrent presentation must report failure',
          )
          report('concurrent:refused', {
            status: collision.status,
            error: String((collision as any).error),
          })
          await pending
          return
        }
        const a = run('concurrent-first')
        await pause(700)
        const b = run('concurrent-second', second)
        await Promise.all([a, b])
        return
      }
      if (name === 'dispose') {
        const pending = run('dispose')
        // A stopped Android Activity unloads its Frame and defers back navigation.
        // Unmount the owning stack to exercise disposal while DocumentsUI stays open.
        setTimeout(() => {
          if (isAndroid) stackGeneration.value++
          else router.back({ animated: false }).catch(fatal)
        }, 2000)
        await pending
        return
      }
      if (name === 'recreate') {
        assert(isAndroid, 'Recreation is Android-only')
        const activity = screen._context as android.app.Activity
        console.log(`FLOW_OWNER ${activity.hashCode()}`)
        const pending = run('recreate')
        setTimeout(() => activity.recreate(), 1500)
        await pending
        return
      }
      if (name === 'close') {
        assert(isAndroid, 'Close is Android-only')
        const activity = screen._context as android.app.Activity
        const pending = run('close')
        setTimeout(() => activity.finish(), 1500)
        await pending
        return
      }
      if (name === 'modal') {
        await router.push('/modal')
        return
      }
      throw new Error(`Unknown command: ${name}`)
    }
    command = handleCommand
    return () =>
      h(
        'Page',
        {
          actionBarHidden: true,
          ref: (node: any) => {
            if (node) screen = node.nativeView
          },
        },
        [
          h('ScrollView', [
            h('StackLayout', { padding: 24 }, [
              h('Label', { text: 'Native flow checks', fontSize: 24 }),
              h('Label', {
                text: status.value,
                textWrap: true,
                automationText: 'flow-status',
              }),
              h('Label', {
                text: first.running.value ? 'RUNNING' : 'IDLE',
                automationText: 'flow-running',
              }),
              ...[
                'pick',
                'guard',
                'concurrent',
                'dispose',
                'recreate',
                'close',
                'modal',
              ].map((name) =>
                h('Button', {
                  text: name,
                  automationText: name,
                  onTap: () => handleCommand(name).catch(fatal),
                }),
              ),
              ...records.value.map((text) => h('Label', { text })),
            ]),
          ]),
        ],
      )
  },
})
const Home = defineComponent({
  setup: () => () =>
    h('Page', { actionBarHidden: true }, [
      h('StackLayout', { padding: 24 }, [
        h('Label', { text: 'Flow home' }),
        h('Label', { text: status.value, automationText: 'flow-status' }),
        h('Button', {
          text: 'open',
          automationText: 'open',
          onTap: () => router.push('/picker'),
        }),
      ]),
    ]),
})
const router = createRouter({
  routes: [
    { path: '/', component: Home },
    { path: '/picker', component: PickerPage },
    { path: '/modal', component: PickerPage, modal: true },
  ],
})
function fatal(error: unknown) {
  status.value = `FAIL ${String(error)}`
  console.log(`FLOW_FATAL ${String(error)} ${(error as Error)?.stack ?? ''}`)
}
Application.android?.on('activityNewIntent', (args: any) => {
  const name = args.intent.getStringExtra('flowCommand')
  if (name) command(String(name)).catch(fatal)
})
Application.android?.on('activityCreated', (args: any) => {
  if (args.activity.isNativeScriptActivity)
    console.log(`FLOW_OWNER_CREATED ${args.activity.hashCode()}`)
})
createApp({
  render: () =>
    isAndroid
      ? h('GridLayout', [h(RouterView, { key: stackGeneration.value })])
      : h(RouterView),
})
  .use(router)
  .start()
void (async () => {
  const documentPath = `${knownFolders.documents().path}/router-flow-sample.txt`
  // Preserve the same document across the process-restart tests.
  if (!File.exists(documentPath))
    await File.fromPath(documentPath).writeText('Native flow acceptance document')
  await pause(700)
  if (ApplicationSettings.hasKey(marker)) {
    report('recovery:orphan', { previous: ApplicationSettings.getString(marker) })
    ApplicationSettings.remove(marker)
  }
  await router.push('/picker')
  console.log(`FLOW_READY ${pid()}`)
})().catch(fatal)
