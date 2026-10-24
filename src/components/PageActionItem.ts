import { unsetValue } from '@nativescript/core'
import { defineComponent, h, inject, type PropType } from 'nativescript-vue'
import { entryKey } from '../injection.js'
import { ACTION_OWNER } from '../action-owner.js'
import type { PageActions } from '../page-actions.js'

/** NativeScript still owns the ActionItem and ActionBar; Button supplies enabled state. */
export const PageActionItem = defineComponent({
  name: 'PageActionItem',
  inheritAttrs: false,
  props: {
    actions: { type: Object as PropType<PageActions>, required: true },
    action: { type: String, required: true },
    buttonClass: String,
  },
  setup(props, { attrs }) {
    const entry = inject(entryKey, null)
    return () => {
      if (!entry || props.actions[ACTION_OWNER].entry !== entry)
        throw new Error('PageActionItem must use actions owned by its routed page')
      const state = props.actions.get(props.action)
      return h(
        'ActionItem',
        {
          ...attrs,
          visibility: state?.visible ? 'visible' : 'collapsed',
          onTap: () => {
            void props.actions.dispatch(props.action)
          },
        },
        [
          h('Button', {
            text: state?.title ?? '',
            isEnabled: state?.enabled ?? false,
            accessible: true,
            accessibilityLabel: state?.title ?? '',
            accessibilityRole: 'button',
            accessibilityState: state?.enabled ? unsetValue : 'disabled',
            class: props.buttonClass,
            color: state?.destructive ? '#c62828' : unsetValue,
            backgroundColor: 'transparent',
            borderWidth: 0,
            minHeight: 44,
            padding: '0 12',
            onTap: () => {
              void props.actions.dispatch(props.action)
            },
          }),
        ],
      )
    }
  },
})
