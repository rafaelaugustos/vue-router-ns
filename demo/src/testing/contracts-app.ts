// Native contract fixture. No Frame/controller/gesture methods are replaced.
import {
  Application,
  ApplicationSettings,
  Device,
  File,
  Frame,
  isAndroid,
  isIOS,
  knownFolders,
  Page,
  Utils,
  type Label,
} from '@nativescript/core'
import {
  ActionBar,
  createApp,
  defineComponent,
  h,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  watch,
  type Component,
} from 'nativescript-vue'
import {
  createRouter,
  isNavigationFailure,
  NavigationFailureType,
  onBeforeRouteLeave,
  RouterView,
  useBackGesture,
  useNativeHost,
  useRoute,
  useRouter,
} from 'vue-router-ns'

declare const __CONTRACT_FAULT__: boolean
const status = ref('starting')
const blocked = ref(false)
const pause = (ms = 50) => new Promise<void>((done) => setTimeout(done, ms))
const pid = () =>
  isAndroid ? android.os.Process.myPid() : NSProcessInfo.processInfo.processIdentifier
const records: { name: string; ok: boolean }[] = []
const samples: {
  batch: number
  durations: number[]
  livePages: number
  nativeRetained: number
  collections: { round: number; livePages: number; nativeRetained: number }[]
}[] = []
const weakPages: WeakRef<Page>[] = []
const weakNative: { deref(): unknown }[] = []
// Objective-C weak storage observes controller lifetime, not just JS wrappers.
const weakControllers = isIOS
  ? NSHashTable.weakObjectsHashTable<UIViewController>()
  : undefined
