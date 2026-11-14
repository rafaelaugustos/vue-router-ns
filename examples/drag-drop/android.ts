import type { View } from '@nativescript/core'
import { destinationType, type DropItem } from './policy'

declare const android: any
declare const java: any
declare const Array: ArrayConstructor & { create(type: string, size: number): string[] }
interface LocalDragEvent {
  getAction(): number
  getLocalState(): object
  getClipDescription(): { hasMimeType(type: string): boolean } | null
  getClipData(): {
    getItemCount(): number
    getItemAt(index: number): {
      getUri(): unknown
      getIntent(): unknown
      getText(): string | { length(): number; toString(): string } | null
    }
  } | null
  getResult(): boolean
}

export const destinationMime = 'application/vnd.vue-router-ns.destination+json'
export interface AndroidDragOrigin {
  windowId: string
  frame: string
}
interface LocalDrag {
  origin: AndroidDragOrigin
  count: number
  mime: string
}
// Retain JNI wrappers only for an active local gesture. Never transfer native objects.
const localDrags = new Map<object, LocalDrag>()
export interface AndroidDragSourceOptions {
  origin(): AndroidDragOrigin
  items(): readonly string[]
  mime?(): string
  began?(): void
  /** Native transfer acceptance, NOT navigation success or a move commit. */
  ended?(accepted: boolean): void
  error(error: unknown): void
}
/** Android API 24+, dedicated source view; owns its native OnDragListener. */
export function installAndroidDragSource(view: View, options: AndroidDragSourceOptions) {
  const native = view.android as any
  let active = true,
    token: object | undefined
  const listener = new android.view.View.OnDragListener({
    onDrag(_view: unknown, event: LocalDragEvent) {
      if (event.getAction() === android.view.DragEvent.ACTION_DRAG_STARTED)
        return active && event.getLocalState() === token
      if (
        event.getAction() === android.view.DragEvent.ACTION_DRAG_ENDED &&
        event.getLocalState() === token
      ) {
        localDrags.delete(token!)
        token = undefined
        if (active) options.ended?.(event.getResult())
        return true
      }
      // This view observes its own lifetime; it is not a drop destination.
      return false
    },
  })
  function begin() {
    if (!active || token) return
    try {
      const items = options.items()
      if (!items.length) return
      const mime = options.mime?.() ?? destinationMime
      const types = Array.create('java.lang.String', 1)
      types[0] = mime
      const clip = new android.content.ClipData(
        'Router destination',
        types,
        new android.content.ClipData.Item(items[0]!),
      )
      for (const json of items.slice(1))
        clip.addItem(new android.content.ClipData.Item(json))
      const current: object = new java.lang.Object()
      token = current
      localDrags.set(current, {
        origin: { ...options.origin() },
        count: items.length,
        mime,
      })
      const started = native.startDragAndDrop(
        clip,
        new android.view.View.DragShadowBuilder(native),
        current,
        0,
      )
      if (!started) {
        localDrags.delete(current)
        if (token === current) token = undefined
        return
      }
      options.began?.()
    } catch (error) {
      if (token) localDrags.delete(token)
      token = undefined
      options.error(error)
    }
  }
  function dispose() {
    if (!active) return
    active = false
    if (token) {
      localDrags.delete(token)
      token = undefined
      native.cancelDragAndDrop()
    }
    view.off('longPress', begin)
    view.off('unloaded', dispose)
    native.setOnDragListener(null!)
  }
  native.setOnDragListener(listener)
  view.on('longPress', begin)
  view.on('unloaded', dispose)
  return { listener, dispose }
}
export interface AndroidDropTargetOptions {
  accepts(types: readonly string[]): boolean
  nextId(): string
  hover(active: boolean): void
  receive(
    id: string,
    items: readonly DropItem[],
    origin: AndroidDragOrigin,
  ): Promise<void>
  error(error: unknown): void
}
/** Same-Activity local text only. No URI coercion, global flags or external grants. */
export function installAndroidDropTarget(view: View, options: AndroidDropTargetOptions) {
  const native = view.android as any
  let active = true
  const deliveries = new Map<object, string>()
  function accepted(event: LocalDragEvent) {
    if (!active) return undefined
    const local = localDrags.get(event.getLocalState())
    if (
      !local ||
      local.origin.windowId !== view.getNativeWindow()?.id ||
      local.count !== 1 ||
      local.mime !== destinationMime ||
      !event.getClipDescription()?.hasMimeType(destinationMime) ||
      !options.accepts([destinationType])
    )
      return undefined
    return local
  }
  const listener = new android.view.View.OnDragListener({
    onDrag(_view: unknown, event: LocalDragEvent) {
      if (!active) return false
      const action = event.getAction(),
        events = android.view.DragEvent
      if (action === events.ACTION_DRAG_ENDED) {
        deliveries.delete(event.getLocalState())
        options.hover(false)
        return true
      }
      if (action === events.ACTION_DRAG_EXITED) {
        options.hover(false)
        return true
      }
      const local = accepted(event)
      if (action === events.ACTION_DRAG_STARTED) return !!local
      if (
        action === events.ACTION_DRAG_ENTERED ||
        action === events.ACTION_DRAG_LOCATION
      ) {
        options.hover(!!local)
        return !!local
      }
      if (action !== events.ACTION_DROP || !local) return false
      options.hover(false)
      // ClipData is available only at DROP. Do not call coerceToText: it may read a URI.
      const clip = event.getClipData()
      if (!clip || clip.getItemCount() !== 1) return false
      const item = clip.getItemAt(0)
      if (item.getUri() || item.getIntent()) return false
      const text = item.getText()
      if (text === null || text === undefined) return false
      const length = typeof text === 'string' ? text.length : text.length()
      if (length > 8192) return false
      const json = text.toString(),
        token = event.getLocalState()
      const id = deliveries.get(token) ?? options.nextId()
      deliveries.set(token, id)
      // Android's local text is already transferred. Policy still validates it
      // and waits for router readiness; this is not an asynchronous OS provider.
      void options
        .receive(
          id,
          [
            {
              type: destinationType,
              load: () => ({ value: Promise.resolve(json), cancel() {} }),
            },
          ],
          local.origin,
        )
        .catch(options.error)
      return true
    },
  })
  function dispose() {
    if (!active) return
    active = false
    deliveries.clear()
    options.hover(false)
    native.setOnDragListener(null!)
    view.off('unloaded', dispose)
  }
  native.setOnDragListener(listener)
  view.on('unloaded', dispose)
  return { listener, dispose }
}
