import type { Frame, Page } from '@nativescript/core'
import {
  computed,
  defineComponent,
  getCurrentInstance,
  h,
  onBeforeUnmount,
  onMounted,
  provide,
  shallowRef,
  watch,
  type PropType,
} from 'nativescript-vue'
import { entryKey, routeKey, routerKey } from './injection.js'
import { isBlocked, type Entry } from './stack.js'

interface PageLink {
  link(page: Page, entry: Entry): void
  unlink(page: Page): void
}

/**
 * Every navigated page is mounted as its own app by NativeScript-Vue, so
 * nothing provided by `<RouterView>` reaches it. This wrapper hands each page
 * its own route and a router bound to the stack it lives in.
 */
export function createPage(entry: Entry, { link, unlink }: PageLink) {
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

      onMounted(() => {
        // HMR remounts the page with a fresh native view; relinking keeps the entry
        page = instance.proxy!.$el?.nativeView ?? null
        if (!page) return
        link(page, entry)

        // a swipe can't wait for an async guard, so it is disabled while one is active
        watch(blocked, (value) => (page!.enableSwipeBackNavigation = !value), {
          immediate: true,
        })

        if (entry.stack.modal) {
          watch(
            () => entry.isActive() && blocked.value,
            (value) => preventModalDismissal(entry.stack.frame, value),
            { immediate: true },
          )
        }
      })

      onBeforeUnmount(() => {
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

function preventModalDismissal(frame: Frame | null, prevent: boolean) {
  // iOS 13+ sheets close with a swipe; `modalInPresentation` turns that off
  const controller = frame?.ios?.controller
  if (controller) controller.modalInPresentation = prevent
}
