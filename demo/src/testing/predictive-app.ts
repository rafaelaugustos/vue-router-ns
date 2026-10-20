import {
  Application,
  ApplicationSettings,
  Device,
  File,
  Frame,
  knownFolders,
  Page,
  FadeTransition,
  Utils,
} from '@nativescript/core'
import { ActionBar, createApp, defineComponent, h, ref, watch } from 'nativescript-vue'
import {
  createRouter,
  RouterView,
  onBeforeRouteLeave,
  useBackGesture,
  useNativeHost,
  useRoute,
} from 'vue-router-ns'

declare const __PREDICTIVE_CORE__: boolean
const status = ref('starting')
const leaveGuard = ref(false)
let globalGuard = false
let main: Frame
let current: Frame
let target: Page | undefined
let previous: Page | undefined
let sequence = 0
let commandStart = 0
let busy = false
let result: unknown
let resultCount = 0
let gesture: any[] = []
let captures: any[] = []
const collected = new java.lang.ref.ReferenceQueue<android.graphics.Bitmap>()
const bitmaps: java.lang.ref.WeakReference<android.graphics.Bitmap>[] = []
let collectedCount = 0
function trackBitmap(frame: Frame) {
  const image = frame.nativeViewProtected.getChildAt(0) as android.widget.ImageView
  const drawable = image.getDrawable() as android.graphics.drawable.BitmapDrawable
  bitmaps.push(new java.lang.ref.WeakReference(drawable.getBitmap(), collected))
}
const lifecycle: any[] = []
const assertions: string[] = []
const pause = (ms = 100) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const settings = {
  routes: [] as any[],
  backPreview: (__PREDICTIVE_CORE__ ? 'core' : true) as boolean | 'core',
  diagnostics: true,
}
const file = File.fromPath(`${knownFolders.documents().path}/predictive.json`)
function check(label: string, value: unknown): asserts value {
  if (!value) throw new Error(label)
  assertions.push(label)
}
function history(frame = current) {
  return [...frame.backStack.map((e) => e.resolvedPage), frame.currentPage].filter(
    Boolean,
  )
}
function fragment(frame: Frame, page: Page | undefined) {
  return [...frame.backStack, (frame as any)._currentEntry].find(
    (e) => e?.resolvedPage === page,
  )?.fragment
}
function trace(event: string, path: string, page: Page) {
  lifecycle.push({
    event,
    path,
    loaded: page.isLoaded,
    parent: !!page.nativeViewProtected?.getParent?.(),
    at: performance.now(),
  })
}
function report(command: string, error?: unknown) {
  const data = {
    command,
    sequence: ++sequence,
    ok: !error,
    error: error ? String(error) : undefined,
    sdk: Device.sdkVersion,
    pid: android.os.Process.myPid(),
    coreBuild: __PREDICTIVE_CORE__,
    mode: settings.backPreview,
    route: router.currentRoute.value.path,
    stack: router.stack.value.map((r) => r.path),
    gesture,
    captures,
    lifecycle: lifecycle.slice(commandStart),
    assertions,
    resultCount,
    diagnostics: router.diagnostics?.toJSON(),
  }
  file.writeTextSync(JSON.stringify(data))
  status.value = `${error ? 'FAIL' : 'PASS'} ${command}`
  console.log(`PREDICTIVE_RESULT ${JSON.stringify(data)}`)
}
async function until(test: () => unknown, label: string, timeout = 10000) {
  const end = Date.now() + timeout
  while (!test()) {
    if (Date.now() > end) throw new Error(`Timeout: ${label}`)
    await pause()
  }
}
function observeFrame(frame: Frame) {
  const native = frame as any
  if (!native.beginBackPreview || native.__previewObserved) return
  native.__previewObserved = true
  const begin = native.beginBackPreview
  // Observational wrapper calls the actual Core implementation without altering its result.
  native.beginBackPreview = function (options: any) {
    const start = performance.now()
    const session = begin.call(this, options)
    captures.push({
      milliseconds: performance.now() - start,
      accepted: !!session,
      bytes: session?.snapshotBytes ?? 0,
    })
    return session
  }
}
const Screen = defineComponent({
  setup() {
    const route = useRoute()
    const host = useNativeHost<Frame>()
    const progress = useBackGesture()
    onBeforeRouteLeave(() => false, {
      when: () => route.path === '/guard' && leaveGuard.value,
    })
    watch(
      progress,
      (value) => {
        if (!value) return
        const frame = host.native!
        const below = frame.backStack.at(-1)?.resolvedPage
        gesture.push({
          progress: value.progress,
          edge: value.edge,
          previousAttached: !!below?.nativeViewProtected?.getParent(),
          previousLoaded: below?.isLoaded,
          currentLoaded: frame.currentPage?.isLoaded,
          fragmentBackStack: (frame as any)
            ._getFragmentManager()
            ?.getBackStackEntryCount(),
          children: frame.nativeViewProtected?.getChildCount(),
          at: performance.now(),
        })
      },
      { flush: 'sync' },
    )
    return () =>
      h(
        'Page',
        {
          backgroundColor: route.path === '/' ? '#dbeafe' : '#fff7ed',
          onLoaded: (event: any) => {
            current = host.native!
            if (route.path === '/') main = current
            observeFrame(current)
            trace('loaded', route.path, event.object)
          },
          onUnloaded: (event: any) => trace('unloaded', route.path, event.object),
          onNavigatedTo: (event: any) => {
            current = host.native!
            trace('navigatedTo', route.path, event.object)
          },
          onNavigatedFrom: (event: any) =>
            trace('navigatedFrom', route.path, event.object),
        },
        [
          h(ActionBar, { title: `Predictive ${route.path}` }),
          h('StackLayout', { padding: 24 }, [
            h('Label', {
              text: `${settings.backPreview === 'core' ? 'CORE' : 'LEGACY'}: ${route.path}`,
              fontSize: 28,
              color: '#111827',
            }),
            h('Label', { text: status.value, textWrap: true, marginTop: 16 }),
            h('TextField', {
              text: `draft ${route.path}`,
              hint: 'Draft must remain intact',
            }),
            h('Label', {
              text: 'Native Page / Frame\nPrevious page: blue\nDetail page: orange',
              fontSize: 22,
              marginTop: 40,
              textWrap: true,
            }),
          ]),
        ],
      )
  },
})
settings.routes = ['/', '/detail', '/guard', '/replacement', '/last'].map((path) => ({
  path,
  component: Screen,
}))
settings.routes.push({ path: '/modal', component: Screen, modal: { fullscreen: true } })
const router = createRouter(settings)
router.beforeEach((_to, _from, info) =>
  info.type === 'back' && globalGuard ? false : undefined,
)
async function reset() {
  leaveGuard.value = false
  globalGuard = false
  while (current && current !== main) {
    await router.back({ animated: false })
    await pause()
  }
  await router.setStack(['/'], { animated: false })
  await until(() => main?.currentPage?.isLoaded, 'root loaded')
  current = main
}
async function prepare(path = '/detail', custom = false) {
  await reset()
  await router.push(
    path,
    custom ? { transition: { instance: new FadeTransition(100) } } : { animated: true },
  )
  await until(
    () =>
      !!fragment(current, current.currentPage)?.isResumed() &&
      !!Application.android.foregroundActivity?.hasWindowFocus(),
    'resumed and focused',
  )
  target = current.currentPage
  previous = current.backStack.at(-1)?.resolvedPage
  gesture = []
  captures = []
  commandStart = lifecycle.length
}
function unchanged() {
  check('current Page identity retained', current.currentPage === target)
  check(
    'previous Page detached after gesture',
    !previous?.nativeViewProtected?.getParent(),
  )
  check(
    'native translation restored',
    Math.abs(target!.nativeViewProtected.getTranslationX()) < 0.01,
  )
  check(
    'native scale restored',
    Math.abs(target!.nativeViewProtected.getScaleX() - 1) < 0.01,
  )
  check(
    'native alpha restored',
    Math.abs(target!.nativeViewProtected.getAlpha() - 1) < 0.01,
  )
}
async function command(name: string) {
  if (busy) return
  busy = true
  try {
    if (name === 'mode-legacy') settings.backPreview = true
    else if (name === 'mode-core') {
      check(
        'candidate Core API exists',
        typeof (main as any).beginBackPreview === 'function',
      )
      settings.backPreview = 'core'
    } else if (name === 'prepare') await prepare()
    else if (name === 'cancel-check') {
      unchanged()
      check(
        'real progress received',
        gesture.length > 0 && gesture.some((v) => v.progress > 0),
      )
      check(
        'FragmentManager history unchanged',
        gesture.every((v) => v.fragmentBackStack === 0),
      )
      if (settings.backPreview === 'core') {
        check(
          'Core snapshot accepted',
          captures.some((v) => v.accepted && v.bytes > 0),
        )
        check(
          'previous Page never attached in Core preview',
          gesture.every((v) => !v.previousAttached),
        )
      } else
        check(
          'legacy preview attaches previous Page',
          gesture.some((v) => v.previousAttached),
        )
      check(
        'no Page navigation during cancelled gesture',
        lifecycle.slice(commandStart).length === 0,
      )
    } else if (name === 'commit-check') {
      await until(() => current.currentPage === previous, 'native pop')
      check('native target removed', !history().includes(target!))
      check('returned Page loaded', previous?.isLoaded)
      check('no invariant violations', !router.diagnostics?.snapshot().issues.length)
    } else if (name === 'global-guard') {
      await prepare()
      globalGuard = true
    } else if (name === 'guard-check') {
      unchanged()
      check('global guard reached after progress', gesture.length > 0)
    } else if (name === 'leave-guard') {
      await prepare('/guard')
      leaveGuard.value = true
    } else if (name === 'leave-check') {
      unchanged()
      check(
        'active leave guard suppresses preview',
        gesture.length === 0 && captures.length === 0,
      )
    } else if (name === 'custom') {
      await prepare('/detail', true)
    } else if (name === 'custom-check') {
      unchanged()
      if (settings.backPreview === 'core')
        check(
          'custom transition declined by Core',
          captures.length > 0 && captures.every((v) => !v.accepted),
        )
      check(
        'custom transition uses existing preview',
        gesture.some((v) => v.previousAttached),
      )
    } else if (name === 'modal') {
      await reset()
      resultCount = 0
      void router.pushForResult('/modal').then((value) => {
        result = value
        resultCount++
      })
      await until(() => router.currentRoute.value.path === '/modal', 'modal')
      await router.push('/detail', { animated: true })
      target = current.currentPage
      previous = current.backStack.at(-1)?.resolvedPage
      gesture = []
      captures = []
      commandStart = lifecycle.length
    } else if (name === 'modal-check') {
      await until(() => current.currentPage === previous, 'modal inner pop')
      check('main history untouched', history(main).length === 1)
      check('modal still open', resultCount === 0 && current !== main)
      await router.back({ result: 'accepted', animated: false })
      await until(() => resultCount === 1, 'modal result')
      check('modal result retained', result === 'accepted')
      current = main
    } else if (name === 'replace-clear') {
      await prepare()
      await router.replace('/replacement', { animated: false })
      check('replace preserves history length', history().length === 2)
      await router.push('/last', { clearHistory: true, animated: false })
      check(
        'clearHistory leaves one Page',
        history().length === 1 && !current.canGoBack(),
      )
      if (settings.backPreview === 'core')
        check('no Core preview at root', !(current as any).beginBackPreview())
    } else if (name === 'interrupt') {
      await prepare()
      const session = (current as any).beginBackPreview?.()
      check('interrupt session available', session)
      session.update(0.6, 'left')
      const finished = session.finish()
      await router.replace('/replacement', { animated: false })
      check(
        'replacement interrupts native session',
        !session.active && (await finished) === false,
      )
      check('replacement not popped', router.currentRoute.value.path === '/replacement')
    } else if (name === 'memory') {
      await reset()
      for (let i = 0; i < 8; i++) {
        await prepare()
        const session = (current as any).beginBackPreview?.()
        check(`cycle ${i} created`, session)
        trackBitmap(current)
        session.update(0.5, 'right')
        session.dispose()
        check(`cycle ${i} released bitmap`, session.snapshotBytes === 0)
        await router.back({ animated: false })
      }
      for (let round = 0; round < 3; round++) {
        await pause(300)
        Utils.GC()
        java.lang.Runtime.getRuntime().gc()
        await pause(300)
        while (collected.poll()) collectedCount++
      }
      check('all snapshot bitmaps collected', bitmaps.length - collectedCount === 0)
      check('one Page after cycles', history().length === 1)
    } else throw new Error(`Unknown command ${name}`)
    await pause(250)
    report(name)
  } catch (error) {
    report(name, error)
  } finally {
    busy = false
  }
}
Application.android.on('activityNewIntent', (event: any) => {
  const name = event.intent.getStringExtra('predictiveCommand')
  if (name) void command(String(name))
})
createApp({ render: () => h(RouterView) })
  .use(router)
  .start()
void router
  .isReady()
  .then(async () => {
    await until(() => !!main?.currentPage?.isLoaded, 'first Page')
    report('ready')
  })
  .catch((error) => report('ready', error))