const active = new Set<number>()
let sequence = 0
let frame: Frame
let busy = false
let resultCount = 0
let modalResult: unknown
let modalGuardAttempts = 0
let gestureEvents = 0
let gesturePeak = 0
let gesturePage: Page | undefined
let revision = 1
let reportSequence = 0
let gestureObserver: NSObject | undefined
const reportFile = File.fromPath(`${knownFolders.documents().path}/native-contracts.json`)
const report = (command: string, error?: unknown) => {
  const data = {
    version: 1,
    sequence: ++reportSequence,
    command,
    ok: !error,
    error: error ? String(error) : undefined,
    pid: pid(),
    platform: isAndroid ? 'android' : 'ios',
    sdk: Device.sdkVersion,
    model: Device.model,
    fault: __CONTRACT_FAULT__,
    gesture: { events: gestureEvents, peak: gesturePeak },
    nativeFocus: isAndroid
      ? {
          frame: (frame as any)?._domId,
          topmost: (Frame.topmost() as any)?._domId,
          resumed: frame?.currentPage
            ? !!fragmentFor(frame.currentPage)?.isResumed()
            : false,
          focused: !!Application.android.foregroundActivity?.hasWindowFocus(),
        }
      : undefined,
    checks: records,
    samples,
    stack: router.stack.value.map((route) => route.path),
    diagnostics: router.diagnostics?.toJSON(),
  }
  reportFile.writeTextSync(JSON.stringify(data))
  File.fromPath(
    `${knownFolders.documents().path}/contract-${data.pid}-${data.sequence}-${command}.json`,
  ).writeTextSync(JSON.stringify(data))
  status.value = `${error ? 'FAIL' : 'PASS'} ${command}`
  console.log(`CONTRACT_RESULT ${JSON.stringify(data)}`)
}
function check(name: string, value: unknown): asserts value {
  if (!value) throw new Error(name)
  records.push({ name, ok: true })
}
async function until(test: () => boolean, label: string, timeout = 10000) {
  const end = Date.now() + timeout
  while (!test()) {
    if (Date.now() > end) throw new Error(`Timed out: ${label}`)
    await pause()
  }
}
const commands = [
  'suite',
  'hmr',
  'gesture-setup',
  'cancel-check',
  'commit-check',
  'guard-setup',
  'guard-check',
  'allow',
  'modal-setup',
  'modal-check',
  'modal-result-check',
  'restore-setup',
  'restore-check',
  'measure',
]
function pageComponent(title: string, version = 1) {
  return defineComponent({
    setup() {
      const route = useRoute()
      const owned = useRouter()
      const host = useNativeHost<Frame>()
      const gesture = useBackGesture()
      const id = ++sequence
      onBeforeRouteLeave(
        () => {
          if (route.path === '/modal') modalGuardAttempts++
          return !blocked.value
        },
        {
          when: () =>
            (route.path === '/guard' || route.path === '/modal') && blocked.value,
        },
      )
      watch(
        gesture,
        (value) => {
          if (value) {
            gestureEvents++
            gesturePeak = Math.max(gesturePeak, value.progress)
          }
        },
        { flush: 'sync' },
      )
      onMounted(() => active.add(id))
      onUnmounted(() => active.delete(id))
      return () =>
        h(
          'Page',
          {
            automationText: `page:${route.path}`,
            backgroundColor: '#ffffff',
            onLoaded: () => {
              if (route.path !== '/modal') frame = host.native!
            },
          },
          [
            h(ActionBar, { title: `${title} ${version}` }),
            h('StackLayout', { padding: 12 }, [
              h('Label', {
                id: 'contract-heading',
                text: `${title}:${version}:${route.path}`,
                automationText: 'contract-heading',
              }),
              h('Label', {
                text: status.value,
                automationText: 'contract-status',
                textWrap: true,
              }),
              h('Label', { text: `PID ${pid()}`, automationText: 'contract-pid' }),
              h(
                'WrapLayout',
                commands.map((name) =>
                  h('Button', {
                    text: name,
                    automationText: name,
                    fontSize: 11,
                    height: 38,
                    onTap: () => void command(name),
                  }),
                ),
              ),
              h('Button', {
                text: 'finish-modal',
                automationText: 'finish-modal',
                onTap: () => void owned.back({ result: 'native-result' }),
              }),
            ]),
          ],
        )
    },
  })
}
const Root = Object.assign(pageComponent('Root'), { __hmrId: 'contract-covered-page-63' })
const hmr = (
  globalThis as unknown as {
    __VUE_HMR_RUNTIME__: {
      createRecord(id: string, component: Component): void
      reload(id: string, component: Component): void
    }
  }
).__VUE_HMR_RUNTIME__
hmr.createRecord(Root.__hmrId, Root)
const router = createRouter({
  diagnostics: { maxEvents: 10000 },
  routes: [
    { path: '/', component: Root },
    { path: '/a', component: pageComponent('A') },
    { path: '/b', component: pageComponent('B') },
    { path: '/c', component: pageComponent('C') },
    { path: '/guard', component: pageComponent('Guard') },
    { path: '/modal', component: pageComponent('Modal'), modal: { animated: false } },
  ],
  restore: {
    load: () => {
      const saved = ApplicationSettings.getString('contract-history')
      return saved ? JSON.parse(saved) : null
    },
    save: (state) =>
      ApplicationSettings.setString('contract-history', JSON.stringify(state)),
  },
})
function nativePages() {
  return [...frame.backStack.map((entry) => entry.resolvedPage), frame.currentPage!]
}
function fragmentFor(page: Page) {
  return [...frame.backStack, (frame as any)._currentEntry].find(
    (entry) => entry?.resolvedPage === page,
  )?.fragment
}
function history(expected: string[], label: string) {
  const native = nativePages()
  check(
    `${label}: logical history`,
    JSON.stringify(router.stack.value.map((r) => r.path)) === JSON.stringify(expected),
  )
  check(
    `${label}: native history`,
    native.length === expected.length && new Set(native).size === native.length,
  )
  for (let i = 0; i < native.length; i++) {
    check(
      `${label}: native page ${i}`,
      native[i]!.automationText === `page:${expected[i]}`,
    )
  }
  check(
    `${label}: rendered content`,
    (frame.currentPage!.getViewById('contract-heading') as Label).text.endsWith(
      `:${expected.at(-1)}`,
    ),
  )
  if (isIOS)
    check(
      `${label}: UIKit controllers`,
      frame.ios.controller.viewControllers.count === expected.length,
    )
  else check(`${label}: Android Fragment`, !!fragmentFor(frame.currentPage!)?.isAdded())
  check(`${label}: diagnostic parity`, router.diagnostics!.snapshot().issues.length === 0)
}
async function root() {
  blocked.value = false
  await router.push('/', { clearHistory: true, animated: false })
  await pause()
}
async function suite() {
  await root()
  const original = frame.currentPage
  await router.push('/a', { animated: false })
  const a = frame.currentPage
  await router.push('/b', { animated: false })
  await router.replace('/c', { animated: false })
  history(['/', '/a', '/c'], 'replace')
  // Exercise the native Frame pop, independent of router.back().
  frame.goBack()
  await until(() => router.currentRoute.value.path === '/a', 'native pop')
  history(['/', '/a'], 'native pop')
  check('native pop retains the previous Page', frame.currentPage === a)
  await router.back({ animated: false })
  check('return retains root Page', frame.currentPage === original)
  await router.push('/b', { clearHistory: true, animated: false })
  history(['/b'], 'clearHistory')
  await root()
  blocked.value = true
  await router.push('/guard', { animated: false })
  const refusal = await router.back()
  check(
    'guard refuses before native mutation',
    isNavigationFailure(refusal, NavigationFailureType.aborted),
  )
  history(['/', '/guard'], 'guard')
  blocked.value = false
  await router.back({ animated: false })
  await modalSetup()
  const refused = await router.back()
  check(
    'modal guard refuses dismissal',
    isNavigationFailure(refused, NavigationFailureType.aborted),
  )
  blocked.value = false
  await router.back({ result: 'native-result', animated: false })
  await until(() => resultCount === 1, 'one modal result')
  check('modal returns typed result exactly once', modalResult === 'native-result')
  history(['/'], 'modal result')
}
async function coveredHmr() {
  await root()
  const original = frame.currentPage!
  await router.push('/a', { animated: false })
  const top = frame.currentPage
  revision++
  hmr.reload(Root.__hmrId, { ...pageComponent('Root', revision), __hmrId: Root.__hmrId })
  await nextTick()
  await pause(200)
  check(
    'covered HMR retains top and covered native Pages',
    frame.currentPage === top &&
      frame.backStack[0]!.resolvedPage === original &&
      (original.getViewById('contract-heading') as Label)?.text !== `Root:${revision}:/`,
  )
  let backDeadline: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      router.back({ animated: false }),
      new Promise<never>((_, reject) => {
        backDeadline = setTimeout(
          () => reject(new Error('Timed out: covered HMR native return')),
          10000,
        )
      }),
    ])
  } finally {
    clearTimeout(backDeadline)
  }
  await until(
    () =>
      frame.currentPage !== original &&
      (frame.currentPage?.getViewById('contract-heading') as Label)?.text ===
        `Root:${revision}:/`,
    'native Page replacement after covered HMR',
  )
  history(['/'], 'covered HMR')
  check(
    'covered HMR applies once',
    router.diagnostics!.events.filter((e) => e.phase === 'hmr' && e.detail === 'applied')
      .length === 1,
  )
}
async function modalSetup() {
  resultCount = 0
  modalResult = undefined
  modalGuardAttempts = 0
  blocked.value = true
  void router.pushForResult('/modal').then((value) => {
    modalResult = value
    resultCount++
  })
  await until(() => router.currentRoute.value.path === '/modal', 'modal presentation')
}
function retainWeak(page: Page) {
  weakPages.push(new WeakRef(page))
  if (isAndroid) {
    const fragment = fragmentFor(page)
    check('measured Fragment is attached before pop', !!fragment?.isAdded())
    const reference = new java.lang.ref.WeakReference(fragment)
    weakNative.push({ deref: () => reference.get() })
  } else {
    check(
      'measured UIKit controller is presented before pop',
      page.ios === frame.ios.controller.topViewController,
    )
    weakControllers!.addObject(page.ios)
  }
}
async function measure() {
  await root()
  // Warm-up is excluded from the measured batches.
  for (let i = 0; i < 5; i++) {
    await router.push('/a', { animated: false })
    await router.back({ animated: false })
  }
  for (let batch = 0; batch < 4; batch++) {
    const durations: number[] = []
    for (let i = 0; i < 10; i++) {
      const start = performance.now()
      await router.push('/a', {
        animated: true,
        transition: { name: 'fade', duration: 100 },
      })
      retainWeak(frame.currentPage!)
      await router.back({ animated: true })
      durations.push(performance.now() - start)
    }
    // JS finalizers release bridge references asynchronously; ART then needs
    // another collection to release the native object. Fixed rounds also make
    // that delay visible, rather than polling until a desired count appears.
    const collections = []
    for (let round = 0; round < 3; round++) {
      await pause(300)
      Utils.GC()
      if (isAndroid) java.lang.System.gc()
      await pause(300)
      collections.push({
        round,
        livePages: weakPages.filter((ref) => !!ref.deref()).length,
        nativeRetained: isIOS
          ? weakControllers!.allObjects.count
          : weakNative.filter((ref) => !!ref.deref()).length,
      })
    }
    const sample = {
      batch,
      durations,
      livePages: collections.at(-1)!.livePages,
      nativeRetained: collections.at(-1)!.nativeRetained,
      collections,
    }
    samples.push(sample)
    check(`batch ${batch}: only root component mounted`, active.size === 1)
    history(['/'], `batch ${batch}`)
  }
}
async function command(name: string) {
  if (busy) return
  busy = true
  status.value = `RUN ${name}`
  try {
    if (name === 'suite') await suite()
    else if (name === 'hmr') await coveredHmr()
    else if (name === 'measure') await measure()
    else if (name === 'gesture-setup' || name === 'guard-setup') {
      await root()
      blocked.value = name === 'guard-setup'
      await router.push(blocked.value ? '/guard' : '/a', { animated: true })
      if (isAndroid)
        await until(
          () =>
            Frame.topmost() === frame &&
            !!fragmentFor(frame.currentPage!)?.isResumed() &&
            !!Application.android.foregroundActivity?.hasWindowFocus(),
          'gesture target resumed, focused and owns native Back',
        )
      gesturePage = frame.currentPage
      gestureEvents = 0
      gesturePeak = 0
    } else if (name === 'cancel-check') {
      history(['/', '/a'], 'cancelled gesture')
      check('cancelled gesture retains native Page', gesturePage === frame.currentPage)
      check(
        'cancelled gesture received native progress',
        gestureEvents > 0 && gesturePeak > 0,
      )
      check(
        'cancelled preview resets transforms',
        frame.currentPage!.translateX === 0 && frame.currentPage!.scaleX === 1,
      )
    } else if (name === 'commit-check') {
      history(['/'], 'committed gesture')
      check(
        'committed gesture removes native Page',
        !nativePages().includes(gesturePage!),
      )
      gesturePage = undefined
    } else if (name === 'guard-check') history(['/', '/guard'], 'native guarded Back')
    else if (name === 'allow') blocked.value = false
    else if (name === 'modal-setup') await modalSetup()
    else if (name === 'modal-check') {
      check('native modal dismissal reaches the guard', modalGuardAttempts > 0)
      check(
        'native modal dismissal remains guarded',
        router.currentRoute.value.path === '/modal' && resultCount === 0,
      )
    } else if (name === 'modal-result-check') {
      await until(() => resultCount === 1, 'native modal result')
      check('native modal result settles exactly once', modalResult === 'native-result')
      history(['/'], 'native modal result')
    } else if (name === 'restore-setup') {
      await root()
      await router.push('/a', { animated: false })
      await router.push('/b', { animated: false })
      ApplicationSettings.setNumber('contract-old-pid', pid())
      history(['/', '/a', '/b'], 'before process death')
    } else if (name === 'restore-check') {
      check(
        'restoration runs in a new process',
        pid() !== ApplicationSettings.getNumber('contract-old-pid'),
      )
      history(['/', '/a', '/b'], 'restored process')
      await router.back({ animated: false })
      history(['/', '/a'], 'restored Back')
    } else throw new Error(`Unknown contract command ${name}`)
    report(name)
  } catch (error) {
    report(name, error)
  } finally {
    busy = false
  }
}
Application.android?.on('activityNewIntent', (args: any) => {
  const name = args.intent.getStringExtra('contractCommand')
  if (name) void command(String(name))
})
createApp({ render: () => h(RouterView) })
  .use(router)
  .start()
void router
  .isReady()
  .then(async () => {
    await until(() => !!frame?.currentPage?.isLoaded, 'initial native Page')
    if (isIOS) {
      const Observer = (NSObject as any).extend(
        {
          observe(recognizer: UIPanGestureRecognizer) {
            if (
              recognizer.state === UIGestureRecognizerState.Began ||
              recognizer.state === UIGestureRecognizerState.Changed
            ) {
              gestureEvents++
              gesturePeak = Math.max(
                gesturePeak,
                recognizer.translationInView(recognizer.view).x /
                  recognizer.view!.bounds.size.width,
              )
            }
          },
        },
        {
          exposedMethods: {
            observe: { returns: interop.types.void, params: [UIGestureRecognizer] },
          },
        },
      )
      gestureObserver = Observer.new()
      frame.ios.controller.interactivePopGestureRecognizer.addTargetAction(
        gestureObserver,
        'observe',
      )
    }
    report('ready')
  })
  .catch((error) => report('ready', error))
