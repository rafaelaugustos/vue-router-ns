import { inject, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import type { InjectionKey, Ref } from 'vue'
import type { WebRuntime } from '@rafaelaugusto/jolt/web'

function preferences() {
  return { reduced: ref(false) }
}
const key: InjectionKey<ReturnType<typeof preferences>> = Symbol('docs-motion')

export function provideMotionPreference() {
  const state = preferences()
  provide(key, state)
  let media: MediaQueryList | undefined
  const update = () => (state.reduced.value = !!media?.matches)
  onMounted(() => {
    media = window.matchMedia('(prefers-reduced-motion: reduce)')
    update()
    media.addEventListener('change', update)
  })
  onBeforeUnmount(() => media?.removeEventListener('change', update))
  return state
}

export const useMotionPreference = () => inject(key, preferences())

/** The site alone owns Jolt. SSR and navigation remain usable without motion. */
export function useSiteMotion(
  root: Ref<HTMLElement | undefined>,
  setup: (runtime: WebRuntime, element: HTMLElement) => void,
) {
  const preference = useMotionPreference()
  const ready = ref(false)
  let runtime: WebRuntime | undefined
  let disposed = false
  let mounted = false
  let generation = 0
  async function start() {
    const current = ++generation
    runtime?.dispose()
    runtime = undefined
    if (preference.reduced.value) {
      ready.value = true
      return
    }
    try {
      const { createWebRuntime } = await import('@rafaelaugusto/jolt/web')
      if (disposed || current !== generation || !root.value) return
      runtime = createWebRuntime(document, { reducedMotion: 'user' })
      setup(runtime, root.value)
      ready.value = true
    } catch (error) {
      runtime?.dispose()
      runtime = undefined
      console.warn(
        '[router docs] Motion unavailable; content remains interactive.',
        error,
      )
    }
  }
  watch(preference.reduced, () => {
    if (mounted) void start()
  })
  onMounted(() => {
    mounted = true
    void start()
  })
  onBeforeUnmount(() => {
    disposed = true
    runtime?.dispose()
  })
  return {
    ready,
    run: (action: (runtime: WebRuntime) => void) => runtime && action(runtime),
  }
}
