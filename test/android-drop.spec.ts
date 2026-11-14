import type { View } from '@nativescript/core'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { destinationType } from '../examples/drag-drop/policy.js'
import {
  destinationMime,
  installAndroidDragSource,
  installAndroidDropTarget,
} from '../examples/drag-drop/android.js'

const events = {
  ACTION_DRAG_STARTED: 1,
  ACTION_DRAG_LOCATION: 2,
  ACTION_DROP: 3,
  ACTION_DRAG_ENDED: 4,
  ACTION_DRAG_ENTERED: 5,
  ACTION_DRAG_EXITED: 6,
}
class Item {
  uri: unknown = null
  intent: unknown = null
  constructor(public text: any) {}
  getText = vi.fn(() => this.text)
  getUri() {
    return this.uri
  }
  getIntent() {
    return this.intent
  }
}
class Clip {
  static Item = Item
  items: Item[]
  constructor(
    _label: string,
    public types: string[],
    first: Item,
  ) {
    this.items = [first]
  }
  addItem(item: Item) {
    this.items.push(item)
  }
  getItemCount() {
    return this.items.length
  }
  getItemAt(index: number) {
    return this.items[index]!
  }
}
class NativeView {
  listener: any
  clip!: Clip
  token!: object
  result = true
  fail = false
  flags?: number
  cancelDragAndDrop = vi.fn()
  setOnDragListener(value: any) {
    this.listener = value
  }
  startDragAndDrop(clip: Clip, _shadow: unknown, token: object, flags: number) {
    this.clip = clip
    this.token = token
    this.flags = flags
    if (this.fail) throw new Error('native failure')
    return this.result
  }
}
class OwnedView {
  android = new NativeView()
  windowId = 'window'
  handlers = new Map<string, Set<() => void>>()
  getNativeWindow() {
    return { id: this.windowId }
  }
  on(name: string, fn: () => void) {
    if (!this.handlers.has(name)) this.handlers.set(name, new Set())
    this.handlers.get(name)!.add(fn)
  }
  off(name: string, fn: () => void) {
    this.handlers.get(name)?.delete(fn)
  }
  fire(name: string) {
    for (const fn of this.handlers.get(name) ?? []) fn()
  }
  get view() {
    return this as unknown as View
  }
}
const cleanups: (() => void)[] = []
beforeEach(() => {
  Object.defineProperty(Array, 'create', {
    configurable: true,
    value: (_type: string, size: number) => new Array<string>(size),
  })
  vi.stubGlobal('java', { lang: { Object: class {} } })
  vi.stubGlobal('android', {
    content: { ClipData: Clip },
    view: {
      DragEvent: events,
      View: {
        OnDragListener: class {
          constructor(implementation: unknown) {
            return implementation as object
          }
        },
        DragShadowBuilder: class {
          constructor(_view: unknown) {}
        },
      },
    },
  })
})
afterEach(() => {
  cleanups
    .splice(0)
    .reverse()
    .forEach((fn) => fn())
  Reflect.deleteProperty(Array, 'create')
  vi.unstubAllGlobals()
})
function setup(items = ['{"version":1}'], mime = destinationMime) {
  const source = new OwnedView(),
    target = new OwnedView()
  const began = vi.fn(),
    ended = vi.fn(),
    error = vi.fn(),
    hover = vi.fn(),
    receive = vi.fn(async (..._args: any[]) => {})
  const nextId = vi.fn(() => `delivery:${nextId.mock.calls.length}`)
  const drag = installAndroidDragSource(source.view, {
    origin: () => ({ windowId: 'window', frame: 'library' }),
    items: () => items,
    mime: () => mime,
    began,
    ended,
    error,
  })
  const drop = installAndroidDropTarget(target.view, {
    accepts: (types) => types.length === 1 && types[0] === destinationType,
    nextId,
    hover,
    receive,
    error,
  })
  cleanups.push(drag.dispose, drop.dispose)
  const start = () => source.fire('longPress')
  const event = (action: number) => ({
    getAction: () => action,
    getLocalState: () => source.android.token,
    getClipDescription: () => ({
      hasMimeType: (type: string) => source.android.clip.types.includes(type),
    }),
    getClipData: vi.fn(() => source.android.clip),
    getResult: () => true,
  })
  const send = (action: number) => {
    const e = event(action)
    return { e, result: drop.listener.onDrag(null, e) }
  }
  return {
    source,
    target,
    drag,
    drop,
    began,
    ended,
    error,
    hover,
    receive,
    nextId,
    start,
    event,
    send,
  }
}
it('reads no payload on hover and transfers only local text after DROP with no global flags', async () => {
  const s = setup()
  s.start()
  expect(s.source.android.flags).toBe(0)
  expect(s.began).toHaveBeenCalledOnce()
  for (const action of [
    events.ACTION_DRAG_STARTED,
    events.ACTION_DRAG_ENTERED,
    events.ACTION_DRAG_LOCATION,
  ]) {
    const { e, result } = s.send(action)
    expect(result).toBe(true)
    expect(e.getClipData).not.toHaveBeenCalled()
  }
  expect(s.receive).not.toHaveBeenCalled()
  expect(s.send(events.ACTION_DROP).result).toBe(true)
  const [id, items, origin] = s.receive.mock.calls[0]!
  expect(id).toBe('delivery:1')
  expect(origin).toEqual({ windowId: 'window', frame: 'library' })
  expect(items[0].type).toBe(destinationType)
  expect(await items[0].load().value).toBe('{"version":1}')
})
it.each(['multiple', 'mime', 'external', 'other-window'] as const)(
  'rejects %s at native admission without reading ClipData',
  (reason) => {
    const s = setup(
      reason === 'multiple' ? ['one', 'two'] : ['one'],
      reason === 'mime' ? 'text/plain' : destinationMime,
    )
    s.start()
    if (reason === 'external') s.source.android.token = {}
    if (reason === 'other-window') s.target.windowId = 'other'
    const { e, result } = s.send(events.ACTION_DRAG_STARTED)
    expect(result).toBe(false)
    expect(e.getClipData).not.toHaveBeenCalled()
    expect(s.receive).not.toHaveBeenCalled()
  },
)
it.each(['uri', 'intent', 'oversized', 'null', 'count'] as const)(
  'rejects %s at DROP without coercing native data',
  (kind) => {
    const s = setup()
    s.start()
    const item = s.source.android.clip.items[0]!
    if (kind === 'uri') item.uri = { secret: 'content://provider' }
    if (kind === 'intent') item.intent = { component: 'untrusted' }
    if (kind === 'oversized')
      item.text = {
        length: () => 8193,
        toString: () => {
          throw new Error('Must not convert oversized text')
        },
      }
    if (kind === 'null') item.text = null
    if (kind === 'count') s.source.android.clip.addItem(new Item('unexpected'))
    expect(s.send(events.ACTION_DROP).result).toBe(false)
    expect(s.receive).not.toHaveBeenCalled()
    if (kind === 'uri' || kind === 'intent') expect(item.getText).not.toHaveBeenCalled()
  },
)
it('reuses one delivery per native session and gives a fresh gesture a fresh id', () => {
  const s = setup()
  s.start()
  s.source.android.clip.items[0]!.text = { length: () => 2, toString: () => '{}' }
  s.send(events.ACTION_DROP)
  s.send(events.ACTION_DROP)
  expect(s.nextId).toHaveBeenCalledOnce()
  expect(s.receive.mock.calls[0]![0]).toBe(s.receive.mock.calls[1]![0])
  const end = s.event(events.ACTION_DRAG_ENDED)
  s.drag.listener.onDrag(null, end)
  s.drop.listener.onDrag(null, end)
  expect(s.ended).toHaveBeenCalledWith(true)
  s.start()
  s.send(events.ACTION_DROP)
  expect(s.receive.mock.calls[2]![0]).not.toBe(s.receive.mock.calls[0]![0])
})
it('native acceptance is distinct from asynchronous navigation failure', async () => {
  const s = setup()
  s.start()
  s.receive.mockRejectedValueOnce(new Error('guard/app failure'))
  expect(s.send(events.ACTION_DROP).result).toBe(true)
  await Promise.resolve()
  expect(s.error).toHaveBeenCalledOnce()
})
it('unloading the source cancels its gesture and invalidates late delivery', () => {
  const s = setup()
  s.start()
  s.source.fire('unloaded')
  expect(s.source.android.cancelDragAndDrop).toHaveBeenCalledOnce()
  expect(s.source.android.listener).toBeNull()
  expect(s.send(events.ACTION_DROP).result).toBe(false)
  s.source.fire('longPress')
  expect(s.began).toHaveBeenCalledOnce()
  s.drop.dispose()
  s.hover.mockClear()
  s.send(events.ACTION_DRAG_ENDED)
  s.send(events.ACTION_DRAG_EXITED)
  expect(s.hover).not.toHaveBeenCalled()
})
it.each([false, true])('cleans a refused/throwing native start (throws: %s)', (fail) => {
  const s = setup()
  s.source.android.result = false
  s.source.android.fail = fail
  s.start()
  expect(s.began).not.toHaveBeenCalled()
  expect(s.send(events.ACTION_DROP).result).toBe(false)
  expect(s.error).toHaveBeenCalledTimes(fail ? 1 : 0)
})
