import type { Page, View } from '@nativescript/core'
import { inject, onUnmounted, toValue, type MaybeRefOrGetter } from 'nativescript-vue'
import { entryKey } from './injection.js'
import { pageEffect, pageVisible, watchPageVisibility } from './page-effects.js'
import { dismissPageSearch } from './search.js'
import type { RegisteredRouter } from './typed.js'
import { bindCommands, type NativeCommandsHost } from './commands-native.js'

export type KeyModifier = 'meta' | 'ctrl' | 'alt' | 'shift'
export interface NavigationShortcut {
  input: string
  modifiers?: readonly KeyModifier[]
}
export interface NavigationCommand {
  id: string
  title: MaybeRefOrGetter<string>
  shortcut: NavigationShortcut
  action: 'back' | 'closeModal' | ((router: RegisteredRouter) => unknown)
  enabled?: MaybeRefOrGetter<boolean>
  /** Reserved editing shortcuts and IME composition are always left to the OS. */
  allowInTextInput?: boolean
}
export interface NavigationCommandState {
  readonly id: string
  readonly title: string
  readonly shortcut: NavigationShortcut
  readonly enabled: boolean
}
export interface NavigationCommands {
  list(): readonly NavigationCommandState[]
  execute(id: string): Promise<boolean>
  /** Focus this pane's command responder without taking focus from a text editor. */
  focus(): boolean
  /** @internal */
  [COMMAND_HOST](view: View): () => void
}
export const COMMAND_HOST = Symbol('navigation command host')

/** True for standard editing bindings, which must never become router commands. */
export function reservedShortcut(shortcut: NavigationShortcut): boolean {
  const modifiers = shortcut.modifiers ?? []
  return (
    modifiers.some((key) => key === 'meta' || key === 'ctrl') &&
    ['a', 'c', 'v', 'x', 'z', 'y'].includes(shortcut.input.toLowerCase())
  )
}

/** Register commands in page setup; render NavigationCommandScope around its content. */
export function useNavigationCommands(
  source: MaybeRefOrGetter<readonly NavigationCommand[]>,
): NavigationCommands {
  const entry = inject(entryKey, null)
  if (!entry) throw new Error('useNavigationCommands() must be used inside a routed page')
  let page: Page | undefined
  let host: View | undefined
  let native: NativeCommandsHost | undefined
  let busy = false
  const commands = () => {
    const result = toValue(source)
    const ids = new Set<string>()
    const keys = new Set<string>()
    for (const command of result) {
      const key = `${[...(command.shortcut.modifiers ?? [])].sort()}:${command.shortcut.input.toLowerCase()}`
      if (!command.id || ids.has(command.id) || keys.has(key))
        throw new Error('Navigation commands need unique ids and shortcuts per scope')
      if (reservedShortcut(command.shortcut))
        throw new Error(`Editing shortcut cannot be a navigation command: ${command.id}`)
      if (command.shortcut.input.length === 1 && !command.shortcut.modifiers?.length)
        throw new Error('Printable navigation shortcuts need a modifier')
      ids.add(command.id)
      keys.add(key)
    }
    return result
  }
  const enabled = (command: NavigationCommand) => {
    if (!page || !pageVisible(entry, page) || busy || entry.stack.pending) return false
    if (command.enabled !== undefined && !toValue(command.enabled)) return false
    if (command.action === 'back')
      return (
        entry.stack.entries.value.length > 1 ||
        (!!entry.stack.modal && entry.stack.modal.cancelable !== false)
      )
    if (command.action === 'closeModal')
      return !!entry.stack.modal && entry.stack.modal.cancelable !== false
    return true
  }
  const attach = () => {
    native?.dispose()
    native =
      page && host && pageVisible(entry, page)
        ? bindCommands(host, {
            list: (editing) =>
              commands()
                .filter(
                  (command) => enabled(command) && (!editing || command.allowInTextInput),
                )
                .map((command) => ({
                  id: command.id,
                  title: toValue(command.title),
                  shortcut: command.shortcut,
                })),
            dispatch: (id) => {
              void api.execute(id).catch((error) => {
                if (__DEV__)
                  console.error('[vue-router-ns] Navigation command failed:', error)
              })
            },
            escape: () => !!page && dismissPageSearch(page),
          })
        : undefined
  }
  const api: NavigationCommands = {
    list: () =>
      commands().map((command) => ({
        id: command.id,
        title: toValue(command.title),
        shortcut: command.shortcut,
        enabled: enabled(command),
      })),
    async execute(id) {
      const command = commands().find((command) => command.id === id)
      if (!command || !enabled(command)) return false
      busy = true
      try {
        const router = entry.stack.router as RegisteredRouter
        if (command.action === 'back') await router.back()
        else if (command.action === 'closeModal')
          await router.go(-entry.stack.entries.value.length)
        else await command.action(router)
        return true
      } finally {
        busy = false
      }
    },
    focus: () => native?.focus() ?? false,
    [COMMAND_HOST](view) {
      if (host)
        throw new Error('A command registry may have only one NavigationCommandScope')
      host = view
      attach()
      return () => {
        native?.dispose()
        native = undefined
        host = undefined
      }
    },
  }
  commands()
  const unregister = pageEffect(entry, (view) => {
    page = view
    attach()
    const stop = watchPageVisibility(entry, view, (visible) => {
      attach()
      if (visible && entry.stack.entries.value.at(-1) === entry) native?.focus()
    })
    return () => {
      stop()
      native?.dispose()
      native = undefined
      page = undefined
    }
  })
  onUnmounted(unregister)
  return api
}
