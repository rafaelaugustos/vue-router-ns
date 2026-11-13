import { View as MockView } from './shims/core.js'
const View: any = MockView
import { defineComponent, h } from 'nativescript-vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useBackHistoryMenu, RouterView, type BackHistoryMenu } from '../src/index.js'
import { dismissPageHistoryMenu } from '../src/history-menu.js'
import { mount, page, settle } from './helpers.js'

const native = vi.hoisted(() => ({ opens: [] as any[] }))
vi.mock('../src/history-menu-native.js', () => ({
  presentHistoryMenu: vi.fn((source, options) => {
    const binding = { dismiss: vi.fn() }
    native.opens.push({ source, ...options, binding })
    return binding
  }),
}))
beforeEach(() => {
  native.opens.length = 0
})

async function fixture() {
  const menus: BackHistoryMenu[] = []
  const onError = vi.fn()
  const Screen = page('Screen', () => menus.push(useBackHistoryMenu({ onError })))
  const mounted = await mount([
    { path: '/:id?', component: Screen },
    { path: '/modal', component: Screen, modal: true },
  ])
  const source = () => {
    const view = new View()
    view.parent = mounted.frame().currentPage!
    return view
  }
  const seed = async () => {
    for (const path of ['/same', '/middle', '/same', '/top'])
      await mounted.router.push(path)
  }
  return { ...mounted, menus, onError, source, seed, menu: () => menus.at(-1)! }
}

describe('page-owned Back history menu', () => {
  it('dismisses covered history without crossing a modal boundary', async () => {
    const f = await fixture()
    await f.seed()
    const owner = f.menu(),
      source = f.source(),
      before = f.router.getHistory()
    owner.show(source)
    const old = native.opens.at(-1)
    await f.router.push('/modal')
    expect(owner.active.value).toBe(false)
    expect(owner.show(source)).toBe(false)
    old.select(0)
    await settle()
    expect(f.router.currentRoute.value.path).toBe('/modal')
    await f.router.back()
    expect(f.router.getHistory()).toEqual(before)
    expect(owner.show(source)).toBe(true)
    f.app.unmount()
  })
  it('opens without guards/navigation, labels duplicates, and selects the exact retained entry', async () => {
    const f = await fixture()
    await f.seed()
    const before = f.router.getHistory()!
    const guard = vi.fn()
    f.router.beforeEach(guard)
    expect(f.menu().show(f.source())).toBe(true)
    const open = native.opens.at(-1)
    expect(open.labels).toEqual(['/same (4)', '/middle (3)', '/same (2)', '/ (1)'])
    expect(f.menu().active.value).toBe(true)
    expect(f.router.getHistory()).toEqual(before)
    expect(guard).not.toHaveBeenCalled()
    open.select(2)
    await settle()
    expect(f.router.getHistory()!.entries.map((e) => e.id)).toEqual(
      before.entries.slice(0, 2).map((e) => e.id),
    )
    expect(guard).toHaveBeenCalledOnce()
    expect(open.binding.dismiss).toHaveBeenCalledOnce()
    open.select(0)
    await settle()
    expect(guard).toHaveBeenCalledOnce()
  })

  it('preserves history after a guard refuses selection and reports thrown errors once', async () => {
    const f = await fixture()
    await f.seed()
    const before = f.router.getHistory()
    let mode = 'refuse'
    const failure = new Error('guard failure')
    f.router.beforeEach(() => {
      if (mode === 'refuse') return false
      throw failure
    })
    f.menu().show(f.source())
    native.opens.at(-1).select(2)
    await settle()
    expect(f.router.getHistory()).toEqual(before)
    expect(f.menu().active.value).toBe(false)
    expect(f.onError).not.toHaveBeenCalled()
    mode = 'throw'
    f.menu().show(f.source())
    native.opens.at(-1).select(1)
    await settle()
    expect(f.router.getHistory()).toEqual(before)
    expect(f.onError).toHaveBeenCalledExactlyOnceWith(failure)
  })

  it('invalidates stale callbacks on external navigation, reopening, source unload and teardown', async () => {
    const f = await fixture()
    await f.seed()
    const old = f.menu()
    old.show(f.source())
    const first = native.opens.at(-1)
    expect(old.show(f.source())).toBe(true)
    expect(native.opens).toHaveLength(1)
    old.dismiss()
    old.show(f.source())
    const second = native.opens.at(-1)
    first.select(3)
    expect(old.active.value).toBe(true)
    await f.router.push('/next')
    expect(old.active.value).toBe(false)
    second.select(3)
    await settle()
    expect(f.router.currentRoute.value.path).toBe('/next')
    expect(old.show(f.source())).toBe(false)
    const source = f.source()
    f.menu().show(source)
    const third = native.opens.at(-1)
    source.notify({ eventName: 'unloaded', object: source })
    third.select(3)
    expect(f.menu().active.value).toBe(false)
    f.menu().show(f.source())
    const lastMenu = f.menu(),
      last = native.opens.at(-1)
    f.app.unmount()
    last.select(0)
    expect(lastMenu.active.value).toBe(false)
    expect(lastMenu.show(source)).toBe(false)
    expect(f.onError).not.toHaveBeenCalled()
  })

  it('rejects roots and foreign anchors; Escape/native dismissal leave history unchanged', async () => {
    const f = await fixture()
    expect(f.menu().show(f.source())).toBe(false)
    await f.seed()
    expect(f.menu().show(new View())).toBe(false)
    const before = f.router.getHistory()
    f.menu().show(f.source())
    const first = native.opens.at(-1)
    expect(dismissPageHistoryMenu(f.frame().currentPage! as any)).toBe(true)
    first.select(0)
    f.menu().show(f.source())
    native.opens.at(-1).close()
    expect(f.menu().active.value).toBe(false)
    expect(dismissPageHistoryMenu(f.frame().currentPage! as any)).toBe(false)
    expect(f.router.getHistory()).toEqual(before)
    const moved = f.source()
    f.menu().show(moved)
    moved.parent = null
    native.opens.at(-1).select(0)
    await settle()
    expect(f.router.getHistory()).toEqual(before)
  })

  it('targets its owning pane even when another named stack is focused', async () => {
    const owners: Record<string, BackHistoryMenu> = {}
    const Screen = defineComponent({
      props: ['pane'],
      setup(props) {
        owners[props.pane] = useBackHistoryMenu({
          label: (entry, index) => `${props.pane} ${entry.route.path} #${index + 1}`,
        })
        return () => h('Page')
      },
    })
    const f = await mount(
      [
        { path: '/left/:id?', component: Screen, props: { pane: 'left' } },
        { path: '/right/:id?', component: Screen, props: { pane: 'right' } },
      ],
      {
        render: () =>
          h('GridLayout', {}, [
            h(RouterView, { name: 'left', initial: '/left' }),
            h(RouterView, { name: 'right', initial: '/right' }),
          ]),
      },
    )
    await f.router.push('/left/1', { frame: 'left' })
    await f.router.push('/right/1', { frame: 'right' })
    const { views } = await import('./shims/nativescript-vue.js')
    const source = new View()
    source.parent = (views.get('Frame')!.at(-2) as any).currentPage
    const right = f.router.getHistory({ frame: 'right' })
    expect(owners.left!.show(source)).toBe(true)
    expect(native.opens.at(-1).labels).toEqual(['left /left #1'])
    native.opens.at(-1).select(0)
    await settle()
    expect(f.router.getHistory({ frame: 'left' })!.entries).toHaveLength(1)
    expect(f.router.getHistory({ frame: 'right' })).toEqual(right)
    f.app.unmount()
  })
})
