import { inject, ref } from 'nativescript-vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { onBeforeRouteLeave, useRoute } from '../src/index.js'
import { entryKey } from '../src/injection.js'
import { bindGuardedBack, hasGuardedHistory } from '../src/guarded-back.js'
import type { Entry } from '../src/stack.js'
import { Device } from './shims/core.js'
import { mount, page, settle } from './helpers.js'

const stops: (() => void)[] = []
beforeEach(() => {
  vi.stubGlobal('UIAction', {
    actionWithTitleImageIdentifierHandler: (
      title: string,
      image: unknown,
      id: unknown,
      handler: () => void,
    ) => ({ title, image, id, handler }),
  })
  vi.stubGlobal('UIImage', { systemImageNamed: (name: string) => name })
  vi.stubGlobal('UIMenu', {
    menuWithTitleChildren: (title: string, children: any[]) => ({ title, children }),
  })
  vi.stubGlobal('UIDeferredMenuElement', {
    elementWithUncachedProvider: (provide: (done: (items: any[]) => void) => void) => ({
      provide,
    }),
  })
  vi.stubGlobal('UIBarButtonItem', {
    alloc: () => ({
      initWithPrimaryActionMenu: (primary: any, menu: any) => ({
        primary,
        menu,
        enabled: true,
      }),
    }),
  })
})
afterEach(() => {
  stops
    .splice(0)
    .reverse()
    .forEach((stop) => stop())
  vi.unstubAllGlobals()
})

async function fixture(guardPath = '/middle') {
  const dirty = ref(false),
    entries: Entry[] = []
  const guard = vi.fn<() => boolean | Promise<boolean>>(() => false)
  const Screen = page('Page', () => {
    const route = useRoute()
    entries.push(inject(entryKey)!)
    onBeforeRouteLeave(guard, { when: () => dirty.value && route.path === guardPath })
  })
  const f = await mount([
    { path: '/dialog', component: page('Modal'), modal: true },
    { path: '/:id?', component: Screen },
  ])
  stops.push(() => f.app.unmount())
  for (const path of ['/same', '/middle', '/same', '/top']) await f.router.push(path)
  const owner = entries.at(-1)!,
    nativePage = f.frame().currentPage!
  const sibling = { title: 'App action' }
  const item = Object.assign(nativePage.ios.navigationItem, {
    hidesBackButton: false,
    leftBarButtonItems: [sibling],
    setLeftBarButtonItemsAnimated(items: any[]) {
      this.leftBarButtonItems = items
    },
  })
  let appItems = [sibling],
    hidden = false
  const update = vi.fn(() => {
    item.leftBarButtonItems = appItems
    item.hidesBackButton = hidden
  })
  Object.assign(nativePage.actionBar, { update })
  const stop = bindGuardedBack(owner, nativePage as any)
  stops.push(stop)
  const button = () =>
    item.leftBarButtonItems.find(
      (candidate: any) => candidate.accessibilityIdentifier === 'router-guarded-back',
    )
  const menu = () => {
    let actions: any[] = []
    button().menu.children[0].provide((items: any[]) => {
      actions = items
    })
    return actions
  }
  return {
    ...f,
    dirty,
    guard,
    owner,
    item,
    update,
    nativePage,
    button,
    menu,
    stop,
    sibling,
    header(items: any[], hide = false) {
      appItems = items
      hidden = hide
      ;(nativePage.actionBar as any).update()
    },
  }
}

