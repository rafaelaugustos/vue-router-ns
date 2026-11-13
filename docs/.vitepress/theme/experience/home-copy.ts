import { computed } from 'vue'
import { useDocsLocale } from '../locale'
export function useHomeCopy() {
  const { localize } = useDocsLocale()
  return computed(() =>
    localize(
      {
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
      {
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
      },
    ),
  )
}
