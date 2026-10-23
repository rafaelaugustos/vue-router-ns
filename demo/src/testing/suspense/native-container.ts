import { GridLayout } from '@nativescript/core'
import { getViewMeta, registerElement } from 'nativescript-vue'

// App opt-in for NativeScript-Vue 3.1.2 / Vue 3.5.44. The name must be unused.
// Vue stages a pending branch here before moving it into the visible native tree.
export function registerSuspenseContainer() {
  registerElement('div', () => GridLayout, getViewMeta('GridLayout'))
}
