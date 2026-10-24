import { IOSHelper, isAndroid, isIOS, ListView, Utils, View } from '@nativescript/core'
import {
  createNativeView,
  watchEffect,
  type Component,
  type Directive,
} from 'nativescript-vue'
import { routerOf } from './page-router.js'
import type { Router } from './router.js'
import type { NavigationOptions, RouteLocationRaw, TransitionOption } from './types.js'
import { ACTION_OWNER, type ActionOwner } from './action-owner.js'

export interface RouteMenuAction {
  title: string
  /** An SF Symbol name on iOS. Android menus show titles only. */
  image?: string
  destructive?: boolean
  enabled?: boolean
  visible?: boolean
  /** Navigates on selection, through the guards like any push. */
  to?: RouteLocationRaw
  run?: () => unknown
}

export interface RouteMenuOptions {
  /**
   * Rendered inside UIKit's preview, in a Vue app of its own: it is not a
   * stack entry, no guard runs for it and `afterEach` does not fire. The
   * committed page mounts fresh.
   */
  preview?: Component
  props?: Record<string, unknown>
  /** Decides at long-press time whether protected content may be shown. The actions still show. */
  canPreview?: () => boolean
  /** Device-independent pixels. A missing height is measured from the content at the source's width. */
  size?: { width?: number; height?: number }
  actions?: RouteMenuAction[]
  /** Android: the item that opens the route. Defaults to "Open". */
  openTitle?: string
  /** Receives asynchronous or synchronous menu failures; otherwise logged in all builds. */
  onError?: (error: unknown) => void
}

export interface RoutePreviewOptions extends RouteMenuOptions {
  to: RouteLocationRaw
  replace?: boolean
  clearHistory?: boolean
  withParents?: boolean
  frame?: string
  transition?: TransitionOption
  /** iOS 18 and later: the committed page grows out of the source view. */
  zoom?: boolean
}

interface Menu {
  view: View
  router: Router | undefined
  options: RoutePreviewOptions
  version: number
  invalidate(): void
  dismiss?: () => void
  detach(): void
}

const menus = new WeakMap<View, Menu>()

/**
 * Gives `view` a native context menu for a route: a long press on iOS shows
 * the preview and the actions, and committing the preview navigates. Android
 * gets the actions in a popup menu. Calling it again updates the options.
 */
export function attachRouteMenu(
  view: View,
  options: RoutePreviewOptions,
  router?: Router,
): () => void {
  const existing = menus.get(view)
  if (existing) {
    existing.invalidate()
    existing.options = options
    existing.router = router ?? existing.router
    return existing.detach
  }
  const menu: Menu = {
    view,
    router,
    options,
    version: 0,
    invalidate() {
      menu.version++
      menu.dismiss?.()
    },
    detach: () => {},
  }
  menus.set(view, menu)
  view.on('unloaded', menu.invalidate)
  // a list row binds before it joins its list and page; the platform side waits for the tree
  let stop: (() => void) | undefined
  const start = () => {
    view.off('loaded', start)
    if (stop || menus.get(view) !== menu) return
    stop = isIOS ? bindIOS(menu) : isAndroid ? bindAndroid(menu) : () => {}
  }
  if (view.isLoaded) start()
  else view.on('loaded', start)
  menu.detach = () => {
    if (menus.get(view) !== menu) return
    menus.delete(view)
    menu.invalidate()
    view.off('unloaded', menu.invalidate)
    view.off('loaded', start)
    stop?.()
  }
  return menu.detach
}

function routerFor(menu: Menu): Router | undefined {
  menu.router ??= routerOf(menu.view)
  if (!menu.router && __DEV__)
    console.warn('[vue-router-ns] A route menu needs its view inside a routed page')
  return menu.router
}

export function detachRouteMenu(view: View) {
  menus.get(view)?.detach()
}

function current(menu: Menu, version: number) {
  return menus.get(menu.view) === menu && menu.version === version && menu.view.isLoaded
}

