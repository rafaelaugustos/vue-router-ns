import { describe, expect, it, vi, afterEach } from 'vitest'
import { ref } from 'nativescript-vue'
import {
  useNavigationCommands,
  onBeforeRouteLeave,
  type NavigationCommands,
} from '../src/index.js'
import { bindCommands, CommandLayout } from '../src/commands-native.js'
import { mount, page } from './helpers.js'
import { setPlatform } from './shims/core.js'

afterEach(() => vi.unstubAllGlobals())

describe('native navigation commands', () => {
  it('exposes the exact Objective-C action selector and returns native arrays for UIKit discovery', () => {
    setPlatform('ios')
    let methods: any, metadata: any
    vi.stubGlobal('interop', { types: { void: 'void', id: 'id' } })
    vi.stubGlobal('UIView', {
      extend: (members: any, options: any) => {
        methods = members
        metadata = options
        return { new: () => ({}) }
      },
    })
    new CommandLayout().createNativeView()
    expect(methods['routerCommand:']).toBeTypeOf('function')
    expect(metadata.exposedMethods['routerCommand:'].params).toEqual(['id'])
    vi.stubGlobal('UIKeyCommand', {
      commandWithTitleImageActionInputModifierFlagsPropertyList: (...args: any[]) => ({
        action: args[2],
        propertyList: args[5],
      }),
    })
    vi.stubGlobal('NSMutableArray', {
      new: () => {
        const value = {
          items: [] as any[],
          addObject(item: any) {
            this.items.push(item)
          },
        }
        return value
      },
    })
    const native: any = {
      window: { subviews: { count: 0 } },
      becomeFirstResponder: () => true,
    }
    const dispatch = vi.fn()
    const binding = bindCommands({ nativeViewProtected: native } as any, {
      list: () => [
        { id: 'open', title: 'Open', shortcut: { input: 'o', modifiers: ['meta'] } },
      ],
      dispatch,
      escape: () => false,
    })
    const keys = native.routerKeys()
    expect(Array.isArray(keys)).toBe(false)
    expect(keys.items[0].action).toBe('routerCommand:')
    native.routerDispatch('open')
    expect(dispatch).toHaveBeenCalledWith('open')
    binding.dispose()
    expect(native.routerKeys).toBeNull()
  })
  it('computes back availability, runs guards and disables repeat dispatch while awaiting them', async () => {
    let commands!: NavigationCommands
    let allow!: (value: boolean) => void
    const { router, app } = await mount([
      { path: '/', component: page('Root') },
      {
        path: '/detail',
        component: page('Detail', () => {
          commands = useNavigationCommands([
            {
              id: 'back',
              title: 'Back',
              shortcut: { input: '[', modifiers: ['meta'] },
              action: 'back',
            },
          ])
          onBeforeRouteLeave(
            () =>
              new Promise<boolean>((resolve) => {
                allow = resolve
              }),
          )
        }),
      },
    ])
    await router.push('/detail')
    expect(commands.list()[0]!.enabled).toBe(true)
    const attempt = commands.execute('back')
    await vi.waitFor(() => expect(allow).toBeDefined())
    expect(commands.list()[0]!.enabled).toBe(false)
    expect(await commands.execute('back')).toBe(false)
    allow(false)
    expect(await attempt).toBe(true)
    expect(router.stack.value).toHaveLength(2)
    const again = commands.execute('back')
    await new Promise((resolve) => setTimeout(resolve, 0))
    allow(true)
    await again
    expect(router.stack.value).toHaveLength(1)
    expect(await commands.execute('back')).toBe(false)
    app.unmount()
  })

  it('routes typed app commands through the page router and honors reactive enabled/title state', async () => {
    let commands!: NavigationCommands
    const enabled = ref(false)
    const title = ref('Open detail')
    const { router, app } = await mount([
      {
        path: '/',
        component: page('Root', () => {
          commands = useNavigationCommands([
            {
              id: 'open',
              title,
              enabled,
              shortcut: { input: 'o', modifiers: ['ctrl'] },
              action: (router) => router.push('/detail'),
            },
          ])
        }),
      },
      { path: '/detail', component: page('Detail') },
    ])
    expect(await commands.execute('open')).toBe(false)
    enabled.value = true
    title.value = 'Abrir detalhe'
    expect(commands.list()[0]!.title).toBe('Abrir detalhe')
    await commands.execute('open')
    expect(router.currentRoute.value.path).toBe('/detail')
    expect(commands.list()[0]!.enabled).toBe(false)
    app.unmount()
  })

  it('closes the entire modal through guards and disables modal close outside modals', async () => {
    const registries: NavigationCommands[] = []
    const component = page('Page', () => {
      registries.push(
        useNavigationCommands([
          {
            id: 'close',
            title: 'Close',
            shortcut: { input: 'Escape' },
            action: 'closeModal',
          },
          {
            id: 'back',
            title: 'Back',
            shortcut: { input: '[', modifiers: ['meta'] },
            action: 'back',
          },
        ]),
      )
    })
    const { router, app } = await mount([
      { path: '/', component },
      { path: '/modal', component, modal: true },
      { path: '/nested', component },
    ])
    expect(registries[0]!.list().every((command) => !command.enabled)).toBe(true)
    await router.push('/modal')
    await router.push('/nested')
    expect(registries[2]!.list()[0]!.enabled).toBe(true)
    await registries[2]!.execute('close')
    expect(router.currentRoute.value.path).toBe('/')
    app.unmount()
  })

  it('rejects reserved editing shortcuts', async () => {
    const { reservedShortcut } = await import('../src/commands.js')
    for (const input of ['a', 'c', 'v', 'x', 'z', 'y'])
      expect(reservedShortcut({ input, modifiers: ['ctrl'] })).toBe(true)
    expect(reservedShortcut({ input: 'n', modifiers: ['meta'] })).toBe(false)
  })

  it('binds unhandled Android keys, preserves composition, handles Escape before actions and removes listeners', () => {
    setPlatform('android')
    let listener: any
    const remove = vi.fn()
    const focus: any = { getEditableText: () => null }
    const native = {
      getRootView: () => ({ findFocus: () => focus }),
      setFocusableInTouchMode() {},
      requestFocus: () => true,
    }
    vi.stubGlobal('android', {
      view: { inputmethod: { BaseInputConnection: { getComposingSpanStart: () => -1 } } },
    })
    vi.stubGlobal('androidx', {
      core: {
        view: {
          ViewCompat: {
            OnUnhandledKeyEventListenerCompat: function (value: any) {
              return value
            },
            addOnUnhandledKeyEventListener: (_: unknown, value: unknown) => {
              listener = value
            },
            removeOnUnhandledKeyEventListener: remove,
          },
        },
      },
    })
    const dispatch = vi.fn(),
      escape = vi.fn(() => true)
    const binding = bindCommands({ nativeViewProtected: native } as any, {
      list: (editing) =>
        editing ? [] : [{ id: 'close', title: 'Close', shortcut: { input: 'Escape' } }],
      dispatch,
      escape,
    })
    const event = (action: number) => ({
      getKeyCode: () => 111,
      getAction: () => action,
      isCanceled: () => false,
      getUnicodeChar: () => 0,
      isShiftPressed: () => false,
      isCtrlPressed: () => false,
      isAltPressed: () => false,
      isMetaPressed: () => false,
    })
    expect(listener.onUnhandledKeyEvent(native, event(0))).toBe(true)
    expect(escape).toHaveBeenCalledOnce()
    expect(dispatch).not.toHaveBeenCalled()
    expect(listener.onUnhandledKeyEvent(native, event(1))).toBe(true)
    escape.mockReturnValue(false)
    focus.getEditableText = () => ({})
    expect(listener.onUnhandledKeyEvent(native, event(0))).toBe(false)
    binding.dispose()
    expect(remove).toHaveBeenCalledWith(native, listener)
  })
})
