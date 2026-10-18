import { h, ref } from 'nativescript-vue'
import { describe, expect, it, vi } from 'vitest'
import {
  RouterDrawer,
  RouterView,
  type RouteRecordRaw,
  type RouterDrawerHandle,
} from '../src/index.js'
import { mount, page, paths, settle } from './helpers.js'
import {
  DrawerLayoutStub,
  installMaterial,
  pressAndroidBack,
  swipeAndroidBack,
} from './shims/core.js'
import { views } from './shims/nativescript-vue.js'

const routes = [
  { path: '/', component: page('Home') },
  { path: '/list', component: page('List') },
] satisfies RouteRecordRaw[]

function drawerApp(
  options: {
    platform?: 'ios' | 'android'
    closeOnNavigate?: boolean
    open?: boolean
    on?: Record<string, (...args: unknown[]) => void>
  } = {},
) {
  const handle = ref<RouterDrawerHandle>()
  const mounted = mount(routes, {
    platform: options.platform ?? 'android',
    render: () =>
      h(
        RouterDrawer,
        {
          ref: handle,
          width: 280,
          closeOnNavigate: options.closeOnNavigate,
          open: options.open,
          ...options.on,
        },
        {
          default: () => h(RouterView),
          drawer: () => h('Button', { text: 'Settings' }),
        },
      ),
  })
  const layout = () => views.get('RouterDrawerLayout')!.at(-1) as DrawerLayoutStub
  return { mounted, handle, layout }
}

