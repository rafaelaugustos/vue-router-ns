<script setup lang="ts">
import { ref } from 'vue'
import Clip from './Clip.vue'
import NavigationScene from './experience/NavigationScene.vue'
import { useHomeCopy } from './experience/home-copy'
import { useWords } from './experience/words'
import { useSiteMotion } from './experience/motion'
const root = ref<HTMLElement>()
const copy = useHomeCopy()
const { word, link } = useWords()
const copied = ref(false)
const copyFailed = ref(false)
const command = 'npm install vue-router-ns@next'
useSiteMotion(root, (motion, element) => {
  motion.animate(
    [...element.querySelectorAll<HTMLElement>('.hero-title > span')],
    { y: [30, 0], opacity: [0, 1] },
    { duration: 780, stagger: 110, ease: 'easeOut' },
  )
  element
    .querySelectorAll<HTMLElement>('.hero-title > span')
    .forEach((line) => motion.observeGeometry(line))
  const reveals = [...element.querySelectorAll<HTMLElement>('[data-reveal]')]
  motion.set(reveals, { y: 0 })
  reveals.forEach((item) => motion.observeGeometry(item))
  motion.viewportEnter(reveals, {
    keyframes: { y: [20, 0], opacity: [0, 1] },
    transition: { duration: 600, ease: 'easeOut' },
    once: true,
    threshold: 0.12,
  })
  element.querySelectorAll<HTMLElement>('.route-button').forEach((button) => {
    motion.press(button, { scale: 0.97 }, { transition: 'snappy' })
    motion.observeGeometry(button)
  })
})
async function copyInstall() {
  try {
    await navigator.clipboard.writeText(command)
    copied.value = true
    copyFailed.value = false
  } catch {
    copyFailed.value = true
  }
}
</script>

