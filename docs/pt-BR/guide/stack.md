# Definindo a pilha inteira

Como o `NavigationStack(path:)` do SwiftUI, a pilha pode ser definida como uma lista, e as páginas seguem:

```ts
await router.setStack(['/', '/orders', { name: 'order', params: { id: 42 } }])
```

O router mantém as páginas que as duas pilhas compartilham, de baixo para cima, volta até a última delas e empurra o resto. Só o último passo anima. Os guards rodam para cada passo, e a primeira falha interrompe. Uma rota modal na lista vira uma página comum: a lista descreve a pilha de um frame.

Ele aceita `frame`, `animated` e `transition` como segundo argumento. É a base do [`withParents`](./deep-links#trazendo-os-pais-junto) e da [restauração de uma pilha salva](./restore).

A lista não pode ser vazia. Se um guard interromper o processo, os passos já concluídos permanecem: `setStack()` não é uma transação. Em um `RouterSplitView`, a lista fica fixada como primeira entrada, mesmo quando omitida no argumento.

## Voltando sem animar

`back()`, `backTo()` e `backToRoot()` aceitam `animated: false`. `go(delta)` só recebe o deslocamento; use `backTo()` ou `backToRoot()` quando precisar de opções. Um frame anima um pop do jeito que a página removida entrou, então o router define isso na página antes de remover.
