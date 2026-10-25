import { observeFrameBack } from '../../../research/transition-observation/frame-ios'
// Opt-in iOS investigation. Observes UIKit; never installs a transition delegate.
import {
  File,
  knownFolders,
  Frame,
  Page,
  isIOS,
  Device,
  StackLayout,
} from '@nativescript/core'
import {
  ActionBar,
  createApp,
  defineComponent,
  h,
  ref,
  onBeforeUnmount,
} from 'nativescript-vue'
import {
  createRouter,
  RouterView,
  useRouter,
  useRoute,
  onBeforeRouteLeave,
} from 'vue-router-ns'

const status = ref('Ready'),
  blocked = ref(false),
  sourceVisible = ref(true)
const commands: any[] = []
const observations: any[] = [],
  completions: any[] = [],
  lifecycle: any[] = []
let source: StackLayout | undefined,
  frame: Frame,
  resultCount = 0,
  disposed = 0
const entryIds = new Map<UIViewController, string>()
let observer: ReturnType<typeof observeFrameBack> | undefined
let nextEntry = 0
let detached: ReturnType<typeof observeFrameBack> | undefined
let mode = 'plain',
  currentCoordinator: any
const pause = (ms = 700) => new Promise<void>((resolve) => setTimeout(resolve, ms))
function save() {
  if (!frame) return
  File.fromPath(`${knownFolders.documents().path}/transitions.json`).writeTextSync(
    JSON.stringify({
      sdk: Device.sdkVersion,
      mode,
      status: status.value,
      blocked: blocked.value,
      sourceVisible: sourceVisible.value,
      resultCount,
      disposed,
      stack: router.stack.value.map((r) => r.path),
      native: [...frame.backStack.map((e) => e.resolvedPage), frame.currentPage].map(
        (p) => p?.automationText,
      ),
      commands,
      observations,
      completions,
      lifecycle,
      diagnostics: router.diagnostics!.toJSON(),
    }),
  )
}
function check(test: unknown, label: string) {
  if (!test) throw new Error(label)
}
async function act(name: string) {
  try {
    if (
      name === 'Plain' ||
      name === 'Zoom' ||
      name === 'Guarded plain' ||
      name === 'Removed source'
    ) {
      blocked.value = false
      sourceVisible.value = true
      if (router.stack.value.length > 1) await router.backTo('/')
      await pause(200)
      mode = name
      observations.length = 0
      completions.length = 0
      resultCount = 0
      disposed = 0
      blocked.value = name === 'Guarded plain'
      void router
        .pushForResult('/detail', {
          zoomFrom: name === 'Plain' || name === 'Guarded plain' ? undefined : source,
        })
        .then(() => {
          resultCount++
          save()
        })
      const deadline = Date.now() + 10000
      while (router.stack.value.length !== 2 || frame.backStack.length !== 1) {
        if (Date.now() > deadline) throw new Error('Detail presentation timed out')
        await pause(100)
      }
      await pause(150)
      if (name === 'Removed source') sourceVisible.value = false
      check(router.stack.value.length === 2, 'Detail presented')
    } else if (name === 'Check cancel') {
      await pause(300)
      check(
        router.stack.value.length === 2 && frame.backStack.length === 1,
        'Cancelled gesture preserves both histories',
      )
      check(
        resultCount === 0 && disposed === 0,
        'Cancelled gesture keeps result pending and page alive',
      )
      check(
        completions.some((e) => e.cancelled),
        'UIKit reported actual cancellation',
      )
    } else if (name === 'Check commit') {
      await pause(300)
      check(
        router.stack.value.length === 1 && frame.backStack.length === 0,
        'Committed gesture synchronizes histories',
      )
      check(resultCount === 1 && disposed === 1, 'Exactly one result and page disposal')
    } else if (name === 'Check guard') {
      await pause(300)
      check(
        router.stack.value.length === 2 && frame.backStack.length === 1,
        'Guard holds native and logical histories',
      )
      check(resultCount === 0, 'Guard keeps result pending')
      check(
        observations.length === 0,
        'Guard rejects before an observation session begins',
      )
    } else if (name === 'Allow') blocked.value = false
    else if (name === 'Back') await router.back()
    else if (name === 'Interrupt soon') {
      setTimeout(() => {
        lifecycle.push({
          event: 'interrupt-request',
          interactive: observer?.active ?? false,
        })
        observer?.invalidate('source-replaced')
        void router.replace('/replacement')
      }, 2500)
    } else if (name === 'Detach soon') {
      setTimeout(() => {
        lifecycle.push({
          event: 'detach-request',
          interactive: observer?.active ?? false,
        })
        detached = observer
        observer?.dispose()
        observer = undefined
      }, 2500)
    } else if (name === 'Check detach') {
      await pause()
      check(
        lifecycle.some((e) => e.event === 'detach-request' && e.interactive),
        'Unsubscribe during native interaction',
      )
      check(detached?.targetCount === 0, 'All gesture targets removed')
      check(
        observations.filter((e) => e.type === 'terminal').length === 1,
        'No late or duplicate terminal after unsubscribe',
      )
      check(
        router.stack.value.length === 2 && frame.backStack.length === 1,
        'Observer disposal does not cancel or commit navigation',
      )
      check(
        resultCount === 0 && disposed === 0,
        'Cancelled native gesture retains result/page after unsubscribe',
      )
    } else if (name === 'Check interrupt') {
      await pause()
      check(
        router.diagnostics!.snapshot().issues.length === 0,
        'Interrupted navigation converges',
      )
      check(
        frame.backStack.length + 1 === router.stack.value.length,
        'Interrupted histories agree',
      )
      check(resultCount <= 1, 'Interrupted result never settles twice')
      check(
        lifecycle.some((e) => e.event === 'interrupt-request' && e.interactive),
        'Replacement requested during actual observed interaction',
      )
      check(
        observations.filter((e) => e.type === 'terminal').length === 1,
        'Exactly one interrupted terminal',
      )
    }
    status.value = `PASS ${name}`
  } catch (error) {
    status.value = `FAIL ${name}: ${String(error)}`
  }
  commands.push({
    name,
    status: status.value,
    mode,
    resultCount,
    disposed,
    stack: router.stack.value.map((r) => r.path),
    observations: observations.slice(),
    completions: completions.slice(),
    issues: router.diagnostics!.snapshot().issues,
  })
  save()
}
const button = (name: string) =>
  h('Button', {
    text: name,
    automationText: name,
    height: 40,
    fontSize: 14,
    onTap: () => void act(name),
  })
