import type { EventData, View } from '@nativescript/core'
import { cloneVNode, defineComponent, type PropType } from 'nativescript-vue'
import { useRouter } from '../composables.js'
import {
  attachRouteMenu,
  detachRouteMenu,
  type RouteMenuOptions,
} from '../context-menu.js'
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
    withParents: Boolean,
    /** iOS 18 and later: the page grows out of the link's child. */
    zoom: Boolean,
    transition: [String, Object] as PropType<TransitionOption>,
    frame: String,
    /** A long press previews the route and offers actions; see the context menus guide. */
    menu: Object as PropType<RouteMenuOptions>,
  },
  setup(props, { slots }) {
    const router = useRouter()

    const navigate = (args?: EventData) => {
      const options: NavigationOptions = {
        transition: props.transition,
        clearHistory: props.clearHistory,
        withParents: props.withParents,
        frame: props.frame,
        zoomFrom: props.zoom ? (args?.object as View | undefined) : undefined,
      }
      return props.replace
        ? router.replace(props.to, options)
        : router.push(props.to, options)
    }

    const attach = (args: EventData) => {
      if (!props.menu) return
      attachRouteMenu(
        args.object as View,
        {
          ...props.menu,
          to: props.to,
          replace: props.replace,
          clearHistory: props.clearHistory,
          withParents: props.withParents,
          frame: props.frame,
          transition: props.transition,
          zoom: props.zoom,
        },
        router as never,
      )
    }
    const detach = (args: EventData) => detachRouteMenu(args.object as View)

    return () => {
      const children = slots.default?.({ navigate }) ?? []
      if (children.length !== 1) {
        if (__DEV__) {
          console.warn('[vue-router-ns] <RouterLink> expects exactly one child')
        }
        return children
      }
      return cloneVNode(
        children[0]!,
        props.menu
          ? { onTap: navigate, onLoaded: attach, onUnloaded: detach }
          : { onTap: navigate },
      )
    }
  },
})
