import { isIOS, TabView } from '@nativescript/core'
import { getCurrentInstance } from 'nativescript-vue'
import { useNavigationCommands } from 'vue-router-ns'

/** Each page/window installs its own opt-in shortcuts. */
export function useDemoCommands() {
  const instance = getCurrentInstance()!
  const modifier = isIOS ? 'meta' : 'ctrl'
  const selectTab = (offset: number) => {
    const view = instance.proxy!.$el?.nativeView
    const root = view?.getNativeWindow?.()?.rootView
    if (root instanceof TabView) {
      const count = root.items?.length ?? 0
      if (count) root.selectedIndex = (root.selectedIndex + offset + count) % count
    }
  }
  return useNavigationCommands([
    {
      id: 'back',
      title: 'Go back',
      shortcut: { input: '[', modifiers: [modifier] },
      action: 'back',
    },
    {
      id: 'close',
      title: 'Close modal',
      shortcut: { input: 'Escape' },
      allowInTextInput: true,
      action: 'closeModal',
    },
    {
      id: 'compose',
      title: 'Compose a message',
      shortcut: { input: 'n', modifiers: [modifier] },
      action: (router) => router.push('/compose'),
    },
    {
      id: 'next-tab',
      title: 'Next tab',
      shortcut: { input: 'ArrowRight', modifiers: ['ctrl', 'shift'] },
      action: () => selectTab(1),
    },
    {
      id: 'previous-tab',
      title: 'Previous tab',
      shortcut: { input: 'ArrowLeft', modifiers: ['ctrl', 'shift'] },
      action: () => selectTab(-1),
    },
  ])
}
