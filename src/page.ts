import { Frame, isIOS, type Page } from '@nativescript/core'
import {
  computed,
  defineComponent,
  getCurrentInstance,
  h,
  nextTick,
  onBeforeUnmount,
  onMounted,
  provide,
  shallowRef,
  watch,
  type PropType,
  type VNode,
} from 'nativescript-vue'
import { entryKey, routeKey, routerKey } from './injection.js'
import { holdBackButton, zoomFrom } from './ios.js'
import { isBlocked, type Entry } from './stack.js'
import { connectPageEffects } from './page-effects.js'
import { layoutIssues, walkLayoutTree } from './layouts.js'

interface PageLink {
  link(page: Page, entry: Entry): void
  unlink(page: Page): void
  reload?(entry: Entry, state: 'requested' | 'deferred' | 'applied'): void
}

/**
 * Every navigated page is mounted as its own app by NativeScript-Vue, so
 * nothing provided by `<RouterView>` reaches it. This wrapper hands each page
 * its own route and a router bound to the stack it lives in.
 */
export function createPage(entry: Entry, { link, unlink, reload }: PageLink) {
  return defineComponent({
    name: 'RouterPage',
    inheritAttrs: false,
    setup() {
      provide(routerKey, entry.stack.router)
      provide(routeKey, entry.route)
      provide(entryKey, entry)

      const instance = getCurrentInstance()!
      const blocked = computed(() => isBlocked(entry))
      let page: Page | null = null
      let stopReload: (() => void) | undefined
      let stopEffects: (() => void) | undefined
      const diagnose = () => {
        if (!__DEV__ || !entry.layout) return
        const issues = layoutIssues(instance.subTree, entry.component)
        for (const issue of issues)
          console.warn(
            `[vue-router-ns] Layout "${entry.layout.name}" for "${entry.route.fullPath}": ${issue}`,
          )
      }

      // A layout and its destination share one native Page and reload boundary.
      const reloadPage = () => {
        reload?.(entry, 'requested')
        const context = instance.appContext as { reload?: () => void }
        const frame = page?.frame
        if (!frame || frame.currentPage === page) {
          reload?.(entry, 'applied')
          context.reload?.()
          return
        }
        if (stopReload) return
        reload?.(entry, 'deferred')
        // Android's Page.navigatedTo precedes completion of the Frame
        // navigation. Replacing there can dispose the newly mounted app.
        const returned = () => {
          if (frame.currentPage !== page) return
          stopReload?.()
          stopReload = undefined
          void nextTick(() => {
            if (!entry.disposed) {
              reload?.(entry, 'applied')
              context.reload?.()
            }
          })
        }
        frame.on(Frame.navigatedToEvent, returned)
        stopReload = () => frame.off(Frame.navigatedToEvent, returned)
      }
      const refreshLayout = () => {
        if (__DEV__) {
          const install = (vnode: VNode) => {
            if (vnode.type !== entry.component && vnode.type !== entry.layout?.component)
              return
            const child = vnode.component as { ceReload?: () => void } | null
            if (child && !child.ceReload) child.ceReload = reloadPage
          }
          if (entry.layout) walkLayoutTree(instance.subTree, install)
          else install(instance.subTree)
        }
        diagnose()
      }

      onMounted(() => {
        // Route/layout script HMR uses NativeScript-Vue's Page replacement,
        // deferred until this entry is current and Frame navigation has settled.
        refreshLayout()
        // HMR remounts the page with a fresh native view; relinking keeps the entry
        page = instance.proxy!.$el?.nativeView ?? null
        if (!page) return
        link(page, entry)
        stopEffects = connectPageEffects(entry, page)
        // mounting comes before the frame navigates, so the zoom is in place for the push
        if (entry.zoomFrom) zoomFrom(page, entry.zoomFrom, () => !isBlocked(entry))

        // a swipe can't wait for an async guard, so it is disabled while one is active,
        // and the back button goes through the router instead of popping on its own
        watch(
          blocked,
          (value) => {
            page!.enableSwipeBackNavigation = !value
            if (isIOS) {
              holdBackButton(page!, value ? () => void entry.stack.router.back() : null)
            }
          },
          { immediate: true },
        )

        if (entry.stack.modal) {
          watch(
            () => entry.isActive() && blocked.value,
            (value) => entry.stack.host?.holdDismissal?.(value),
            { immediate: true },
          )
        }
      })

      onBeforeUnmount(() => {
        stopEffects?.()
        stopReload?.()
        if (page) unlink(page)
      })

      return () =>
        entry.layout
          ? h(
              entry.layout.component,
              { onVnodeMounted: refreshLayout, onVnodeUpdated: refreshLayout },
              {
                default: () =>
                  h(entry.component, {
                    ...entry.props,
                    onVnodeMounted: refreshLayout,
                    onVnodeUpdated: refreshLayout,
                  }),
              },
            )
          : h(entry.component, entry.props)
    },
  })
}

/** Root of a modal route: a frame, so the modal gets an ActionBar and its own stack. */
export const ModalHost = defineComponent({
  name: 'RouterModal',
  props: {
    onReady: {
      type: Function as PropType<(frame: Frame) => void>,
      required: true,
    },
  },
  setup(props) {
    const frame = shallowRef<{ nativeView: Frame }>()
    onMounted(() => props.onReady(frame.value!.nativeView))
    return () => h('Frame', { ref: frame })
  },
})
