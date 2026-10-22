import { getCurrentInstance, h, nextTick, onUnmounted, ref } from 'nativescript-vue'
import { describe, expect, it, vi } from 'vitest'
import { mount, paths, settle } from './helpers.js'

describe('router-owned page apps', () => {
  it('retains reactive apps during native surface teardown and releases them once on pop/close', async () => {
    const removed = vi.fn()
    const text = ref('before')
    const component = {
      setup() {
        onUnmounted(removed)
        return () => h('Page', { title: text.value })
      },
    }
    const { router, frame, app } = await mount([
      { path: '/', component },
      { path: '/edit', component },
    ])
    await router.push('/edit')
    const retained = frame().currentPage!
    frame().tearDown()
    await nextTick()
    expect(removed).not.toHaveBeenCalled()
    text.value = 'after recreation'
    await nextTick()
    expect((retained as any).title).toBe('after recreation')
    await router.back()
    expect(paths(router.stack.value)).toEqual(['/'])
    expect(removed).toHaveBeenCalledTimes(1)
    app.unmount()
    await nextTick()
    expect(removed).toHaveBeenCalledTimes(2)
  })

  it('defers covered-page reload, replaces its native Page on return and preserves lower history', async () => {
    const reloads: (() => void)[] = []
    const removed = vi.fn()
    const component = {
      setup() {
        const context = getCurrentInstance()!.appContext
        reloads.push(() => context.reload!())
        onUnmounted(removed)
        return () => h('Page')
      },
    }
    const { router, frame, app } = await mount([
      { path: '/', component },
      { path: '/edit', component },
      { path: '/cover', component },
    ])
    await router.push('/edit')
    const before = frame().currentPage
    await router.push('/cover')
    reloads[1]!()
    reloads[1]!()
    await settle()
    expect(removed).not.toHaveBeenCalled()
    await router.back()
    await settle()
    expect(paths(router.stack.value)).toEqual(['/', '/edit'])
    expect(frame().currentPage).not.toBe(before)
    expect(removed).toHaveBeenCalledTimes(2) // cover popped, edit reloaded once
    await router.push('/cover')
    await router.back()
    expect(paths(router.stack.value)).toEqual(['/', '/edit'])
    app.unmount()
    await nextTick()
    expect(removed).toHaveBeenCalledTimes(reloads.length)
  })

  it('cancels a pending covered reload when clearHistory removes the page', async () => {
    const reloads: (() => void)[] = []
    const component = {
      setup() {
        const context = getCurrentInstance()!.appContext
        reloads.push(() => context.reload!())
        return () => h('Page')
      },
    }
    const { router, app } = await mount([
      { path: '/', component },
      { path: '/edit', component },
    ])
    await router.push('/edit')
    reloads[0]!()
    await router.push('/', { clearHistory: true })
    await settle()
    const count = reloads.length
    reloads[0]!()
    await settle()
    expect(reloads).toHaveLength(count)
    expect(paths(router.stack.value)).toEqual(['/'])
    app.unmount()
  })
})
