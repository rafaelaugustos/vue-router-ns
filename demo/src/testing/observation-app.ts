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
  sourceVisible = ref(true),
  hostVisible = ref(true)
const commands: any[] = []
const observations: any[] = [],
  completions: any[] = [],
  lifecycle: any[] = []
let source: StackLayout | undefined,
  frame: Frame,
  resultCount = 0,
  disposed = 0
const entryIds = new Map<UIViewController, string>()
const observers = new Map<Frame, ReturnType<typeof observeFrameBack>>()
const hostIds = new Map<Frame, string>()
let rootFrame: Frame | undefined
let oldTarget: Page | undefined
let targetAttempt: ReturnType<typeof router.setStack> | undefined
let previousSession: string | undefined
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
      name === 'Target case' ||
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
      if (name === 'Target case') await router.push('/middle', { animated: false })
      void router
        .pushForResult('/detail', {
          zoomFrom:
            name === 'Plain' || name === 'Guarded plain' || name === 'Target case'
              ? undefined
              : source,
        })
        .then(() => {
          resultCount++
          save()
        })
      const deadline = Date.now() + 10000
      while (
        router.stack.value.length !== (name === 'Target case' ? 3 : 2) ||
        frame.backStack.length !== (name === 'Target case' ? 2 : 1)
      ) {
        if (Date.now() > deadline) throw new Error('Detail presentation timed out')
        await pause(100)
      }
      await pause(150)
      if (name === 'Removed source') sourceVisible.value = false
      check(
        router.stack.value.length === (name === 'Target case' ? 3 : 2),
        'Detail presented',
      )
    } else if (name === 'Modal') {
      await router.push('/modal')
      await pause()
      check(frame !== rootFrame, 'Modal has a distinct native Frame host')
    } else if (name === 'Modal push') {
      mode = 'modal'
      observations.length = 0
      completions.length = 0
      resultCount = 0
      disposed = 0
      void router.pushForResult('/detail').then(() => {
        resultCount++
        save()
      })
      await pause()
      check(
        frame !== rootFrame && frame.backStack.length === 1,
        'Inner modal stack pushed',
      )
    } else if (name === 'Check modal') {
      await pause()
      check(
        frame !== rootFrame && rootFrame?.backStack.length === 0,
        'Modal Back leaves root host unchanged',
      )
      check(resultCount === 1 && disposed === 1, 'Modal inner Back settles once')
      check(
        observations.every((e) => e.host === hostIds.get(frame)),
        'Only modal host observes its Back',
      )
    } else if (name === 'Target soon') {
      oldTarget = frame.backStack.at(-1)?.resolvedPage
      setTimeout(() => {
        lifecycle.push({
          event: 'target-replace-request',
          interactive: observer?.active ?? false,
        })
        observer?.invalidate('target-replaced')
        // Public stack replacement replaces the covered target and current entry.
        // This does not claim isolated mutation of an arbitrary covered native entry.
        // Core cannot reliably pop another target while UIKit is reversing.
        // Defer the mutation until native completion; invalidation happens now.
        targetAttempt = new Promise<void>((resolve) => {
          const coordinator = frame.ios.controller.transitionCoordinator
          if (coordinator)
            coordinator.animateAlongsideTransitionCompletion(null, () => resolve())
          else resolve()
        }).then(async () => {
          await pause(150)
          return router.setStack(['/', '/replacement', '/detail'], { animated: false })
        })
        void targetAttempt.then((failure) =>
          lifecycle.push({
            event: 'target-replace-outcome',
            failure: failure?.type ?? null,
          }),
        )
      }, 2500)
    } else if (name === 'Check target') {
      await pause()
      const failure = await Promise.race([
        targetAttempt,
        pause(4000).then(() => {
          throw new Error(
            'Target replacement did not settle within four seconds after native reversal',
          )
        }),
      ])
      // Native reversal may cancel a competing stack request. The observer does
      // not override that decision; retry only after the native interaction ends.
      if (failure) {
        check(!observer?.active, 'Native observation is terminal before retry')
        const retried = await router.setStack(['/', '/replacement', '/detail'], {
          animated: false,
        })
        check(!retried, 'Settled stack replacement succeeds')
        await pause()
      }
      check(
        lifecycle.some((e) => e.event === 'target-replace-request' && e.interactive),
        'Target invalidation during actual interaction',
      )
      check(
        frame.backStack.at(-1)?.resolvedPage !== oldTarget,
        'Covered native target actually replaced',
      )
      check(
        frame.backStack.at(-1)?.resolvedPage.automationText === '/replacement',
        'Replacement target installed',
      )
      check(
        observations.filter((e) => e.type === 'terminal').length === 1,
        'Target invalidation has one terminal',
      )
      check(
        observations.some((e) => e.type === 'terminal' && e.reason === 'target-replaced'),
        'Target invalidation reported',
      )
      check(
        resultCount <= 1 && router.diagnostics!.snapshot().issues.length === 0,
        'Replacement settles and converges',
      )
    } else if (name === 'Unload soon') {
      setTimeout(() => {
        lifecycle.push({
          event: 'unload-request',
          interactive: observer?.active ?? false,
        })
        detached = observer
        previousSession = observations.find((e) => e.type === 'began')?.session
        hostVisible.value = false
      }, 2500)
    } else if (name === 'Restore host') {
      await pause()
      check(
        lifecycle.some((e) => e.event === 'unload-request' && e.interactive),
        'Native host removed during interaction',
      )
      check(
        detached?.disposed && detached.targetCount === 0,
        'Frame unload removes observation targets',
      )
      check(
        observations.filter((e) => e.type === 'terminal').length === 1,
        'Unload interrupts exactly once',
      )
      check(
        observations.some((e) => e.reason === 'host-unloaded'),
        'Actual unload event interrupts observation',
      )
      observer = undefined
      hostVisible.value = true
      await pause()
      check(
        observers.get(frame) &&
          !observers.get(frame)!.disposed &&
          observers.get(frame)!.targetCount > 0,
        'Reload attaches a new observer',
      )
    } else if (name === 'Check reconnect') {
      check(
        observations.filter((e) => e.type === 'began').length === 1,
        'Reconnect does not duplicate subscriptions',
      )
      check(
        observations[0]?.session !== previousSession,
        'Reconnected sessions never reuse identity',
      )
      check(
        observations.filter((e) => e.type === 'terminal').length === 1,
        'One terminal after reconnection',
      )
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
            rootFrame ??= frame
            if (!hostIds.has(frame))
              hostIds.set(frame, `fixture-frame-${hostIds.size + 1}`)
            observer = observers.get(frame)
            if (!observer || observer.disposed) {
              observer = observeFrameBack(
                frame,
                { window: 'fixture-window', host: hostIds.get(frame)! },
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
              observers.set(frame, observer)
            }
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
          h('ScrollView', [
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
              ...(route.path === '/' || route.path === '/modal'
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
                    ...(route.path === '/modal'
                      ? ['Modal push', 'Check modal', 'Back']
                      : [
                          'Plain',
                          'Target case',
                          'Modal',
                          'Guarded plain',
                          'Check commit',
                          'Check interrupt',
                          'Check reconnect',
                          'Zoom',
                          'Removed source',
                        ]
                    ).map(button),
                  ]
                : [
                    h('Label', {
                      text: 'Swipe from the left edge. Reverse to cancel; release across the screen to commit.',
                      textWrap: true,
                      fontSize: 18,
                      marginBottom: 20,
                    }),
                    ...[
                      'Target soon',
                      'Unload soon',
                      'Check target',
                      'Check reconnect',
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
          ]),
        ],
      )
  },
})
const router = createRouter({
  diagnostics: true,
  routes: [
    ...['/', '/detail', '/replacement', '/middle'].map((path) => ({
      path,
      component: Screen,
    })),
    { path: '/modal', component: Screen, modal: true },
  ],
})
createApp({
  render: () =>
    hostVisible.value
      ? h(RouterView)
      : h('StackLayout', { padding: 40 }, [
          h('Label', { text: 'Native host unloaded' }),
          button('Restore host'),
        ]),
})
  .use(router)
  .start()
