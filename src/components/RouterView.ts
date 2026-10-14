import type { Frame } from '@nativescript/core'
import {
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  type PropType,
} from 'nativescript-vue'
import { useRouter } from '../composables.js'
import { INTERNAL, type RouterInternals } from '../internal.js'
import { onTabReselect, tabOf } from '../tabs.js'
import type { RouteLocationRaw } from '../types.js'

/**
 * A native `Frame` whose back stack the router drives. Use one per
 * independent stack, e.g. one per tab.
 */
export const RouterView = defineComponent({
  name: 'RouterView',
  props: {
    /** Pass it as `frame` in navigation options to target this view. */
    name: { type: String, default: 'default' },
    /** First page of the stack. */
    initial: { type: [String, Object] as PropType<RouteLocationRaw>, default: '/' },
    /** Inside a `<TabViewItem>`: tapping its tab while selected goes back to the first page. */
    backToRootOnReselect: Boolean,
  },
  setup(props) {
    const router = useRouter()
    const internals = (router as unknown as { [INTERNAL]: RouterInternals })[INTERNAL]
    const frame = shallowRef<{ nativeView: Frame }>()
    // the name is read once: renaming a live stack would orphan its pages
    const name = props.name
    let stopReselect: (() => void) | undefined

    onMounted(() => {
      const view = frame.value!.nativeView
      internals.mount(name, view, props.initial)

      if (props.backToRootOnReselect) {
        const tab = tabOf(view)
        if (tab) {
          stopReselect = onTabReselect(tab.tabView, tab.index, () => {
            router.backToRoot({ frame: name }).catch(() => {})
          })
        } else if (__DEV__) {
          console.warn(
            `[vue-router-ns] <RouterView name="${name}"> has backToRootOnReselect but isn't inside a <TabViewItem>`,
          )
        }
      }
    })
    onBeforeUnmount(() => {
      stopReselect?.()
      internals.unmount(name)
    })

    return () => h('Frame', { ref: frame })
  },
})