<template>
  <div ref="root" class="router-experience vp-raw">
    <section class="route-hero route-shell" aria-labelledby="navigation-title">
      <div class="hero-pitch">
        <a class="route-eyebrow hero-edition" :href="link('compatibility')"
          ><span class="edition-dot" aria-hidden="true"></span> NATIVESCRIPT-VUE 3
          <span aria-hidden="true">/</span> iOS + ANDROID
          <span aria-hidden="true">↗</span></a
        >
        <h1 id="navigation-title" class="hero-title">
          <span>{{
            word(['Go somewhere.', 'Vá mais longe.', 'Ve más lejos.', '去往新处。'])
          }}</span>
          <span class="hero-title-accent">{{
            word([
              'Keep your place.',
              'Guarde seu lugar.',
              'Guarda tu lugar.',
              '记住来路。',
            ])
          }}</span>
        </h1>
        <p class="hero-description">{{ copy.intro }}</p>
        <div class="route-actions">
          <a class="route-button" :href="link('first-app')"
            >{{ copy.start }} <span aria-hidden="true">↗</span></a
          ><a class="route-text-link" href="#navigation-model"
            >{{
              word([
                'Try the stack',
                'Experimente a pilha',
                'Prueba la pila',
                '体验导航栈',
              ])
            }}
            <span aria-hidden="true">↓</span></a
          >
        </div>
        <div class="hero-install">
          <code>{{ command }}</code
          ><button
            type="button"
            @click="copyInstall"
            :aria-label="
              word([
                'Copy install command',
                'Copiar comando de instalação',
                'Copiar comando de instalación',
                '复制安装命令',
              ])
            "
          >
            {{ copied ? '✓' : '⧉' }}
          </button>
        </div>
        <p v-if="copied || copyFailed" class="copy-status" role="status">
          {{
            copyFailed
              ? word([
                  'Select the command to copy it.',
                  'Selecione o comando para copiar.',
                  'Selecciona el comando para copiarlo.',
                  '请选择并复制命令。',
                ])
              : word(['Copied.', 'Copiado.', 'Copiado.', '已复制。'])
          }}
        </p>
        <a class="hero-compatibility" :href="link('compatibility')"
          >{{ copy.note }} <span aria-hidden="true">↗</span></a
        >
      </div>
      <div id="navigation-model" class="hero-model"><NavigationScene /></div>
    </section>
    <div class="route-platforms route-shell">
      <span>{{
        word([
          'FAMILIAR API. NATIVE AT HEART.',
          'API FAMILIAR. ESSÊNCIA NATIVA.',
          'API FAMILIAR. ESENCIA NATIVA.',
          '熟悉的 API，原生的体验。',
        ])
      }}</span>
      <div>
        <b>Vue 3</b><i aria-hidden="true">↳</i><b>NativeScript</b
        ><i aria-hidden="true">↳</i><b>iOS + Android</b>
      </div>
      <a href="https://github.com/rafaelaugustos/vue-router-ns">MIT / GitHub ↗</a>
    </div>
    <section class="route-proof route-shell route-section" aria-labelledby="proof-title">
      <div class="proof-copy" data-reveal>
        <span class="route-eyebrow"
          >01 /
          {{
            word([
              'THE NATIVE FEELING',
              'A SENSAÇÃO NATIVA',
              'LA SENSACIÓN NATIVA',
              '原生体验',
            ])
          }}</span
        >
        <h2 id="proof-title">
          {{ word(['Every gesture.', 'Cada gesto.', 'Cada gesto.', '每个手势。'])
          }}<br /><em>{{
            word(['Right at home.', 'No seu lugar.', 'En su lugar.', '恰到好处。'])
          }}</em>
        </h2>
        <p>
          {{
            word([
              'The header, the Back gesture, the page waiting underneath. Let the platform do what it does best, while your app keeps its own story.',
              'O header, o gesto de voltar, a página esperando logo abaixo. Deixe a plataforma fazer o que sabe, enquanto seu app guarda a própria história.',
              'La barra, el gesto de volver, la página que espera debajo. Deja que la plataforma haga lo que sabe mientras tu app conserva su historia.',
              '导航栏、返回手势、下方等待的页面。让平台发挥所长，让应用保留自己的故事。',
            ])
          }}
        </p>
        <a class="route-text-link" :href="link('native-showcase')"
          >{{
            word([
              'Inside Fieldnotes',
              'Por dentro do Fieldnotes',
              'Dentro de Fieldnotes',
              '探索 Fieldnotes',
            ])
          }}
          ↗</a
        >
        <div class="proof-code">
          <span>FAMILIAR, BY DESIGN</span>
          <pre><code><b>await</b> router.push('/notes/coast')
