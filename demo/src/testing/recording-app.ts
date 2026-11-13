// --env.recordingTest: actual native navigation and an intentional unmanaged Page.
import { File, Frame, knownFolders, Label, Page } from '@nativescript/core'
import { ActionBar, createApp, defineComponent, h, ref } from 'nativescript-vue'
import { createRouter, RouterView, type DiagnosticRecord } from 'vue-router-ns'

const status = ref('READY'),
  detail = ref('Native iOS capture · v2 recording contract')
const summary = ref('Use the controls to record observed native and logical state.')
const comparison = ref(''),
  retained = ref('')
let frame: Frame
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const check = (value: unknown, message: string) => {
  if (!value) throw new Error(message)
}
type Checkpoint = Extract<DiagnosticRecord, { kind: 'checkpoint' }>
const screen = (title: string) =>
  defineComponent({
    setup: () => () =>
      h('Page', { backgroundColor: '#f1f5fa' }, [
        h(ActionBar, { title }),
        h('Label', {
          text: title,
          fontSize: 28,
          color: '#183b58',
          textAlignment: 'center',
        }),
      ]),
  })
const router = createRouter({
  routes: [
    { path: '/', component: screen('Recording home') },
    { path: '/items/:id', component: screen('Retained native page') },
    { path: '/blocked', component: screen('Must not mount'), beforeEnter: () => false },
    { path: '/modal', component: screen('Observed modal lifetime'), modal: true },
  ],
  diagnostics: { maxEvents: 500, recording: { maxRecords: 160, maxBytes: 262144 } },
})
const diagnostics = router.diagnostics!
const checkpoints = () =>
  diagnostics.recording()!.records.filter((r): r is Checkpoint => r.kind === 'checkpoint')
let release: (() => void) | undefined
router.beforeEach((to) =>
  to.params.id === 'slow'
    ? new Promise<void>((resolve) => {
        release = resolve
      })
    : undefined,
)

