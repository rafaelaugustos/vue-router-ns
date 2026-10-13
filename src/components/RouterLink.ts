import { cloneVNode, defineComponent, type PropType } from 'nativescript-vue'
import { useRouter } from '../composables.js'
import type { NavigationOptions, RouteLocationRaw, TransitionOption } from '../types.js'

/**
 * Makes its only child navigate on tap, without adding a view to the tree:
 *
 * ```vue
 * <RouterLink to="/settings">
 *   <Button text="Settings" />
 * </RouterLink>
 * ```
 */
export const RouterLink = defineComponent({
  name: 'RouterLink',
  props: {
    to: { type: [String, Object] as PropType<RouteLocationRaw>, required: true },
    replace: Boolean,
    clearHistory: Boolean,
    transition: [String, Object] as PropType<TransitionOption>,
    frame: String,
  },
  setup(props, { slots }) {
    const router = useRouter()

    const navigate = () => {
      const options: NavigationOptions = {
        transition: props.transition,
        clearHistory: props.clearHistory,
        frame: props.frame,
      }
      return props.replace
        ? router.replace(props.to, options)
        : router.push(props.to, options)
    }

    return () => {
      const children = slots.default?.({ navigate }) ?? []
      if (children.length !== 1) {
        if (__DEV__) {
          console.warn('[vue-router-ns] <RouterLink> expects exactly one child')
        }
        return children
      }
      return cloneVNode(children[0]!, { onTap: navigate })
    }
  },
})
