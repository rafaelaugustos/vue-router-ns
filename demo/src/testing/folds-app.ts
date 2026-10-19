// Native folding acceptance: ns build android --env.foldsTest.
import {
  Application,
  type Frame,
  type GridLayout,
  type Page,
  type ScrollView,
  type TextField,
  type View,
} from '@nativescript/core'
import { createApp, defineComponent, h, nextTick, ref, type Ref } from 'nativescript-vue'
import { createRouter, RouterSplitView, useRoute } from 'vue-router-ns'
import { observeWindowFolds, splitViewport, type WindowFold } from '../../../dist/folding'

interface Capture {
  page?: Page
  editor?: TextField
  scroll?: ScrollView
  draft: Ref<string>
}
const captured = new Map<string, Capture>()
const status = ref('Preparing fold checks')
const foldAware = ref(true)
let root: GridLayout
let split: GridLayout
let folds: readonly WindowFold[] = []
let baseline: {
  pages: Page[]
  entries: unknown[]
  frames: Frame[]
  scroll: number
  editor: TextField
}
const pause = (ms = 100) => new Promise<void>((done) => setTimeout(done, ms))
async function until(test: () => boolean, message: string) {
  for (let i = 0; i < 150; i++) {
    if (test()) return
    await pause()
  }
  throw new Error(`Timed out: ${message}`)
}
function assert(test: unknown, message: string): asserts test {
  if (!test) throw new Error(message)
}
const Screen = defineComponent({
  setup() {
    const route = useRoute()
    const path = route.path
    const state: Capture = { draft: ref('') }
    captured.set(path, state)
    return () =>
      h(
        'Page',
        {
          actionBarHidden: true,
          ref: (node: any) => {
            if (node) state.page = node.nativeView
          },
        },
        [
          h(
            'GridLayout',
            {
              rows: 'auto, auto, *',
              padding: 12,
              backgroundColor: path === '/list' ? '#e8eefc' : '#f8f5ed',
            },
            [
              h('Label', { text: path, fontSize: 22 }),
              h('TextField', {
                row: 1,
                hint: 'Retained draft',
                text: state.draft.value,
                onTextChange: (args: any) => {
                  state.draft.value = args.value
                },
                ref: (node: any) => {
                  if (node) state.editor = node.nativeView
                },
              }),
              h(
                'ScrollView',
                {
                  row: 2,
                  ref: (node: any) => {
                    if (node) state.scroll = node.nativeView
                  },
                },
                [
                  h(
                    'StackLayout',
                    Array.from({ length: 70 }, (_, i) =>
                      h('Label', { text: `${path} • item ${i}`, height: 44 }),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      )
  },
})
const router = createRouter({
  routes: [
    { path: '/list', component: Screen },
    { path: '/one', component: Screen },
    { path: '/two', component: Screen },
    { path: '/modal', component: Screen, modal: true },
  ],
})
const App = defineComponent({
  setup() {
    return () =>
      h('Page', { actionBarHidden: true }, [
        h(
          'GridLayout',
          {
            rows: 'auto, *',
            ref: (node: any) => {
              if (node) root = node.nativeView
            },
          },
          [
            h('Label', { text: status.value, textWrap: true, padding: 8 }),
            h(RouterSplitView, { row: 1, list: '/list', foldAware: foldAware.value }),
          ],
        ),
      ])
  },
})
createApp(App).use(router).start()

function bounds(view: View) {
  const native = view.nativeViewProtected
  const xy = Array.create('int', 2)
  native.getLocationInWindow(xy)
  const density = native.getResources().getDisplayMetrics().density
  return {
    left: xy[0] / density,
    top: xy[1] / density,
    right: (xy[0] + native.getWidth()) / density,
    bottom: (xy[1] + native.getHeight()) / density,
  }
}
function snapshot() {
  return {
    folds,
    viewport: splitViewport(split),
    columns: split
      .getColumns()
      .map((item) => `${item.value}${item.gridUnitType === 'star' ? '*' : ''}`)
      .join(', '),
    rows: split
      .getRows()
      .map((item) => `${item.value}${item.gridUnitType === 'star' ? '*' : ''}`)
      .join(', '),
    panes: baseline.frames.map(bounds),
    pid: android.os.Process.myPid(),
    path: router.currentRoute.value.path,
  }
}
function retained() {
  assert(
    router.stack.value.length === baseline.entries.length &&
      router.stack.value.every((entry, i) => entry === baseline.entries[i]),
    'logical history replaced',
  )
  assert(captured.size === 3 || captured.size === 4, 'unexpected page count')
  for (const [i, path] of ['/list', '/one', '/two'].entries()) {
    assert(captured.get(path)!.page === baseline.pages[i], `Page replaced: ${path}`)
    assert(captured.get(path)!.draft.value === `draft ${path}`, `draft lost: ${path}`)
  }
  assert(baseline.frames[1]!.currentPage === baseline.pages[2], 'native detail changed')
  assert(
    Math.abs(captured.get('/two')!.scroll!.verticalOffset - baseline.scroll) < 2,
    'scroll lost',
  )
}
function hingeExcluded() {
  const paneBounds = baseline.frames.map(bounds)
  for (const fold of folds.filter((f) => f.separating || f.occluding)) {
    for (const pane of paneBounds) {
      const intersects = fold.vertical
        ? pane.left < fold.right - 0.5 && pane.right > fold.left + 0.5
        : pane.top < fold.bottom - 0.5 && pane.bottom > fold.top + 0.5
      assert(!intersects, `pane crosses fold: ${JSON.stringify({ fold, pane })}`)
    }
  }
}
let busy = Promise.resolve()
async function command(name: string) {
  if (name === 'modal') {
    await router.push('/modal')
    return
  }
  if (name === 'dismiss') {
    await router.back()
    retained()
    return
  }
  if (name === 'rtl') {
    root.android.setLayoutDirection(1)
    split.android.setLayoutDirection(1)
    split.requestLayout()
    await pause(300)
  }
  if (name === 'ltr') {
    root.android.setLayoutDirection(0)
    split.android.setLayoutDirection(0)
    split.requestLayout()
    await pause(300)
  }
  if (name === 'disable') {
    foldAware.value = false
    await nextTick()
    await pause(300)
  }
  if (name === 'enable') {
    foldAware.value = true
    await nextTick()
    await pause(300)
  }
  if (name === 'focus') {
    baseline.editor.android.setShowSoftInputOnFocus(false)
    baseline.editor.android.requestFocus()
    await pause(200)
    assert(baseline.editor.android.hasFocus(), 'could not focus editor')
    return
  }
  if (name === 'vertical' || name === 'horizontal') {
    await until(
      () => folds.some((f) => f.separating && f.vertical === (name === 'vertical')),
      `native ${name} FoldingFeature`,
    )
  }
  if (name === 'occluding')
    await until(
      () => folds.some((f) => f.occluding && f.right > f.left),
      'occluding native hinge',
    )
  if (name === 'flat')
    await until(
      () => folds.every((f) => !f.separating && !f.occluding),
      'flat nonseparating fold',
    )
  await pause(400)
  if (router.currentRoute.value.path !== '/modal') {
    retained()
    if (name !== 'disable')
      await until(() => {
        try {
          hingeExcluded()
          return true
        } catch {
          return false
        }
      }, 'native panes outside the fold after layout settles')
    if (name === 'focused')
      assert(baseline.editor.android.hasFocus(), 'input focus lost during posture change')
  }
  const [list, detail] = baseline.frames.map(bounds)
  if (name === 'rtl' && folds.some((f) => f.vertical && f.separating))
    assert(list!.left > detail!.left, 'list is not on RTL start side')
  if (name === 'back') {
    await router.back()
    assert(
      router.currentRoute.value.path === '/one',
      'Back lost retained previous detail',
    )
    assert(captured.get('/one')!.draft.value === 'draft /one', 'Back lost previous draft')
  }
}
Application.android.on(Application.android.activityNewIntentEvent, (args: any) => {
  const name = args.intent?.getStringExtra('foldCommand')
  const id = args.intent?.getStringExtra('foldId')
  if (!name) return
  busy = busy
    .then(async () => {
      await command(name)
      status.value = `PASS ${name}`
      console.log(`FOLD_RESULT ${JSON.stringify({ id, name, ok: true, ...snapshot() })}`)
    })
    .catch((error) => {
      status.value = `FAIL ${String(error)}`
      console.log(
        `FOLD_RESULT ${JSON.stringify({ id, name, ok: false, error: String(error), ...(baseline ? snapshot() : {}) })}`,
      )
    })
})
void (async () => {
  await router.isReady()
  await router.push('/one', { animated: false })
  await router.push('/two', { animated: false })
  await until(() => !!captured.get('/two')?.editor?.android, 'native detail editor')
  split = captured.get('/list')!.page!.frame.parent as GridLayout
  observeWindowFolds(split, (next) => {
    folds = next
    console.log(`FOLD_FEATURE ${JSON.stringify(next)}`)
  })
  for (const [path, state] of captured) state.draft.value = `draft ${path}`
  await nextTick()
  await pause(500)
  captured.get('/two')!.scroll!.scrollToVerticalOffset(280, false)
  await pause(300)
  baseline = {
    pages: ['/list', '/one', '/two'].map((path) => captured.get(path)!.page!),
    entries: [...router.stack.value],
    frames: [captured.get('/list')!.page!.frame, captured.get('/two')!.page!.frame],
    scroll: captured.get('/two')!.scroll!.verticalOffset,
    editor: captured.get('/two')!.editor!,
  }
  assert(baseline.scroll > 100, 'fixture did not scroll')
  status.value = 'Ready for native fold changes'
  console.log(`FOLD_READY ${JSON.stringify(snapshot())}`)
})().catch((error) => console.log(`FOLD_FATAL ${String(error)}`))
