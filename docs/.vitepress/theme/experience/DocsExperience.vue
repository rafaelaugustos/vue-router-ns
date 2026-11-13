<script setup lang="ts">
import { ref } from 'vue'
import { useSiteMotion } from './motion'
import { useWords } from './words'
const root = ref<HTMLElement>()
const { word, link } = useWords()
useSiteMotion(root, (motion, element) => {
  const article = element.closest('.VPDoc') as HTMLElement
  const title = article?.querySelector<HTMLElement>('.vp-doc h1')
  if (title)
    motion.animate(
      title,
      { opacity: [0, 1], y: [12, 0] },
      { duration: 440, ease: 'easeOut' },
    )
  const progress = element.querySelector<HTMLElement>('.reading-progress')!
  if (article)
    motion.scrollLinked(
      document,
      progress,
      { scaleX: [0.001, 1] },
      {
        range: { element: article, start: 'start start', end: 'end end' },
      },
    )
})
</script>

<template>
  <div ref="root" class="docs-experience">
    <div class="docs-context">
      <a :href="link('')"
        ><span aria-hidden="true">↳</span>
        {{
          word([
            'THE NAVIGATION GUIDE',
            'O GUIA DA NAVEGAÇÃO',
            'LA GUÍA DE NAVEGACIÓN',
            '导航指南',
          ])
        }}</a
      >
    </div>
    <div class="reading-track" aria-hidden="true">
      <div class="reading-progress"></div>
    </div>
  </div>
</template>
