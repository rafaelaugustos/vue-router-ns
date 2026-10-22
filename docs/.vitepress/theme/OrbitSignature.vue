<script setup>
import { computed } from 'vue'
import { useData } from 'vitepress'

const { lang } = useData()
const label = computed(() =>
  lang.value.startsWith('pt') ? 'Gerenciado pelo' : 'Managed by',
)
</script>

<template>
  <div class="orbit-signature">
    <a
      class="orbit-signature-link"
      href="https://orbit.getcortexlabs.com/"
      target="_blank"
      rel="noopener noreferrer"
    >
      <svg
        class="orbit-signature-symbol"
        width="20"
        height="20"
        viewBox="0 0 64 64"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="32" cy="32" r="13" stroke="currentColor" stroke-width="5" />
        <ellipse
          cx="32"
          cy="32"
          rx="27"
          ry="10"
          transform="rotate(-35 32 32)"
          stroke="currentColor"
          stroke-width="3"
        />
      </svg>
      <span>{{ label }} <strong>Orbit</strong></span>
      <span class="orbit-signature-arrow" aria-hidden="true">↗</span>
    </a>
  </div>
</template>
