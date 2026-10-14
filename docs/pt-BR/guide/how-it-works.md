# Como funciona

Cada `<RouterView>` renderiza um `Frame` do NativeScript. As páginas são montadas com `$navigateTo`, dentro de um pequeno wrapper que fornece a rota delas e um router ligado à pilha delas. O NativeScript-Vue monta cada página como um app próprio, então nada fornecido pelo `<RouterView>` chegaria a elas de outro jeito.

O router nunca guarda um histórico próprio. Depois de cada `navigatedTo`, ele lê `frame.backStack` e a página atual e os espelha. Pops que ele não iniciou, como um swipe no iOS, são captados do mesmo jeito que os dele. O `replace` marca a entrada atual com `backstackVisible: false` antes de navegar, que é como o frame descarta uma página nativamente.

## Onde ele fala com a plataforma

- **Botão de voltar do Android**: `activityBackPressed`, cancelado e transformado em `router.back()` para os leave guards terem voz. No Android 14 ou mais novo, um `OnBackPressedCallback` acima do do core acompanha o swipe e entrega o progresso ao `useBackGesture()`.
- **Swipe de voltar do iOS**: `enableSwipeBackNavigation` desligado enquanto um leave guard está ativo.
- **Botão de voltar do iOS**: `UINavigationItem.backAction` (iOS 16) enquanto um leave guard está ativo.
- **Modais**: `modalInPresentation` enquanto um leave guard está ativo, e um delegate na frente do do core para ouvir um swipe segurado.
- **Abas**: um delegate na frente do da barra de abas no iOS, touch listeners na faixa de abas no Android, para ouvir um toque na aba selecionada.

## Testes

Os testes rodam contra um substituto do `Frame` do NativeScript ([`test/shims/core.ts`](https://github.com/rafaelaugustos/vue-router-ns/blob/master/test/shims/core.ts)). Ele segue a ordem do real: as navegações terminam num tick posterior, e as páginas descartadas são liberadas antes do `navigatedTo` disparar. As partes acima que tocam a plataforma são exercitadas por pequenas costuras que o shim consegue chamar, e conferidas em aparelhos uma a uma.