async function run(name: string) {
  status.value = `RUN ${name}`
  let error: unknown
  try {
    if (name === 'initial') {
      await router.isReady()
      check(checkpoints()[0]?.boundary === 'initial', 'Initial checkpoint retained')
    } else if (name === 'success') {
      await router.push('/items/private-value?token=private-query', {
        props: { secret: 'private-prop' },
      })
      check(router.stack.value.length === 2, 'Native push settled')
      check(
        checkpoints().some((r) => r.boundary === 'reconcile-before'),
        'Before reconciliation observed',
      )
      check(
        checkpoints().some((r) => r.boundary === 'reconcile-after'),
        'After reconciliation observed',
      )
    } else if (name === 'blocked') {
      const original = frame.currentPage
      await router.push('/blocked')
      check(frame.currentPage === original, 'Guard preserves exact native Page')
      check(
        diagnostics.events.some(
          (e) => e.phase === 'navigation' && e.outcome === 'aborted',
        ),
        'Guard outcome recorded',
      )
    } else if (name === 'cancelled') {
      const pending = router.push('/items/slow')
      for (let i = 0; !release && i < 100; i++) await wait(10)
      check(release, 'Async guard started')
      await router.push('/items/fast')
      release!()
      await pending
      check(
        diagnostics.events.some(
          (e) => e.phase === 'navigation' && e.outcome === 'cancelled',
        ),
        'Overlapping request cancelled',
      )
    } else if (name === 'modal') {
      const pending = router.pushForResult('/modal')
      await wait(1200)
      check(
        checkpoints().some((r) =>
          r.snapshot.stacks.some(
            (s) => s.modal && s.logical.some((e) => e.awaitingResult),
          ),
        ),
        'Modal and pending result observed',
      )
      await router.back({ result: { secret: 'private-result' } })
      await pending
      check(
        !checkpoints()
          .at(-1)!
          .snapshot.stacks.some((s) => s.modal),
        'Modal lifetime ended',
      )
    } else if (name === 'divergence') {
      frame.navigate({
        animated: false,
        create: () => {
          const page = new Page(),
            label = new Label()
          label.text = 'Intentional unmanaged native Page'
          label.fontSize = 24
          label.textAlignment = 'center'
          page.backgroundColor = '#fee7dc'
          page.content = label
          return page
        },
      })
      await wait(600)
      check(
        checkpoints().some(
          (r) =>
            r.boundary === 'reconcile-after' &&
            r.snapshot.issues.some((i) => i.code === 'unknown-native-page'),
        ),
        'Actual unknown native Page retained',
      )
    } else if (name === 'recovery') {
      frame.goBack()
      await wait(600)
      check(
        checkpoints().at(-1)!.snapshot.issues.length === 0,
        'Native recovery observed',
      )
      check(
        checkpoints().some((r) =>
          r.snapshot.issues.some((i) => i.code === 'unknown-native-page'),
        ),
        'Earlier divergence remains observable',
      )
    } else if (name === 'truncate') {
      for (let i = 0; i < 180; i++) diagnostics.checkpoint()
      check(diagnostics.recording()!.droppedRecords > 0, 'Evicted prefix reported')
      check(
        diagnostics.recording()!.records[0]!.sequence > 1,
        'Sequence identifies missing prefix',
      )
    } else if (name === 'clear') {
      diagnostics.clear()
      check(diagnostics.recording()!.epoch === 1, 'Clear advances epoch')
      check(diagnostics.recording()!.records[0]?.kind === 'gap', 'Clear gap explicit')
    } else if (name === 'stop') {
      diagnostics.stop()
      const before = JSON.stringify(diagnostics.recording())
      await router.backToRoot({ animated: false })
      check(
        JSON.stringify(diagnostics.recording()) === before,
        'Stopped recording unchanged while app navigates',
      )
    }
    const capture = diagnostics.recording()!
    check(
      capture.records.length <= capture.limits.maxRecords &&
        capture.retainedBytes <= capture.limits.maxBytes,
      'Retention bounded',
    )
    check(!JSON.stringify(capture).includes('private-'), 'Payloads redacted')
  } catch (value) {
    error = value
  }
  const capture = diagnostics.recording()!
  const state = checkpoints().at(-1)?.snapshot
  const stack = state?.stacks[0]
  const logical = stack?.logical.map((entry) => entry.route).join(' → ') ?? 'unobserved'
  const native =
    stack?.native
      .flatMap((host) => host.entries)
      .map((id) => (id === null ? 'UNKNOWN' : id.split(':').at(-1)))
      .join(' → ') ?? 'unobserved'
  comparison.value = `Logical: ${logical}\nNative: ${native}`
  summary.value = `${checkpoints().length} checkpoints · ${capture.records.filter((r) => r.kind === 'event').length} events · ${state?.issues.length ?? 0} current issues`
  retained.value = `${capture.retainedBytes} / ${capture.limits.maxBytes} bytes · dropped ${capture.droppedRecords} · cleared ${capture.clearedRecords}\nCollector work: ${capture.overhead.totalMs.toFixed(2)} ms total / ${capture.overhead.maxMs.toFixed(2)} ms max`
  detail.value =
    name === 'recovery'
      ? 'Current stacks agree; the earlier divergence is still recorded.'
      : name === 'stop'
        ? 'The app navigated after stop; the detached recording stayed unchanged.'
        : 'Actual native observations. No replay, navigation inference or restored objects.'
  const report = {
    command: name,
    ok: !error,
    error: error ? String(error) : undefined,
    capture,
  }
  await File.fromPath(
    `${knownFolders.documents().path}/recording-${name}.json`,
  ).writeText(JSON.stringify(report, null, 2))
  if (name === 'recovery')
    await File.fromPath(`${knownFolders.documents().path}/recording-v1.json`).writeText(
      diagnostics.export(),
    )
  status.value = `${error ? 'FAIL' : 'PASS'} ${name}`
}

const app = createApp({
  render: () =>
    h('GridLayout', { rows: 'auto,auto,auto,auto,auto,*', backgroundColor: '#e4ecf6' }, [
      h('Label', {
        row: 0,
        text: status.value,
        fontSize: 23,
        fontWeight: 'bold',
        color: '#17656c',
        margin: '12 20',
      }),
      h('Label', {
        row: 1,
        text: detail.value,
        textWrap: true,
        fontSize: 16,
        margin: '0 20 8',
      }),
      h('Label', {
        row: 2,
        text: `${summary.value}\n${retained.value}`,
        textWrap: true,
        fontSize: 16,
        margin: '0 20 8',
      }),
      h('Label', {
        row: 3,
        text: comparison.value,
        textWrap: true,
        fontSize: 16,
        margin: '0 20 8',
        color: '#183b58',
      }),
      h(
        'WrapLayout',
        { row: 4, margin: '0 12 8' },
        [
          'initial',
          'success',
          'blocked',
          'cancelled',
          'modal',
          'divergence',
          'recovery',
          'truncate',
          'clear',
          'stop',
        ].map((name) =>
          h('Button', {
            text: name === 'initial' ? 'start' : name,
            accessibilityLabel: `recording:${name}`,
            margin: 4,
            padding: 10,
            onTap: () => void run(name),
          }),
        ),
      ),
      h(RouterView, {
        row: 5,
        onLoaded: (event: { object: Frame }) => {
          frame = event.object
        },
      }),
    ]),
})
app.use(router)
app.start()
