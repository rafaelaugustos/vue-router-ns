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
let visible = false
let manuallyPaused = false
let automaticPause = false

const pause = () => {
  if (video.value && !video.value.paused) {
    automaticPause = true
    video.value.pause()
  }
}
const playWhenVisible = () => {
  if (visible && !motion?.matches && !manuallyPaused) {
    void video.value?.play().catch(() => {})
  }
}
const onPause = () => {
  if (!automaticPause && visible) manuallyPaused = true
  automaticPause = false
}
const onPlay = () => {
  manuallyPaused = false
}
const onMotionChange = () => {
  if (motion?.matches) pause()
  else playWhenVisible()
}

onMounted(() => {
  const element = video.value!
  element.muted = true
  element.addEventListener('pause', onPause)
  element.addEventListener('play', onPlay)
  motion = window.matchMedia('(prefers-reduced-motion: reduce)')
  motion.addEventListener('change', onMotionChange)
  observer = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting && entry.intersectionRatio >= 0.25
      if (visible) playWhenVisible()
      else pause()
    },
    { threshold: 0.25 },
  )
  observer.observe(element)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  motion?.removeEventListener('change', onMotionChange)
  video.value?.removeEventListener('pause', onPause)
  video.value?.removeEventListener('play', onPlay)
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
