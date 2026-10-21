import { defineComponent, getCurrentInstance, h } from 'nativescript-vue'
import { expect, it, vi } from 'vitest'
import { mount, page, paths, settle } from './helpers.js'

it.each(['return', 'discard'] as const)(
  'defers covered page HMR until Frame navigation settles (%s)',
  async (action) => {
    let context: { reload?: () => void } | undefined
    const setup = vi.fn(() => {
      context = getCurrentInstance()!.appContext
      return () => h('Page')
    })
    const component = Object.assign(defineComponent({ setup }), {
      __hmrId: `router-covered-page-${action}`,
    })
    const hmr = (
      globalThis as unknown as {
        __VUE_HMR_RUNTIME__: {
          createRecord(id: string, component: unknown): void
          reload(id: string, component: unknown): void
        }
      }
    ).__VUE_HMR_RUNTIME__
    hmr.createRecord(component.__hmrId, component)
    const { router, frame, app } = await mount(
      [
        { path: '/', component },
        { path: '/above', component: page('Above') },
        { path: '/fresh', component: page('Fresh') },
      ],
      { diagnostics: true },
    )
    await router.push('/above')
    const covered = frame().backStack[0]!.resolvedPage
    const top = frame().currentPage
    // NativeScript-Vue owns this callback. The router must wait until the
    // Frame has returned before letting it remount and replace the Page.
    const reload = vi.fn()
    context!.reload = reload
    hmr.reload(component.__hmrId, { ...component, setup })
    hmr.reload(component.__hmrId, { ...component, setup })
    await settle()

    expect(reload).not.toHaveBeenCalled()
    expect(setup).toHaveBeenCalledOnce()
    expect(frame().currentPage).toBe(top)
    expect(frame().backStack[0]!.resolvedPage).toBe(covered)
    expect(
      router
        .diagnostics!.events.filter((event) => event.phase === 'hmr')
        .map((event) => event.detail),
    ).toEqual(['requested', 'deferred', 'requested'])
    expect(paths(router.stack.value)).toEqual(['/', '/above'])
    if (action === 'return') await router.back()
    else await router.push('/fresh', { clearHistory: true })
    await settle()
    expect(reload).toHaveBeenCalledTimes(action === 'return' ? 1 : 0)
    expect(paths(router.stack.value)).toEqual([action === 'return' ? '/' : '/fresh'])
    expect(
      router.diagnostics!.events.filter(
        (event) => event.phase === 'hmr' && event.detail === 'applied',
      ),
    ).toHaveLength(action === 'return' ? 1 : 0)
    app.unmount()
  },
)
