<script setup lang="ts">
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'
import Clip from './Clip.vue'
const { lang } = useData()
const pt = computed(() => lang.value === 'pt-BR')
const link = (path: string) => withBase(`${pt.value ? '/pt-BR' : ''}/guide/${path}`)
const copy = computed(() =>
  pt.value
    ? {
        eyebrow: 'NATIVESCRIPT-VUE 3 · iOS + ANDROID',
        title: 'Navegação nativa.',
        tail: 'Com a API que você conhece.',
        intro:
          'Crie apps com pilhas independentes, gestos nativos e navegação adaptativa. Rotas, guards e estado de cada página continuam nas suas mãos.',
        start: 'Crie seu primeiro app',
        examples: 'Explore os exemplos',
        note: 'Release candidate · Veja compatibilidade e limites',
        caption:
          'Fieldnotes no iOS 26: drawer, busca, ações e retorno à mesma página. Gravação real de simulador.',
        featureTitle: 'Do primeiro push ao app completo',
        featureIntro:
          'Escolha o que seu app precisa. Cada guia mostra o uso, a composição e os limites de cada plataforma.',
        features: [
          [
            '01',
            'Histórico que pertence à página',
            'Volte para a mesma lista, com o mesmo estado. Cada aba pode manter sua própria pilha.',
            'mental-model',
            'Entenda páginas e pilhas',
          ],
          [
            '02',
            'Navegação que se adapta',
            'Combine abas, drawer e lista/detalhe. Alterne o drawer entre overlay e painel sem recriar as páginas.',
            'capabilities',
            'Escolha os containers',
          ],
          [
            '03',
            'Controles da plataforma',
            'Use headers, busca e menus nativos, com ações compartilhadas entre as superfícies suportadas.',
            'page-actions',
            'Explore ações por página',
          ],
          [
            '04',
            'Fluxos com começo e volta',
            'Abra um modal, receba um resultado e proteja uma edição antes de sair.',
            'modals',
            'Trabalhe com modais',
          ],
          [
            '05',
            'Entradas e retomadas',
            'Receba deep links e atalhos, organize a pilha de destino e restaure estado persistido pelo app.',
            'deep-links',
            'Conecte o app ao sistema',
          ],
          [
            '06',
            'Navegação observável',
            'Exporte um diagnóstico e compare o histórico lógico com o nativo no visualizador de relatórios.',
            'diagnostics-viewer',
            'Investigue uma navegação',
          ],
        ],
        learn: 'Um caminho para aprender',
        learnIntro: 'Comece pequeno e avance usando os mesmos conceitos.',
        steps: [
          [
            '01',
            'Instale e execute',
            'Prepare um projeto NativeScript-Vue e abra a primeira página.',
            'install',
          ],
          [
            '02',
            'Construa um fluxo',
            'Lista, detalhe, edição protegida e resultado de modal, com todos os arquivos.',
            'first-app',
          ],
          [
            '03',
            'Combine os recursos',
            'Siga o Fieldnotes para adicionar drawer, busca e ações compartilhadas.',
            'native-showcase',
          ],
        ],
        existing: 'Já tem um app?',
        existingText:
          'Encontre uma receita por tarefa ou compare o comportamento com o Vue Router.',
        recipes: 'Tarefas comuns',
        differences: 'Vindo do Vue Router',
      }
    : {
        eyebrow: 'NATIVESCRIPT-VUE 3 · iOS + ANDROID',
        title: 'Native navigation.',
        tail: 'With the API you know.',
        intro:
          'Build apps with independent stacks, native gestures and adaptive navigation. Keep routes, guards and page-owned state in your hands.',
        start: 'Build your first app',
        examples: 'Explore the examples',
        note: 'Release candidate · See compatibility and limits',
        caption:
          'Fieldnotes on iOS 26: drawer, search, actions and return to the same page. Actual simulator recording.',
        featureTitle: 'From the first push to a complete app',
        featureIntro:
          'Choose what your app needs. Each guide explains usage, composition and platform limits.',
        features: [
          [
            '01',
            'History belongs to the page',
            'Return to the same list with the same state. Each tab can keep its own navigation stack.',
            'mental-model',
            'Understand pages and stacks',
          ],
          [
            '02',
            'Navigation that adapts',
            'Compose tabs, drawers and list/detail. Switch the drawer between overlay and pane without recreating pages.',
            'capabilities',
            'Choose your containers',
          ],
          [
            '03',
            'Controls from the platform',
            'Use native headers, search and menus, with shared actions across supported surfaces.',
            'page-actions',
            'Explore page actions',
          ],
          [
            '04',
            'Flows with a way back',
            'Open a modal, receive a result and protect an edit before the page is removed.',
            'modals',
            'Work with modals',
          ],
          [
            '05',
            'Entry points and recovery',
            'Handle deep links and shortcuts, build the destination stack and restore app-persisted state.',
            'deep-links',
            'Connect to the system',
          ],
          [
            '06',
            'Navigation you can inspect',
            'Export a diagnostic report and compare logical history with native history in the report viewer.',
            'diagnostics-viewer',
            'Investigate a navigation',
          ],
        ],
        learn: 'A path through the docs',
        learnIntro: 'Start small and build on the same concepts.',
        steps: [
          [
            '01',
            'Install and run',
            'Prepare a NativeScript-Vue project and open the first page.',
            'install',
          ],
          [
            '02',
            'Build a complete flow',
            'List, detail, guarded editing and a modal result, with every file included.',
            'first-app',
          ],
          [
            '03',
            'Bring the features together',
            'Follow Fieldnotes to add a drawer, search and shared actions.',
            'native-showcase',
          ],
        ],
        existing: 'Already building an app?',
        existingText: 'Find a recipe by task or compare the behavior with Vue Router.',
        recipes: 'Common tasks',
        differences: 'Coming from Vue Router',
      },
)
</script>

