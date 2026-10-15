import { defineComponent, h, nextTick, onUnmounted, ref } from 'nativescript-vue'
import { describe, expect, it, vi } from 'vitest'
import {
  isNavigationFailure,
  NavigationFailureType,
  onBeforeRouteLeave,
  onPageActivated,
  onPageDeactivated,
  RouterSplitView,
  RouterView,
  useRouter,
  type Router,
  type SavedStacks,
} from '../src/index.js'
import { events, mount, page, paths, settle } from './helpers.js'
import { Frame, pressAndroidBack, View } from './shims/core.js'
import { views } from './shims/nativescript-vue.js'

const List = page('List')
const Detail = page('Detail')
const routes = [
  { path: '/messages', component: List },
  { path: '/messages/:id', component: Detail },
  { path: '/edit', component: Detail },
  { path: '/compose', component: Detail, modal: true },
]

async function split(options: { platform?: 'ios' | 'android'; wide?: boolean } = {}) {
  const result = await mount(routes, {
    platform: options.platform,
    render: () => h(RouterSplitView, { list: '/messages' }),
  })
  const [listFrame, detailFrame] = views.get('Frame')!.slice(-2) as Frame[]
  const layout = listFrame!.parent!
  const resize = async (width: number) => {
    layout.width = width
    layout.notify({ eventName: 'layoutChanged', object: layout })
    await nextTick()
  }
  await resize(options.wide ? 1024 : 400)
  return { ...result, listFrame: listFrame!, detailFrame: detailFrame!, layout, resize }
}

