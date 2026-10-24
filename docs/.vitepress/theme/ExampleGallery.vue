<script setup lang="ts">
import { computed, ref } from 'vue'
import { useData, withBase } from 'vitepress'
const { lang } = useData()
const pt = computed(() => lang.value === 'pt-BR')
const platform = ref('all')
const query = ref('')
function clearFilters() {
  query.value = ''
  platform.value = 'all'
}
const link = (path: string) => withBase(`${pt.value ? '/pt-BR' : ''}/guide/${path}`)
const examples = computed(() => [
  {
    id: 'first-app',
    platform: 'ios',
    path: 'first-app',
    level: pt.value ? 'COMECE AQUI' : 'START HERE',
    title: pt.value ? 'Seu primeiro fluxo completo' : 'Your first complete flow',
    text: pt.value
      ? 'Lista, detalhe, edição em modal e guard. Todos os arquivos do tutorial também executam no demo.'
      : 'List, detail, a modal editor and a guard. Every tutorial file also runs in the demo.',
    media: 'first-app',
    capture: 'iOS 26',
  },
  {
    id: 'fieldnotes',
    platform: 'ios',
    path: 'native-showcase',
    level: pt.value ? 'APP INTEGRADO' : 'INTEGRATED APP',
    title: 'Fieldnotes',
    text: pt.value
      ? 'Drawer, busca, ações compartilhadas e estado preservado em um app pequeno.'
      : 'Drawer, search, shared actions and retained state in one small app.',
    media: 'native-showcase',
    capture: 'iOS 26',
  },
  {
    id: 'airbnb',
    platform: 'ios',
    path: 'demo#airbnb-ns',
    level: pt.value ? 'APP INTEGRADO' : 'INTEGRATED APP',
    title: 'Airbnb NS',
    text: pt.value
      ? 'Feed de acomodações, favoritos, abas e transição de um card para o detalhe.'
      : 'Accommodation feed, favorites, tabs and a transition from card to detail.',
    media: 'ios-airbnb',
    capture: 'iOS 26',
  },
  {
    id: 'adaptive',
    platform: 'ios',
    path: 'drawer',
    level: pt.value ? 'CONTAINER' : 'CONTAINER',
    title: pt.value ? 'Drawer adaptativo' : 'Adaptive drawer',
    text: pt.value
      ? 'Overlay e painel permanente com as mesmas páginas, históricos e rascunhos.'
      : 'Overlay and permanent pane with the same pages, histories and drafts.',
    media: 'adaptive-drawer',
    capture: 'iOS / iPadOS 18.6',
  },
  {
    id: 'actions',
    platform: 'ios',
    path: 'page-actions',
    level: pt.value ? 'EXPERIÊNCIA NATIVA' : 'NATIVE EXPERIENCE',
    title: pt.value ? 'Uma ação, várias superfícies' : 'One action, several surfaces',
    text: pt.value
      ? 'Header e menu compartilham título, disponibilidade, estado ocupado e erros.'
      : 'Header and menu share title, availability, busy state and errors.',
    media: 'page-actions',
    capture: 'iOS 18.6',
  },
  {
    id: 'tabs',
    platform: 'android',
    path: 'tabs',
    level: 'CONTAINER',
    title: pt.value ? 'Histórico por aba' : 'History per tab',
    text: pt.value
      ? 'Navegue, alterne de aba e volte ao mesmo ponto em cada pilha.'
      : 'Navigate, switch tabs and return to the same position in each stack.',
    media: 'android-tabs',
    capture: 'Android 16',
  },
  {
    id: 'sheet',
    platform: 'android',
    path: 'modals',
    level: pt.value ? 'FLUXO NATIVO' : 'NATIVE FLOW',
    title: pt.value ? 'Bottom sheet com rota' : 'A routed bottom sheet',
    text: pt.value
      ? 'Apresente uma página nativa em uma sheet Material, com histórico e Back.'
      : 'Present a native page in a Material sheet with history and Back handling.',
    media: 'android-sheet',
    capture: 'Android 16',
  },
  {
    id: 'drawer',
    platform: 'android',
    path: 'drawer',
    level: 'CONTAINER',
    title: pt.value ? 'Menu e Back no Android' : 'Android menu and Back',
    text: pt.value
      ? 'O Back fecha o drawer aberto antes de remover uma página.'
      : 'Back closes the open drawer before removing a page.',
    media: 'android-drawer',
    capture: 'Android 16',
  },
  {
    id: 'loaders',
    platform: 'android',
    path: 'data-loading',
    level: pt.value ? 'EXPERIMENTAL' : 'EXPERIMENTAL',
    title: pt.value ? 'Dados, erro e nova tentativa' : 'Data, error and retry',
    text: pt.value
      ? 'Observe o carregamento por entrada sem bloquear a apresentação nativa.'
      : 'Observe data loading per entry without blocking native presentation.',
    media: 'android-loaders',
    capture: 'Android 16',
  },
  {
    id: 'viewer',
    platform: 'web',
    path: 'diagnostics-viewer',
    level: pt.value ? 'FERRAMENTA' : 'TOOL',
    title: pt.value ? 'Visualizador de diagnósticos' : 'Diagnostics viewer',
    text: pt.value
      ? 'Investigue pilhas, guards e divergências em relatórios locais. Dados demonstrativos sintéticos.'
      : 'Investigate stacks, guards and mismatches in local reports. Synthetic demonstration data.',
    media: 'diagnostics-viewer',
    capture: pt.value ? 'Navegador' : 'Browser',
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
  { id: 'all', name: pt.value ? 'Todas' : 'All' },
  { id: 'ios', name: 'iOS / iPadOS' },
  { id: 'android', name: 'Android' },
  { id: 'web', name: pt.value ? 'Navegador' : 'Browser' },
])
</script>

<template>
  <div class="example-gallery">
    <div class="example-toolbar">
      <label class="example-search"
        ><span>{{ pt ? 'Encontre um exemplo' : 'Find an example' }}</span
        ><input
          v-model="query"
          type="search"
          :placeholder="pt ? 'Busca, drawer, modal…' : 'Search, drawer, modal…'"
      /></label>
      <fieldset class="example-filters">
        <legend>{{ pt ? 'Plataforma da gravação' : 'Recording platform' }}</legend>
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
      {{ filtered.length }} {{ pt ? 'exemplos encontrados' : 'examples found' }}
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
            >{{ pt ? 'Veja o vídeo e o código' : 'Watch and see the code' }}
            <span aria-hidden="true">→</span></span
          >
        </div>
      </a>
    </div>
    <div v-if="!filtered.length" class="example-empty">
      <p>
        {{
          pt ? 'Nenhum exemplo com esses filtros.' : 'No examples match these filters.'
        }}
      </p>
      <button type="button" @click="clearFilters">
        {{ pt ? 'Limpar filtros' : 'Clear filters' }}
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