<template>
  <div class="navigation-home">
    <section class="navigation-hero" aria-labelledby="navigation-title">
      <div class="navigation-pitch">
        <p class="navigation-eyebrow">{{ copy.eyebrow }}</p>
        <h1 id="navigation-title">
          {{ copy.title }} <span>{{ copy.tail }}</span>
        </h1>
        <p class="navigation-intro">{{ copy.intro }}</p>
        <div class="navigation-actions">
          <a class="navigation-button primary" :href="link('first-app')"
            >{{ copy.start }} <span aria-hidden="true">↗</span></a
          >
          <a class="navigation-button" :href="link('examples')">{{ copy.examples }}</a>
        </div>
        <pre
          class="navigation-code"
          aria-label="TypeScript"
        ><code><span>await</span> router.push('/notes/coast')
<span>await</span> router.back()</code></pre>
        <a class="navigation-status" :href="link('compatibility')"
          >{{ copy.note }} <span aria-hidden="true">→</span></a
        >
      </div>
      <div class="navigation-preview">
        <div class="navigation-preview-label">
          <span aria-hidden="true"></span> FIELDNOTES
        </div>
        <Clip name="native-showcase-preview" :width="248" :caption="copy.caption" />
      </div>
    </section>
    <section class="navigation-section" aria-labelledby="navigation-features">
      <div class="navigation-section-heading">
        <h2 id="navigation-features">{{ copy.featureTitle }}</h2>
        <p>{{ copy.featureIntro }}</p>
      </div>
      <div class="navigation-feature-grid">
        <a
          v-for="feature in copy.features"
          :key="feature[0]"
          class="navigation-feature"
          :href="link(feature[3])"
        >
          <span class="navigation-number">{{ feature[0] }}</span>
          <h3>{{ feature[1] }}</h3>
          <p>{{ feature[2] }}</p>
          <span class="navigation-card-link"
            >{{ feature[4] }} <span aria-hidden="true">→</span></span
          >
        </a>
      </div>
    </section>
    <section
      class="navigation-section navigation-learning"
      aria-labelledby="navigation-learn"
    >
      <div class="navigation-section-heading">
        <h2 id="navigation-learn">{{ copy.learn }}</h2>
        <p>{{ copy.learnIntro }}</p>
      </div>
      <div class="navigation-steps">
        <a v-for="step in copy.steps" :key="step[0]" :href="link(step[3])"
          ><span class="navigation-number">{{ step[0] }}</span>
          <h3>{{ step[1] }}</h3>
          <p>{{ step[2] }}</p>
          <span aria-hidden="true">↗</span></a
        >
      </div>
    </section>
    <aside class="navigation-existing">
      <div>
        <h2>{{ copy.existing }}</h2>
        <p>{{ copy.existingText }}</p>
      </div>
      <div class="navigation-actions">
        <a class="navigation-button" :href="link('recipes')">{{ copy.recipes }}</a
        ><a class="navigation-card-link" :href="link('vue-router')"
          >{{ copy.differences }} →</a
        >
      </div>
    </aside>
  </div>
</template>

<style scoped>
.navigation-pitch {
  min-width: 0;
}
.navigation-home a {
  text-decoration: none;
}
.navigation-home .navigation-feature,
.navigation-home .navigation-steps a {
  color: var(--vp-c-text-1);
}
.navigation-home .navigation-button {
  text-decoration: none;
}
.navigation-home h2 {
  margin: 0;
  padding: 0;
  border: 0;
}
.navigation-home .navigation-section-heading p {
  margin: 0;
}
.navigation-home .navigation-status {
  text-decoration: underline;
}
.navigation-home h3 {
  margin: 12px 0 10px;
}

