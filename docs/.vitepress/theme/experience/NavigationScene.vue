<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useSiteMotion } from './motion'
import { useWords } from './words'
const { word } = useWords()
const root = ref<HTMLElement>()
const page = ref<'home' | 'note'>('home')
const editing = ref(false)
const query = ref('')
const saved = ref('')
const draft = ref('')
const title = computed(() =>
  word(['Coastal walk', 'Caminho da costa', 'Paseo costero', '海岸漫步']),
)
const found = computed(() =>
  title.value.toLocaleLowerCase().includes(query.value.toLocaleLowerCase()),
)
const event = ref<'start' | 'push' | 'modal' | 'result' | 'back' | 'cancel'>('start')
const code = computed(
  () =>
    ({
      start: "const query = ref('')",
      push: "router.push('/notes/coast')",
      modal: "router.pushForResult('/notes/coast/edit')",
      result: 'router.back({ result: draft })',
      back: 'router.back()',
      cancel: 'router.back()',
    })[event.value],
)
const status = computed(() => {
  if (editing.value)
    return word([
      'A separate modal. Your pages stay in place.',
      'Um modal separado. Suas páginas continuam no lugar.',
      'Un modal separado. Tus páginas siguen en su lugar.',
      '独立模态页面，原有页面保持不变。',
    ])
  if (event.value === 'result')
    return word([
      'Result received by the same detail page.',
      'Resultado recebido pela mesma página de detalhe.',
      'La misma página de detalle recibe el resultado.',
      '同一个详情页面接收返回结果。',
    ])
  if (page.value === 'note')
    return word([
      'Home stays mounted below this page.',
      'Home continua montada abaixo desta página.',
      'Home permanece montada bajo esta página.',
      'Home 在当前页面下方保持挂载。',
    ])
  return word([
    'Your search stays here when you come back.',
    'Sua busca continua aqui quando você volta.',
    'Tu búsqueda sigue aquí cuando vuelves.',
    '返回时，搜索内容仍然保留。',
  ])
})
const { ready, run } = useSiteMotion(root, (motion, element) => {
  motion.animate(
    [...element.querySelectorAll<HTMLElement>('.scene-layer')],
    { y: [28, 0], opacity: [0, 1] },
    { duration: 800, stagger: 90, ease: 'easeOut' },
  )
  element
    .querySelectorAll<HTMLElement>('.scene-layer')
    .forEach((layer) => motion.observeGeometry(layer))
})
let activePage: HTMLElement | undefined
watch([page, editing], async () => {
  run((motion) => {
    if (activePage) motion.release(activePage)
    activePage = undefined
  })
  await nextTick()
  const target = root.value?.querySelector<HTMLElement>(
    editing.value
      ? '.scene-editor'
      : page.value === 'note'
        ? '.scene-detail'
        : '.scene-list',
  )
  if (target)
    run((motion) => {
      activePage = target
      motion.animate(
        target,
        { y: [editing.value ? 40 : 10, 0], opacity: [0.25, 1] },
        { duration: 480, ease: 'easeOut' },
      )
      motion.observeGeometry(target)
    })
})
async function focus(selector: string) {
  await nextTick()
  root.value?.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true })
}
function openNote() {
  page.value = 'note'
  event.value = 'push'
  void focus('[data-back]')
}
function back() {
  page.value = 'home'
  event.value = 'back'
  void focus('[data-open-note]')
}
function edit() {
  draft.value = saved.value
  editing.value = true
  event.value = 'modal'
  void focus('textarea')
}
function close(save: boolean) {
  if (save) saved.value = draft.value
  editing.value = false
  event.value = save ? 'result' : 'cancel'
  void focus('[data-edit]')
}
</script>

