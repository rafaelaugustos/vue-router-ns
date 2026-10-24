# Fieldnotes: exemplo integrado de navegação nativa

<Clip name="native-showcase" aspect="402 / 874" caption="Simulador iOS 26 real: drawer, busca e menus nativos, ações compartilhadas no header, resultado de modal, guards de edição e retorno à lista preservada." />

Fieldnotes é um pequeno app executável de lista/detalhe. O drawer abre destinos; headers e busca nativos levam à nota; ações do header e menu compartilham estado; o editor protege alterações não salvas; um modal nativo devolve resultado à mesma página de detalhe.

Ele usa APIs públicas e a próxima **0.1.0-rc.3** do repositório. A rc.2 publicada já oferece headers, large titles iOS, busca, menus contextuais, guards, resultados de modal e foco de navegação. O drawer iOS e as ações compartilhadas deste exemplo são novidades da rc.3. Compile este checkout para executar o exemplo completo; instalar apenas rc.2 não fornece essas adições.

## Execute a partir do checkout

Instale a CLI NativeScript e os SDKs seguindo a [configuração NativeScript](https://docs.nativescript.org/setup/). Na raiz do repositório:

```sh
npm ci
npm run build

# Gere os recursos nativos uma vez; App_Resources é ignorado pelo Git.
if [ ! -d demo/App_Resources ]; then
  showcase_resources=$(mktemp -d)
  ns create showcase-resources --template @nativescript/template-blank-ts --path "$showcase_resources"
  cp -R "$showcase_resources/showcase-resources/App_Resources" demo/App_Resources
fi

cd demo
npm install
npm run showcase:ios
# ou:
npm run showcase:android
```

Os scripts selecionam `--env.showcase`; o demo de e-mail continua sendo a entrada padrão. Ambos usam `org.nativescript.vuerouterns`, portanto instalar um substitui o outro no dispositivo escolhido. Passe `-- --device <id>` para selecionar simulador/emulador. A base testada é Core 9.1.3, NativeScript-Vue 3.1.2, runtime iOS 9.1.0 e Android 9.1.1.

## Percorra o fluxo completo

1. Abra **Menu → About this example** e depois **Return to library**. O overlay fecha quando a navegação confirma. O drawer não adiciona entrada ao histórico.
2. Toque em **Search**, digite `coast` e segure o cartão correspondente. Escolha **Star note**. A ação pertence àquele item, não a outra nota do catálogo.
3. Abra **Along the coast**. O header mostra **Unstar** porque o menu alterou a mesma nota em memória. Alterne a ação no header ou segure o cartão do detalhe para usar seu menu compartilhado.
4. Toque em **Review in a modal → Mark as reviewed**. A sheet fecha e o detalhe original mostra **Reviewed today**. Cancelar uma revisão posterior preserva o valor anterior.
5. Abra **Edit**, altere a nota e use Voltar nativo. Escolha **Keep editing**. Abra o drawer e tente **Library**: o mesmo guard protege essa saída, e a recusa mantém o drawer aberto. Feche o painel e toque em **Save**.
6. Volte do detalhe à lista. A página original e a consulta `coast` permanecem; a busca não reabre o teclado automaticamente.

As notas são fictícias e ficam apenas em memória. Save atualiza essa nota em memória; não é sincronização em nuvem nem persistência após reiniciar. A consulta pertence à Page da lista; o rascunho, à Page de edição. Para persistir após morte do processo, acrescente armazenamento do app e [restauração de estado por página](./restore).

## Onde cada recurso está

| Código em `demo/src/showcase`                                                                                                    | Responsabilidade                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`App.vue`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/showcase/App.vue)                                 | Um `RouterDrawer` ao redor de um `RouterView`. Library volta explicitamente à raiz; About empurra uma rota. Não há uma segunda implementação de navegação.    |
| [`router.ts`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/showcase/router.ts)                             | Rotas lazy de lista/detalhe/edição/about e a rota modal nativa.                                                                                               |
| [`pages/Library.vue`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/showcase/pages/Library.vue)             | `ActionBar`, `iosLargeTitle`, `useNativeSearch`, consulta da página e ScrollView nativo. A navegação deixa a integração de busca gerenciar seu ciclo de vida. |
| [`components/NoteCard.vue`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/showcase/components/NoteCard.vue) | Botão nativo acessível para abrir e menu específico do item. Chaves estáveis vinculam ações à nota correta.                                                   |
| [`pages/Note.vue`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/showcase/pages/Note.vue)                   | `usePageActions` compartilhado entre `PageActionItem` e menu; resultado tipado do modal; alvo de retorno de foco.                                             |
| [`pages/Edit.vue`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/showcase/pages/Edit.vue)                   | Rascunho local, guard condicional e confirmação nativa. Save atualiza os dados antes de voltar.                                                               |
| [`pages/Review.vue`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/showcase/pages/Review.vue)               | Page modal nativa, cancelamento e `back({ result })`.                                                                                                         |
| [`state.ts`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/showcase/state.ts)                               | Pequeno catálogo fictício e ref do drawer. Não controla o histórico nativo.                                                                                   |

O app tem uma pilha Frame. About é uma rota dessa pilha, não uma aba independente. Se precisar de históricos separados por destino, componha Frames nomeados em abas conforme [escolha de containers](./capabilities). Drawer adaptativo, visualizador de diagnóstico e adaptadores de transição não são requisitos deste exemplo.

## Apresentação nativa e alternativas acessíveis

No iOS, `iosLargeTitle` usa a barra UIKit real com conteúdo nativo rolável, e `useNativeSearch` instala um search controller pertencente à página. No Android, a Toolbar normal apresenta temporariamente SearchView nativo na área de título. O exemplo não desenha large title Android falso nem substitui pilhas para imitar transições.

Todas as rotas são acessíveis por botões nativos. Os cartões têm botão explícito de abrir; ações contextuais também ficam no header do detalhe ou em Review. `useNavigationFocus` declara headings iniciais e alvos de retorno entre lista/detalhe/modal. O drawer mantém seu isolamento e restauração de acessibilidade. O app usa a política padrão de movimento do sistema, sem animação personalizada adicional.

O ScrollView com três cartões mantém o exemplo pequeno. Para catálogos grandes, use lista virtualizada e reteste reutilização de linhas/menus e qualquer origem de zoom. Este exemplo usa transições normais; os [limites de transições interativas](./interactive-transitions) continuam aplicáveis.

## Validação e gravações

Veja o [relatório nativo](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-showcase.md) e os [scripts de reprodução](https://github.com/rafaelaugustos/vue-router-ns/tree/main/scripts/native/showcase). Eles separam input real, identidade via diagnósticos, plataformas gravadas e limites de acessibilidade manual. Compilar com sucesso não comprova funcionamento de navegação ou foco.

A entrada opcional `--env.showcaseTest` executa o **mesmo app** e grava snapshots limitados para aceitação. `--env.showcase` normal não inclui esse polling/bridge de arquivos; nenhum deles é publicado no pacote do router.
