import { ActionBar, defineComponent, h, onUnmounted } from 'nativescript-vue'
import { useRouter } from 'vue-router-ns'
import { counts } from './metrics'

export default defineComponent({
  setup() {
    const router = useRouter()
    counts.detailSetups++
    onUnmounted(() => {
      counts.detailUnmounts++
    })
    return () =>
      h('Page', { backgroundColor: '#edf7f5' }, [
        h(ActionBar, { title: 'Prepared destination' }),
        h('StackLayout', { padding: 32 }, [
          h('Label', {
            text: 'The page exists only after navigation.',
            textWrap: true,
            fontSize: 26,
            fontWeight: 'bold',
            color: '#164740',
          }),
          h('Label', {
            text: 'The normal guard and data loader ran at commit. Back preserves the original card page.',
            textWrap: true,
            fontSize: 18,
            marginTop: 20,
          }),
          h('Button', { text: 'Back to cards', onTap: () => router.back() }),
        ]),
      ])
  },
})