<template>
  <div
    ref="root"
    class="navigation-scene"
    :data-motion-ready="ready"
    data-navigation-scene
  >
    <div class="scene-orbit" aria-hidden="true"><span>↗</span></div>
    <div class="scene-stack scene-layer" aria-hidden="true">
      <span>/home</span><i></i><i></i>
    </div>
    <div class="scene-stack second scene-layer" aria-hidden="true">
      <span>/notes/coast</span><i></i>
    </div>
    <div class="scene-window scene-layer">
      <div class="scene-toolbar">
        <span class="scene-symbol" aria-hidden="true">↳</span><strong>Fieldnotes.</strong
        ><span class="scene-toolbar-dot" aria-hidden="true"></span>
      </div>
      <div class="scene-viewport">
        <div v-show="page === 'home'" class="scene-list">
          <div class="scene-kicker">
            {{
              word([
                'YOUR LITTLE COLLECTION',
                'SUA PEQUENA COLEÇÃO',
                'TU PEQUEÑA COLECCIÓN',
                '你的珍藏',
              ])
            }}
          </div>
          <h2>
            {{
              word([
                'Places to return to.',
                'Lugares para voltar.',
                'Lugares para volver.',
                '值得再访的地方。',
              ])
            }}
          </h2>
          <label class="scene-search"
            ><span aria-hidden="true">⌕</span
            ><input
              v-model="query"
              :placeholder="
                word(['Search notes…', 'Buscar notas…', 'Buscar notas…', '搜索笔记…'])
              "
              :aria-label="
                word(['Search notes', 'Buscar notas', 'Buscar notas', '搜索笔记'])
              "
          /></label>
          <button
            v-if="found"
            type="button"
            class="scene-note"
            data-open-note
            @click="openNote"
          >
            <div class="scene-landscape" aria-hidden="true">
              <svg viewBox="0 0 300 120" fill="none">
                <path
                  d="M0 120V60C45 10 84 120 154 48S251 15 300 40V120"
                  fill="#b5ceb0"
                />
                <path
                  d="M0 120V94C80 30 140 120 204 69S266 60 300 30V120"
                  fill="#5c8975"
                />
                <path d="M0 120C90 56 116 148 195 84S276 89 300 78V120" fill="#245747" />
                <path
                  d="M87 120C140 60 191 131 247 11"
                  stroke="#f9f1ca"
                  stroke-width="3"
                  stroke-linecap="round"
                  stroke-dasharray="4 5"
                />
                <circle cx="247" cy="12" r="5" fill="#f9f1ca" /></svg
              ><span>01 / FIELDNOTES</span>
            </div>
            <span class="scene-note-copy"
              ><span
                ><strong>{{ title }}</strong
                ><small>{{
                  word([
                    'A slower way home',
                    'Um caminho com mais calma',
                    'Un camino sin prisa',
                    '慢慢走回家',
                  ])
                }}</small></span
              ><span aria-hidden="true">↗</span></span
            >
          </button>
          <p v-else class="scene-empty">
            {{
              word([
                'No matching notes. Try “coast”.',
                'Nenhuma nota. Tente “costa”.',
                'Sin resultados. Prueba “costero”.',
                '没有匹配项，试试“海岸”。',
              ])
            }}
          </p>
        </div>
        <div v-show="page === 'note'" class="scene-detail" :inert="editing">
          <button type="button" class="scene-back" data-back @click="back">
            ← {{ word(['Back', 'Voltar', 'Volver', '返回']) }}
          </button>
          <div class="scene-detail-mark" aria-hidden="true">↗</div>
          <div class="scene-kicker">/NOTES/COAST</div>
          <h2>{{ title }}</h2>
          <p class="scene-note-body">
            {{
              saved ||
              word([
                'Take the long way. There is something good around the next corner.',
                'Vá pelo caminho mais longo. Tem algo bom depois da próxima curva.',
                'Toma el camino largo. Hay algo bueno después de la próxima curva.',
                '走远一点，下一处转角会有新的发现。',
              ])
            }}
          </p>
          <button type="button" class="scene-edit" data-edit @click="edit">
            {{
              word(['Edit this note', 'Editar esta nota', 'Editar esta nota', '编辑笔记'])
            }}
            <span aria-hidden="true">↗</span>
          </button>
        </div>
        <div v-if="editing" class="scene-modal" @keydown.esc.prevent="close(false)">
          <form class="scene-editor" @submit.prevent="close(true)">
            <span class="scene-kicker">{{
              word([
                'MODAL / OWN STACK',
                'MODAL / PILHA PRÓPRIA',
                'MODAL / PILA PROPIA',
                '模态 / 独立导航栈',
              ])
            }}</span>
            <label for="scene-draft">{{
              word([
                'A little note.',
                'Uma pequena nota.',
                'Una pequeña nota.',
                '记下这一刻。',
              ])
            }}</label>
            <textarea
              id="scene-draft"
              v-model="draft"
              maxlength="120"
              :placeholder="
                word([
                  'What will you remember?',
                  'O que você vai lembrar?',
                  '¿Qué recordarás?',
                  '你想记住什么？',
                ])
              "
            ></textarea>
            <div>
              <button type="button" @click="close(false)">
                {{ word(['Cancel', 'Cancelar', 'Cancelar', '取消']) }}</button
              ><button type="submit" class="scene-save">
                {{
                  word([
                    'Save & return',
                    'Salvar e voltar',
                    'Guardar y volver',
                    '保存并返回',
                  ])
                }}
                ↗
              </button>
            </div>
          </form>
        </div>
      </div>
      <div class="scene-history" aria-hidden="true">
        <span :class="{ current: page === 'home' }">Home</span
        ><span v-if="page === 'note'">→</span
        ><span v-if="page === 'note'" :class="{ current: !editing }">Note</span
        ><span v-if="editing">↗</span><span v-if="editing" class="current">Modal</span
        ><small>{{ page === 'home' ? '01' : editing ? '02 + 01' : '02' }}</small>
      </div>
    </div>
    <div class="scene-code scene-layer">
      <span aria-hidden="true">↳</span><code>{{ code }}</code>
    </div>
    <p class="scene-status" role="status">{{ status }}</p>
    <p class="scene-caption">
      {{
        word([
          'Interactive navigation model',
          'Modelo interativo de navegação',
          'Modelo interactivo de navegación',
          '交互式导航模型',
        ])
      }}
    </p>
  </div>
</template>
