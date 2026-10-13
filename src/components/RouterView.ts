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
  },
  setup(props) {
    const router = useRouter() as unknown as { [INTERNAL]: RouterInternals }
    const frame = shallowRef<{ nativeView: Frame }>()
    // the name is read once: renaming a live stack would orphan its pages
    const name = props.name

    onMounted(() => router[INTERNAL].mount(name, frame.value!.nativeView, props.initial))
    onBeforeUnmount(() => router[INTERNAL].unmount(name))

    return () => h('Frame', { ref: frame })
  },
})
