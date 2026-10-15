import type { Frame, View } from '@nativescript/core'
import {
  computed,
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

/** One logical stack, with a persistent list pane and a native detail stack. */
export const RouterSplitView = defineComponent({
  name: 'RouterSplitView',
  props: {
    name: { type: String, default: 'default' },
    list: { type: [String, Object] as PropType<RouteLocationRaw>, required: true },
    /** Available width, in device-independent pixels, required for two panes. */
    breakpoint: { type: Number, default: 840 },
    listWidth: { type: Number, default: 320 },
    backToRootOnReselect: Boolean,
  },
  setup(props, { slots }) {
    const router = useRouter()
    const internals = (router as unknown as { [INTERNAL]: RouterInternals })[INTERNAL]
    const layout = shallowRef<{ nativeView: View }>()
    const list = shallowRef<{ nativeView: Frame }>()
    const detail = shallowRef<{ nativeView: Frame }>()
    const width = shallowRef(0)
    const expanded = computed(() => width.value >= props.breakpoint)
    const detailVisible = shallowRef(false)
    const name = props.name
    let stopReselect: (() => void) | undefined
    const measure = () => {
      width.value = layout.value?.nativeView.getActualSize().width ?? 0
    }

    onMounted(() => {
      measure()
      internals.mountSplit(
        name,
        list.value!.nativeView,
        detail.value!.nativeView,
        props.list,
        expanded,
        detailVisible,
      )
      if (props.backToRootOnReselect) {
        const tab = tabOf(list.value!.nativeView)
        if (tab)
          stopReselect = onTabReselect(tab.tabView, tab.index, () => {
            router.backToRoot({ frame: name }).catch(() => {})
          })
      }
    })
    onBeforeUnmount(() => {
      stopReselect?.()
      internals.unmount(name)
    })

    return () =>
      h(
        'GridLayout',
        {
          ref: layout,
          columns: expanded.value
            ? `${Math.min(props.listWidth, width.value / 2)}, *`
            : '*',
          onLayoutChanged: measure,
        },
        [
          h('Frame', {
            ref: list,
            col: 0,
            isUserInteractionEnabled: expanded.value || !detailVisible.value,
            accessibilityHidden: !expanded.value && detailVisible.value,
          }),
          h(
            'GridLayout',
            {
              col: expanded.value ? 1 : 0,
              visibility: expanded.value && !detailVisible.value ? 'visible' : 'collapse',
            },
            slots.empty?.(),
          ),
          h('Frame', {
            ref: detail,
            col: expanded.value ? 1 : 0,
            backgroundColor: 'transparent',
            opacity: detailVisible.value ? 1 : 0,
            isUserInteractionEnabled: detailVisible.value,
            accessibilityHidden: !detailVisible.value,
          }),
        ],
      )
  },
})