describe('RouterSplitView', () => {
  it('activates both visible panes, and deactivates them under a modal', async () => {
    const active = new Set<string>()
    const tracked = (name: string) =>
      page(name, () => {
        onPageActivated(() => active.add(name))
        onPageDeactivated(() => active.delete(name))
        onUnmounted(() => active.delete(name))
      })
    const { router } = await mount(
      [
        { path: '/messages', component: tracked('list') },
        { path: '/messages/1', component: tracked('detail') },
        { path: '/compose', component: tracked('modal'), modal: true },
      ],
      { render: () => h(RouterSplitView, { list: '/messages' }) },
    )
    await router.push('/messages/1')
    expect([...active]).toEqual(['detail'])
    const layout = views.get('Frame')!.at(-2)!.parent!
    layout.width = 1000
    layout.notify({ eventName: 'layoutChanged' })
    await nextTick()
    expect(active).toEqual(new Set(['list', 'detail']))
    await router.push('/compose')
    expect(active).toEqual(new Set(['modal']))
    await router.back()
    expect(active).toEqual(new Set(['list', 'detail']))
    layout.width = 400
    layout.notify({ eventName: 'layoutChanged' })
    await nextTick()
    expect(active).toEqual(new Set(['detail']))
  })

  it('cancels pending navigation when the split view unmounts', async () => {
    const { router, app, detailFrame } = await split()
    let release!: () => void
    router.beforeEach(
      () =>
        new Promise<void>((resolve) => {
          release = resolve
        }),
    )
    const navigation = router.push('/messages/1')
    await settle()
    app.unmount()
    release()
    expect(isNavigationFailure(await navigation, NavigationFailureType.cancelled)).toBe(
      true,
    )
    expect(detailFrame.currentPage).toBeNull()
  })

  it('starts with a pinned list and an empty detail pane', async () => {
    const { router, listFrame, detailFrame, layout } = await split({ wide: true })
    expect(paths(router.stack.value)).toEqual(['/messages'])
    expect(listFrame.currentPage).toBeTruthy()
    expect(detailFrame.currentPage).toBeNull()
    expect((detailFrame as any).opacity).toBe(0)
    expect((layout as any).columns).toBe('320, *')
  })

  it('keeps the same page instances and history across window sizes', async () => {
    const { router, listFrame, detailFrame, layout, resize } = await split()
    await router.push('/messages/1')
    await router.push('/edit')
    const list = listFrame.currentPage
    const detail = detailFrame.currentPage
    const history = detailFrame.backStack.map((entry) => entry.resolvedPage)
    const before = [...events]
    const guards = vi.fn()
    router.beforeEach(guards)

    await resize(1200)
    expect((layout as any).columns).toBe('320, *')
    await resize(600)
    expect((layout as any).columns).toBe('*')
    expect(listFrame.currentPage).toBe(list)
    expect(detailFrame.currentPage).toBe(detail)
    expect(detailFrame.backStack.map((entry) => entry.resolvedPage)).toEqual(history)
    expect(paths(router.stack.value)).toEqual(['/messages', '/messages/1', '/edit'])
    expect(events).toEqual(before)
    expect(guards).not.toHaveBeenCalled()
  })

  it.each([false, true])(
    'pops the detail history and returns to the list (wide=%s)',
    async (wide) => {
      const { router, listFrame, detailFrame } = await split({ wide })
      const list = listFrame.currentPage
      await router.push('/messages/1')
      await router.push('/messages/2')
      await router.back()
      expect(paths(router.stack.value)).toEqual(['/messages', '/messages/1'])
      await router.back()
      await nextTick()
      expect(paths(router.stack.value)).toEqual(['/messages'])
      expect((detailFrame as any).opacity).toBe(0)
      expect(listFrame.currentPage).toBe(list)
      expect(events).not.toContain('unmount List')
    },
  )

  it('handles the Android back button and native iOS pops from the first detail', async () => {
    const { router } = await split({ platform: 'android' })
    await router.push('/messages/1')
    expect(pressAndroidBack().cancel).toBe(true)
    await settle()
    expect(paths(router.stack.value)).toEqual(['/messages'])
    const ios = await split()
    await ios.router.push('/messages/2')
    ios.detailFrame.popNatively()
    expect(paths(ios.router.stack.value)).toEqual(['/messages'])
  })

  it('runs leave guards when going back to the list', async () => {
    const Guarded = page('Guarded', () => onBeforeRouteLeave(() => false))
    const { router } = await mount(
      [...routes, { path: '/guarded', component: Guarded }],
      {
        render: () => h(RouterSplitView, { list: '/messages' }),
      },
    )
    await router.push('/guarded')
    expect(isNavigationFailure(await router.back(), NavigationFailureType.aborted)).toBe(
      true,
    )
    expect(
      isNavigationFailure(await router.push('/messages'), NavigationFailureType.aborted),
    ).toBe(true)
    expect(paths(router.stack.value)).toEqual(['/messages', '/guarded'])
  })

  it('selecting the list route returns through the stack instead of duplicating it', async () => {
    const { router } = await split()
    await router.push('/messages/1')
    await router.push('/edit')
    await router.push('/messages')
    expect(paths(router.stack.value)).toEqual(['/messages'])
    await router.push('/messages')
    expect(paths(router.stack.value)).toEqual(['/messages'])
  })

  it('replace at the list opens the first detail and later replaces only the top', async () => {
    const { router, listFrame } = await split()
    const list = listFrame.currentPage
    await router.replace('/messages/1')
    await router.replace('/messages/2')
    expect(paths(router.stack.value)).toEqual(['/messages', '/messages/2'])
    await router.back()
    expect(listFrame.currentPage).toBe(list)
    expect(paths(router.stack.value)).toEqual(['/messages'])
  })

  it('clearHistory clears details while retaining the list and native back destination', async () => {
    const { router, listFrame } = await split()
    const list = listFrame.currentPage
    await router.push('/messages/1')
    await router.push('/edit')
    await router.push('/messages/2', { clearHistory: true })
    expect(paths(router.stack.value)).toEqual(['/messages', '/messages/2'])
    expect(listFrame.currentPage).toBe(list)
    await router.back()
    expect(paths(router.stack.value)).toEqual(['/messages'])
  })

  it('setStack prepends the pinned list and can clear all details', async () => {
    const { router } = await split()
    await router.setStack(['/messages/1', '/edit'])
    expect(paths(router.stack.value)).toEqual(['/messages', '/messages/1', '/edit'])
    await router.setStack(['/messages'])
    expect(paths(router.stack.value)).toEqual(['/messages'])
  })

  it('preserves list and detail component state during resizing', async () => {
    const states: ReturnType<typeof ref<string>>[] = []
    const Stateful = defineComponent({
      setup() {
        const draft = ref('')
        states.push(draft)
        return () => h('Page', [h('Label', { text: draft.value })])
      },
    })
    const { router } = await mount(
      [
        { path: '/messages', component: Stateful },
        { path: '/messages/:id', component: Stateful },
      ],
      { render: () => h(RouterSplitView, { list: '/messages' }) },
    )
    await router.push('/messages/1')
    states[0]!.value = 'list filter'
    states[1]!.value = 'unsaved detail'
    const layout = views.get('Frame')!.at(-2)!.parent!
    for (const width of [1200, 500, 1000]) {
      layout.width = width
      layout.notify({ eventName: 'layoutChanged' })
      await nextTick()
    }
    expect(states).toHaveLength(2)
    expect(states.map((state) => state.value)).toEqual(['list filter', 'unsaved detail'])
  })

  it('pages in the list and detail share the same bound router', async () => {
    const routers: Router[] = []
    const Bound = page('Bound', () => routers.push(useRouter() as Router))
    const { router } = await mount(
      [
        { path: '/messages', component: Bound },
        { path: '/messages/:id', component: Bound },
      ],
      { render: () => h(RouterSplitView, { list: '/messages' }) },
    )
    await routers[0]!.push('/messages/1')
    await routers[0]!.push('/messages/2')
    expect(routers[0]).toBe(routers[1])
    expect(paths(router.stack.value)).toEqual(['/messages', '/messages/1', '/messages/2'])
  })

  it('keeps modals separate and returns to the same selected detail', async () => {
    const { router, detailFrame, resize } = await split()
    await router.push('/messages/1')
    const detail = detailFrame.currentPage
    await router.push('/compose')
    await resize(1100)
    expect(View.presented).toHaveLength(1)
    await router.back()
    expect(View.presented).toHaveLength(0)
    expect(router.currentRoute.value.path).toBe('/messages/1')
    expect(detailFrame.currentPage).toBe(detail)
  })

  it('returns a result from the first detail to the list', async () => {
    const { router } = await split()
    const result = router.pushForResult<string>('/messages/1')
    await settle()
    await router.back({ result: 'selected' })
    expect(await result).toBe('selected')
  })

  it('restores and saves one logical stack without the native placeholder', async () => {
    const save = vi.fn()
    const state: SavedStacks = {
      savedAt: Date.now(),
      stacks: { inbox: ['/messages', '/messages/2', '/edit'] },
    }
    const { router } = await mount(routes, {
      restore: { load: () => state, save },
      render: () => h(RouterSplitView, { name: 'inbox', list: '/messages' }),
    })
    expect(paths(router.stack.value)).toEqual(state.stacks.inbox)
    await router.back()
    expect(save.mock.lastCall?.[0].stacks.inbox).toEqual(['/messages', '/messages/2'])
  })

  it('can be targeted by name alongside a normal RouterView', async () => {
    const { router } = await mount(routes, {
      render: () =>
        h('GridLayout', [
          h(RouterSplitView, { name: 'inbox', list: '/messages' }),
          h(RouterView, { name: 'other', initial: '/edit' }),
        ]),
    })
    await settle()
    await router.push('/messages/2', { frame: 'inbox' })
    expect(paths(router.stack.value)).toEqual(['/messages', '/messages/2'])
    await router.backToRoot({ frame: 'inbox' })
    expect(router.currentRoute.value.path).toBe('/messages')
  })
})