const Screen = defineComponent({
  setup() {
    let ownController: UIViewController | undefined
    const local = useRouter(),
      route = useRoute()
    onBeforeRouteLeave(() => false, {
      when: () => route.path === '/detail' && blocked.value,
    })
    onBeforeUnmount(() => {
      if (ownController) entryIds.delete(ownController)
      if (route.path === '/detail') disposed++
    })
    return () =>
      h(
        'Page',
        {
          automationText: route.path,
          backgroundColor: route.path === '/' ? '#e8f0eb' : '#fff7e8',
          onLoaded: (e: any) => {
            frame = (e.object as Page).frame
            ownController = (e.object as Page).ios
            if (!entryIds.has((e.object as Page).ios))
              entryIds.set((e.object as Page).ios, `fixture-entry-${++nextEntry}`)
            if (!observer)
              observer = observeFrameBack(
                frame,
                { window: 'fixture-window', host: 'root-frame' },
                (controller) => {
                  const matched = controller
                    ? [...entryIds].find(([native]) => native.isEqual(controller))?.[1]
                    : null
                  if (!matched)
                    lifecycle.push({
                      event: 'unmapped-controller',
                      native: String(controller),
                      known: [...entryIds].map(([native, key]) => ({
                        native: String(native),
                        key,
                      })),
                    })
                  return matched ?? null
                },
                (event) => {
                  observations.push(event)
                  if (event.type === 'terminal')
                    completions.push({
                      cancelled: event.outcome === 'cancelled',
                      outcome: event.outcome,
                    })
                  save()
                },
              )
            lifecycle.push({ event: 'loaded', path: route.path })
            save()
          },
          onUnloaded: () => lifecycle.push({ event: 'unloaded', path: route.path }),
          onNavigatedTo: () => {
            lifecycle.push({ event: 'navigatedTo', path: route.path })
            save()
          },
        },
        [
          h(ActionBar, {
            title: route.path === '/' ? 'Native transitions' : 'UIKit owns this gesture',
          }),
          h('StackLayout', { padding: 20 }, [
            h('Label', {
              text: 'Native observation v0',
              fontSize: 26,
              fontWeight: 'bold',
              color: '#123d2d',
            }),
            h('Label', {
              text: `${mode} · result ${resultCount}`,
              fontSize: 16,
              marginTop: 10,
            }),
            h('Label', {
              text: status.value,
              textWrap: true,
              automationText: status.value,
              fontSize: 14,
              marginBottom: 12,
            }),
            ...(route.path === '/'
              ? [
                  ...(sourceVisible.value
                    ? [
                        h(
                          'StackLayout',
                          {
                            ref: (node: any) => {
                              source = node?.nativeView
                            },
                            backgroundColor: '#286449',
                            height: 90,
                            borderRadius: 16,
                            padding: 20,
                          },
                          [
                            h('Label', {
                              text: 'Native zoom source',
                              color: 'white',
                              fontSize: 22,
                            }),
                          ],
                        ),
                      ]
                    : []),
                  ...[
                    'Plain',
                    'Zoom',
                    'Guarded plain',
                    'Removed source',
                    'Check commit',
                    'Check interrupt',
                  ].map(button),
                ]
              : [
                  h('Label', {
                    text: 'Swipe from the left edge. Reverse to cancel; release across the screen to commit.',
                    textWrap: true,
                    fontSize: 18,
                    marginBottom: 20,
                  }),
                  ...[
                    'Check cancel',
                    'Check guard',
                    'Allow',
                    'Back',
                    'Interrupt soon',
                    'Detach soon',
                    'Check detach',
                    'Check interrupt',
                  ].map(button),
                  h('Label', {
                    text: `History: ${local.stack.value.map((r) => r.path).join(' → ')}`,
                    textWrap: true,
                    marginTop: 12,
                  }),
                ]),
          ]),
        ],
      )
  },
})
const router = createRouter({
  diagnostics: true,
  routes: ['/', '/detail', '/replacement'].map((path) => ({ path, component: Screen })),
})
createApp({ render: () => h(RouterView) })
  .use(router)
  .start()
