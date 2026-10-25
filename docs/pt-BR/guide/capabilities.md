# Capacidades nativas e escolha de containers

Experimente o [Fieldnotes, exemplo nativo integrado](./native-showcase), para percorrer drawer, busca, ações compartilhadas, guards e resultado de modal em um único app.

Comece pelo que o aplicativo precisa mostrar e escolha quem controla essa apresentação. O NativeScript fornece headers e controles; o router fornece identidade das rotas, guards, resultados e coordenação de pilhas nativas. Conteúdo, ações de negócio e política de persistência pertencem ao aplicativo.

Esta página descreve a **0.1.0-rc.3**, comparada à base anterior **0.1.0-rc.2**. “Existente” significa disponível na rc.2; “rc.3” identifica adições que exigem a nova candidata ou um build local. O pacote ainda é uma release candidate, sem promessa de estabilidade 1.0. Os guias detalhados continuam sendo a referência das APIs.

## Encontre uma capacidade

Os exemplos abaixo são caminhos do repositório. Siga a [configuração do demo](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/README.md) e compile o pacote antes de executar um exemplo opcional. A [tabela de compatibilidade](./compatibility) registra a base de dependências.

| Necessidade                                    | Responsável / disponibilidade                                                       | Limite por plataforma                                                                                                           | Guia e código executável                                                                                                                                                                                              |
| ---------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Header e botões nativos                        | Core `ActionBar` / `ActionItem`; existente                                          | Barra de navegação UIKit no iOS, Toolbar nativa no Android                                                                      | [Barras nativas](./native-bars); [`Inbox.vue`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/pages/Inbox.vue), demo normal                                                                       |
| Título grande que recolhe                      | Core `ActionBar iosLargeTitle`; existente                                           | iOS com conteúdo nativo rolável. ActionBar padrão Android não oferece política equivalente de Material app bar recolhível       | [Barras nativas](./native-bars); Inbox do demo normal                                                                                                                                                                 |
| Busca nativa por página                        | Router `useNativeSearch`; existente                                                 | `UISearchController` iOS; SearchView no title view da ActionBar Android existente                                               | [Propriedade da busca](./native-bars); Inbox do demo normal                                                                                                                                                           |
| Ações contextuais e prévia de item             | Integração de menu do router, callbacks do app; existente                           | Prévia/menu nativo iOS; popup Android com ação explícita de abrir                                                               | [Menus de contexto](./context-menus); [`MessagePreview.vue`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/components/MessagePreview.vue), Inbox do demo normal                                  |
| Ações compartilhadas entre header/menu/teclado | Router `usePageActions` / `PageActionItem`; **rc.3**                                | Elegibilidade, ocupação e erros compartilhados entre superfícies suportadas; salvar/compartilhar/excluir ainda pertencem ao app | [Ações por página](./page-actions); [`actions-app.ts`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/testing/actions-app.ts), `--env.actionsTest`                                                |
| Comandos de teclado                            | Registro e despacho nativo do router; existente                                     | Teclado físico e atalhos variam por plataforma                                                                                  | [Teclado](./keyboard); [`navigation-commands.ts`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/navigation-commands.ts), demo normal                                                             |
| Drawer / menu personalizado permanente         | Router `RouterDrawer`                                                               | Overlay Android existente; overlay iOS e apresentação adaptativa/permanente na **rc.3**                                         | [Drawer](./drawer); [`adaptivedrawer-app.ts`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/testing/adaptivedrawer-app.ts), `--env.adaptivedrawerTest`                                           |
| Históricos por aba / sidebar de abas no iPad   | Router `RouterTabs` com hosts nativos; existente                                    | Abas/sidebar UIKit no iOS 18+; bottom navigation/rail Material Android com fallback Core documentado                            | [Abas](./tabs); [`App.vue`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/App.vue), demo normal                                                                                                  |
| Lista/detalhe adaptativo                       | Router `RouterSplitView`, Frames nativos separados; existente                       | Multiplataforma, com geometria de dobra Android opcional                                                                        | [Split](./split-view); Inbox do demo normal                                                                                                                                                                           |
| Colunas controladas pelo UIKit                 | Router `RouterUIKitSplitView`; experimental, existente                              | iOS 18+; controla a raiz da janela. Não pode ser filho de drawer ou abas                                                        | [Split UIKit](./split-view); [`uikitsplit-app.ts`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/testing/uikitsplit-app.ts), `--env.uikitsplitTest`                                              |
| Modal nativo e resultado tipado                | Apresentação de rota do router e host modal nativo; existente                       | Histórico interno separado; comportamento/dependências das sheets variam                                                        | [Modais](./modals); [`Compose.vue`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/pages/Compose.vue), demo normal                                                                                |
| Zoom / shared elements / Voltar preditivo      | Transições UIKit/Core e coordenação do router; existente                            | Zoom iOS exige 18+ e API no runtime; progresso Android exige 14+. Sem controlador interativo universal                          | [Transições](./transitions), [limites de controle](./interactive-transitions); [`Transitions.vue`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/pages/Transitions.vue), Settings no demo normal |
| Diagnóstico de navegação                       | Coletor/export opcional do router; existente. Visualizador no navegador na **rc.3** | Estado lógico/nativo e tempos, sem heap/FPS nativo ou time travel ao vivo                                                       | [Diagnósticos](./diagnostics), [visualizador](./diagnostics-viewer); [`Diagnostics.vue`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/pages/Diagnostics.vue), Settings no demo normal           |
| Múltiplas janelas / recriação                  | Um router por janela nativa; existente                                              | Base publicada e testes específicos de reconstrução de tasks/cenas                                                              | [Janelas](./windows); [`windows-app.ts`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/testing/windows-app.ts), `--env.windowsTest`                                                              |

