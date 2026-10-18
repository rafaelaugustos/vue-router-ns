<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { withBase } from 'vitepress'

withDefaults(
  defineProps<{ name: string; caption: string; width?: number; aspect?: string }>(),
  { width: 280, aspect: '402 / 874' },
)

const video = ref<HTMLVideoElement>()
let observer: IntersectionObserver | undefined
let motion: MediaQueryList | undefined
const stopForReducedMotion = () => {
  if (motion?.matches) video.value?.pause()
}

onMounted(() => {
  const element = video.value!
  motion = window.matchMedia('(prefers-reduced-motion: reduce)')
  motion.addEventListener('change', stopForReducedMotion)
  let started = false
  observer = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) element.pause()
      else if (!started && !motion?.matches) {
        started = true
        void element.play().catch(() => {})
      }
    },
    { threshold: 0.25 },
  )
  observer.observe(element)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  motion?.removeEventListener('change', stopForReducedMotion)
})
</script>

<template>
  <figure class="clip" :style="{ width: `${width}px` }">
    <video
      ref="video"
      :src="withBase(`/media/${name}.mp4`)"
      :poster="withBase(`/media/${name}.jpg`)"
      :aria-label="caption"
      :style="{ aspectRatio: aspect }"
      :width="width"
      loop
      muted
      playsinline
      controls
      preload="none"
    />
    <figcaption>{{ caption }}</figcaption>
  </figure>
</template>

<style scoped>
.clip {
  margin: 24px auto;
  max-width: 100%;
}

.clip video {
  display: block;
  width: 100%;
  border: 1px solid var(--vp-c-divider);
  border-radius: 20px;
  background: var(--vp-c-bg-soft);
}

.clip figcaption {
  margin-top: 10px;
  color: var(--vp-c-text-2);
  font-size: 13px;
  line-height: 1.6;
  text-align: center;
}
</style>
