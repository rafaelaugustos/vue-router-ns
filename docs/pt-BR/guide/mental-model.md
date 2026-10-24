# Páginas, pilhas e estado

Uma rota descreve o destino. Uma pilha nativa controla as páginas abertas. `RouterView` cria um Frame do NativeScript; o router coordena a navegação e acompanha o histórico nativo desse Frame.

Essa distinção importa ao voltar de um detalhe, trocar de aba ou fechar um modal. Percorra o exemplo abaixo uma etapa por vez.

<StackModel />

## Uma página é uma entrada com seu próprio ciclo

`push` adiciona uma entrada. A página anterior continua montada. Um `ref` local, como a busca de uma lista, pertence àquela página preservada e continua lá depois do Back. `replace` remove a entrada atual; Back remove a entrada do topo. Páginas removidas são desmontadas.

Dentro de uma página roteada, `useRoute()` se refere **à rota daquela página**. Abrir outra página não transforma todas as anteriores no novo destino. `useRouter()` fica vinculado à pilha que controla a página. Fora das páginas, `router.currentRoute` pode orientar a interface global de navegação; ele não substitui o `useRoute()` local.

| Estado                                     | Onde colocar                                          | Duração                                             |
| ------------------------------------------ | ----------------------------------------------------- | --------------------------------------------------- |
| Busca da lista ou estado visual de rolagem | Refs/views locais da página                           | Enquanto a entrada estiver preservada               |
| Texto não salvo do editor                  | Ref local da página de edição                         | Até remover o editor, salvo explicitamente pelo app |
| Nota compartilhada entre lista e detalhe   | Store da aplicação                                    | Conforme a persistência implementada pelo app       |
| Estado depois que o processo encerra       | Armazenamento do app e restauração opcional do router | Exige serialização e recuperação explícitas         |

Páginas preservadas não são armazenamento persistente. O [primeiro app](./first-app) mantém notas em memória; encerrar o processo perde os dados. Consulte [restauração](./restore) quando o app precisar recuperar estado depois disso.

<a id="visibility-is-different-from-mounting"></a>

## Visibilidade é diferente de montagem

Abrir um detalhe ou modal pode cobrir a página sem removê-la. Voltar não chama seu `onMounted` outra vez. Use `onPageActivated` para atualizar ao reaparecer, `onPageDeactivated` para pausar trabalho enquanto está coberta e `onUnmounted` para limpeza final. O [guia do ciclo de página](./pages) explica esses hooks.

## Containers controlam coisas diferentes

- Um `RouterView` controla uma pilha de um Frame.
- Abas podem selecionar pilhas nomeadas; trocar de aba não significa reiniciar o histórico.
- Um drawer envolve o conteúdo existente. Abri-lo não cria uma rota; seus botões decidem qual navegação solicitar.
- Uma rota modal recebe um Frame separado. O `useRouter()` interno navega naquela pilha; Back na raiz fecha o modal.
- Um layout split tem regras explícitas para histórico compacto/expandido. Escolha o container suportado antes de combiná-lo com outros.

Consulte [escolha de containers](./capabilities#choose-a-container) antes de aninhar componentes. Mais containers não criam automaticamente históricos independentes.

## Back nativo e guards

O app pode chamar `router.back()`, e a plataforma também oferece botões e gestos. O router sincroniza a navegação nativa concluída com seu estado. Leave guards atuam quando uma página seria **removida**, e não simplesmente coberta por um push.

Um gesto interativo iOS não pode esperar uma confirmação assíncrona. Um leave guard ativo desliga o swipe-back daquela página; usar `{ when: dirty }` mantém o gesto disponível enquanto ela está sem alterações. Botões nativos, modais e Android têm seus próprios caminhos suportados. Veja a matriz de plataformas em [guards](./guards).

**Próximo passo:** [construa o fluxo](./first-app) ou [escolha os containers do app](./capabilities).
