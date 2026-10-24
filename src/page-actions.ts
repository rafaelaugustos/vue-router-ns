import type { Page, View } from '@nativescript/core'
import {
  computed,
  inject,
  onUnmounted,
  shallowRef,
  toValue,
  type MaybeRefOrGetter,
  type Ref,
} from 'nativescript-vue'
import { entryKey } from './injection.js'
import { pageEffect, pageVisible, watchPageVisibility } from './page-effects.js'
import { commandFocusOrigin } from './accessibility.js'
import { ACTION_OWNER, type ActionOwner } from './action-owner.js'
import type { RegisteredRouter } from './typed.js'
import type { RouteMenuAction } from './context-menu.js'

export interface PageActionContext {
  /** The existing router bound to the originating stack. */
  readonly router: RegisteredRouter
  /** Aborted on page/host disposal or HMR replacement, not ordinary coverage. */
  readonly signal: AbortSignal
}
export interface PageAction {
  id: string
  title: MaybeRefOrGetter<string>
  busyTitle?: MaybeRefOrGetter<string>
  enabled?: MaybeRefOrGetter<boolean>
  visible?: MaybeRefOrGetter<boolean>
  /** SF Symbol for the iOS context menu only. No automatic Android icon mapping. */
  image?: MaybeRefOrGetter<string | undefined>
  destructive?: MaybeRefOrGetter<boolean>
  run(context: PageActionContext): unknown
}
export interface PageActionState {
  readonly id: string
  readonly title: string
  readonly enabled: boolean
  readonly visible: boolean
  readonly busy: boolean
  readonly image: string | undefined
  readonly destructive: boolean
}
export interface PageActionsOptions {
  /** Native dispatch errors are delivered here, or logged in all builds if absent. */
  onError?: (error: unknown, id: string) => void
}
export interface PageActions<Id extends string = string> extends ActionOwner {
  readonly busy: Readonly<Ref<Id | undefined>>
  get(id: Id): PageActionState | undefined
  list(): readonly PageActionState[]
  /** True when the callback fulfills; false if unavailable or it acknowledges disposal with AbortError. */
  execute(id: Id): Promise<boolean>
  /** Event adapter: reports failures through onError and resolves false. */
  dispatch(id: Id): Promise<boolean>
  /** Menu bindings read live state when opened and recheck it before dispatch. */
  menu(ids?: readonly Id[]): RouteMenuAction[]
}

/** One serial action owner per call, scoped to the routed Page's lifetime. */
export function usePageActions<const T extends readonly PageAction[]>(
  source: MaybeRefOrGetter<T>,
  options: PageActionsOptions = {},
): PageActions<T[number]['id']> {
  type Id = T[number]['id']
  const entry = inject(entryKey, null)
  if (!entry) throw new Error('usePageActions() must be used inside a routed page')
  const page = shallowRef<Page>()
  const visible = shallowRef(false)
  const disposed = shallowRef(false)
  const running = shallowRef<{ id: Id; controller: AbortController }>()
  const definitions = () => {
    const actions = toValue(source)
    const ids = new Set<string>()
    for (const action of actions) {
      if (!action.id || ids.has(action.id))
        throw new Error('Page actions need unique non-empty ids per registry')
      ids.add(action.id)
    }
    return actions
  }
  const available = () =>
    !disposed.value && !!page.value && visible.value && pageVisible(entry, page.value)
  const state = (action: PageAction): PageActionState => {
    const busy = running.value?.id === action.id
    const shown = action.visible === undefined || toValue(action.visible)
    return {
      id: action.id,
      title: toValue(
        busy && action.busyTitle !== undefined ? action.busyTitle : action.title,
      ),
      enabled:
        shown &&
        available() &&
        !running.value &&
        !entry.stack.pending &&
        (action.enabled === undefined || toValue(action.enabled)),
      visible: shown,
      busy,
      image: action.image === undefined ? undefined : toValue(action.image),
      destructive: action.destructive === undefined ? false : toValue(action.destructive),
    }
  }
  const owner: ActionOwner[typeof ACTION_OWNER] = {
    entry,
    accepts(view: View) {
      if (!available()) return false
      for (
        let current: View | null = view;
        current;
        current = current.parent as View | null
      )
        if (current === page.value) return true
      return false
    },
  }
  const api: PageActions<Id> = {
    [ACTION_OWNER]: owner,
    busy: computed(() => running.value?.id),
    get(id) {
      const action = definitions().find((action) => action.id === id)
      return action && state(action)
    },
    list: () => definitions().map(state),
    async execute(id) {
      const action = definitions().find((action) => action.id === id)
      if (!action || !state(action).enabled) return false
      const attempt = { id, controller: new AbortController() }
      running.value = attempt
      const stopOrigin = commandFocusOrigin(entry)
      try {
        await action.run({
          router: entry.stack.router as RegisteredRouter,
          signal: attempt.controller.signal,
        })
        return true
      } catch (error) {
        if (
          attempt.controller.signal.aborted &&
          (error as { name?: string })?.name === 'AbortError'
        )
          return false
        throw error
      } finally {
        stopOrigin()
        if (running.value === attempt) running.value = undefined
      }
    },
    async dispatch(id) {
      try {
        return await api.execute(id)
      } catch (error) {
        if (options.onError) {
          try {
            options.onError(error, id)
          } catch (reportError) {
            console.error(
              '[vue-router-ns] Page action error handler failed:',
              reportError,
              'Original action error:',
              error,
            )
          }
        } else console.error(`[vue-router-ns] Page action ${id} failed:`, error)
        return false
      }
    },
    menu(ids = definitions().map((action) => action.id as Id)) {
      return ids.map((id): RouteMenuAction & ActionOwner => ({
        [ACTION_OWNER]: owner,
        get title() {
          return api.get(id)?.title ?? id
        },
        get enabled() {
          return api.get(id)?.enabled ?? false
        },
        get visible() {
          return api.get(id)?.visible ?? false
        },
        get image() {
          return api.get(id)?.image
        },
        get destructive() {
          return api.get(id)?.destructive ?? false
        },
        run: () => api.dispatch(id),
      }))
    },
  }
  const cancel = () => {
    running.value?.controller.abort()
    running.value = undefined
  }
  definitions()
  const unregister = pageEffect(entry, (view) => {
    page.value = view
    const stop = watchPageVisibility(entry, view, (value) => {
      visible.value = value
    })
    return () => {
      stop()
      visible.value = false
      page.value = undefined
      cancel()
    }
  })
  onUnmounted(() => {
    disposed.value = true
    cancel()
    unregister()
  })
  return api
}
