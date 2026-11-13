import { File, Frame, GridLayout, knownFolders, Page } from '@nativescript/core'
import {
  ActionBar,
  createApp,
  defineComponent,
  h,
  nextTick,
  onUnmounted,
  ref,
} from 'nativescript-vue'
import {
  createRouter,
  mountNativeHost,
  onBeforeRouteLeave,
  useRoute,
  type NativeHostDelegate,
  type RouteRecordRaw,
} from 'vue-router-ns'
import { runNativeHostConformance } from 'vue-router-ns/testing/native-host'
import { createExternalFrameHost } from '@vue-router-ns/example-frame-host'

const status = ref('READY')
const guarded = ref(false)
const checks: string[] = []
const router = createRouter({ routes: [], diagnostics: true, motion: 'full' })
router.onError(() => {}) // Injected atomic failures are asserted by the harness.
let container: GridLayout
let frame: Frame
let owner: Frame | undefined
let host: ReturnType<typeof createExternalFrameHost>
let stop = () => {}
let late: NativeHostDelegate | undefined
let rejectNext: 'push' | 'back' | undefined
let busy = false
let pages: readonly Page[] = []
let disposedPages = 0
const lifetimes: { id: number; path: string; event: string }[] = []
const vueErrors: string[] = []
let viewId = 0
let resultCount = 0
let result: Promise<unknown>
let gestureObserver: NSObject | undefined
let gestureEvents = 0
let gesturePeak = 0
const observeGestures = () => {
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
const check = (value: unknown, name: string) => {
  if (!value) throw new Error(name)
  checks.push(name)
}
const until = async (predicate: () => boolean) => {
  const end = Date.now() + 5000
  while (!predicate()) {
    if (Date.now() >= end) throw new Error('Timed out awaiting native state')
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}
function report(command: string, error?: unknown, extra?: unknown) {
  const data = {
    command,
    ok: !error,
    error: error ? String(error) : undefined,
    checks: [...checks],
    logical: router.stack.value.map((route) => route.fullPath),
    native: host?.pages().map((page) => page._domId),
    loaded: host?.loaded,
    controllers: frame?.ios?.controller?.viewControllers.count,
    resultCount,
    disposedPages,
    lifetimes,
    vueErrors,
    gestureEvents,
    gesturePeak,
    extra,
  }
  File.fromPath(`${knownFolders.documents().path}/host-${command}.json`).writeTextSync(
    JSON.stringify(data),
  )
  status.value = `${error ? 'FAIL' : 'PASS'} ${command}`
  console.log(`HOST_RESULT ${JSON.stringify(data)}`)
}
function mount(
  routes: readonly RouteRecordRaw[],
  unloaded = false,
  retainedOwner = false,
) {
  const removeRoutes = routes.map((route) => router.addRoute(route))
  frame = new Frame()
  frame.automationText = 'host:frame'
  host = createExternalFrameHost(frame)
  const attach = host.attach
  host.attach = (delegate) => {
    late = delegate
    attach(delegate)
  }
  const push = host.push,
    back = host.back
  host.push = (component, options) => {
    if (rejectNext === 'push') {
      rejectNext = undefined
      throw new Error('Injected atomic push failure')
    }
    return push(component, options)
  }
  host.back = (target, options) => {
    if (rejectNext === 'back') {
      rejectNext = undefined
      return Promise.reject(new Error('Injected atomic back failure'))
    }
    return back(target, options)
  }
  owner = retainedOwner ? new Frame() : undefined
  if (owner) {
    container.addChild(owner)
    const page = new Page()
    page.actionBarHidden = true
    page.content = frame
    owner.navigate({ create: () => page, animated: false })
  } else if (!unloaded) container.addChild(frame)
  const unmount = mountNativeHost(router, 'default', host)
  const mountedView = owner ?? frame
  stop = () => {
    unmount()
    removeRoutes.forEach((remove) => remove())
    if (mountedView.parent === container) container.removeChild(mountedView)
  }
  return {
    router,
    host,
    unmount: () => stop(),
    load: () => container.addChild(frame),
    popNatively: () => frame.goBack(),
    rejectNext: (operation: 'push' | 'back') => {
      rejectNext = operation
    },
    lateEvents: () => {
      late?.changed()
      late?.closed()
      late?.backPressed()
      late?.dismissAttempted()
      late?.backGesture()
    },
  }
}
const destination = defineComponent({
  setup() {
    const id = ++viewId
    const path = useRoute().path
    lifetimes.push({ id, path, event: 'setup' })
    onBeforeRouteLeave(() => false, { when: guarded })
    onUnmounted(() => {
      disposedPages++
      lifetimes.push({ id, path, event: 'unmounted' })
    })
    return () =>
      h('Page', {}, [
        h(ActionBar, { title: 'External adapter' }),
        h('StackLayout', { padding: 24 }, [
          h('Label', { text: 'NativeHost · public exports', fontSize: 24 }),
          h('Label', {
            text: 'Native swipe, guards and owner lifecycle',
            textWrap: true,
          }),
          h('Label', {
            text: guarded.value ? 'Leave guard active' : 'Swipe Back enabled',
            automationText: 'host:guard',
          }),
        ]),
      ])
  },
})
async function command(name: string) {
  if (busy) return
  busy = true
  try {
    if (name === 'conformance') {
      const result = await runNativeHostConformance((routes) => mount(routes, true), {
        timeoutMs: 8000,
      })
      report(name, undefined, result)
      return
    }
    if (name === 'prepare') {
      mount(
        [
          { path: '/', component: destination },
          { path: '/gesture', component: destination },
        ],
        false,
        true,
      )
      await until(() => host.pages().length === 1)
      result = router.pushForResult('/gesture').then((value) => {
        resultCount++
        return value
      })
      await until(() => host.pages().length === 2 && router.stack.value.length === 2)
      pages = [...host.pages()]
      check(
        frame.ios.controller.viewControllers.count === 2,
        'two real UIKit controllers',
      )
      observeGestures()
    } else if (name === 'cancelled') {
      check(
        gestureEvents > 0 && gesturePeak > 0.2,
        'cancelled gesture actually moved UIKit transition',
      )
      check(
        router.stack.value.length === 2 &&
          host.pages().every((page, i) => page === pages[i]),
        'cancelled native gesture retains identities',
      )
      check(
        resultCount === 0 && disposedPages === 0,
        'cancelled gesture retains result and Vue apps',
      )
    } else if (name === 'guard-on') {
      guarded.value = true
      await nextTick()
      gestureEvents = 0
      gesturePeak = 0
      check(!pages[1].enableSwipeBackNavigation, 'leave guard disables native swipe')
    } else if (name === 'guarded') {
      check(
        router.stack.value.length === 2 && resultCount === 0,
        'blocked native gesture retains history and result',
      )
      check(gestureEvents === 0, 'guard prevented UIKit gesture recognition')
      guarded.value = false
      await nextTick()
    } else if (name === 'committed') {
      await until(() => router.stack.value.length === 1)
      check(
        gestureEvents > 0 && gesturePeak > 0.5,
        'committed gesture actually moved UIKit transition',
      )
      check(
        (await result) === undefined && resultCount === 1,
        'native gesture settles result once',
      )
      check(
        host.pages()[0] === pages[0] && disposedPages === 1,
        'native gesture preserves root and disposes departed app',
      )
    } else if (name === 'detach') {
      pages = [...host.pages()]
      const cover = new Page()
      cover.actionBarHidden = true
      owner!.navigate({ create: () => cover, animated: false })
      await until(() => !host.loaded)
      check(!host.loaded, 'container reports unloaded')
      check(
        host.pages()[0] === pages[0] && disposedPages === 1,
        'temporary unload retains Page and Vue app',
      )
    } else if (name === 'reattach') {
      owner!.goBack()
      await until(() => host.loaded)
      check(
        host.pages()[0] === pages[0] && disposedPages === 1,
        'reattach preserves Page and Vue app',
      )
      result = router.pushForResult('/gesture').then((value) => {
        resultCount++
        return value
      })
      await until(() => host.pages().length === 2 && router.stack.value.length === 2)
      check(
        frame.ios.controller.viewControllers.count === 2,
        'navigation works after reattach',
      )
    } else if (name === 'dispose') {
      frame.ios.controller.interactivePopGestureRecognizer.removeTargetAction(
        gestureObserver,
        'observe',
      )
      gestureObserver = undefined
      stop()
      await nextTick()
      check(
        (await result) === undefined && resultCount === 2,
        'owner closure settles pending result once',
      )
      check(
        host.native === null && disposedPages === 3,
        'owner closure releases native handle and all Vue apps',
      )
      check(
        lifetimes.filter((event) => event.event === 'setup').length === 3 &&
          [1, 2, 3].every(
            (id) =>
              lifetimes.filter((event) => event.id === id && event.event === 'unmounted')
                .length === 1,
          ),
        'each destination app unmounts exactly once',
      )
      check(vueErrors.length === 0, 'no Vue lifecycle errors')
      late?.changed()
      late?.closed()
      late?.backPressed()
      late?.dismissAttempted()
      stop()
      check(
        router.stack.value.length === 0 && resultCount === 2,
        'late callbacks and repeated unmount are inert',
      )
      check(
        (router.diagnostics?.snapshot().issues.length ?? 0) === 0,
        'no reconciliation issues',
      )
    }
    report(name)
  } catch (error) {
    report(name, error)
  } finally {
    busy = false
  }
}
const commands = [
  'conformance',
  'prepare',
  'cancelled',
  'guard-on',
  'guarded',
  'committed',
  'detach',
  'reattach',
  'dispose',
]
const app = createApp({
  setup() {
    const ready = (args: { object: GridLayout }) => {
      container = args.object
    }
    return () =>
      h('GridLayout', { rows: 'auto,auto,*', backgroundColor: '#f4f5f8' }, [
        h('Label', {
          row: 0,
          text: status.value,
          automationText: 'host:status',
          color: '#163350',
          padding: 10,
        }),
        h(
          'WrapLayout',
          { row: 1, padding: 6 },
          commands.map((name) =>
            h('Button', {
              text: name,
              automationText: `host:${name}`,
              fontSize: 14,
              margin: 4,
              padding: 8,
              minWidth: 100,
              borderWidth: 1,
              borderColor: '#ccd5df',
              borderRadius: 6,
              onTap: () => void command(name),
            }),
          ),
        ),
        h('GridLayout', { row: 2, onLoaded: ready }),
      ])
  },
})
app.use(router)
app.config.errorHandler = (error) => {
  vueErrors.push(String(error))
}
app.start()
