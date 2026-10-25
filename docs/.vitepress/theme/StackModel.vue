<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDocsLocale } from './locale'
const { t, localize } = useDocsLocale()
const step = ref(0)
const descriptions = computed(() =>
  localize(
    [
      'Home keeps the query “coast” in a local ref. There is one entry in the stack.',
      'push adds Note. Home stays mounted with the same query, but is covered.',
      'pushForResult opens Edit in a modal Frame. Note and Home remain in the original stack.',
      'back({ result }) closes Edit and resolves the Promise in Note. The existing Note page receives the result.',
      'Back removes Note. Home reappears with the query “coast”; it did not mount again.',
    ],
    [
      'Home guarda a busca “coast” em um ref local. Só há uma entrada na pilha.',
      'push adiciona Note. Home permanece montada, com a mesma busca, mas está coberta.',
      'pushForResult abre Edit em um Frame modal. Note e Home continuam na pilha original.',
      'back({ result }) fecha Edit e resolve a Promise em Note. A página Note existente recebe o resultado.',
      'Back remove Note. Home reaparece com a busca “coast”; ela não montou novamente.',
    ],
  ),
)
const actions = [
  'Home',
  "push('/notes/coast')",
  "pushForResult('/notes/coast/edit')",
  'back({ result })',
  'back()',
]
</script>

<template>
  <figure class="stack-model">
    <figcaption>
      {{
        t(
          'Conceptual model — not a native simulator',
          'Modelo conceitual — não é um simulador nativo',
        )
      }}
    </figcaption>
    <div
      class="stack-model-buttons"
      :aria-label="t('Navigation steps', 'Etapas da navegação')"
    >
      <button
        v-for="(action, i) in actions"
        :key="action"
        type="button"
        :aria-pressed="step === i"
        @click="step = i"
      >
        {{ i + 1 }}. {{ action }}
      </button>
    </div>
    <div class="stack-model-frames" aria-hidden="true">
      <div class="stack-model-frame">
        <span>RouterView · Frame</span>
        <div
          v-if="step > 0 && step < 4"
          class="stack-model-page"
          :class="{ covered: step === 2 }"
        >
          <strong>Note / coast</strong
          ><small>{{
            step === 3
              ? t('Result received', 'Resultado recebido')
              : t('Own entry', 'Entrada própria')
          }}</small>
        </div>
        <div class="stack-model-page" :class="{ covered: step > 0 && step < 4 }">
          <strong>Home</strong><small>query = "coast"</small>
        </div>
      </div>
      <div class="stack-model-frame" :class="{ empty: step !== 2 }">
        <span>{{ t('Modal Frame', 'Frame modal') }}</span>
        <div v-if="step === 2" class="stack-model-page">
          <strong>Edit / coast</strong
          ><small>{{ t('Local draft', 'Rascunho local') }}</small>
        </div>
        <p v-else>{{ t('No open modal', 'Sem modal aberto') }}</p>
      </div>
    </div>
    <p class="stack-model-explanation" role="status">{{ descriptions[step] }}</p>
  </figure>
</template>

<style scoped>
.stack-model {
  margin: 24px 0;
  padding: 20px;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
}
.stack-model figcaption {
  font-size: 12px;
  color: var(--vp-c-text-2);
}
.stack-model-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 16px 0;
}
.stack-model-buttons button {
  border: 1px solid var(--vp-c-divider);
  padding: 6px 9px;
  border-radius: 6px;
  font: 11px/1.6 var(--vp-font-family-mono);
  overflow-wrap: anywhere;
  text-align: left;
}
.stack-model-buttons button[aria-pressed='true'] {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}
.stack-model-buttons button:focus-visible {
  outline: 3px solid var(--vp-c-brand-1);
  outline-offset: 3px;
}
.stack-model-frames {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  min-height: 225px;
}
.stack-model-frame {
  border: 1px dashed var(--vp-c-divider);
  padding: 12px;
  border-radius: 8px;
}
.stack-model-frame > span {
  color: var(--vp-c-text-2);
  font-size: 12px;
}
.stack-model-frame > p {
  font-size: 13px;
  color: var(--vp-c-text-2);
}
.stack-model-page {
  border: 1px solid var(--vp-c-brand-1);
  padding: 12px;
  margin-top: 12px;
  border-radius: 6px;
  background: var(--vp-c-bg);
  display: flex;
  flex-direction: column;
  font-size: 14px;
}
.stack-model-page small {
  color: var(--vp-c-text-2);
  margin-top: 4px;
}
.stack-model-page.covered {
  border-color: var(--vp-c-divider);
}
.stack-model-explanation {
  font-size: 14px;
  min-height: 68px;
  margin-bottom: 0;
}
@media (max-width: 420px) {
  .stack-model {
    padding: 14px;
  }
  .stack-model-frames {
    grid-template-columns: 1fr;
  }
}
</style>
