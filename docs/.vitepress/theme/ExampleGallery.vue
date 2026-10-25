<script setup lang="ts">
import { computed, ref } from 'vue'
import { withBase } from 'vitepress'
import { useDocsLocale } from './locale'
const { t, link } = useDocsLocale()
const platform = ref('all')
const query = ref('')
function clearFilters() {
  query.value = ''
  platform.value = 'all'
}
const examples = computed(() => [
  {
    id: 'first-app',
    platform: 'ios',
    path: 'first-app',
    level: t('START HERE', 'COMECE AQUI'),
    title: t('Your first complete flow', 'Seu primeiro fluxo completo'),
    text: t(
      'List, detail, a modal editor and a guard. Every tutorial file also runs in the demo.',
      'Lista, detalhe, edição em modal e guard. Todos os arquivos do tutorial também executam no demo.',
    ),
    media: 'first-app',
    capture: 'iOS 26',
  },
  {
    id: 'fieldnotes',
    platform: 'ios',
    path: 'native-showcase',
    level: t('INTEGRATED APP', 'APP INTEGRADO'),
    title: 'Fieldnotes',
    text: t(
      'Drawer, search, shared actions and retained state in one small app.',
      'Drawer, busca, ações compartilhadas e estado preservado em um app pequeno.',
    ),
    media: 'native-showcase',
    capture: 'iOS 26',
  },
  {
    id: 'airbnb',
    platform: 'ios',
    path: 'demo#airbnb-ns',
    level: t('INTEGRATED APP', 'APP INTEGRADO'),
    title: 'Airbnb NS',
    text: t(
      'Accommodation feed, favorites, tabs and a transition from card to detail.',
      'Feed de acomodações, favoritos, abas e transição de um card para o detalhe.',
    ),
    media: 'ios-airbnb',
    capture: 'iOS 26',
  },
  {
    id: 'adaptive',
    platform: 'ios',
    path: 'drawer',
    level: t('CONTAINER', 'CONTAINER'),
    title: t('Adaptive drawer', 'Drawer adaptativo'),
    text: t(
      'Overlay and permanent pane with the same pages, histories and drafts.',
      'Overlay e painel permanente com as mesmas páginas, históricos e rascunhos.',
    ),
    media: 'adaptive-drawer',
    capture: 'iOS / iPadOS 18.6',
  },
  {
    id: 'actions',
    platform: 'ios',
    path: 'page-actions',
    level: t('NATIVE EXPERIENCE', 'EXPERIÊNCIA NATIVA'),
    title: t('One action, several surfaces', 'Uma ação, várias superfícies'),
    text: t(
      'Header and menu share title, availability, busy state and errors.',
      'Header e menu compartilham título, disponibilidade, estado ocupado e erros.',
    ),
    media: 'page-actions',
    capture: 'iOS 18.6',
  },
  {
    id: 'tabs',
    platform: 'android',
    path: 'tabs',
    level: t('CONTAINER', 'CONTAINER'),
    title: t('History per tab', 'Histórico por aba'),
    text: t(
      'Navigate, switch tabs and return to the same position in each stack.',
      'Navegue, alterne de aba e volte ao mesmo ponto em cada pilha.',
    ),
    media: 'android-tabs',
    capture: 'Android 16',
  },
  {
    id: 'sheet',
    platform: 'android',
    path: 'modals',
    level: t('NATIVE FLOW', 'FLUXO NATIVO'),
    title: t('A routed bottom sheet', 'Bottom sheet com rota'),
    text: t(
      'Present a native page in a Material sheet with history and Back handling.',
      'Apresente uma página nativa em uma sheet Material, com histórico e Back.',
    ),
    media: 'android-sheet',
    capture: 'Android 16',
  },
  {
    id: 'drawer',
    platform: 'android',
    path: 'drawer',
    level: t('CONTAINER', 'CONTAINER'),
    title: t('Android menu and Back', 'Menu e Back no Android'),
    text: t(
      'Back closes the open drawer before removing a page.',
      'O Back fecha o drawer aberto antes de remover uma página.',
    ),
    media: 'android-drawer',
    capture: 'Android 16',
  },
  {
    id: 'loaders',
    platform: 'android',
    path: 'data-loading',
    level: t('EXPERIMENTAL', 'EXPERIMENTAL'),
    title: t('Data, error and retry', 'Dados, erro e nova tentativa'),
    text: t(
      'Observe data loading per entry without blocking native presentation.',
      'Observe o carregamento por entrada sem bloquear a apresentação nativa.',
    ),
    media: 'android-loaders',
    capture: 'Android 16',
  },
  {
    id: 'viewer',
    platform: 'web',
    path: 'diagnostics-viewer',
    level: t('TOOL', 'FERRAMENTA'),
    title: t('Diagnostics viewer', 'Visualizador de diagnósticos'),
    text: t(
      'Investigate stacks, guards and mismatches in local reports. Synthetic demonstration data.',
      'Investigue pilhas, guards e divergências em relatórios locais. Dados demonstrativos sintéticos.',
    ),
    media: 'diagnostics-viewer',
    capture: t('Browser', 'Navegador'),
  },
])
const filtered = computed(() =>
  examples.value.filter(
    (e) =>
      (platform.value === 'all' || e.platform === platform.value) &&
      `${e.title} ${e.text} ${e.level}`
        .toLocaleLowerCase()
        .includes(query.value.trim().toLocaleLowerCase()),
  ),
)
const filters = computed(() => [
  { id: 'all', name: t('All', 'Todas') },
  { id: 'ios', name: 'iOS / iPadOS' },
  { id: 'android', name: 'Android' },
  { id: 'web', name: t('Browser', 'Navegador') },
])
</script>

