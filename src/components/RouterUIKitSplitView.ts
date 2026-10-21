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
import { createUIKitSplitHost } from '../hosts/uikit-split.js'
import type { UIKitSplitView } from '../uikit-split.js'
import type { RouteLocationRaw } from '../types.js'

/** Opt-in, window-root UIKit double-column navigation. iOS/Core SplitView only. */
export const RouterUIKitSplitView = defineComponent({
  name: 'RouterUIKitSplitView',
  props: {
    name: { type: String, default: 'default' },
    list: { type: [String, Object] as PropType<RouteLocationRaw>, required: true },
    primaryWidthFraction: { type: Number, default: 0.32 },
  },
  setup(props) {
    const router = useRouter()
    const internals = (router as unknown as { [INTERNAL]: RouterInternals })[INTERNAL]
    const container = shallowRef<{ nativeView: UIKitSplitView }>()
    const list = shallowRef<{ nativeView: Frame }>()
    const detail = shallowRef<{ nativeView: Frame }>()
    const name = props.name
    onMounted(() => {
      const view = container.value!.nativeView
      const primary = list.value!.nativeView
      const secondary = detail.value!.nativeView
      internals.mount(name, createUIKitSplitHost(view, primary, secondary), props.list)
    })
    onBeforeUnmount(() => {
      internals.unmount(name)
    })
    return () =>
      h(
        'RouterUIKitSplitHost',
        {
          ref: container,
          displayMode: 'oneBesideSecondary',
          splitBehavior: 'tile',
          preferredPrimaryColumnWidthFraction: props.primaryWidthFraction,
        },
        [
          h('Frame', { ref: list, splitRole: 'primary' }),
          h('Frame', { ref: detail, splitRole: 'secondary' }),
        ],
      )
  },
})