.navigation-home {
  max-width: 1184px;
  margin: 0 auto;
  padding: 36px 32px 80px;
}
.navigation-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(0, 0.75fr);
  align-items: center;
  gap: 64px;
  padding: 24px 0 72px;
}
.navigation-eyebrow {
  color: var(--vp-c-brand-1);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.13em;
  margin-bottom: 26px;
}
h1 {
  font-size: clamp(40px, 4.8vw, 64px);
  font-weight: 700;
  line-height: 1.06;
  letter-spacing: -0.045em;
}
h1 span {
  display: block;
  color: var(--vp-c-brand-1);
}
.navigation-intro {
  max-width: 520px;
  color: var(--vp-c-text-2);
  font-size: 18px;
  line-height: 1.65;
  margin: 24px 0 28px;
}
.navigation-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.navigation-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  min-height: 46px;
  padding: 10px 18px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 9px;
  font-size: 14px;
  font-weight: 600;
  background: var(--vp-c-bg-soft);
}
.navigation-button.primary {
  background: var(--vp-c-brand-3);
  border-color: var(--vp-c-brand-3);
  color: #071b12;
}
.navigation-button:hover {
  border-color: var(--vp-c-brand-1);
}
a:focus-visible {
  outline: 3px solid var(--vp-c-brand-1);
  outline-offset: 5px;
}
.navigation-code {
  padding: 18px 22px;
  margin: 28px 0 16px;
  border: 1px solid var(--vp-c-divider);
  border-left: 3px solid var(--vp-c-brand-1);
  border-radius: 8px;
  background: var(--vp-code-block-bg);
  font-size: 14px;
  line-height: 1.9;
  overflow: auto;
  max-width: 475px;
}
.navigation-code span {
  color: var(--vp-c-brand-1);
}
.navigation-status {
  color: var(--vp-c-text-2);
  font-size: 12px;
  text-decoration: underline;
  text-underline-offset: 4px;
}
.navigation-preview {
  position: relative;
  padding: 20px 16px 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 28px;
  background:
    radial-gradient(ellipse at top, var(--vp-c-brand-soft), transparent 70%),
    var(--vp-c-bg-soft);
}
.navigation-preview-label {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.16em;
  color: var(--vp-c-text-2);
}
.navigation-preview-label span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--vp-c-brand-1);
}
.navigation-preview :deep(.clip) {
  margin: 16px auto 20px;
}
.navigation-preview :deep(figcaption) {
  font-size: 11px;
  line-height: 1.5;
}
.navigation-section {
  padding: 44px 0;
  border-top: 1px solid var(--vp-c-divider);
}
.navigation-section-heading {
  display: flex;
  align-items: start;
  gap: 36px;
  justify-content: space-between;
  margin-bottom: 28px;
}
h2 {
  font-size: 28px;
  font-weight: 650;
  letter-spacing: -0.025em;
  line-height: 1.25;
}
.navigation-section-heading p {
  max-width: 420px;
  color: var(--vp-c-text-2);
  font-size: 15px;
  line-height: 1.65;
}
.navigation-feature-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}
.navigation-feature {
  display: flex;
  flex-direction: column;
  padding: 24px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 14px;
}
.navigation-feature:hover {
  background: var(--vp-c-bg-soft);
  border-color: var(--vp-c-brand-1);
}
.navigation-number {
  color: var(--vp-c-brand-1);
  font-size: 12px;
  font-weight: 650;
  font-family: var(--vp-font-family-mono);
}
h3 {
  font-size: 18px;
  line-height: 1.4;
  font-weight: 650;
  margin: 12px 0 10px;
  letter-spacing: -0.02em;
}
.navigation-feature p,
.navigation-steps p {
  color: var(--vp-c-text-2);
  font-size: 14px;
  line-height: 1.7;
  margin-bottom: 24px;
}
.navigation-card-link {
  font-size: 13px;
  color: var(--vp-c-brand-1);
  font-weight: 600;
  margin-top: auto;
}
.navigation-steps {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}
.navigation-steps a {
  padding: 24px;
  background: var(--vp-c-bg-soft);
  border: 1px solid transparent;
  border-radius: 14px;
}
.navigation-steps a:hover {
  border-color: var(--vp-c-brand-1);
}
.navigation-existing {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 28px;
  padding: 32px 0 0;
  border-top: 1px solid var(--vp-c-divider);
}
.navigation-existing h2 {
  font-size: 21px;
}
.navigation-existing p {
  color: var(--vp-c-text-2);
  font-size: 14px;
  max-width: 440px;
  line-height: 1.6;
  margin-top: 10px;
}
@media (max-width: 959px) {
  .navigation-hero {
    gap: 28px;
  }
  .navigation-feature-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .navigation-section-heading,
  .navigation-existing {
    flex-direction: column;
  }
  .navigation-steps {
    gap: 10px;
  }
}
@media (max-width: 639px) {
  .navigation-home {
    padding: 20px 24px 48px;
  }
  .navigation-hero {
    grid-template-columns: minmax(0, 1fr);
    gap: 32px;
    padding-bottom: 40px;
  }
  h1 {
    font-size: 43px;
  }
  .navigation-eyebrow {
    font-size: 10px;
  }
  .navigation-preview {
    max-width: 360px;
    width: 100%;
    margin: 0 auto;
  }
  .navigation-intro {
    font-size: 17px;
  }
  .navigation-feature-grid,
  .navigation-steps {
    grid-template-columns: minmax(0, 1fr);
  }
  .navigation-section {
    padding: 32px 0;
  }
  .navigation-section-heading {
    gap: 14px;
  }
  h2 {
    font-size: 26px;
  }
}
</style>
