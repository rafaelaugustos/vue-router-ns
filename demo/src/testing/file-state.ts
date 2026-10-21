import { ActionBar, defineComponent, h, ref } from 'nativescript-vue'
import {
  useRoute,
  useRouter,
  useNativeHost,
  type RouteLocation,
  type NativeHostHandle,
} from 'vue-router-ns'
import type { Frame } from '@nativescript/core'

export const captures: {
  route: RouteLocation
  draft: ReturnType<typeof ref<string>>
  host: NativeHostHandle<Frame>
}[] = []
export const status = ref('Running generated file routes')
export function capturePage() {
  const value = { route: useRoute(), draft: ref('draft'), host: useNativeHost<Frame>() }
  captures.push(value)
  return value
}
export const FilePage = defineComponent({
  setup() {
    const { route, draft } = capturePage(),
      router = useRouter()
    return () =>
      h('Page', { backgroundColor: '#ffffff' }, [
        h(ActionBar, { title: `Files ${route.path}` }),
        h('StackLayout', { padding: 16 }, [
          h('Label', { text: status.value, textWrap: true }),
          h('Label', {
            text: `route ${String(route.name)} ${route.fullPath}`,
            textWrap: true,
          }),
          h('TextField', {
            text: draft.value,
            onTextChange: (event: { value: string }) => {
              draft.value = event.value
            },
          }),
          h('Button', { text: 'Back', onTap: () => router.back() }),
        ]),
      ])
  },
})
