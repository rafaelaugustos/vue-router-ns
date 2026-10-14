import { computed, defineComponent, inject, ref, watch } from 'nativescript-vue'
import { entryKey } from '../injection.js'

/**
 * Renders its content once the page is on screen, after the transition, so a
 * page with a lot to lay out still animates in on time. Until then it renders
 * the `fallback` slot, if any. Outside a page it renders right away.
 *
 * ```vue
 * <Deferred>
 *   <template #fallback><ActivityIndicator busy /></template>
 *   <HeavyList :items="items" />
 * </Deferred>
 * ```
 */
export const Deferred = defineComponent({
  name: 'RouterDeferred',
  setup(_, { slots }) {
    const entry = inject(entryKey, null)
    const ready = ref(!entry)

    if (entry) {
      const stop = watch(
        computed(entry.isActive),
        (active) => {
          if (!active) return
          ready.value = true
          stop()
        },
        { immediate: true },
      )
    }

    return () => (ready.value ? slots.default?.() : slots.fallback?.())
  },
})
