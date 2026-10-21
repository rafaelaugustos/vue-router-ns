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
  Application,
  installDocumentPicker,
  Page,
} from './shims/core.js'
import { views } from './shims/nativescript-vue.js'
import { startNativeFlow } from '../src/native-flows.js'

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

  it('keep legacy concurrent attempts apart by request code and retain newer running state', async () => {
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

    const activity = Application.android.foregroundActivity
    Application.android.notify({
      eventName: 'activityResult',
      object: Application.android,
      activity,
      requestCode: codes[1],
      resultCode: 3,
      intent: null,
    })
    Application.android.notify({
      eventName: 'activityResult',
      object: Application.android,
      activity,
      requestCode: codes[0],
      resultCode: 2,
      intent: null,
    })

    expect(await first).toEqual({ status: 'completed', value: 20 })
    expect(await second).toEqual({ status: 'completed', value: 300 })

    const replaced = handles[0]!.run(1)
    const newer = handles[0]!.run(2)
    expect(await replaced).toEqual({ status: 'cancelled', reason: 'replaced' })
    expect(handles[0]!.running.value).toBe(true)
    Application.android.notify({
      eventName: 'activityResult',
      object: Application.android,
      activity,
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

  it('uses the originating Activity even when another window is foreground', async () => {
    await mount(routes, { platform: 'android', initial: '/attach' })
    const owner = Application.android.foregroundActivity!
    const nativePage = views.get('Page')!.at(-1) as Page
    nativePage._context = { getBaseContext: () => owner }
    const other = new Activity()
    Application.android.foregroundActivity = other
    const pending = pickers[0]!.run({})
    const launch = Activity.launched.at(-1)!
    expect(launch.activity).toBe(owner)
    expect(
      other.getActivityResultRegistry().dispatchResult(launch.requestCode, 0, null),
    ).toBe(false)
    expect(pickers[0]!.running.value).toBe(true)
    owner.getActivityResultRegistry().dispatchResult(launch.requestCode, 0, null)
    expect(await pending).toEqual({ status: 'cancelled', reason: 'user' })
    expect(owner.getActivityResultRegistry().callbacks.size).toBe(0)
  })

  it('rebinds AndroidX correlation after Activity recreation without relaunching', async () => {
    await mount(routes, { platform: 'android', initial: '/attach' })
    const owner = Application.android.foregroundActivity!
    const pending = pickers[0]!.run({})
    const launch = Activity.launched.at(-1)!
    const bundle = new Map<string, boolean>()
    const state = {
      putBoolean: (key: string, value: boolean) => bundle.set(key, value),
      getBoolean: (key: string) => bundle.get(key) ?? false,
    }
    Application.android.notify({
      eventName: 'saveActivityState',
      activity: owner,
      bundle: state,
    })
    vi.spyOn(owner, 'isChangingConfigurations').mockReturnValue(true)
    Application.android.notify({ eventName: 'activityDestroyed', activity: owner })
    expect(owner.getActivityResultRegistry().callbacks.size).toBe(0)
    const recreated = new Activity()
    recreated.getActivityResultRegistry().restore(owner.getActivityResultRegistry())
    // A system result can precede registration after recreation.
    recreated.getActivityResultRegistry().dispatchResult(launch.requestCode, -1, {
      getData: () => ({ toString: () => 'content://after-recreation' }),
    })
    Application.android.notify({
      eventName: 'activityCreated',
      activity: recreated,
      bundle: state,
    })
    expect(await pending).toEqual({
      status: 'completed',
      value: { uris: ['content://after-recreation'] },
    })
    expect(Activity.launched).toHaveLength(1)
    expect(recreated.getActivityResultRegistry().callbacks.size).toBe(0)
  })

  it('cancels on owner destruction and drops late registry callbacks', async () => {
    await mount(routes, { platform: 'android', initial: '/attach' })
    const owner = Application.android.foregroundActivity!
    const pending = pickers[0]!.run({})
    const launch = Activity.launched.at(-1)!
    const callback = owner.getActivityResultRegistry().callbacks.get(launch.requestCode)
    Application.android.notify({
      eventName: 'activityDestroyed',
      activity: new Activity(),
    })
    expect(pickers[0]!.running.value).toBe(true)
    Application.android.notify({ eventName: 'activityDestroyed', activity: owner })
    expect(await pending).toEqual({ status: 'cancelled', reason: 'disposed' })
    expect(owner.getActivityResultRegistry().callbacks.size).toBe(0)
    callback.onActivityResult({ getResultCode: () => -1, getData: () => null })
    expect(pickers[0]!.running.value).toBe(false)
  })

  it('does not let an older asynchronous guard launch over a newer attempt', async () => {
    await mount(routes, { platform: 'android', initial: '/attach' })
    let allow!: (ok: boolean) => void
    const old = pickers[0]!.run(
      {},
      {
        before: () =>
          new Promise<boolean>((done) => {
            allow = done
          }),
      },
    )
    const recent = pickers[0]!.run({})
    allow(true)
    expect(await old).toEqual({ status: 'cancelled', reason: 'replaced' })
    expect(Activity.launched).toHaveLength(1)
    expect(pickers[0]!.running.value).toBe(true)
    activityResults.deliver(Activity.launched[0]!.requestCode, null)
    await recent
    const error = new Error('guard failed')
    expect(
      await pickers[0]!.run(
        {},
        {
          before: async () => {
            throw error
          },
        },
      ),
    ).toEqual({ status: 'failed', error })
  })

  it('settles support, launch, result-parser and cleanup failures without hanging', async () => {
    const error = new Error('native error')
    expect(
      await startNativeFlow(
        {
          kind: 'support',
          supported: () => {
            throw error
          },
          start() {},
        },
        undefined,
        undefined,
      ).outcome,
    ).toEqual({ status: 'failed', error })
    expect(
      await startNativeFlow(
        {
          kind: 'launch',
          start: () => {
            throw error
          },
        },
        undefined,
        undefined,
      ).outcome,
    ).toEqual({ status: 'failed', error })
    const cleanup = startNativeFlow(
      {
        kind: 'cleanup',
        start: () => () => {
          throw error
        },
      },
      undefined,
      undefined,
    )
    cleanup.dispose()
    expect(await cleanup.outcome).toEqual({ status: 'failed', error })
    await mount(routes, { platform: 'android', initial: '/attach' })
    const pending = pickers[0]!.run({})
    const owner = Application.android.foregroundActivity!
    const launch = Activity.launched.at(-1)!
    owner.getActivityResultRegistry().dispatchResult(launch.requestCode, -1, {
      getClipData() {
        throw error
      },
    })
    expect(await pending).toEqual({ status: 'failed', error })
    expect(owner.getActivityResultRegistry().callbacks.size).toBe(0)
  })

  it('reserves iOS presentation before UIKit exposes presentedViewController', async () => {
    await mount(routes, { initial: '/attach' })
    const pageView = views.get('Page')!.at(-1) as Page
    const a = startNativeFlow(createDocumentPicker(), {}, pageView as any)
    const b = startNativeFlow(createDocumentPicker(), {}, pageView as any)
    expect((await b.outcome).status).toBe('failed')
    const picker = pageView.ios.presented.at(-1)
    expect(picker.types).toEqual(['uttype:public.item'])
    picker.delegate.documentPickerWasCancelled()
    expect(await a.outcome).toEqual({ status: 'cancelled', reason: 'user' })
    const c = startNativeFlow(
      createDocumentPicker(),
      { types: ['image/*', 'video/*'] },
      pageView as any,
    )
    expect(pageView.ios.presented.at(-1).types).toEqual([
      'uttype:public.image',
      'uttype:public.movie',
    ])
    c.dispose()
    await c.outcome
  })

  it('must be used inside a routed page', () => {
    expect(() => useNativeFlow(createDocumentPicker())).toThrow(/inside a routed page/)
  })
})