<b>await</b> router.back()
<i>// {{ word(['Same page. Same state.', 'Mesma página. Mesmo estado.', 'Misma página. Mismo estado.', '同一页面，同一状态。']) }}</i></code></pre>
        </div>
      </div>
      <div class="proof-media" data-reveal>
        <div class="proof-media-heading">
          <span class="edition-dot" aria-hidden="true"></span
          >{{
            word([
              'REAL NATIVE RECORDINGS',
              'GRAVAÇÕES NATIVAS REAIS',
              'GRABACIONES NATIVAS REALES',
              '真实原生录屏',
            ])
          }}
        </div>
        <div class="proof-devices">
          <Clip
            name="native-showcase-preview"
            :width="210"
            :caption="copy.caption"
          /><Clip
            name="android-drawer"
            :width="185"
            :caption="
              word([
                'Android drawer. Actual emulator recording.',
                'Drawer Android. Gravação real de emulador.',
                'Drawer Android. Grabación real de emulador.',
                'Android 抽屉导航，真实模拟器录屏。',
              ])
            "
          />
        </div>
        <a class="route-text-link" :href="link('examples')"
          >{{ copy.examples }} <span aria-hidden="true">↗</span></a
        >
      </div>
    </section>
    <section
      class="route-capabilities route-shell route-section"
      aria-labelledby="navigation-features"
    >
      <div class="route-section-heading" data-reveal>
        <div>
          <span class="route-eyebrow"
            >02 /
            {{
              word([
                'ROOM TO GROW',
                'ESPAÇO PARA CRESCER',
                'ESPACIO PARA CRECER',
                '为成长留出空间',
              ])
            }}</span
          >
          <h2 id="navigation-features">{{ copy.featureTitle }}</h2>
        </div>
        <p>{{ copy.featureIntro }}</p>
      </div>
      <div class="route-feature-grid">
        <a
          v-for="feature in copy.features"
          :key="feature[0]"
          class="route-feature"
          :href="link(feature[3])"
          data-reveal
          ><span class="feature-number">{{ feature[0] }}</span>
          <div>
            <h3>{{ feature[1] }}</h3>
            <p>{{ feature[2] }}</p>
            <span class="route-text-link">{{ feature[4] }}</span>
          </div>
          <span class="feature-arrow" aria-hidden="true">↗</span></a
        >
      </div>
    </section>
    <section
      class="route-learning route-shell route-section"
      aria-labelledby="navigation-learn"
    >
      <div class="route-section-heading" data-reveal>
        <div>
          <span class="route-eyebrow"
            >03 /
            {{
              word([
                'YOUR NEXT DESTINATION',
                'SEU PRÓXIMO DESTINO',
                'TU PRÓXIMO DESTINO',
                '你的下一站',
              ])
            }}</span
          >
          <h2 id="navigation-learn">{{ copy.learn }}</h2>
        </div>
        <p>{{ copy.learnIntro }}</p>
      </div>
      <div class="route-steps">
        <a v-for="step in copy.steps" :key="step[0]" :href="link(step[3])" data-reveal
          ><span class="step-index">{{ step[0] }} <span aria-hidden="true">↗</span></span>
          <h3>{{ step[1] }}</h3>
          <p>{{ step[2] }}</p></a
        >
      </div>
    </section>
    <section class="route-ecosystem route-shell" aria-labelledby="ecosystem-title">
      <div data-reveal>
        <span class="route-eyebrow">{{
          word(['GOOD COMPANY', 'BOA COMPANHIA', 'BUENA COMPAÑÍA', '一路同行'])
        }}</span>
        <h2 id="ecosystem-title">
          {{
            word([
              'Made to work together.',
              'Feitos para trabalhar juntos.',
              'Hechos para trabajar juntos.',
              '为协作而生。',
            ])
          }}
        </h2>
        <p>
          {{
            word([
              'Add your own visual language and motion. The navigation stays yours.',
              'Adicione sua linguagem visual e movimento. A navegação continua sua.',
              'Añade tu lenguaje visual y movimiento. La navegación sigue siendo tuya.',
              '加入自己的视觉语言与动效，导航依然由你掌控。',
            ])
          }}
        </p>
      </div>
      <a href="https://jolt.rafaelaugusto.dev/" class="ecosystem-link"
        ><b>jolt.</b
        ><span>{{
          word([
            'Motion, with feeling.',
            'Movimento com sensação.',
            'Movimiento que se siente.',
            '有温度的动效。',
          ])
        }}</span
        ><i aria-hidden="true">↗</i></a
      ><a href="https://mavis-ui.getcortexlabs.com/" class="ecosystem-link"
        ><b>mavis.</b
        ><span>{{
          word([
            'Interfaces with character.',
            'Interfaces com personalidade.',
            'Interfaces con personalidad.',
            '有个性的界面。',
          ])
        }}</span
        ><i aria-hidden="true">↗</i></a
      >
    </section>
    <section class="route-finale route-shell" aria-labelledby="finale-title">
      <span class="route-eyebrow">{{ copy.existing }}</span>
      <h2 id="finale-title">
        {{ word(['The next page', 'A próxima página', 'La próxima página', '下一页，'])
        }}<br /><em>{{ word(['is yours.', 'é sua.', 'es tuya.', '由你书写。']) }}</em>
      </h2>
      <p>{{ copy.existingText }}</p>
      <div class="route-actions">
        <a class="route-button" :href="link('recipes')">{{ copy.recipes }} ↗</a
        ><a class="route-text-link" :href="link('vue-router')"
          >{{ copy.differences }} ↗</a
        >
      </div>
    </section>
  </div>
</template>
