import type { View } from '@nativescript/core'

export interface WindowDragOffer {
  activity: NSUserActivity
  title: string
  cancel?(): void
  began?(): void
  ended?(operation: UIDropOperation): void
}
/** App-owned activity/token registration. The OS, not this delegate, creates a scene. */
export function installWindowDragSource(
  view: View,
  offer: () => WindowDragOffer | undefined,
) {
  const delegate = WindowDragDelegate.new() as WindowDragDelegate
  delegate.offer = offer
  delegate.active = true
  delegate.sessions = new Map()
  const interaction = UIDragInteraction.alloc().initWithDelegate(delegate)
  interaction.enabled = true
  const native = view.ios as UIView
  native.userInteractionEnabled = true
  native.addInteraction(interaction)
  return {
    delegate,
    dispose() {
      delegate.active = false
      for (const offer of delegate.sessions.values()) offer.cancel?.()
      delegate.sessions.clear()
      native.removeInteraction(interaction)
    },
  }
}
@NativeClass()
class WindowDragDelegate extends NSObject implements UIDragInteractionDelegate {
  static ObjCProtocols = [UIDragInteractionDelegate]
  active!: boolean
  offer!: () => WindowDragOffer | undefined
  sessions!: Map<UIDragSession, WindowDragOffer>
  dragInteractionItemsForBeginningSession(
    _interaction: UIDragInteraction,
    session: UIDragSession,
  ) {
    if (!this.active) return NSArray.array<UIDragItem>()
    const offer = this.offer()
    if (!offer) return NSArray.array<UIDragItem>()
    this.sessions.set(session, offer)
    const provider = NSItemProvider.alloc().initWithObject(
      NSString.stringWithString(offer.title),
    )
    provider.registerObjectVisibility(
      offer.activity,
      NSItemProviderRepresentationVisibility.All,
    )
    return NSArray.arrayWithObject(UIDragItem.alloc().initWithItemProvider(provider))
  }
  dragInteractionSessionWillBegin(
    _interaction: UIDragInteraction,
    session: UIDragSession,
  ) {
    this.sessions.get(session)?.began?.()
  }
  dragInteractionSessionAllowsMoveOperation() {
    return false
  }
  dragInteractionSessionIsRestrictedToDraggingApplication() {
    return false
  }
  dragInteractionSessionDidEndWithOperation(
    _interaction: UIDragInteraction,
    session: UIDragSession,
    operation: UIDropOperation,
  ) {
    const offer = this.sessions.get(session)
    this.sessions.delete(session)
    offer?.ended?.(operation)
  }
}