function report(menu: Menu, error: unknown) {
  if (menu.options.onError) {
    try {
      menu.options.onError(error)
    } catch (reportError) {
      console.error(
        '[vue-router-ns] Menu error handler failed:',
        reportError,
        'Original menu error:',
        error,
      )
    }
  } else console.error('[vue-router-ns] Route menu failed:', error)
}

async function open(menu: Menu, version = menu.version) {
  if (!current(menu, version)) return
  const { options, view } = menu
  const router = routerFor(menu)
  if (!router) return
  const navigation: NavigationOptions = {
    transition: options.transition,
    clearHistory: options.clearHistory,
    withParents: options.withParents,
    frame: options.frame,
    zoomFrom: options.zoom ? view : undefined,
  }
  try {
    return await (options.replace
      ? router.replace(options.to, navigation)
      : router.push(options.to, navigation))
  } catch (error) {
    report(menu, error)
  }
}

function enabled(menu: Menu, action: RouteMenuAction) {
  const owner = (action as Partial<ActionOwner>)[ACTION_OWNER]
  return (
    action.visible !== false &&
    action.enabled !== false &&
    (!owner || owner.accepts(menu.view))
  )
}

function run(menu: Menu, action: RouteMenuAction, version: number) {
  if (!current(menu, version) || !enabled(menu, action)) return
  try {
    const result = action.to
      ? routerFor(menu)?.push(action.to, { frame: menu.options.frame })
      : action.run?.()
    return Promise.resolve(result).catch((error) => report(menu, error))
  } catch (error) {
    report(menu, error)
  }
}

/** The directive form: `v-route-preview="{ to, preview, actions }"` on any view, list rows included. */
export const vRoutePreview: Directive<{ nativeView?: View }, RoutePreviewOptions> = {
  mounted: bind,
  updated(el, binding) {
    // Stable bindings can update their reactive action state without dismissing
    // the native menu. Recycled sources supply a fresh options object.
    if (binding.value !== binding.oldValue) bind(el, binding)
  },
  unmounted(el) {
    if (el?.nativeView instanceof View) detachRouteMenu(el.nativeView)
  },
}

function bind(
  el: { nativeView?: View },
  binding: { value: RoutePreviewOptions; instance: unknown },
) {
  const view = el?.nativeView
  if (!(view instanceof View)) return
  const router = (binding.instance as { $router?: Router } | null)?.$router
  attachRouteMenu(view, binding.value, router)
}

declare const NSObject: any
declare const NSMutableArray: any
declare const UIContextMenuInteraction: any
declare const UIContextMenuInteractionDelegate: unknown
declare const UIContextMenuConfiguration: any
declare const UIContextMenuInteractionCommitStyle: any
declare const UIMenu: any
declare const UIMenuElementAttributes: any
declare const UIAction: any
declare const UIImage: any
declare const CGSizeMake: any
let Delegate: any

interface Preview {
  controller: any
  dispose(): void
}

