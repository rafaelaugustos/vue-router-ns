# Como funciona

Cada `<RouterView>` renderiza um `Frame` do NativeScript e o entrega ao router como um [host nativo](./native-hosts). As páginas são montadas com `$navigateTo`, dentro de um pequeno wrapper que fornece a rota delas e um router ligado à pilha delas. O NativeScript-Vue monta cada página como um app próprio, então nada fornecido pelo `<RouterView>` chegaria a elas de outro jeito.

Em um `RouterView`, a pilha nativa é a fonte do histórico. Depois de cada `navigatedTo`, o host de Frame reporta uma mudança, e o router lê as páginas do host e as espelha. Pops que ele não iniciou, como um swipe no iOS, são captados do mesmo jeito que os dele. O `replace` marca a entrada atual com `backstackVisible: false` antes de navegar, que é como o frame descarta uma página nativamente.

O router fala com todo contêiner pelo mesmo contrato de host: o Frame de um `<RouterView>`, o frame dentro de um modal e os dois Frames de um `<RouterSplitView>`. Matching, guards, resultados e reconciliação ficam no router, uma vez só; apresentação, gestos e handles nativos ficam no host. O contrato é experimental e está documentado em [hosts nativos](./native-hosts).

## Onde ele fala com a plataforma

- **Botão de voltar do Android**: `activityBackPressed`, cancelado e transformado em `router.back()` para os leave guards terem voz. No Android 14 ou mais novo, um `OnBackPressedCallback` acima do do core acompanha o swipe e entrega o progresso ao `useBackGesture()`.
- **Swipe de voltar do iOS**: `enableSwipeBackNavigation` desligado enquanto um leave guard está ativo.
- **Botão de voltar do iOS**: `UINavigationItem.backAction` (iOS 16) enquanto um leave guard está ativo.
- **Modais**: `modalInPresentation` enquanto um leave guard está ativo, e um delegate na frente do do core para ouvir um swipe segurado.
- **Abas**: um delegate na frente do da barra de abas no iOS, touch listeners na faixa de abas no Android, para ouvir um toque na aba selecionada.

## Testes

Os testes rodam contra um substituto do `Frame` do NativeScript ([`test/shims/core.ts`](https://github.com/rafaelaugustos/vue-router-ns/blob/master/test/shims/core.ts)). Ele segue a ordem do real: as navegações terminam num tick posterior, e as páginas descartadas são liberadas antes do `navigatedTo` disparar. As partes acima que tocam a plataforma são exercitadas por pequenas costuras que o shim consegue chamar, e conferidas em aparelhos uma a uma.

## Lista e detalhe

`RouterSplitView` mantém dois Frames dentro de um `GridLayout` nativo: um para a lista fixada e outro para os detalhes. O router combina os dois em uma pilha lógica e omite a raiz transparente interna do detalhe. A largura altera a disposição dos Frames; não transfere páginas entre eles. Não usa `UISplitViewController` nem implementa um drawer.

## Atualizações em desenvolvimento

O wrapper encaminha reloads do componente roteado ao NativeScript-Vue para substituir a Page nativa. Uma página coberta espera o `navigatedTo` do Frame e o próximo tick do Vue antes de recarregar. Veja [HMR](./pages#hmr-durante-o-desenvolvimento).

As verificações nativas e seus ambientes estão registradas no [relatório de validação](https://github.com/rafaelaugustos/vue-router-ns/blob/master/test/native-validation.md); ele complementa os testes do shim.
