# Definindo a pilha inteira

## Selecionando uma entrada retida exata

`router.stack` lista rotas. `router.history` acrescenta um snapshot congelado com um endereço da instância atual de cada entrada retida, da base ao topo. Duas entradas no mesmo caminho têm endereços diferentes:

```ts
const snapshot = router.getHistory({ frame: 'inbox' })
const selected = snapshot?.entries[1]
if (selected) await router.backToEntry(selected, { animated: false })
```

`history.value` acompanha a pilha do chamador: a pilha em foco no router da aplicação ou a pilha proprietária dentro de uma página. `getHistory()` lê o mesmo escopo; `{ frame }` seleciona um frame nomeado neste router/janela. A leitura não revela abas nem navega. Use `computed(() => router.getHistory({ frame: 'inbox' }))` para uma visão reativa de uma pilha nomeada. Um escopo ausente ou fechado retorna `undefined`. O histórico de uma página fechada não passa a representar outra pilha.

Cada snapshot contém `scope` e `entries`. O escopo contém `id`, `name`, `kind` (`frame` ou `modal`), `windowId` quando vinculado a uma janela nativa e `pinnedRoot`. Cada entrada contém:

| Campo           | Significado                                                                                                                                                      |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scopeId`, `id` | Endereço exato aceito por `backToEntry()`. Permanece estável enquanto a pilha e a entrada existem, inclusive durante descarregamento temporário e HMR da página. |
| `key`           | Identidade do estado da página. A restauração versão 2 a preserva, mas cria um novo endereço de instância.                                                       |
| `route`         | Cópias de `path`, `fullPath`, `name`, `params`, `query` e `hash`. Sem registros de rota, componentes, metadados ou referências nativas.                          |
| `restored`      | Esta página foi reconstruída de uma pilha salva, inclusive de um snapshot antigo contendo apenas caminhos. É um novo objeto nativo.                              |

Snapshots, entradas, dados de rota e arrays internos de parâmetros/query são congelados. Um snapshot antigo continua sendo uma observação daquele momento; leia novamente para consultar as entradas atuais. Manter um snapshot não retém as Pages nativas do router.

`backToEntry(selected, { animated, result })` seleciona a pilha proprietária da entrada mesmo se outra pilha nomeada ganhou foco. A aba dessa pilha é revelada antes da navegação. Não há substituição por `frame` nem busca alternativa por rota. O resultado informado vai somente para a página do topo removida; os outros resultados removidos recebem `undefined`. Os guards de saída executam do topo para a base pelo caminho existente de Back, incluindo redirecionamentos, confirmação nativa e descarte.

- Selecionar o topo atual retorna uma falha `duplicated`, sem executar guards ou alterar o histórico.
- Uma entrada ausente, outro router/janela ou uma pilha fechada/substituída rejeita com erro. Reutilizar o nome do frame ou restaurar o mesmo caminho/chave não torna um endereço antigo válido.
- Um guard que recusa retorna `aborted` e preserva a pilha. Uma navegação mais nova, fechamento do proprietário ou alteração nativa do topo/alvo durante a espera retorna `cancelled`.
- Uma pilha retida e descarregada enfileira Back até o host carregar; outras pilhas podem continuar navegando. Uma pilha ainda não aberta não tem uma entrada retida para selecionar.
- A raiz fixa de um split pode ser selecionada e continua fixa. A seleção nunca a remove.
- Com um modal aberto, a seleção fica restrita à pilha do modal superior. Selecionar um histórico coberto rejeita sem fechar o modal; use primeiro o fluxo existente de Back do modal. Selecionar a raiz do modal o mantém aberto.

Persista rotas e estado da aplicação com a [restauração](./restore), não esses endereços de instâncias. Entradas removidas deixam de existir: não há histórico de avanço, e a reconstrução não recupera os objetos nativos anteriores. Os controles nativos de Back continuam presentes. Um menu opcional de histórico será outra etapa; esta API não instala um menu.

<Clip name="entry-history" :width="480" aspect="3 / 4" caption="Duas pilhas nativas: seleção da ocorrência exata, recusa por guard, endereço inválido, Back nativo cancelado/concluído e fechamento dos proprietários. Simulador iOS 18.6; rótulos do app em inglês." />

## Reconciliando uma lista de rotas

Como o `NavigationStack(path:)` do SwiftUI, a pilha pode ser definida como uma lista, e as páginas seguem:

```ts
await router.setStack(['/', '/orders', { name: 'order', params: { id: 42 } }])
```

O router mantém as páginas que as duas pilhas compartilham, de baixo para cima, volta até a última delas e empurra o resto. Só o último passo anima. Os guards rodam para cada passo, e a primeira falha interrompe. Uma rota modal na lista vira uma página comum: a lista descreve a pilha de um frame.

Ele aceita `frame`, `animated` e `transition` como segundo argumento. É a base do [`withParents`](./deep-links#trazendo-os-pais-junto) e da [restauração de uma pilha salva](./restore).

A lista não pode ser vazia. Se um guard interromper o processo, os passos já concluídos permanecem: `setStack()` não é uma transação. Em um `RouterSplitView`, a lista fica fixada como primeira entrada, mesmo quando omitida no argumento.

## Voltando sem animar

`back()`, `backTo()` e `backToRoot()` aceitam `animated: false`. `go(delta)` só recebe o deslocamento; use `backTo()` ou `backToRoot()` quando precisar de opções. Um frame anima um pop do jeito que a página removida entrou, então o router define isso na página antes de remover.
