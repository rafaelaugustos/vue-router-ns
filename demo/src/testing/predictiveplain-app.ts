import {
  Application,
  Button,
  Device,
  File,
  Frame,
  Label,
  knownFolders,
  Page,
  StackLayout,
  TextField,
} from '@nativescript/core'
import { previewBack } from '../../../dist/back-preview.js'
const frame = new Frame()
const file = File.fromPath(`${knownFolders.documents().path}/predictive-plain.json`)
const trace: any[] = []
for (const method of [
  '_onAttachedToWindow',
  '_onDetachedFromWindow',
  'initNativeView',
  'disposeNativeView',
  'onLoaded',
  'onUnloaded',
]) {
  const original = (frame as any)[method]
  ;(frame as any)[method] = function (...args: any[]) {
    const record = (phase: string) =>
      trace.push({
        event: method,
        phase,
        at: performance.now(),
        nativeId: this.nativeViewProtected?.hashCode(),
        nativeAttached: this.nativeViewProtected?.isAttachedToWindow(),
        flag: this._attachedToWindow,
        activity: this.android.activity?.hashCode(),
        state: String(this.android.activity?.getLifecycle?.()?.getCurrentState?.()),
        global: Application.android.foregroundActivity?.hashCode(),
        managerDestroyed: this._manager?.isDestroyed(),
      })
    record('before')
    const result = original.apply(this, args)
    record('after')
    return result
  }
}

let session: any
let oldActivity = 0
let previous: Page
let top: Page
let input: TextField
let busy = false
let mode = 'core'
let stage = 'initial'
const pause = (ms = 100) => new Promise<void>((resolve) => setTimeout(resolve, ms))
function check(value: unknown, label: string): asserts value {
  if (!value) throw new Error(label)
}
async function until(test: () => unknown) {
  const end = Date.now() + 15000
  while (!test()) {
    if (Date.now() > end) throw new Error('Native Frame not ready')
    await pause()
  }
}
function report(command: string, error?: unknown) {
  const data = {
    command,
    stage,
    frameLoaded: frame.isLoaded,
    pageLoaded: frame.currentPage?.isLoaded,
    queueEmpty: frame.navigationQueueIsEmpty(),
    executing: !!(frame as any)._executingContext,
    attached: (frame as any)._attachedToWindow,
    ownerActivity: frame.android.activity?.hashCode(),
    managerDestroyed: (frame as any)._getFragmentManager()?.isDestroyed(),
    ok: !error,
    error: error ? String(error) : undefined,
    mode,
    sdk: Device.sdkVersion,
    pid: android.os.Process.myPid(),
    activity: Application.android.foregroundActivity?.hashCode(),
    oldActivity,
    sessionActive: session?.active,
    stack: frame.backStack.length,
    currentId: frame.currentPage?._domId,
    previousId: previous?._domId,
    trace,
  }
  file.writeTextSync(JSON.stringify(data))
  console.log(`PREDICTIVE_PLAIN ${JSON.stringify(data)}`)
}
function page(title: string) {
  const page = new Page()
  page.actionBar.title = title
  page.backgroundColor = '#dbeafe'
  const layout = new StackLayout()
  layout.padding = 24
  const label = new Label()
  label.text = title
  label.fontSize = 24
  layout.addChild(label)
  const field = new TextField()
  field.text = 'retained draft'
  layout.addChild(field)
  if (title === 'Detail') input = field
  const button = new Button()
  button.text = 'Recreate Activity'
  button.on('tap', () => void recreate())
  layout.addChild(button)
  page.content = layout
  for (const event of ['loaded', 'unloaded', 'navigatedTo', 'navigatedFrom'])
    page.on(event, () =>
      trace.push({
        event,
        title,
        id: page._domId,
        loaded: page.isLoaded,
        at: performance.now(),
      }),
    )
  return page
}
async function prepare() {
  frame.navigate({ create: () => page('Root'), animated: false, clearHistory: true })
  await until(() => frame.currentPage?.isLoaded && frame.navigationQueueIsEmpty())
  previous = frame.currentPage
  frame.navigate({ create: () => page('Detail'), animated: false })
  await until(
    () =>
      frame.currentPage !== previous &&
      frame.currentPage?.isLoaded &&
      frame.navigationQueueIsEmpty(),
  )
  top = frame.currentPage
  await pause(300)
  if (mode === 'core') session = (frame as any).beginBackPreview()
  else session = previewBack(frame, top, previous, async () => {})
  check(session, 'Native preview exists')
  if (mode === 'core') session.update(0.6, 'left')
  else session.progress(0.6, 'left')
  oldActivity = Application.android.foregroundActivity.hashCode()
}
async function recreate() {
  if (busy) return
  busy = true
  try {
    stage = 'prepare'
    await prepare()
    stage = 'recreate'
    Application.android.foregroundActivity.recreate()
    await until(
      () =>
        Application.android.foregroundActivity &&
        Application.android.foregroundActivity.hashCode() !== oldActivity &&
        frame.currentPage?.isLoaded &&
        frame.navigationQueueIsEmpty(),
    )
    check(!session.active, 'Old preview disposed by teardown')
    check(
      frame.currentPage === top && frame.backStack.at(-1)?.resolvedPage === previous,
      'Native Page identities retained',
    )
    check(input.text === 'retained draft', 'Draft retained')
    check(
      !previous.nativeViewProtected?.getParent(),
      'Previous Page stays detached after recreation',
    )
    check(
      Math.abs(top.nativeViewProtected.getScaleX() - 1) < 0.01,
      'Scale reset after recreation',
    )
    check(
      Math.abs(top.nativeViewProtected.getTranslationX()) < 0.01,
      'Translation reset after recreation',
    )
    stage = 'back-after-recreate'
    frame.goBack()
    await until(() => frame.currentPage === previous && frame.navigationQueueIsEmpty())
    report('recreated')
  } catch (error) {
    report('recreated', error)
  } finally {
    busy = false
  }
}
frame.on('unloaded', () => {
  if (mode === 'legacy') session?.dispose()
})
Application.android.on('activityNewIntent', (event: any) => {
  const value = event.intent.getStringExtra('predictivePlainCommand')
  if (value) {
    mode = String(value)
    void recreate()
  }
})
Application.run({ create: () => frame })
frame.once('loaded', () => {
  frame.navigate({ create: () => page('Ready'), animated: false })
  void until(() => frame.currentPage?.isLoaded).then(() => report('ready'))
})