describe('guarded UIKit Back ownership', () => {
  it('takes over the active page Back tap and hands it back when its guard becomes inactive', async () => {
    const f = await fixture('/top')
    f.dirty.value = true
    f.button().primary.handler()
    await settle()
    expect(f.guard).toHaveBeenCalledOnce()
    expect(f.router.getHistory()!.entries).toHaveLength(5)
    f.dirty.value = false
    expect(f.button()).toBeUndefined()
    expect(f.item.hidesBackButton).toBe(false)
  })
  it('dismisses an already-open header context menu before replacing native Back', async () => {
    const f = await fixture()
    class Interaction {
      dismissMenu = vi.fn()
    }
    vi.stubGlobal('UIContextMenuInteraction', Interaction)
    const own = new Interaction(),
      foreign = new Interaction()
    f.nativePage.ios.navigationController = {
      navigationBar: { subviews: [{ interactions: [own] }] },
    }
    f.dirty.value = true
    expect(own.dismissMenu).toHaveBeenCalledOnce()
    expect(foreign.dismissMenu).not.toHaveBeenCalled()
    f.dirty.value = false
    expect(own.dismissMenu).toHaveBeenCalledTimes(2)
  })
  it('protects a covered guard, preserves app items, and hands the native header back', async () => {
    const f = await fixture()
    expect(f.button()).toBeUndefined()
    f.dirty.value = true
    expect(hasGuardedHistory(f.owner)).toBe(true)
    expect(f.item.hidesBackButton).toBe(true)
    expect(f.item.leftBarButtonItems).toEqual([f.button(), f.sibling])
    expect(f.menu().map((action) => action.title)).toEqual([
      '/same (4)',
      '/middle (3)',
      '/same (2)',
      '/ (1)',
    ])
    const later = { title: 'New app action' }
    f.header([later])
    expect(f.item.leftBarButtonItems).toEqual([f.button(), later])
    const stale = f.menu()[2]
    f.dirty.value = false
    expect(f.item.leftBarButtonItems).toEqual([later])
    expect(f.item.hidesBackButton).toBe(false)
    stale.handler()
    await settle()
    expect(f.router.getHistory()!.entries).toHaveLength(5)
    f.stop()
    expect((f.nativePage.actionBar as any).update).toBe(f.update)
  })

  it('refuses a menu jump through the covered page and serializes asynchronous selection', async () => {
    const f = await fixture()
    f.dirty.value = true
    let finish!: (value: boolean) => void
    f.guard.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const before = f.router.getHistory()
    const action = f.menu()[2]
    action.handler()
    action.handler()
    await vi.waitFor(() => expect(f.guard).toHaveBeenCalledOnce())
    finish(false)
    await settle()
    expect(f.router.getHistory()).toEqual(before)
    f.guard.mockReturnValue(true)
    f.menu()[2].handler()
    await settle()
    expect(f.router.getHistory()!.entries.map((entry) => entry.id)).toEqual(
      before!.entries.slice(0, 2).map((entry) => entry.id),
    )
  })

  it('short tap performs one Back, while old callbacks cannot navigate after history changes', async () => {
    const f = await fixture()
    f.dirty.value = true
    const old = f.button(),
      stale = f.menu()[3]
    old.primary.handler()
    old.primary.handler()
    await settle()
    expect(f.router.getHistory()!.entries).toHaveLength(4)
    expect(f.guard).not.toHaveBeenCalled()
    stale.handler()
    old.primary.handler()
    await settle()
    expect(f.router.getHistory()!.entries).toHaveLength(4)
  })

  it('invalidates callbacks when a modal covers the owner and restores Back on return', async () => {
    const f = await fixture()
    f.dirty.value = true
    const stale = f.menu()[2]
    await f.router.push('/dialog')
    expect(f.button()).toBeUndefined()
    stale.handler()
    await settle()
    expect(f.guard).not.toHaveBeenCalled()
    await f.router.back()
    expect(f.button()).toBeDefined()
    stale.handler()
    await settle()
    expect(f.guard).not.toHaveBeenCalled()
    expect(f.router.getHistory()!.entries).toHaveLength(5)
  })

  it('respects hidden app Back controls and does not overwrite a later update wrapper', async () => {
    const f = await fixture()
    f.header([f.sibling], true)
    f.dirty.value = true
    expect(f.button()).toBeUndefined()
    expect(f.item.hidesBackButton).toBe(true)
    f.header([f.sibling], false)
    const old = f.menu()[0]
    const ours = (f.nativePage.actionBar as any).update
    const later = () => ours.call(f.nativePage.actionBar)
    ;(f.nativePage.actionBar as any).update = later
    f.stop()
    expect((f.nativePage.actionBar as any).update).toBe(later)
    old.handler()
    later()
    await settle()
    expect(f.button()).toBeUndefined()
    expect(f.item.leftBarButtonItems).toEqual([f.sibling])
    expect(f.router.getHistory()!.entries).toHaveLength(5)
  })

  it('leaves system Back in place when only the retained root has an active guard', async () => {
    const f = await fixture('/')
    f.dirty.value = true
    expect(hasGuardedHistory(f.owner)).toBe(false)
    expect(f.button()).toBeUndefined()
    expect(f.item.hidesBackButton).toBe(false)
  })

  it('does not install on iOS 15', async () => {
    const f = await fixture()
    f.stop()
    Device.sdkVersion = '15.5'
    const stop = bindGuardedBack(f.owner, f.nativePage as any)
    f.dirty.value = true
    expect(f.button()).toBeUndefined()
    stop()
  })
})
