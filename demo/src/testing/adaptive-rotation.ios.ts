// Opt-in fixture only. Observe UIKit without replacing navigation/gesture delegates.
import { Application, File, Frame, knownFolders } from '@nativescript/core'

let Observer: any
let observer: any
let pending: any
const identities = new WeakMap<object, number>()
let serial = 0
export function nativeIdentity(value: object | undefined) {
  if (!value) return null
  if (!identities.has(value)) identities.set(value, ++serial)
  return identities.get(value)!
}
function write(run: any) {
  File.fromPath(`${knownFolders.documents().path}/adaptive/rotation.json`).writeTextSync(
    JSON.stringify(run.report),
  )
}
function event(run: any, kind: string, data: object = {}) {
  run.report.events.push({ kind, at: performance.now(), wallTime: Date.now(), ...data })
  write(run)
}
function observeNavigation(run: any, rotation?: any) {
  if (!run.observed && run.report.operation !== 'settled') {
    const controller = run.frame.ios.controller
    const coordinator =
      controller.transitionCoordinator ??
      controller.topViewController?.transitionCoordinator
    // Some UIKit nested contexts return null for the transition keys. The
    // Frame source and navigation controller's destination identify that push/pop.
    const from =
      coordinator?.viewControllerForKey(UITransitionContextFromViewControllerKey) ??
      run.source
    const to =
      coordinator?.viewControllerForKey(UITransitionContextToViewControllerKey) ??
      controller.topViewController
    if (coordinator && coordinator !== rotation && from && to && from !== to) {
      run.observed = true
      run.navigationActive = true
      run.coordinator = coordinator
      const coordinatorId = nativeIdentity(coordinator)
      event(run, 'navigation-observed', {
        coordinator: coordinatorId,
        observedFrom: rotation ? 'rotation-callback' : 'poll',
        fromKey: nativeIdentity(
          coordinator.viewControllerForKey(UITransitionContextFromViewControllerKey),
        ),
        toKey: nativeIdentity(
          coordinator.viewControllerForKey(UITransitionContextToViewControllerKey),
        ),
        from: nativeIdentity(from),
        to: nativeIdentity(to),
        interactive: coordinator.initiallyInteractive,
        duration: coordinator.transitionDuration,
      })
      if (coordinator.initiallyInteractive)
        coordinator.notifyWhenInteractionChangesUsingBlock((context: any) => {
          event(run, 'interaction-ended', { cancelled: context.cancelled })
        })
      coordinator.animateAlongsideTransitionCompletion(null, (context: any) => {
        run.navigationActive = false
        run.coordinator = undefined
        run.completed = true
        event(run, 'navigation-ended', {
          cancelled: context.cancelled,
          coordinator: coordinatorId,
        })
      })
    }
  }
}
function install() {
  if (observer) return
  Observer ??= (UIViewController as any).extend({
    viewWillTransitionToSizeWithTransitionCoordinator(size: CGSize, rotation: any) {
      UIViewController.prototype.viewWillTransitionToSizeWithTransitionCoordinator.call(
        this,
        size,
        rotation,
      )
      const run = pending
      if (!run || run.report.finished) return
      if (run.report.operation.endsWith('-overlap')) observeNavigation(run, rotation)
      const rotationId = nativeIdentity(rotation)
      run.rotationsInFlight++
      // Never retain/query a completed coordinator: UIKit invalidates its context.
      const stillCurrent =
        run.navigationActive &&
        run.frame.ios.controller.transitionCoordinator === run.coordinator
      event(run, 'rotation-began', {
        width: size.width,
        height: size.height,
        navigationActive: stillCurrent,
        navigationCompletionPending: run.navigationActive,
        navigationCoordinator: run.navigationActive
          ? nativeIdentity(run.coordinator)
          : null,
        currentCoordinator: nativeIdentity(
          run.frame.ios.controller.transitionCoordinator,
        ),
        rotationCoordinator: rotationId,
      })
      rotation.animateAlongsideTransitionCompletion(null, () => {
        run.rotationsInFlight--
        run.rotated = true
        event(run, 'rotation-ended', { rotationCoordinator: rotationId })
      })
    },
  })
  observer = Observer.new()
  const root = Application.getRootView().nativeViewProtected.window.rootViewController
  root.addChildViewController(observer)
  observer.view.userInteractionEnabled = false
  root.view.addSubview(observer.view)
  observer.didMoveToParentViewController(root)
}
export function rotationReport() {
  return pending?.report ?? null
}
export function finishUnobservedGesture() {
  const run = pending
  if (!run || !run.report.operation.startsWith('gesture') || run.observed)
    throw new Error('Only an unobserved gesture can be classified as not reproduced')
  clearInterval(run.timer)
  run.report.after = run.snapshot()
  run.report.finished = true
  run.report.notReproduced = 'No interactive coordinator at the permanent content edge'
  write(run)
}
export function rotateDuringNavigation(
  frame: Frame,
  operation: string,
  landscape: boolean,
  navigate: () => Promise<unknown>,
  snapshot: () => unknown,
) {
  install()
  if (pending && !pending.report.finished) throw new Error('Rotation case still running')
  const run = (pending = {
    observed: false,
    navigationActive: false,
    completed: operation === 'settled',
    rotated: false,
    rotationsInFlight: 0,
    source: frame.currentPage?.ios,
    frame,
    coordinator: undefined as any,
    snapshot,
    timer: undefined as ReturnType<typeof setInterval> | undefined,
    report: {
      navigationProfile: operation.endsWith('-overlap')
        ? 'core-slide-1500'
        : 'platform-default',
      reduceMotion: UIAccessibilityIsReduceMotionEnabled(),
      window: {
        width: frame.ios.controller.view.window.bounds.size.width,
        height: frame.ios.controller.view.window.bounds.size.height,
      },
      systemVersion: UIDevice.currentDevice.systemVersion,
      operation,
      landscape,
      events: [],
      before: snapshot(),
      settlements: 0,
      finished: false,
    } as any,
  })
  event(run, 'armed')
  if (operation.startsWith('gesture')) {
    const gesture = frame.ios.controller.interactivePopGestureRecognizer
    const origin = gesture.view.convertPointToView(CGPointMake(0, 0), null)
    event(run, 'gesture-recognizer', {
      enabled: gesture.enabled,
      state: gesture.state,
      x: origin.x,
      y: origin.y,
      width: gesture.view.bounds.size.width,
      height: gesture.view.bounds.size.height,
    })
  }
  const started = performance.now()
  const timer = setInterval(() => {
    if (pending !== run) {
      clearInterval(timer)
      return
    }
    observeNavigation(run)
    const elapsed = performance.now() - started
    if (
      (run.rotated && run.rotationsInFlight === 0 && run.completed && elapsed > 2000) ||
      elapsed > 20000
    ) {
      clearInterval(timer)
      run.report.after = snapshot()
      run.report.finished = true
      if (!run.completed || !run.rotated)
        run.report.error = 'Timed out waiting for native navigation/rotation completion'
      write(run)
    }
  }, 5)
  run.timer = timer
  if (!operation.startsWith('gesture') && operation !== 'settled') {
    void navigate().then(
      (result) => {
        run.report.settlements++
        event(run, 'promise-settled', { result })
      },
      (error) => {
        run.report.error = String(error)
        write(run)
      },
    )
  }
}
