import type { Frame, View } from '@nativescript/core'
import {
  computed,
  defineComponent,
  h,
  inject,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  watch,
  type PropType,
} from 'nativescript-vue'
import { useRouter } from '../composables.js'
import { tabKey } from '../injection.js'
import { createSplitFrameHost } from '../hosts/split.js'
import { INTERNAL, type RouterInternals } from '../internal.js'
import { onTabReselect, tabOf } from '../tabs.js'
import {
  observeWindowFolds,
  observeSplitViewport,
  splitGeometry,
  splitViewport,
  type WindowFold,
} from '../folding.js'
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
    /** Use optional AndroidX WindowManager geometry from the owning Activity. */
    foldAware: { type: Boolean, default: true },
    backToRootOnReselect: Boolean,
  },
  setup(props, { slots }) {
    const router = useRouter()
    const tab = inject(tabKey, null)
    const internals = (router as unknown as { [INTERNAL]: RouterInternals })[INTERNAL]
    const layout = shallowRef<{ nativeView: View }>()
    const list = shallowRef<{ nativeView: Frame }>()
    const detail = shallowRef<{ nativeView: Frame }>()
    const viewport = shallowRef({ x: 0, y: 0, width: 0, height: 0, rtl: false })
    const folds = shallowRef<readonly WindowFold[]>([])
    const geometry = computed(() =>
      splitGeometry(
        viewport.value,
        props.foldAware ? folds.value : [],
        props.breakpoint,
        props.listWidth,
      ),
    )
    const expanded = computed(() => geometry.value.expanded)
    const detailVisible = shallowRef(false)
    const name = props.name
    let stopViewport: (() => void) | undefined
    let stopFolds: (() => void) | undefined
    let stopWatch: (() => void) | undefined
    let stopReselect: (() => void) | undefined
    const measure = () => {
      const view = layout.value?.nativeView
      if (view) {
        const next = splitViewport(view)
        if (JSON.stringify(next) !== JSON.stringify(viewport.value)) viewport.value = next
      }
    }

    onMounted(() => {
      measure()
      stopViewport = observeSplitViewport(layout.value!.nativeView, measure)
      stopWatch = watch(
        () => props.foldAware,
        (enabled) => {
          stopFolds?.()
          stopFolds = enabled
            ? observeWindowFolds(layout.value!.nativeView, (next) => {
                folds.value = next
                measure()
              })
            : undefined
        },
        { immediate: true },
      )
      internals.mount(
        name,
        createSplitFrameHost(list.value!.nativeView, detail.value!.nativeView, {
          expanded,
          detailVisible,
        }),
        props.list,
        tab?.reveal,
        tab?.selected,
        tab?.present,
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
      stopViewport?.()
      stopWatch?.()
      stopFolds?.()
      stopReselect?.()
      internals.unmount(name)
    })

    return () =>
      h(
        'GridLayout',
        {
          ref: layout,
          columns: geometry.value.columns,
          rows: geometry.value.rows,
          onLayoutChanged: measure,
        },
        [
          h('Frame', {
            ref: list,
            col: geometry.value.listColumn,
            row: geometry.value.listRow,
            isUserInteractionEnabled: expanded.value || !detailVisible.value,
            accessibilityHidden: !expanded.value && detailVisible.value,
          }),
          h(
            'GridLayout',
            {
              col: geometry.value.detailColumn,
              row: geometry.value.detailRow,
              visibility: expanded.value && !detailVisible.value ? 'visible' : 'collapse',
            },
            slots.empty?.(),
          ),
          h('Frame', {
            ref: detail,
            col: geometry.value.detailColumn,
            row: geometry.value.detailRow,
            backgroundColor: 'transparent',
            opacity: detailVisible.value ? 1 : 0,
            isUserInteractionEnabled: detailVisible.value,
            accessibilityHidden: !detailVisible.value,
          }),
        ],
      )
  },
})
