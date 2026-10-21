import { ref } from 'nativescript-vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  onBeforeRouteLeave,
  supportsBottomSheets,
  useNativeHost,
  useRouter,
  type NativeHostHandle,
  type NavigationGuard,
  type RouteRecordRaw,
  type Router,
} from '../src/index.js'
import { events, mount, page, paths, settle } from './helpers.js'
import {
  Device,
  Frame,
  installMaterial,
  pressAndroidBack,
  SheetDialog,
  SheetStates,
  View,
} from './shims/core.js'

const Home = page('Home')
const List = page('List')
const Filters = page('Filters')
const routes = [
  { path: '/', component: Home },
  { path: '/list', component: List },
  {
    path: '/filters',
    component: Filters,
    modal: {
      android: {
        sheet: {
          peekHeight: 320,
          maxHeight: 700,
          state: 'expanded',
          skipCollapsed: true,
          fitToContents: false,
          halfExpandedRatio: 0.6,
        },
      },
    },
  },
] satisfies RouteRecordRaw[]

const dialog = () => View.presented.at(-1)!.view.dialog as SheetDialog
const guarded = (name: string, guard: NavigationGuard) =>
  page(name, () => onBeforeRouteLeave(guard))

describe('Android bottom sheets', () => {
  let uninstall: () => void
  beforeEach(() => {
    uninstall = installMaterial()
  })
  afterEach(() => uninstall())

  it('present the route in a Material bottom sheet set up from the record', async () => {
    const { router } = await mount(routes, { platform: 'android' })

    await router.push('/filters')

    expect(supportsBottomSheets()).toBe(true)
    expect(View.presented).toHaveLength(1)
    expect(View.presented[0]!.view).toBeInstanceOf(Frame)
    expect(dialog()).toBeInstanceOf(SheetDialog)
    expect(dialog().behavior).toMatchObject({
      peekHeight: 960,
      maxHeight: 2100,
      state: SheetStates.EXPANDED,
      skipCollapsed: true,
      fitToContents: false,
      halfExpandedRatio: 0.6,
      hideable: true,
      draggable: true,
    })
    expect(dialog()).toMatchObject({
      cancelable: true,
      canceledOnTouchOutside: false,
      dismissWithAnimation: true,
    })
    expect(router.currentRoute.value.path).toBe('/filters')
    expect(paths(router.stack.value)).toEqual(['/filters'])
  })

  it('merge what push passes with the record', async () => {
    const { router } = await mount(routes, { platform: 'android' })

    await router.push('/filters', {
      modal: { android: { sheet: { state: 'collapsed', peekHeight: 200 } } },
    })

    expect(dialog().behavior).toMatchObject({
      peekHeight: 600,
      state: SheetStates.COLLAPSED,
      skipCollapsed: true,
    })
  })

  it('keep the plain modal on iOS', async () => {
    const { router } = await mount(routes, { platform: 'ios' })

    await router.push('/filters')

    expect(View.presented).toHaveLength(1)
    expect(View.presented[0]!.view.dialog).toBeUndefined()
  })

  it('reject a sheet when Material is not in the build', async () => {
    const { router } = await mount(routes, { platform: 'android' })
    uninstall()

    await expect(router.push('/filters')).rejects.toThrow(
      /com\.google\.android\.material/,
    )

    expect(supportsBottomSheets()).toBe(false)
    expect(View.presented).toHaveLength(0)
    expect(router.currentRoute.value.path).toBe('/')
    uninstall = installMaterial()
  })

  it('close through the router when dragged away', async () => {
    const after = vi.fn()
    const { router } = await mount(routes, {
      platform: 'android',
      before: (router) => router.afterEach(after),
    })
    await router.push('/filters')
    after.mockClear()

    expect(dialog().behavior.drag(SheetStates.HIDDEN)).toBe(true)
    await settle()

    expect(View.presented).toHaveLength(0)
    expect(router.currentRoute.value.path).toBe('/')
    expect(events).toContain('unmount Filters')
    expect(after).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/' }),
      expect.objectContaining({ path: '/filters' }),
      undefined,
    )
  })

  it('close on an outside tap, through the leave guards', async () => {
    const ask = vi.fn(async () => true)
    const { router } = await mount(
      [
        ...routes,
        {
          path: '/draft',
          component: guarded('Draft', ask),
          modal: { android: { sheet: true } },
        },
      ],
      { platform: 'android' },
    )
    await router.push('/filters')
    dialog().tapOutside()
    await settle()
    expect(View.presented).toHaveLength(0)

    await router.push('/draft')
    await settle()
    expect(dialog().behavior.hideable).toBe(false)
    expect(dialog().behavior.drag(SheetStates.HIDDEN)).toBe(false)

    dialog().tapOutside()
    await settle()

    expect(ask).toHaveBeenCalledTimes(1)
    expect(View.presented).toHaveLength(0)
    expect(router.currentRoute.value.path).toBe('/')
  })

  it('keep the sheet when the guard refuses, and release it when the guard goes', async () => {
    const dirty = ref(true)
    const refuse = vi.fn(() => false)
    const Draft = page('Draft', () => onBeforeRouteLeave(refuse, { when: dirty }))
    const { router } = await mount(
      [
        ...routes,
        { path: '/draft', component: Draft, modal: { android: { sheet: true } } },
      ],
      { platform: 'android' },
    )
    await router.push('/draft')
    await settle()

    dialog().tapOutside()
    await settle()
    dialog().tapOutside()
    await settle()
    expect(refuse).toHaveBeenCalledTimes(2)
    expect(View.presented).toHaveLength(1)
    expect(router.currentRoute.value.path).toBe('/draft')
    expect(dialog().behavior.hideable).toBe(false)

    dirty.value = false
    await settle()
    expect(dialog().behavior.hideable).toBe(true)
    expect(dialog().behavior.drag(SheetStates.HIDDEN)).toBe(true)
    await settle()
    expect(View.presented).toHaveLength(0)
  })

  it('never hide a sheet that is not cancelable, until code closes it', async () => {
    const { router } = await mount(routes, { platform: 'android' })

    await router.push('/filters', { modal: { cancelable: false } })

    expect(dialog().cancelable).toBe(false)
    expect(dialog().behavior.hideable).toBe(false)
    dialog().tapOutside()
    expect(pressAndroidBack().cancel).toBe(true)
    await settle()
    expect(View.presented).toHaveLength(1)

    await router.back()
    expect(View.presented).toHaveLength(0)
  })

  it.each(['36', '30'])(
    'send the Android back through the router on API %s: pop inside, then close',
    async (sdk) => {
      let inside!: Router
      const Filters = page('Filters', () => (inside = useRouter() as Router))
      const { router } = await mount(
        [
          ...routes.slice(0, 2),
          { path: '/filters', component: Filters, modal: { android: { sheet: true } } },
        ],
        { platform: 'android', before: () => (Device.sdkVersion = sdk) },
      )
      await router.push('/filters')
      await inside.push('/list')
      expect(paths(router.stack.value)).toEqual(['/filters', '/list'])

      expect(pressAndroidBack().cancel).toBe(true)
      await settle()
      expect(paths(router.stack.value)).toEqual(['/filters'])
      expect(View.presented).toHaveLength(1)

      pressAndroidBack()
      await settle()
      expect(View.presented).toHaveLength(0)
      expect(router.currentRoute.value.path).toBe('/')
    },
  )

  it('return a typed result from the sheet', async () => {
    const { router } = await mount(routes, { platform: 'android' })

    const result = router.pushForResult<string>('/filters')
    await settle()
    expect(dialog()).toBeInstanceOf(SheetDialog)
    await router.back({ result: 'unread' })

    expect(await result).toBe('unread')
    expect(View.presented).toHaveLength(0)
  })

  it('tell their pages they live in a bottom sheet', async () => {
    const handles: NativeHostHandle[] = []
    const Filters = page('Filters', () => handles.push(useNativeHost()))
    const { router } = await mount(
      [
        ...routes.slice(0, 2),
        { path: '/filters', component: Filters, modal: { android: { sheet: true } } },
      ],
      { platform: 'android' },
    )

    await router.push('/filters')

    expect(handles[0]!.kind).toBe('bottom-sheet')
    expect(handles[0]!.capabilities).toMatchObject({
      close: true,
      cancellableDismissal: true,
    })
    expect(handles[0]!.native).toBeInstanceOf(Frame)
    await router.back()
    expect(handles[0]!.native).toBeNull()
  })

  it('present without animation under reduced motion', async () => {
    const { router } = await mount(routes, { platform: 'android', motion: 'reduced' })

    await router.push('/filters')

    expect(dialog().dismissWithAnimation).toBe(false)
  })
})
