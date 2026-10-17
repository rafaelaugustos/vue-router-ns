import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createDocumentPicker,
  useNativeFlow,
  type NativeFlow,
  type NativeFlowHandle,
  type NativeFlowOutcome,
  type RouteRecordRaw,
} from '../src/index.js'
import { mount, page, settle } from './helpers.js'
import {
  Activity,
  activityResults,
  androidLinks,
  Application,
  installDocumentPicker,
  Page,
} from './shims/core.js'
import { views } from './shims/nativescript-vue.js'

type Picker = NativeFlowHandle<
  { types?: readonly string[]; multiple?: boolean },
  { uris: string[] }
>
const pickers: Picker[] = []
const Attach = page('Attach', () => pickers.push(useNativeFlow(createDocumentPicker())))
const routes = [
  { path: '/', component: page('Home') },
  { path: '/attach', component: Attach },
] satisfies RouteRecordRaw[]

describe('native flows', () => {
  let uninstall: () => void
  beforeEach(() => {
    uninstall = installDocumentPicker()
    pickers.length = 0
  })
  afterEach(() => {
    uninstall()
    vi.restoreAllMocks()
  })

  it('launch the Android document picker and settle with the picked URIs', async () => {
    const { router } = await mount(routes, { platform: 'android', initial: '/attach' })
    const picker = pickers[0]!

    const pending = picker.run({ types: ['application/pdf', 'image/*'], multiple: true })
    expect(picker.running.value).toBe(true)
    const { intent, requestCode } = Activity.launched[0]!
    expect(intent).toMatchObject({
      action: 'android.intent.action.OPEN_DOCUMENT',
      categories: ['android.intent.category.OPENABLE'],
      type: '*/*',
      extras: {
        'android.intent.extra.MIME_TYPES': ['application/pdf', 'image/*'],
        'android.intent.extra.ALLOW_MULTIPLE': true,
      },
    })

    activityResults.deliver(requestCode, ['content://docs/1', 'content://docs/2'])
    expect(await pending).toEqual({
      status: 'completed',
      value: { uris: ['content://docs/1', 'content://docs/2'] },
    })
    expect(picker.running.value).toBe(false)
    expect(router.stack.value.map((route) => route.path)).toEqual(['/attach'])
  })

  it('report a cancelled picker, and a single document', async () => {
    await mount(routes, { platform: 'android', initial: '/attach' })
    const picker = pickers[0]!

    const cancelled = picker.run({})
    activityResults.deliver(Activity.launched.at(-1)!.requestCode, null)
    expect(await cancelled).toEqual({ status: 'cancelled', reason: 'user' })

    const single = picker.run({ types: ['application/pdf'] })
    expect(Activity.launched.at(-1)!.intent.type).toBe('application/pdf')
    activityResults.deliver(Activity.launched.at(-1)!.requestCode, ['content://docs/3'])
    expect(await single).toEqual({
      status: 'completed',
      value: { uris: ['content://docs/3'] },
    })
  })

  it('keep concurrent attempts apart by request code, across an activity recreation', async () => {
    const codes: number[] = []
    const counter: NativeFlow<number, number> = {
      kind: 'counter',
      start(input, context) {
        codes.push(context.requestCode)
        context.onActivityResult((code) => context.complete(input * code))
      },
    }
    const handles: NativeFlowHandle<number, number>[] = []
    const Two = page('Two', () => {
      handles.push(useNativeFlow(counter), useNativeFlow(counter))
    })
    await mount([{ path: '/', component: Two }], { platform: 'android' })

    const first = handles[0]!.run(10)
    const second = handles[1]!.run(100)
    expect(codes).toHaveLength(2)
    expect(codes[0]).not.toBe(codes[1])

    androidLinks.create(null, { bundle: {} })
    Application.android.notify({
      eventName: 'activityResult',
      object: Application.android,
      requestCode: codes[1],
      resultCode: 3,
      intent: null,
    })
    Application.android.notify({
      eventName: 'activityResult',
      object: Application.android,
      requestCode: codes[0],
      resultCode: 2,
      intent: null,
    })

    expect(await first).toEqual({ status: 'completed', value: 20 })
    expect(await second).toEqual({ status: 'completed', value: 300 })

    const replaced = handles[0]!.run(1)
    const newer = handles[0]!.run(2)
    expect(await replaced).toEqual({ status: 'cancelled', reason: 'replaced' })
    Application.android.notify({
      eventName: 'activityResult',
      object: Application.android,
      requestCode: codes.at(-1),
      resultCode: 5,
      intent: null,
    })
    expect(await newer).toEqual({ status: 'completed', value: 10 })
  })

  it('cancel the attempt when its page leaves, and drop a late result', async () => {
    const { router } = await mount(routes, { platform: 'android' })
    await router.push('/attach')
    const picker = pickers[0]!
    const pending = picker.run({})
    const { requestCode } = Activity.launched.at(-1)!

    await router.back()
    expect(await pending).toEqual({ status: 'cancelled', reason: 'disposed' })

    activityResults.deliver(requestCode, ['content://late'])
    await settle()
    expect(picker.running.value).toBe(false)
  })

  it('run the guard before launching, and fail unsupported flows', async () => {
    const nowhere: NativeFlow<void, void> = {
      kind: 'nowhere',
      supported: () => false,
      start: () => {},
    }
    const handles: NativeFlowHandle<void, void>[] = []
    const Unsupported = page('Unsupported', () => handles.push(useNativeFlow(nowhere)))
    const { router } = await mount(
      [...routes, { path: '/unsupported', component: Unsupported }],
      { platform: 'android', initial: '/attach' },
    )
    const picker = pickers[0]!

    const refused = await picker.run({}, { before: async () => false })
    expect(refused).toEqual({ status: 'cancelled', reason: 'guard' })
    expect(Activity.launched).toHaveLength(0)

    await router.push('/unsupported')
    const failed = await handles[0]!.run()
    expect(failed.status).toBe('failed')
    expect(String((failed as { error: unknown }).error)).toMatch(/isn't supported/)
  })

  it('present the iOS document picker from the page and hear its delegate', async () => {
    await mount(routes, { initial: '/attach' })
    const picker = pickers[0]!
    const pageView = views.get('Page')!.at(-1) as Page

    const pending = picker.run({ types: ['application/pdf'], multiple: true })
    const presented = pageView.ios.presented.at(-1)
    expect(presented.types).toEqual(['uttype:application/pdf'])
    expect(presented.allowsMultipleSelection).toBe(true)

    presented.delegate.documentPickerDidPickDocumentsAtURLs(presented, {
      count: 1,
      objectAtIndex: () => ({ absoluteString: 'file:///docs/a.pdf' }),
    })
    expect(await pending).toEqual({
      status: 'completed',
      value: { uris: ['file:///docs/a.pdf'] },
    })

    const cancelled = picker.run({})
    pageView.ios.presented.at(-1).delegate.documentPickerWasCancelled()
    expect(await cancelled).toEqual({ status: 'cancelled', reason: 'user' })
  })

  it('must be used inside a routed page', () => {
    expect(() => useNativeFlow(createDocumentPicker())).toThrow(/inside a routed page/)
  })
})