<template>
  <div class="example-gallery">
    <div class="example-toolbar">
      <label class="example-search"
        ><span>{{ t('Find an example', 'Encontre um exemplo') }}</span
        ><input
          v-model="query"
          type="search"
          :placeholder="t('Search, drawer, modal…', 'Busca, drawer, modal…')"
      /></label>
      <fieldset class="example-filters">
        <legend>{{ t('Recording platform', 'Plataforma da gravação') }}</legend>
        <button
          v-for="filter in filters"
          :key="filter.id"
          type="button"
          :aria-pressed="platform === filter.id"
          @click="platform = filter.id"
        >
          {{ filter.name }}
        </button>
      </fieldset>
    </div>
    <p class="example-count" role="status">
      {{ filtered.length }} {{ t('examples found', 'exemplos encontrados') }}
    </p>
    <div class="example-grid">
      <a
        v-for="example in filtered"
        :key="example.id"
        class="example-card"
        :href="link(example.path)"
      >
        <div class="example-poster" :class="{ wide: example.platform === 'web' }">
          <img
            :src="withBase(`/media/${example.media}.jpg`)"
            alt=""
            loading="lazy"
            width="220"
            height="240"
          /><span>{{ example.capture }}</span>
        </div>
        <div class="example-description">
          <span class="example-level">{{ example.level }}</span>
          <h2>{{ example.title }}</h2>
          <p>{{ example.text }}</p>
          <span class="example-open"
            >{{ t('Watch and see the code', 'Veja o vídeo e o código') }}
            <span aria-hidden="true">→</span></span
          >
        </div>
      </a>
    </div>
    <div v-if="!filtered.length" class="example-empty">
      <p>
        {{ t('No examples match these filters.', 'Nenhum exemplo com esses filtros.') }}
      </p>
      <button type="button" @click="clearFilters">
        {{ t('Clear filters', 'Limpar filtros') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.example-toolbar {
  display: flex;
  gap: 24px;
  align-items: end;
  flex-wrap: wrap;
  margin: 28px 0 12px;
}
.example-search {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1 1 220px;
  font-weight: 600;
  font-size: 13px;
}
.example-search input {
  width: 100%;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  padding: 10px 12px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  font: inherit;
}
.example-filters {
  border: 0;
  padding: 0;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.example-filters legend {
  font-size: 12px;
  color: var(--vp-c-text-2);
  margin-bottom: 8px;
}
.example-filters button {
  padding: 8px 10px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 7px;
  font-size: 12px;
}
.example-filters button[aria-pressed='true'] {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}
.example-count {
  font-size: 12px;
  color: var(--vp-c-text-2);
}
.example-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}
.example-card {
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  overflow: hidden;
  text-decoration: none;
  font-weight: 400;
  display: flex;
  flex-direction: column;
  color: var(--vp-c-text-1);
}
.example-card:hover {
  border-color: var(--vp-c-brand-1);
}
.example-poster {
  position: relative;
  height: 220px;
  overflow: hidden;
  background: var(--vp-c-bg-soft);
  padding: 18px 24px 0;
  display: flex;
  justify-content: center;
}
.example-poster img {
  width: auto;
  height: 300px;
  max-width: 100%;
  object-fit: contain;
  object-position: top;
  border-radius: 16px 16px 0 0;
  border: 1px solid var(--vp-c-divider);
}
.example-poster.wide {
  align-items: center;
  padding-bottom: 18px;
}
.example-poster.wide img {
  width: 100%;
  height: auto;
  border-radius: 5px;
}
.example-poster > span {
  position: absolute;
  bottom: 10px;
  right: 10px;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  padding: 3px 8px;
  border-radius: 5px;
  font-size: 11px;
  color: var(--vp-c-text-1);
}
.example-description {
  padding: 20px;
  display: flex;
  flex-direction: column;
  flex: 1;
}
.example-level {
  font-size: 10px;
  font-weight: 650;
  letter-spacing: 0.07em;
  color: var(--vp-c-brand-1);
}
.example-description h2 {
  border: 0;
  margin: 9px 0;
  padding: 0;
  font-size: 20px;
  line-height: 1.35;
  letter-spacing: -0.02em;
}
.example-description p {
  margin: 0 0 18px;
  font-size: 14px;
  line-height: 1.65;
  color: var(--vp-c-text-2);
}
.example-open {
  margin-top: auto;
  color: var(--vp-c-brand-1);
  font-size: 13px;
  font-weight: 600;
}
.example-empty {
  padding: 32px;
  border: 1px dashed var(--vp-c-divider);
  border-radius: 12px;
  text-align: center;
}
.example-empty button {
  color: var(--vp-c-brand-1);
  text-decoration: underline;
}
button:focus-visible,
input:focus-visible,
a:focus-visible {
  outline: 3px solid var(--vp-c-brand-1);
  outline-offset: 3px;
}
@media (max-width: 599px) {
  .example-grid {
    grid-template-columns: 1fr;
  }
  .example-toolbar {
    gap: 16px;
  }
}
</style>
