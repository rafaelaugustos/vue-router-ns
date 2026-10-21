<script setup lang="ts">
import { useData } from 'vitepress'
import { version } from '../../../package.json'

const { lang } = useData()
</script>

<template>
  <span
    class="version-badge"
    :title="`${lang === 'pt-BR' ? 'Versão da documentação' : 'Documentation version'}: ${version}`"
    >v{{ version }}</span
  >
</template>

<style scoped>
.version-badge {
  flex-shrink: 0;
  margin-left: 8px;
  padding: 3px 6px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  font-size: 10px;
  font-weight: 600;
  line-height: 1.4;
  white-space: nowrap;
}
</style>