function bindIOS(menu: Menu) {
  let interaction: any
  let delegate: any
  let preview: Preview | undefined
  let stopState: (() => void) | undefined
  let configurationVersion: number | undefined
  const clearState = () => {
    stopState?.()
    stopState = undefined
  }
  menu.dismiss = () => {
    clearState()
    configurationVersion = undefined
    interaction?.dismissMenu?.()
  }

  const owner = {
    configuration() {
      clearState()
      preview?.dispose()
      preview = undefined
      const version = ++menu.version
      configurationVersion = version
      const { options } = menu
      const actions = [...(options.actions ?? [])]
      const previewable = !!options.preview && (options.canPreview?.() ?? true)
      if (!previewable && !actions.some((action) => action.visible !== false)) return null
      const previewProvider = previewable
        ? () => {
            if (!current(menu, version)) return null
            preview?.dispose()
            preview = mountPreview(menu)
            return preview?.controller ?? null
          }
        : null
      const actionProvider = actions.length
        ? () => {
            if (!current(menu, version))
              return UIMenu.menuWithTitleChildren('', NSMutableArray.new())
            clearState()
            let result: any
            let first = true
            stopState = watchEffect(
              () => {
                const children = NSMutableArray.new()
                if (current(menu, version))
                  for (const action of actions)
                    if (action.visible !== false)
                      children.addObject(toUIAction(menu, action, version))
                result = UIMenu.menuWithTitleChildren('', children)
                const updated = result
                if (!first) interaction?.updateVisibleMenuWithBlock?.(() => updated)
                first = false
              },
              { flush: 'sync' },
            )
            return result
          }
        : null
      return UIContextMenuConfiguration.configurationWithIdentifierPreviewProviderActionProvider(
        String(version),
        previewProvider,
        actionProvider,
      )
    },
    commit(animator: any, configuration?: any) {
      const version =
        configuration?.identifier == null
          ? configurationVersion
          : Number(String(configuration.identifier))
      if (version === undefined) return
      if (typeof UIContextMenuInteractionCommitStyle !== 'undefined')
        animator.preferredCommitStyle = UIContextMenuInteractionCommitStyle.Pop
      animator.addCompletion(() => void open(menu, version))
    },
    end(animator: any) {
      clearState()
      const current = preview
      preview = undefined
      if (!current) return
      if (typeof animator?.addCompletion === 'function')
        animator.addCompletion(() => current.dispose())
      else current.dispose()
    },
  }

  const attach = () => {
    const native = menu.view.ios
    if (interaction || typeof native?.addInteraction !== 'function') return
    if (
      typeof UIContextMenuInteraction === 'undefined' ||
      typeof NSObject === 'undefined'
    )
      return
    Delegate ??= NSObject.extend(
      {
        contextMenuInteractionConfigurationForMenuAtLocation(this: any) {
          return this.owner?.configuration() ?? null
        },
        contextMenuInteractionWillPerformPreviewActionForMenuWithConfigurationAnimator(
          this: any,
          _interaction: any,
          configuration: any,
          animator: any,
        ) {
          this.owner?.commit(animator, configuration)
        },
        contextMenuInteractionWillEndForConfigurationAnimator(
          this: any,
          _interaction: any,
          _configuration: any,
          animator: any,
        ) {
          this.owner?.end(animator)
        },
      },
      { protocols: [UIContextMenuInteractionDelegate] },
    )
    delegate = Delegate.new()
    delegate.owner = owner
    interaction = UIContextMenuInteraction.alloc().initWithDelegate(delegate)
    native.addInteraction(interaction)
  }

  // a recycled list row loads again with the same view and the latest options
  const release = () => {
    clearState()
    configurationVersion = undefined
    preview?.dispose()
    preview = undefined
    if (interaction) menu.view.ios?.removeInteraction?.(interaction)
    if (delegate) delegate.owner = null
    interaction = delegate = undefined
  }

  attach()
  menu.view.on('loaded', attach)
  menu.view.on('unloaded', release)
  return () => {
    menu.view.off('loaded', attach)
    menu.view.off('unloaded', release)
    release()
  }
}

function toUIAction(menu: Menu, action: RouteMenuAction, version: number) {
  const native = UIAction.actionWithTitleImageIdentifierHandler(
    action.title,
    action.image ? UIImage.systemImageNamed(action.image) : null,
    null,
    () => void run(menu, action, version),
  )
  if (action.destructive && typeof UIMenuElementAttributes !== 'undefined')
    native.attributes = UIMenuElementAttributes.Destructive
  if (!enabled(menu, action) && typeof UIMenuElementAttributes !== 'undefined')
    native.attributes |= UIMenuElementAttributes.Disabled
  return native
}

