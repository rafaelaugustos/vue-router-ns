import { unsetValue } from '@nativescript/core'
import {
  createApp,
  defineComponent,
  h,
  nextTick,
  ref,
  getCurrentInstance,
} from 'nativescript-vue'
import { describe, expect, it, vi } from 'vitest'
import {
  createRouter,
  type RouterWindow,
  usePageActions,
  useNavigationCommands,
  PageActionItem,
  RouterView,
  RouterTabs,
  RouterTab,
  onBeforeRouteLeave,
  type PageActions,
  type NavigationCommands,
} from '../src/index.js'
import { mount, page, settle } from './helpers.js'
import { views } from './shims/nativescript-vue.js'
import { NativeWindow, resetNative, setPlatform } from './shims/core.js'
import { ACTION_OWNER } from '../src/action-owner.js'

describe('page-owned shared actions', () => {
  it('keeps header/menu state reactive and serializes async dispatch across surfaces', async () => {
    let actions!: PageActions
    let finish!: () => void
    const title = ref('Save'),
      enabled = ref(true),
      visible = ref(true)
    const run = vi.fn(
      () =>
        new Promise<void>((done) => {
          finish = done
        }),
    )
    const Screen = defineComponent({
      setup() {
        actions = usePageActions([
          { id: 'save', title, busyTitle: 'Saving…', enabled, visible, run },
        ])
        return () =>
          h('Page', {}, [
            h('ActionBar', {}, [h(PageActionItem, { actions, action: 'save' })]),
          ])
      },
    })
    const { app } = await mount([{ path: '/', component: Screen }])
    await nextTick()
    const button = views.get('Button')!.at(-1) as any
    const menu = actions.menu()[0]!
    expect(button.text).toBe('Save')
    expect(button.isEnabled).toBe(true)
    const pending = actions.execute('save')
    await nextTick()
    expect(button.text).toBe('Saving…')
    expect(button.isEnabled).toBe(false)
    expect(button.accessibilityState).toBe('disabled')
    expect(menu.title).toBe('Saving…')
    expect(menu.enabled).toBe(false)
    expect(await menu.run!()).toBe(false)
    expect(run).toHaveBeenCalledOnce()
    finish()
    expect(await pending).toBe(true)
    await nextTick()
    expect(button.accessibilityState).toBe(unsetValue)
    title.value = 'Salvar'
    enabled.value = false
    await nextTick()
    expect(button.text).toBe('Salvar')
    expect(menu.title).toBe('Salvar')
    expect(menu.enabled).toBe(false)
    visible.value = false
    await nextTick()
    expect((views.get('ActionItem')!.at(-1) as any).visibility).toBe('collapsed')
    expect(menu.visible).toBe(false)
    app.unmount()
  })

  it('rejects programmatic failures, reports native failures once and releases busy state', async () => {
    let actions!: PageActions
    const error = new Error('save failed'),
      report = vi.fn()
    await mount([
      {
        path: '/',
        component: page('Root', () => {
          actions = usePageActions(
            [
              {
                id: 'save',
                title: 'Save',
                run: () => {
                  throw error
                },
              },
            ],
            { onError: report },
          )
        }),
      },
    ])
    await expect(actions.execute('save')).rejects.toBe(error)
    expect(report).not.toHaveBeenCalled()
    expect(await actions.dispatch('save')).toBe(false)
    expect(report).toHaveBeenCalledExactlyOnceWith(error, 'save')
    expect(actions.busy.value).toBeUndefined()
    expect(actions.get('save')!.enabled).toBe(true)
  })

  it('logs unhandled event errors and contains a throwing error handler', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    let actions!: PageActions, other!: PageActions
    const failure = new Error('failed'),
      reporting = new Error('report failed')
    try {
      await mount([
        {
          path: '/',
          component: page('Root', () => {
            actions = usePageActions([
              {
                id: 'fail',
                title: 'Fail',
                run: async () => {
                  throw failure
                },
              },
            ])
            other = usePageActions(
              [
                {
                  id: 'fail',
                  title: 'Fail',
                  run: () => {
                    throw failure
                  },
                },
              ],
              {
                onError: () => {
                  throw reporting
                },
              },
            )
          }),
        },
      ])
      expect(await actions.dispatch('fail')).toBe(false)
      expect(log).toHaveBeenCalledWith(
        '[vue-router-ns] Page action fail failed:',
        failure,
      )
      expect(await other.dispatch('fail')).toBe(false)
      expect(log).toHaveBeenCalledWith(
        '[vue-router-ns] Page action error handler failed:',
        reporting,
        'Original action error:',
        failure,
      )
    } finally {
      log.mockRestore()
    }
  })

  it('aborts on removal and rejects stale dispatch', async () => {
    let actions!: PageActions, signal!: AbortSignal, finish!: () => void
    const report = vi.fn()
    const { router } = await mount([
      { path: '/', component: page('Root') },
      {
        path: '/edit',
        component: page('Edit', () => {
          actions = usePageActions(
            [
              {
                id: 'save',
                title: 'Save',
                run: (context) => {
                  signal = context.signal
                  return new Promise<void>((done) => {
                    finish = done
                  })
                },
              },
            ],
            { onError: report },
          )
        }),
      },
    ])
    await router.push('/edit')
    const pending = actions.execute('save')
    await router.back()
    expect(signal.aborted).toBe(true)
    expect(await actions.execute('save')).toBe(false)
    finish()
    expect(await pending).toBe(true)
    expect(report).not.toHaveBeenCalled()
  })

  it('reports a genuine late failure even after page removal', async () => {
    let actions!: PageActions, fail!: (error: Error) => void
    const report = vi.fn(),
      failure = new Error('late server rejection')
    const { router } = await mount([
      { path: '/', component: page('Root') },
      {
        path: '/edit',
        component: page('Edit', () => {
          actions = usePageActions(
            [
              {
                id: 'save',
                title: 'Save',
                run: () =>
                  new Promise((_resolve, reject) => {
                    fail = reject
                  }),
              },
            ],
            { onError: report },
          )
        }),
      },
    ])
    await router.push('/edit')
    const pending = actions.dispatch('save')
    await router.back()
    fail(failure)
    expect(await pending).toBe(false)
    expect(report).toHaveBeenCalledExactlyOnceWith(failure, 'save')
  })

  it('retires the old registry and aborts its operation during page HMR', async () => {
    const registries: PageActions[] = [],
      signals: AbortSignal[] = []
    const done: (() => void)[] = []
    let context!: { reload?: () => void }
    const component = defineComponent({
      setup() {
        context = getCurrentInstance()!.appContext
        registries.push(
          usePageActions([
            {
              id: 'save',
              title: 'Save',
              run: ({ signal }) => {
                signals.push(signal)
                return new Promise<void>((resolve) => done.push(resolve))
              },
            },
          ]),
        )
        return () => h('Page')
      },
    })
    const { app } = await mount([{ path: '/', component }])
    const pending = registries[0]!.execute('save')
    context.reload!()
    await settle()
    expect(registries).toHaveLength(2)
    expect(signals[0]!.aborted).toBe(true)
    expect(await registries[0]!.execute('save')).toBe(false)
    expect(registries[1]!.get('save')!.enabled).toBe(true)
    done[0]!()
    expect(await pending).toBe(true)
    app.unmount()
  })

  it('keeps a running action alive under a modal but blocks new dispatch until uncovered', async () => {
    let actions!: PageActions, signal!: AbortSignal, finish!: () => void
    const { router } = await mount([
      {
        path: '/',
        component: page('Root', () => {
          actions = usePageActions([
            {
              id: 'save',
              title: 'Save',
              run: (context) => {
                signal = context.signal
                return new Promise<void>((done) => {
                  finish = done
                })
              },
            },
          ])
        }),
      },
      { path: '/modal', component: page('Modal'), modal: true },
    ])
    const pending = actions.execute('save')
    await router.push('/modal')
    expect(signal.aborted).toBe(false)
    finish()
    expect(await pending).toBe(true)
    expect(await actions.execute('save')).toBe(false)
    await router.back()
    expect(actions.get('save')!.enabled).toBe(true)
  })

  it('composes with existing keyboard commands and respects leave guards and modal results', async () => {
    let actions!: PageActions, commands!: NavigationCommands
    const blocked = ref(true)
    const { router } = await mount([
      { path: '/', component: page('Root') },
      {
        path: '/edit',
        component: page('Edit', () => {
          actions = usePageActions([
            {
              id: 'back',
              title: 'Back',
              run: ({ router }) => router.back({ result: 'accepted' }),
            },
          ])
          commands = useNavigationCommands([
            {
              id: 'back',
              title: () => actions.get('back')!.title,
              enabled: () => actions.get('back')!.enabled,
              shortcut: { input: '[', modifiers: ['meta'] },
              action: () => actions.dispatch('back'),
            },
          ])
          onBeforeRouteLeave(() => false, { when: blocked })
        }),
        modal: true,
      },
    ])
    const result = router.pushForResult('/edit')
    await settle()
    expect(await commands.execute('back')).toBe(true)
    expect(router.currentRoute.value.path).toBe('/edit')
    blocked.value = false
    await commands.execute('back')
    expect(await result).toBe('accepted')
    expect(router.currentRoute.value.path).toBe('/')
    expect(await actions.execute('back')).toBe(false)
  })

  it('isolates native windows and retires only the closed owner', async () => {
    resetNative()
    setPlatform('android')
    const registries: PageActions[] = [],
      signals: AbortSignal[] = [],
      finishes: (() => void)[] = []
    const apps: ReturnType<typeof createApp>[] = [],
      windows: NativeWindow[] = []
    try {
      for (let i = 0; i < 2; i++) {
        const window = new NativeWindow(`actions-${i}`)
        windows.push(window)
        const router = createRouter({
          window: window as unknown as RouterWindow,
          routes: [
            {
              path: '/',
              component: page('Root', () => {
                registries.push(
                  usePageActions([
                    {
                      id: 'save',
                      title: 'Save',
                      run: ({ signal }) => {
                        signals[i] = signal
                        return new Promise<void>((done) => {
                          finishes[i] = done
                        })
                      },
                    },
                  ]),
                )
              }),
            },
          ],
        })
        const app = createApp({ render: () => h(RouterView) }).use(router)
        apps.push(app)
        window.setContent(app.start()!.$el.nativeView)
        await router.isReady()
      }
      const pages = views.get('Page')!.slice(-2)
      expect(registries[0]![ACTION_OWNER].accepts(pages[0]! as any)).toBe(true)
      expect(registries[0]![ACTION_OWNER].accepts(pages[1]! as any)).toBe(false)
      const first = registries[0]!.execute('save'),
        second = registries[1]!.execute('save')
      windows[0]!.close()
      await settle()
      expect(signals[0]!.aborted).toBe(true)
      expect(signals[1]!.aborted).toBe(false)
      expect(await registries[0]!.execute('save')).toBe(false)
      finishes[0]!()
      finishes[1]!()
      await Promise.all([first, second])
      expect(registries[1]!.get('save')!.enabled).toBe(true)
    } finally {
      apps.forEach((app) => app.unmount())
    }
  })

  it('does not dispatch from an inactive tab or navigate a different originating stack', async () => {
    const selected = ref('one'),
      registries: PageActions[] = []
    const Screen = page('Root', () => {
      registries.push(
        usePageActions([
          { id: 'detail', title: 'Detail', run: ({ router }) => router.push('/detail') },
        ]),
      )
    })
    await mount(
      [
        { path: '/', component: Screen },
        { path: '/detail', component: page('Detail') },
      ],
      {
        render: () =>
          h(
            RouterTabs,
            {
              selected: selected.value,
              'onUpdate:selected': (value: string) => {
                selected.value = value
              },
            },
            () => [
              h(RouterTab, { name: 'one', title: 'One' }, () =>
                h(RouterView, { name: 'one' }),
              ),
              h(RouterTab, { name: 'two', title: 'Two' }, () =>
                h(RouterView, { name: 'two' }),
              ),
            ],
          ),
      },
    )
    selected.value = 'two'
    await settle()
    expect(registries).toHaveLength(2)
    expect(await registries[0]!.execute('detail')).toBe(false)
    expect(await registries[1]!.execute('detail')).toBe(true)
    const frames = views.get('Frame')!.slice(-2) as any[]
    expect(frames[0].backStack).toHaveLength(0)
    expect(frames[1].backStack).toHaveLength(1)
  })
})
