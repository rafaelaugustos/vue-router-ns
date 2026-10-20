// ns build ios|android --env.destinationsTest
import {
  ApplicationSettings,
  File,
  Frame,
  knownFolders,
  isAndroid,
  Utils,
} from '@nativescript/core'
import { createApp, defineComponent, h, ref } from 'nativescript-vue'
import {
  createRouter,
  RouterView,
  defineNativeDestination,
  NavigationFailureType,
  type NativeDestinationContext,
} from 'vue-router-ns'

type Context = NativeDestinationContext<{ id: string }, string>
const status = ref('Starting')
const checks: string[] = []
const weak: any[] = []
const collected = isAndroid
  ? new java.lang.ref.ReferenceQueue<androidx.fragment.app.Fragment>()
  : undefined
let nativeCollected = 0
const collections: number[] = []
let created = 0
let disposed = 0
let latest: { context: Context; native: any; activate(name: string): void } | undefined
const pause = (ms = 100) => new Promise<void>((resolve) => setTimeout(resolve, ms))
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message)
}
const report = (name: string, error?: unknown) => {
  if (!error) checks.push(name)
  status.value = error ? `FAILED ${String(error)}` : name
  const result = {
    name,
    error: error ? String(error) : undefined,
    checks,
    created,
    disposed,
    collections,
    pid: isAndroid
      ? android.os.Process.myPid()
      : NSProcessInfo.processInfo.processIdentifier,
    path: router.currentRoute.value.fullPath,
    diagnostics: router.diagnostics?.snapshot(),
  }
  File.fromPath(`${knownFolders.documents().path}/destinations.json`).writeTextSync(
    JSON.stringify(result),
    (failure) => {
      throw failure
    },
  )
  console.log(`DESTINATIONS ${JSON.stringify(result)}`)
}
const fatal = (error: unknown) => report('failed', error)
let Target: any
let Fragment: any
function ensureTarget() {
  Target ??= (NSObject as any).extend(
    {
      invoke(this: any) {
        this.callback?.()
      },
    },
    { exposedMethods: { invoke: { returns: interop.types.void, params: [] } } },
  )
}
function ensureFragment() {
  Fragment ??= (androidx.fragment.app.Fragment as any).extend(
    'org.nativescript.vuerouterns.NativeEditor53',
    {
      onCreateView(this: any, inflater: android.view.LayoutInflater) {
        const layout = new android.widget.LinearLayout(inflater.getContext())
        layout.setOrientation(1)
        layout.setPadding(30, 90, 30, 30)
        const title = new android.widget.TextView(inflater.getContext())
        title.setText(`Native editor ${this.context.input.id}`)
        title.setContentDescription('native-title')
        layout.addView(title)
        this.buttons = {}
        for (const name of ['Complete', 'Cancel', 'Dismiss', 'Pop']) {
          const button = new android.widget.Button(inflater.getContext())
          button.setText(name)
          button.setContentDescription(`native-${name.toLowerCase()}`)
          button.setOnClickListener(
            new android.view.View.OnClickListener({
              onClick: () => {
                if (name === 'Complete')
                  void this.context
                    .complete(`saved:${this.context.input.id}`)
                    .catch(fatal)
                if (name === 'Cancel') void this.context.cancel().catch(fatal)
                if (name === 'Dismiss')
                  this.getParentFragmentManager().beginTransaction().remove(this).commit()
                if (name === 'Pop') this.context.page.frame.goBack()
              },
            }),
          )
          this.buttons[name] = button
          layout.addView(button)
        }
        return layout
      },
    },
  )
}
const editor = defineNativeDestination<{ id: string }, string>({
  id: 'example.vendor-editor',
  input: (route) => ({ id: String(route.params.id) }),
  ios(context) {
    created++
    ensureTarget()
    const controller = UIViewController.new()
    controller.view.backgroundColor = UIColor.systemBackgroundColor
    const stack = UIStackView.new()
    stack.axis = UILayoutConstraintAxis.Vertical
    stack.spacing = 16
    stack.frame = CGRectMake(20, 90, 320, 340)
    controller.view.addSubview(stack)
    const title = UILabel.new()
    title.text = `Native editor ${context.input.id}`
    title.accessibilityIdentifier = 'native-title'
    stack.addArrangedSubview(title)
    const targets: any[] = []
    const buttons: Record<string, UIButton> = {}
    const actions: Record<string, () => void> = {
      Complete: () => {
        void context.complete(`saved:${context.input.id}`).catch(fatal)
      },
      Cancel: () => {
        void context.cancel().catch(fatal)
      },
      Dismiss: () => {
        // SDK removes its own child controller; report the already committed removal.
        controller.willMoveToParentViewController(null)
        controller.view.removeFromSuperview()
        controller.removeFromParentViewController()
        void context.dismissed().catch(fatal)
      },
      Pop: () => {
        controller.navigationController!.popViewControllerAnimated(false)
      },
    }
    for (const [name, action] of Object.entries(actions)) {
      const target = new Target()
      target.callback = action
      targets.push(target)
      const button = UIButton.buttonWithType(UIButtonType.System)
      button.setTitleForState(name, UIControlState.Normal)
      button.accessibilityIdentifier = `native-${name.toLowerCase()}`
      button.addTargetActionForControlEvents(
        target,
        'invoke',
        UIControlEvents.TouchUpInside,
      )
      stack.addArrangedSubview(button)
      buttons[name] = button
    }
    const references = NSHashTable.weakObjectsHashTable<UIViewController>()
    references.addObject(controller)
    weak.push(references)
    latest = {
      context,
      native: controller,
      activate: (name) =>
        buttons[name]!.sendActionsForControlEvents(UIControlEvents.TouchUpInside),
    }
    return {
      native: controller,
      dispose() {
        assert(
          !controller.parentViewController,
          'UIKit controller still parented during disposal',
        )
        targets.forEach((target) => {
          target.callback = undefined
        })
        for (const button of Object.values(buttons))
          button.removeTargetActionForControlEvents(null, null, UIControlEvents.AllEvents)
        if (latest?.native === controller) latest = undefined
        disposed++
      },
    }
  },
  android(context) {
    created++
    ensureFragment()
    const fragment = new Fragment()
    fragment.context = context
    weak.push(new java.lang.ref.WeakReference(fragment, collected!))
    latest = {
      context,
      native: fragment,
      activate: (name) => fragment.buttons[name].performClick(),
    }
    return {
      native: fragment,
      dispose() {
        assert(!fragment.isAdded(), 'Fragment still added during disposal')
        for (const button of Object.values(
          fragment.buttons ?? {},
        ) as android.widget.Button[])
          button.setOnClickListener(null)
        fragment.buttons = undefined
        fragment.context = undefined
        if (latest?.native === fragment) latest = undefined
        disposed++
      },
    }
  },
})
const Home = defineComponent({
  setup() {
    return () =>
      h('Page', [
        h('StackLayout', { padding: 30 }, [
          h('Label', { text: 'Native destination checks' }),
          h('Label', {
            text: status.value,
            automationText: 'destination-status',
            textWrap: true,
          }),
        ]),
      ])
  },
})
const router = createRouter({
  diagnostics: true,
  routes: [
    { path: '/', component: Home },
    { path: '/native/:id', name: 'native', component: editor },
    { path: '/modal/:id', component: editor, modal: true },
    { path: '/cover', component: Home },
  ],
  restore: {
    load: () => JSON.parse(ApplicationSettings.getString('destination-history', 'null')),
    save: (value) =>
      ApplicationSettings.setString('destination-history', JSON.stringify(value)),
  },
})
async function waitFor(predicate: () => boolean, attempts = 100) {
  for (let i = 0; i < attempts; i++) {
    if (predicate()) return
    await pause(50)
  }
  throw new Error('Timed out waiting for native destination')
}
async function roundtrip(action: string, path = '/native/42') {
  const result = router.pushForResult<string>(path, { animated: false })
  await waitFor(() => !!latest?.context.page && router.currentRoute.value.path === path)
  await pause(150)
  latest!.activate(action)
  const value = await result
  assert(
    value === (action === 'Complete' ? `saved:${path.split('/').at(-1)}` : undefined),
    `Wrong ${action} result: ${value}`,
  )
  await pause(150)
  assert(router.currentRoute.value.path === '/', 'Roundtrip did not return to Vue')
  assert(created === disposed, 'Factory instances not released')
  report(action + path)
}
async function run() {
  await router.isReady()
  if (ApplicationSettings.getBoolean('destination-restore')) {
    assert(
      router.currentRoute.value.path === '/native/restore',
      'Native route not restored',
    )
    assert(latest?.context.input.id === 'restore', 'Factory input not restored')
    assert(created === 1, 'Expected one fresh restored controller/Fragment')
    await latest!.context.cancel()
    ApplicationSettings.remove('destination-restore')
    report('restored')
    return
  }
  await roundtrip('Complete')
  await roundtrip('Cancel')
  await roundtrip('Pop')
  await roundtrip('Dismiss')
  await roundtrip('Complete', '/modal/9')
  const result = router.pushForResult('/native/guard', { animated: false })
  await waitFor(
    () => !!latest?.context.page && router.currentRoute.value.path === '/native/guard',
  )
  await pause(150)
  let remove = latest!.context.beforeLeave(() => false)
  const failure = await latest!.context.complete('blocked')
  assert(failure?.type === NavigationFailureType.aborted, 'Guard did not block')
  remove()
  remove = () => {}
  await latest!.context.cancel()
  assert((await result) === undefined, 'Aborted result escaped')
  report('guard')
  await router.push('/native/covered', { animated: false })
  await router.push('/cover', { animated: false })
  await router.back({ animated: false })
  await pause(250)
  assert(latest?.context.input.id === 'covered', 'Covered native entry lost its input')
  await latest!.context.cancel()
  report('cover-return')
  for (let i = 0; i < 8; i++) await roundtrip('Cancel', `/native/${i}`)
  for (let i = 0; i < 3; i++) {
    await pause(300)
    Utils.GC()
    // Same collection protocol as the native contract suite. System.gc()
    // merely sets a flag on Android 14; Runtime.gc() requests ART collection.
    if (isAndroid) java.lang.Runtime.getRuntime().gc()
    await pause(300)
    // Reading WeakReference.get() would create a new strong bridge wrapper.
    if (isAndroid) while (collected!.poll()) nativeCollected++
    collections.push(
      isAndroid
        ? weak.length - nativeCollected
        : weak.filter((reference) => reference.allObjects.count > 0).length,
    )
  }
  assert(
    collections.at(-1) === 0,
    `Native instances retained after disposal and GC: ${collections.join(',')}`,
  )
  assert(
    router.diagnostics!.snapshot().issues.length === 0,
    'Router diagnostics reported inconsistency',
  )
  report('collected')
  await router.push('/native/system-back', { animated: false })
  report('system-back-required')
  await waitFor(() => router.currentRoute.value.path === '/', 6000)
  assert(created === disposed, 'System back did not dispose the native instance')
  report('system-back')
  await router.push('/native/restore', { animated: false })
  ApplicationSettings.setBoolean('destination-restore', true)
  report('restart-required')
}
const app = createApp({ render: () => h(RouterView) })
app.use(router)
app.start()
void run().catch(fatal)