Execute flags em `demo`, por exemplo `ns run ios --env.actionsTest` ou `ns run android --env.actionsTest`. Fixtures exclusivos de iOS exigem iOS. Large titles, headers, busca e menus não exigem um novo subsistema “Native Navigation Headers”.

<a id="choose-a-container"></a>

## Escolha um container

| Container                  | O que controla                                              | Quando usar                                                                                                                      |
| -------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `RouterView`               | Um Frame nativo e sua pilha de rotas                        | Navegação comum push/back.                                                                                                       |
| `RouterTabs` + `RouterTab` | Seleção de destinos e Frames montados em cada aba           | Destinos precisam preservar históricos independentes. `sidebar` muda a apresentação das abas UIKit; não cria um drawer genérico. |
| `RouterDrawer`             | Menu ao redor de conteúdo já montado, sem histórico próprio | Conteúdo de navegação personalizado ou menu permanente adaptativo. Seus botões decidem entre push, link ou reset de pilha.       |
| `RouterSplitView`          | Organização lista/detalhe em Frames e sua adaptação         | Um fluxo lógico se expande em painéis. Pode ser conteúdo de drawer ou estar dentro de aba.                                       |
| `RouterUIKitSplitView`     | `UISplitViewController` da janela e suas colunas            | Você quer controle nativo de colunas/raiz e aceita limites experimentais e de plataforma.                                        |

Um drawer permanente, a sidebar de abas UIKit e colunas split podem ter aparência semelhante. O controle de histórico e controllers é diferente; escolha por essa responsabilidade, não apenas pela aparência.

## Componha drawer com destinos independentes

Mantenha container e Frames nomeados montados. Adapte `presentation` do drawer em vez de trocar árvores inteiras com chave e `v-if`:

```vue
<RouterDrawer ref="drawer" presentation="auto" :breakpoint="840">
  <template #drawer>
    <StackLayout>
      <Button text="Inbox" @tap="router.openLink('/')" />
      <Button text="Settings" @tap="router.openLink('/settings')" />
    </StackLayout>
  </template>
  <RouterTabs>
    <RouterTab name="inbox" title="Inbox">
      <RouterView name="inbox" />
    </RouterTab>
    <RouterTab name="settings" title="Settings">
      <RouterView name="settings" initial="/settings" />
    </RouterTab>
  </RouterTabs>
</RouterDrawer>
```

Este trecho pertence a um app com router instalado. Configure `links.frame` para escolher `settings` em `/settings` e `inbox` nos demais casos; o [guia de drawer](./drawer) e o [fixture executável](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/testing/drawer-app.ts) mostram a configuração completa. `openLink` seleciona o destino e sua pilha. Navegação bem-sucedida fecha o overlay; guard que recusa mantém o drawer aberto. Selecionar destino não implica reset do histórico.

**Composição não suportada:** `<RouterDrawer><RouterUIKitSplitView /></RouterDrawer>` pede que dois containers controlem raízes nativas incompatíveis. Use `RouterSplitView` dentro do drawer ou torne `RouterUIKitSplitView` a raiz da janela e organize suas colunas. Não remonte `RouterView` para simular transição: isso descarta histórico nativo e identidade das páginas.

## Estado, foco e acessibilidade

Uma Page mantida preserva estado Vue enquanto outra a cobre. `usePageState` inclui pequenos estados serializáveis na restauração após morte do processo; não preserva promises nem objetos nativos. A consulta de busca pertence ao app, e sua ativação precisa mirar a página atual elegível. [Ações por página](./page-actions) também recusam execução por um dono coberto, inativo ou descartado.

Use botões nativos com rótulos claros nos destinos do drawer, mantenha Menu/Voltar como alternativa a gestos e declare alvos de [foco de navegação](./accessibility). Respeite movimento reduzido. Verificações automatizadas da hierarquia nativa não comprovam foco falado pelo VoiceOver/TalkBack. Cada relatório vinculado explica seus limites.

## Propostas não são capacidades entregues

A [investigação de transições interativas](./interactive-transitions) propõe limites, não uma API comum nova ou integração Jolt. O [preview Android controlado pelo Core](./android-back) exige candidato não publicado e fixado; Core 9.1.3 usa fallback. Material app bar recolhível no Android, transporte de diagnósticos ao vivo e paridade de gestos em hosts arbitrários não são promessas desta visão geral.
