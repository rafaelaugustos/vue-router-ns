import { Utils, type View } from '@nativescript/core'
import { destinationType, type DropItem } from './policy'

export interface DragOrigin {
  windowId: string
  frame: string
}
export interface DragSourceOptions {
  /** Return serialized public destination data, never Vue/native objects. */
  items(): readonly { json: string; delay?: number; type?: string }[]
  origin(): DragOrigin
  began?(origin: DragOrigin): void
  ended?(operation: number): void
}
@NativeClass()
class DragDelegate extends NSObject implements UIDragInteractionDelegate {
  static ObjCProtocols = [UIDragInteractionDelegate]
  active!: boolean
  options!: DragSourceOptions
  sessions!: Set<UIDragSession>
  dragInteractionItemsForBeginningSession(
    _interaction: UIDragInteraction,
    session: UIDragSession,
  ) {
    if (!this.active) return NSArray.array<UIDragItem>()
    const origin = { ...this.options.origin() }
    this.sessions.add(session)
    origins.set(session, origin)
    return NSArray.arrayWithArray(
      this.options.items().map(({ json, delay = 0, type = destinationType }) => {
        const provider = NSItemProvider.new()
        provider.registerDataRepresentationForTypeIdentifierVisibilityLoadHandler(
          type,
          NSItemProviderRepresentationVisibility.OwnProcess,
          (completion) => {
            const progress = NSProgress.progressWithTotalUnitCount(1)
            // Providers may be invoked off the main queue. UIKit work stays on main.
            Utils.executeOnMainThread(() => {
              setTimeout(() => {
                completion(
                  NSString.stringWithString(json).dataUsingEncoding(NSUTF8StringEncoding),
                  null,
                )
                progress.completedUnitCount = 1
              }, delay)
            })
            return progress
          },
        )
        return UIDragItem.alloc().initWithItemProvider(provider)
      }),
    )
  }
  dragInteractionSessionWillBegin(
    _interaction: UIDragInteraction,
    session: UIDragSession,
  ) {
    const origin = origins.get(session)
    if (origin) this.options.began?.(origin)
  }
  dragInteractionSessionAllowsMoveOperation() {
    return false
  }
  dragInteractionSessionIsRestrictedToDraggingApplication() {
    return true
  }
  dragInteractionSessionDidEndWithOperation(
    _interaction: UIDragInteraction,
    session: UIDragSession,
    operation: UIDropOperation,
  ) {
    origins.delete(session)
    this.sessions.delete(session)
    this.options.ended?.(operation)
  }
}
// Retain bridge wrappers for the session lifetime. A native session can outlive
// its weak JavaScript wrapper and arrive with a different wrapper after GC.
const origins = new Map<UIDragSession, DragOrigin>()

/** Attach only to a loaded native view, retain the returned registration. */
export function installDragSource(view: View, options: DragSourceOptions) {
  const delegate = DragDelegate.new() as DragDelegate
  delegate.active = true
  delegate.options = options
  delegate.sessions = new Set()
  const interaction = UIDragInteraction.alloc().initWithDelegate(delegate)
  interaction.enabled = true
  const native = view.ios as UIView
  native.userInteractionEnabled = true
  native.addInteraction(interaction)
  return {
    delegate,
    dispose() {
      delegate.active = false
      for (const session of delegate.sessions) origins.delete(session)
      delegate.sessions.clear()
      native.removeInteraction(interaction)
    },
  }
}

export interface DropTargetOptions {
  accepts(types: readonly string[]): boolean
  nextId(): string
  hover(active: boolean): void
  receive(
    id: string,
    items: readonly DropItem[],
    origin: DragOrigin | undefined,
  ): Promise<void>
  error(error: unknown): void
}

@NativeClass()
class DropDelegate extends NSObject implements UIDropInteractionDelegate {
  static ObjCProtocols = [UIDropInteractionDelegate]
  active!: boolean
  options!: DropTargetOptions
  deliveries!: Map<UIDropSession, string>
  accepts(session: UIDropSession) {
    if (!this.active || session.items.count !== 1) return false
    const type = session.items
      .objectAtIndex(0)
      .itemProvider.hasItemConformingToTypeIdentifier(destinationType)
      ? destinationType
      : ''
    return this.options.accepts([type])
  }
  dropInteractionCanHandleSession(
    _interaction: UIDropInteraction,
    session: UIDropSession,
  ) {
    return this.accepts(session)
  }
  dropInteractionSessionDidEnter(
    _interaction: UIDropInteraction,
    session: UIDropSession,
  ) {
    this.options.hover(this.accepts(session))
  }
  dropInteractionSessionDidUpdate(
    _interaction: UIDropInteraction,
    session: UIDropSession,
  ) {
    return UIDropProposal.alloc().initWithDropOperation(
      this.accepts(session) ? UIDropOperation.Copy : UIDropOperation.Forbidden,
    )
  }
  dropInteractionSessionDidExit() {
    this.options.hover(false)
  }
  dropInteractionSessionDidEnd(_interaction: UIDropInteraction, session: UIDropSession) {
    this.options.hover(false)
    this.deliveries.delete(session)
  }
  dropInteractionPerformDrop(_interaction: UIDropInteraction, session: UIDropSession) {
    if (!this.accepts(session)) return
    const id = this.deliveries.get(session) ?? this.options.nextId()
    this.deliveries.set(session, id)
    this.options.hover(false)
    const provider = session.items.objectAtIndex(0).itemProvider
    const origin = session.localDragSession
      ? origins.get(session.localDragSession)
      : undefined
    const item: DropItem = {
      type: destinationType,
      load() {
        let progress: NSProgress | undefined,
          cancelled = false
        const value = new Promise<string>((resolve, reject) => {
          progress = provider.loadDataRepresentationForTypeIdentifierCompletionHandler(
            destinationType,
            (data: NSData | null, error: NSError | null) => {
              Utils.executeOnMainThread(() => {
                if (cancelled) return
                if (error || !data || data.length > 8192) {
                  reject(new Error('Invalid provider data'))
                  return
                }
                const text = NSString.alloc().initWithDataEncoding(
                  data,
                  NSUTF8StringEncoding,
                )
                if (!text) {
                  reject(new Error('Invalid UTF-8'))
                  return
                }
                resolve(text.toString())
              })
            },
          )
        })
        return {
          value,
          cancel() {
            cancelled = true
            progress?.cancel()
          },
        }
      },
    }
    void this.options.receive(id, [item], origin).catch(this.options.error)
  }
}
export function installDropTarget(view: View, options: DropTargetOptions) {
  const delegate = DropDelegate.new() as DropDelegate
  delegate.active = true
  delegate.options = options
  delegate.deliveries = new Map()
  const interaction = UIDropInteraction.alloc().initWithDelegate(delegate)
  const native = view.ios as UIView
  native.userInteractionEnabled = true
  native.addInteraction(interaction)
  return {
    delegate,
    dispose() {
      delegate.active = false
      delegate.deliveries.clear()
      options.hover(false)
      native.removeInteraction(interaction)
    },
  }
}
