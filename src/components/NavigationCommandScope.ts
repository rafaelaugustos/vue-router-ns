import {
  defineComponent,
  h,
  onMounted,
  onBeforeUnmount,
  registerElement,
  shallowRef,
  type PropType,
} from 'nativescript-vue'
import type { View } from '@nativescript/core'
import { COMMAND_HOST, type NavigationCommands } from '../commands.js'
import { CommandLayout } from '../commands-native.js'

let registered = false
/** Render inside Page around the content whose responder chain owns the commands. */
export const NavigationCommandScope = defineComponent({
  name: 'NavigationCommandScope',
  inheritAttrs: false,
  props: { commands: { type: Object as PropType<NavigationCommands>, required: true } },
  setup(props, { slots, attrs }) {
    if (!registered) {
      registerElement('RouterCommandHost', () => CommandLayout)
      registered = true
    }
    const host = shallowRef<{ nativeView: View }>()
    let stop: (() => void) | undefined
    onMounted(() => {
      stop = props.commands[COMMAND_HOST](host.value!.nativeView)
    })
    onBeforeUnmount(() => stop?.())
    return () =>
      h(
        'RouterCommandHost',
        { ...attrs, ref: host, onTap: () => props.commands.focus() },
        slots.default?.(),
      )
  },
})