describe('RouterDrawer', () => {
  it('wraps the content and the pane in a drawer layout on Android', async () => {
    const { mounted, layout } = drawerApp()
    const { router } = await mounted

    expect(layout()).toBeInstanceOf(DrawerLayoutStub)
    expect(layout().drawerWidth).toBe(280)
    expect(layout().children).toHaveLength(2)
    expect(layout().children[1]!.children.map((view) => (view as any).text)).toEqual([
      'Settings',
    ])
    expect(paths(router.stack.value)).toEqual(['/'])
  })

  it('renders the content alone on iOS', async () => {
    const layouts = views.get('RouterDrawerLayout')?.length ?? 0
    const buttons = views.get('Button')?.length ?? 0
    const { mounted } = drawerApp({ platform: 'ios' })
    const { router } = await mounted

    expect(views.get('RouterDrawerLayout')?.length ?? 0).toBe(layouts)
    expect(views.get('Button')?.length ?? 0).toBe(buttons)
    expect(paths(router.stack.value)).toEqual(['/'])
  })

  it('opens and closes through the handle, the prop and the native drag', async () => {
    const opened = vi.fn()
    const closed = vi.fn()
    const model = vi.fn()
    const { mounted, handle, layout } = drawerApp({
      on: { onOpened: opened, onClosed: closed, 'onUpdate:open': model },
    })
    await mounted

    handle.value!.open()
    expect(layout().isDrawerOpen).toBe(true)
    expect(handle.value!.isOpen).toBe(true)
    expect(opened).toHaveBeenCalledTimes(1)
    expect(model).toHaveBeenLastCalledWith(true)

    handle.value!.toggle()
    expect(layout().isDrawerOpen).toBe(false)
    expect(closed).toHaveBeenCalledTimes(1)
    expect(model).toHaveBeenLastCalledWith(false)

    layout().drag(true)
    expect(handle.value!.isOpen).toBe(true)
    layout().drag(false)
    expect(handle.value!.isOpen).toBe(false)
  })

  it('starts open when asked', async () => {
    const { mounted, layout } = drawerApp({ open: true })
    await mounted
    expect(layout().isDrawerOpen).toBe(true)
  })

  it('takes the Android back while open, before any page pops', async () => {
    const { mounted, handle, layout } = drawerApp()
    const { router } = await mounted
    await router.push('/list')

    handle.value!.open()
    expect(pressAndroidBack().cancel).toBe(true)
    await settle()
    expect(layout().isDrawerOpen).toBe(false)
    expect(paths(router.stack.value)).toEqual(['/', '/list'])

    expect(pressAndroidBack().cancel).toBe(true)
    await settle()
    expect(paths(router.stack.value)).toEqual(['/'])
  })

  it('leaves the back swipe to the drawer while open', async () => {
    const { mounted, handle, layout } = drawerApp()
    const { router } = await mounted
    await router.push('/list')
    handle.value!.open()

    const swipe = swipeAndroidBack()
    swipe.move(0.5)
    swipe.cancel()
    await settle()
    expect(layout().isDrawerOpen).toBe(true)
    expect(paths(router.stack.value)).toEqual(['/', '/list'])

    swipeAndroidBack().release()
    await settle()

    expect(layout().isDrawerOpen).toBe(false)
    expect(paths(router.stack.value)).toEqual(['/', '/list'])
  })

  it('closes after a navigation, unless told not to', async () => {
    const { mounted, handle, layout } = drawerApp()
    const { router } = await mounted
    handle.value!.open()
    await router.push('/list')
    expect(layout().isDrawerOpen).toBe(false)

    const kept = drawerApp({ closeOnNavigate: false })
    const second = await kept.mounted
    kept.handle.value!.open()
    await second.router.push('/list')
    expect(kept.layout().isDrawerOpen).toBe(true)
  })

  it('keeps the drawer open when a guard refuses its destination', async () => {
    const { mounted, handle, layout } = drawerApp()
    const { router } = await mounted
    router.beforeEach(() => false)
    handle.value!.open()

    await router.push('/list')

    expect(layout().isDrawerOpen).toBe(true)
    expect(paths(router.stack.value)).toEqual(['/'])
  })

  it('still closes when the selected destination is already current', async () => {
    const { mounted, handle, layout } = drawerApp()
    const { router } = await mounted
    handle.value!.open()

    await router.push('/')

    expect(layout().isDrawerOpen).toBe(false)
    expect(paths(router.stack.value)).toEqual(['/'])
  })

  it.each(['dialog', 'sheet'] as const)(
    'gives a %s, its guards and result precedence over the drawer behind it',
    async (presentation) => {
      const uninstall = installMaterial()
      try {
        const { mounted, handle, layout } = drawerApp({ closeOnNavigate: false })
        const { router } = await mounted
        handle.value!.open()
        const options = {
          modal: presentation === 'sheet' ? { android: { sheet: {} } } : true,
        }
        const result = router.pushForResult('/list', options)
        await settle()
        const release = router.beforeEach(() => false)

        pressAndroidBack()
        await settle()
        expect(router.currentRoute.value.path).toBe('/list')
        expect(layout().isDrawerOpen).toBe(true)

        release()
        await router.back({ result: 'accepted' })
        expect(await result).toBe('accepted')
        expect(layout().isDrawerOpen).toBe(true)

        const dismissed = router.pushForResult('/list', options)
        await settle()
        pressAndroidBack()
        await settle()
        expect(await dismissed).toBeUndefined()
        expect(layout().isDrawerOpen).toBe(true)
        pressAndroidBack()
        await settle()
        expect(layout().isDrawerOpen).toBe(false)
        expect(paths(router.stack.value)).toEqual(['/'])
      } finally {
        uninstall()
      }
    },
  )

  it('lets any claimant take the system back first', async () => {
    const { router } = await mount(routes, { platform: 'android' })
    await router.push('/list')
    const back = vi.fn()
    let owns = true
    const release = router.claimSystemBack({ owns: () => owns, back })

    expect(pressAndroidBack().cancel).toBe(true)
    expect(back).toHaveBeenCalledTimes(1)
    expect(paths(router.stack.value)).toEqual(['/', '/list'])

    owns = false
    pressAndroidBack()
    await settle()
    expect(paths(router.stack.value)).toEqual(['/'])
    release()
  })
})
