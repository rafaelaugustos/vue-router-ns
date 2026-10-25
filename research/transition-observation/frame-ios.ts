import type { Frame } from '@nativescript/core'
import { session, sessionIds, type Observation } from './session'
let Target: any

/** Only observes the Frame's known UIKit Back recognizers. No delegate replacement,
 * polling, synthetic progress, admission decisions, or router settlement. */
export function observeFrameBack(
  frame: Frame,
  identity: { window: string; host: string },
  entry: (controller: UIViewController | null) => string | null,
  listener: ((event: Observation) => void) | undefined,
) {
  const controller = frame.ios.controller as UINavigationController
  const nextSession = sessionIds(identity.host)
  let disposed = false
  let active: ReturnType<typeof session> | undefined
  const seen = new WeakSet<object>()
  const targets: UIGestureRecognizer[] = []
  const probe = () => {
    if (disposed) return
    const coordinator: any = controller.transitionCoordinator
    if (!coordinator || !coordinator.initiallyInteractive || seen.has(coordinator)) return
    const from = coordinator.viewControllerForKey(
      UITransitionContextFromViewControllerKey,
    )
    const to = coordinator.viewControllerForKey(UITransitionContextToViewControllerKey)
    seen.add(coordinator)
    active?.invalidate('superseded')
    const current = session(
      {
        ...identity,
        session: nextSession(),
        source: entry(from),
        target: entry(to),
      },
      listener,
    )
    active = current
    // A subscriber may dispose synchronously from the began event.
    if (disposed) {
      current.invalidate('unsubscribed')
      active = undefined
      return
    }
    coordinator.notifyWhenInteractionChangesUsingBlock(
      (context: UIViewControllerTransitionCoordinatorContext) => {
        if (!disposed) current.interaction(context.cancelled)
      },
    )
    // UIKit may call completion even if animateAlongside... returns false.
    coordinator.animateAlongsideTransitionCompletion(
      null,
      (context: UIViewControllerTransitionCoordinatorContext) => {
        if (!disposed) current.complete(context.cancelled)
        if (active === current) active = undefined
      },
    )
  }
  Target ??= (NSObject as any).extend(
    {
      changed(this: any) {
        this.probe?.()
      },
    },
    {
      exposedMethods: {
        changed: { returns: interop.types.void, params: [UIGestureRecognizer] },
      },
    },
  )
  const target = Target.new()
  target.probe = probe
  for (const recognizer of [
    controller.interactivePopGestureRecognizer,
    (controller as any).interactiveContentPopGestureRecognizer as
      UIGestureRecognizer | undefined,
  ]) {
    if (recognizer && !targets.includes(recognizer)) {
      recognizer.addTargetAction(target, 'changed')
      targets.push(recognizer)
    }
  }
  const dispose = (reason = 'unsubscribed') => {
    if (disposed) return
    disposed = true
    for (const recognizer of targets) recognizer.removeTargetAction(target, 'changed')
    targets.length = 0
    target.probe = undefined
    frame.off('unloaded', unload)
    active?.invalidate(reason)
    listener = undefined
    active = undefined
  }
  const unload = () => dispose('host-unloaded')
  frame.on('unloaded', unload)
  return {
    // Host integration must call this when an entry identity is replaced. The
    // prototype does not infer authority from a matching path or native pointer.
    invalidate(reason: 'source-replaced' | 'target-replaced') {
      active?.invalidate(reason)
    },
    dispose: () => dispose(),
    get disposed() {
      return disposed
    },
    get active() {
      return !!active && !active.ended
    },
    get targetCount() {
      return targets.length
    },
  }
}
