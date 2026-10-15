# Lista e detalhe

O `RouterSplitView` mostra a lista e o detalhe lado a lado quando há espaço. Numa janela estreita, o detalhe cobre a lista. As rotas e os métodos de navegação são os mesmos nos dois layouts:

```vue
<RouterSplitView name="inbox" list="/messages">
  <template #empty>
    <Label text="Selecione uma mensagem" horizontalAlignment="center" verticalAlignment="middle" />
  </template>
</RouterSplitView>
```

A rota `list` é a primeira página, fixa. Toda rota não modal empilhada nessa stack vira um detalhe, independentemente do caminho ou da posição na árvore de rotas. Rotas com `modal` continuam abrindo separadamente. Uma split view nomeada pode conviver com `RouterView`s comuns, inclusive em abas diferentes.

```ts
// Dentro dos dois painéis, useRouter() aponta para a stack inteira.
await router.push('/messages/42')
await router.push('/messages/42/edit')

// De outro lugar, informe o nome da stack.
await router.push('/messages/42', { frame: 'inbox' })
```

## Layout e estado

O layout usa a largura disponível do componente, em pixels independentes de densidade, em vez do tipo de aparelho ou da largura total da tela. Rotação, redimensionamento e dobras que alteram essa largura podem trocar o layout. O breakpoint padrão é 840, e a coluna da lista tem largura 320:

```vue
<RouterSplitView list="/messages" :breakpoint="900" :listWidth="300" />
```

Os dois Frames nativos ficam montados. Redimensionar não recria páginas, não executa guards e não muda a rota selecionada. A posição de scroll da lista, o estado local dos componentes, campos não salvos e o histórico nativo do detalhe continuam no lugar. No layout expandido, a lista e o detalhe do topo ficam ativos para `onPageActivated`; um modal desativa os dois. `router.currentRoute` continua sendo o detalhe do topo até voltar para a lista.

O slot `empty` aparece na coluna de detalhe quando o layout expandido não tem detalhe selecionado. Ele não é uma rota nem uma entrada no histórico.

## Histórico e voltar

O histórico funciona da mesma forma nos dois layouts. Selecionar outro item com `push()` adiciona um detalhe; não descarta a seleção anterior. Na stack:

```text
/messages → /messages/42 → /messages/42/edit
```

Voltar leva primeiro a `/messages/42`, depois à lista. No layout expandido, esse último back limpa a coluna de detalhe. O back nativo e o do router permanecem sincronizados, e leave guards podem impedir a remoção de páginas.

- `push(list)` e `backToRoot()` voltam para a lista existente, passando pelos guards.
- `replace()` substitui o detalhe do topo. Na lista, abre o primeiro detalhe.
- `clearHistory: true` limpa o histórico de detalhes e mantém a lista.
- `setStack()` mantém a lista como primeira entrada, inserindo-a quando omitida.
- `pushForResult()` devolve resultados de detalhes ou modais normalmente.
- `restore` salva e restaura o histórico combinado como uma única stack nomeada.
- `backToRootOnReselect` funciona dentro de um `TabViewItem`, como no `RouterView`.

## Comportamento nativo

Lista e detalhe usam um Frame nativo cada. Uma página raiz transparente no Frame de detalhe fornece o destino do back; esse detalhe de implementação não aparece em `router.stack` nem no estado salvo. O modo compacto coloca o Frame de detalhe sobre a lista; o expandido o coloca ao lado. Nenhuma página muda de Frame ao redimensionar.

O primeiro detalhe abre entre painéis, então não usa shared transitions ou o zoom do iOS a partir da lista. Transições entre páginas de detalhe funcionam normalmente, incluindo o preview do predictive back no Android. Voltar do primeiro detalhe para a lista usa a transição normal do Frame. O componente se adapta à largura; ele não posiciona os painéis ao redor de uma dobradiça física.

`name` e `list` são lidos na montagem. Para criar outra split stack, monte um novo componente com uma `key` do Vue diferente.
