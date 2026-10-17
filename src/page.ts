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
} from 'nativescript-vue'
import { entryKey, routeKey, routerKey } from './injection.js'
import { holdBackButton, zoomFrom } from './ios.js'
import { isBlocked, type Entry } from './stack.js'
import { connectPageEffects } from './page-effects.js'

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

      onMounted(() => {
        // Vue sees the routed SFC as a child of RouterPage. Its normal HMR
        // reload would patch this wrapper, bypassing NativeScript-Vue's
        // native Page replacement (and its deferral for covered pages).
        // Use Vue's per-instance HMR hook to reach the native app reload.
        if (__DEV__) {
          const child = instance.subTree.component as { ceReload?: () => void } | null
          if (child && !child.ceReload) {
            child.ceReload = () => {
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
          }
        }
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

      return () => h(entry.component, entry.props)
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
