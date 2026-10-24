import { h, nextTick, ref } from 'nativescript-vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  RouterDrawer,
  RouterView,
  type DrawerPresentation,
  type RouterDrawerHandle,
} from '../src/index.js'
import { drawerGeometry } from '../src/drawer-geometry.js'
import * as folding from '../src/folding.js'
import { mount, page, paths, settle } from './helpers.js'
import { DrawerLayoutStub, pressAndroidBack } from './shims/core.js'
import { views } from './shims/nativescript-vue.js'

afterEach(() => vi.restoreAllMocks())
const viewport = { x: 100, y: 24, width: 1000, height: 700, rtl: false }
const hinge = {
  left: 580.2,
  right: 620.8,
  top: 0,
  bottom: 900,
  vertical: true,
  separating: true,
  occluding: true,
}

describe('adaptive drawer geometry', () => {
  it('uses container width with opt-in auto, clamps the pane and respects RTL', () => {
    expect(drawerGeometry(viewport, [], 'overlay', 840, 300).presentation).toBe('overlay')
    expect(
      drawerGeometry({ ...viewport, width: 839 }, [], 'auto', 840, 300).presentation,
    ).toBe('overlay')
    expect(
      drawerGeometry({ ...viewport, width: 840, rtl: true }, [], 'auto', 840, 300),
    ).toMatchObject({
      presentation: 'permanent',
      pane: { x: 540, width: 300 },
      content: { x: 0, width: 540 },
    })
    expect(
      drawerGeometry({ ...viewport, width: 400 }, [], 'permanent', 840, 900),
    ).toMatchObject({
      pane: { width: 200 },
      content: { x: 200, width: 200 },
    })
  })
  it('excludes a physical hinge in local coordinates, including RTL and partial intersections', () => {
    expect(drawerGeometry(viewport, [hinge], 'auto', 840, 300)).toMatchObject({
      pane: { x: 0, width: 480 },
      content: { x: 521, width: 479 },
    })
    expect(
      drawerGeometry({ ...viewport, rtl: true }, [hinge], 'permanent', 840, 300),
    ).toMatchObject({
      pane: { x: 521, width: 479 },
      content: { x: 0, width: 480 },
    })
    expect(
      drawerGeometry(
        viewport,
        [{ ...hinge, left: 80, right: 120 }],
        'permanent',
        840,
        300,
      ),
    ).toMatchObject({
      pane: { x: 20, width: 300 },
      content: { x: 320, width: 680 },
    })
    expect(
      drawerGeometry(
        viewport,
        [{ ...hinge, vertical: false, left: 0, right: 1200, top: 324, bottom: 344 }],
        'permanent',
        840,
        300,
      ),
    ).toMatchObject({
      pane: { y: 320, height: 380 },
      content: { y: 320, height: 380 },
    })
  })
  it.each([
    { ...hinge, left: NaN },
    { ...hinge, right: 500 },
    { ...hinge, top: 900 },
    { ...hinge, separating: false, occluding: false },
  ])('ignores irrelevant or invalid folding bounds: %j', (fold) => {
    expect(drawerGeometry(viewport, [fold], 'permanent', 840, 300)).toEqual(
      drawerGeometry(viewport, [], 'permanent', 840, 300),
    )
  })
})

it.each(['ios', 'android'] as const)(
  'preserves stack/page identities and a pending modal result across mode changes on %s',
  async (platform) => {
    const presentation = ref<DrawerPresentation>('auto')
    const handle = ref<RouterDrawerHandle>()
    const open = ref(false)
    const opened = vi.fn(),
      closed = vi.fn(),
      changed = vi.fn()
    const stopFolds = vi.fn(),
      stopViewport = vi.fn()
    vi.spyOn(folding, 'observeWindowFolds').mockReturnValue(stopFolds)
    vi.spyOn(folding, 'observeSplitViewport').mockReturnValue(stopViewport)
    const { router, app } = await mount(
      [
        { path: '/', component: page('home') },
        { path: '/detail', component: page('detail') },
        { path: '/modal', component: page('modal'), modal: true },
      ],
      {
        platform,
        render: () =>
          h(
            RouterDrawer,
            {
              ref: handle,
              presentation: presentation.value,
              open: open.value,
              'onUpdate:open': (value: boolean) => {
                open.value = value
              },
              onOpened: opened,
              onClosed: closed,
              onPresentationChange: changed,
            },
            {
              default: () => h(RouterView),
              drawer: () => h('Label', { text: 'Destinations' }),
            },
          ),
      },
    )
    const host = views.get('RouterDrawerLayout')!.at(-1) as DrawerLayoutStub
    const frame = views.get('Frame')!.at(-1) as any
    await router.push('/detail')
    const entries = [...router.stack.value]
    const pages = [
      frame.currentPage,
      ...frame.backStack.map((entry: any) => entry.resolvedPage),
    ]
    handle.value!.open()
    await nextTick()
    const pending = router.pushForResult('/modal')
    await settle()
    const guard = vi.fn()
    router.beforeEach(guard)
    for (const width of [1000, 700, 1200, 400, 900]) {
      host.width = width
      host.notify({ eventName: 'layoutChanged' })
      await nextTick()
      expect(handle.value!.presentation).toBe(width >= 840 ? 'permanent' : 'overlay')
      expect(handle.value!.isOpen).toBe(false)
      expect(open.value).toBe(false)
      expect([
        frame.currentPage,
        ...frame.backStack.map((entry: any) => entry.resolvedPage),
      ]).toEqual(pages)
    }
    expect(guard).not.toHaveBeenCalled()
    handle.value!.open()
    expect(handle.value!.isOpen).toBe(false)
    await router.back({ result: 'kept' })
    expect(await pending).toBe('kept')
    expect(router.stack.value).toEqual(entries)
    if (platform === 'android') {
      pressAndroidBack()
      await settle()
      expect(paths(router.stack.value)).toEqual(['/'])
    }
    presentation.value = 'overlay'
    await nextTick()
    handle.value!.toggle()
    expect(handle.value!.isOpen).toBe(true)
    expect(opened).toHaveBeenCalledTimes(2)
    expect(closed).toHaveBeenCalledTimes(1)
    expect(changed).toHaveBeenLastCalledWith('overlay')
    app.unmount()
    expect(stopFolds).toHaveBeenCalledOnce()
    expect(stopViewport).toHaveBeenCalledOnce()
  },
)

it('normalizes an initially open permanent pane and never captures back for its visibility', async () => {
  const model = vi.fn(),
    opened = vi.fn()
  const handle = ref<RouterDrawerHandle>()
  await mount([{ path: '/', component: page('home') }], {
    render: () =>
      h(
        RouterDrawer,
        {
          ref: handle,
          presentation: 'permanent',
          open: true,
          'onUpdate:open': model,
          onOpened: opened,
        },
        { default: () => h(RouterView) },
      ),
  })
  expect(handle.value!.presentation).toBe('permanent')
  expect(handle.value!.isOpen).toBe(false)
  expect(opened).not.toHaveBeenCalled()
  expect(model).toHaveBeenCalledExactlyOnceWith(false)
})