function mountPreview(menu: Menu): Preview | undefined {
  const { options } = menu
  if (!options.preview) return
  const mounted = createNativeView(options.preview, options.props)
  mounted.mount()
  const view = mounted.nativeView as View
  const controller: any = IOSHelper.UILayoutViewController.initWithOwner(
    new WeakRef(view),
  )
  view.viewController = controller
  view._setupAsRootView({})
  controller.view.addSubview(view.nativeViewProtected)
  // styles apply on load, and the measure below needs them
  view.callLoaded()
  const width =
    options.size?.width ?? (Math.round(menu.view.getActualSize().width) || 320)
  let height = options.size?.height
  if (!height) {
    const { layout } = Utils
    view.measure(
      layout.makeMeasureSpec(layout.toDevicePixels(width), layout.EXACTLY),
      layout.makeMeasureSpec(0, layout.UNSPECIFIED),
    )
    height = Math.round(layout.toDeviceIndependentPixels(view.getMeasuredHeight())) || 200
  }
  controller.preferredContentSize = CGSizeMake(width, height)
  return {
    controller,
    dispose() {
      if (view.isLoaded) view.callUnloaded()
      view._tearDownUI(true)
      mounted.unmount()
    },
  }
}

declare const android: any

function bindAndroid(menu: Menu) {
  const list = listOf(menu.view)
  if (list) return bindAndroidRow(list, menu)
  const onLongPress = () => showPopup(menu, menu.view.android)
  menu.view.on('longPress', onLongPress)
  return () => menu.view.off('longPress', onLongPress)
}

function listOf(view: View): ListView | undefined {
  for (let parent = view.parent; parent; parent = parent.parent)
    if (parent instanceof ListView) return parent
  return undefined
}

const lists = new WeakMap<ListView, { rows: Set<Menu>; stop(): void }>()

/**
 * A gesture on the row itself would make it clickable, and Android's
 * ListView then stops delivering taps for it. The list's own long click
 * finds the row's menu instead.
 */
function bindAndroidRow(list: ListView, menu: Menu) {
  let state = lists.get(list)
  if (!state) {
    const rows = new Set<Menu>()
    const install = () => {
      const native = list.android
      if (typeof native?.setOnItemLongClickListener !== 'function') return
      native.setOnItemLongClickListener(
        new android.widget.AdapterView.OnItemLongClickListener({
          onItemLongClick(_parent: unknown, item: unknown) {
            const row = [...rows].find((candidate) =>
              contains(item, candidate.view.android),
            )
            if (!row) return false
            showPopup(row, item)
            return true
          },
        }),
      )
    }
    install()
    list.on('loaded', install)
    state = {
      rows,
      stop() {
        list.off('loaded', install)
        list.android?.setOnItemLongClickListener?.(null)
      },
    }
    lists.set(list, state)
  }
  const current = state
  current.rows.add(menu)
  return () => {
    current.rows.delete(menu)
    if (current.rows.size) return
    current.stop()
    lists.delete(list)
  }
}

function contains(parent: any, child: any): boolean {
  for (let view = child; view; view = view.getParent?.()) if (view === parent) return true
  return false
}

function showPopup(menu: Menu, anchor: any) {
  if (!anchor || typeof android === 'undefined') return
  menu.dismiss?.()
  const version = ++menu.version
  const popup = new android.widget.PopupMenu(anchor.getContext(), anchor)
  const actions = [...(menu.options.actions ?? [])]
  const native = popup.getMenu()
  const stopState = watchEffect(
    () => {
      native.clear()
      native.add(0, 0, 0, menu.options.openTitle ?? 'Open')
      actions.forEach((action, index) => {
        if (action.visible === false) return
        native
          .add(0, index + 1, index + 1, action.title)
          .setEnabled(enabled(menu, action))
      })
    },
    { flush: 'sync' },
  )
  const dismiss = () => {
    stopState()
    popup.dismiss()
  }
  menu.dismiss = dismiss
  popup.setOnDismissListener(
    new android.widget.PopupMenu.OnDismissListener({
      onDismiss() {
        stopState()
        if (menu.dismiss === dismiss) menu.dismiss = undefined
      },
    }),
  )
  popup.setOnMenuItemClickListener(
    new android.widget.PopupMenu.OnMenuItemClickListener({
      onMenuItemClick(item: { getItemId(): number }) {
        const id = item.getItemId()
        if (id === 0) void open(menu, version)
        else if (actions[id - 1]) void run(menu, actions[id - 1]!, version)
        return true
      },
    }),
  )
  popup.show()
}
