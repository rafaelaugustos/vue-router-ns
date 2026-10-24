# Tarefas comuns do aplicativo

Comece pelo que o app precisa fazer. Estes caminhos levam a um padrão funcional, depois aos detalhes da API e às restrições de plataforma. Para apps completos executáveis, veja a [galeria de exemplos](./examples).

| Quero…                                             | Use este padrão                                                      | Confira antes de publicar                                                                                                           |
| -------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Abrir um detalhe e voltar à mesma lista            | [Primeiro app](./first-app), `push` / `back`                         | Mantenha a busca na página preservada; [visibilidade é diferente de montagem](./mental-model#visibility-is-different-from-mounting) |
| Confirmar antes de perder uma edição               | [Leave guard condicional](./guards)                                  | Ative só enquanto houver alterações; o swipe-back iOS fica desativado durante o guard                                               |
| Devolver um valor escolhido ou editado             | [`pushForResult` e `back({ result })`](./modals)                     | Trate `undefined` como cancelamento; o genérico `T` não valida o valor em runtime                                                   |
| Exigir login antes de abrir um destino             | [Guards globais ou de rota](./guards)                                | Redirecione para uma rota permitida; um leave guard não executa apenas porque houve push                                            |
| Manter históricos separados por destino principal  | [Pilhas nomeadas em abas](./tabs)                                    | Um drawer sozinho não cria uma pilha por item do menu                                                                               |
| Manter um menu visível em uma janela larga         | [Drawer adaptativo](./drawer)                                        | Meça a largura do container; painel permanente e overlay `open` têm estados distintos                                               |
| Mostrar lista e detalhe juntos                     | [Navegação split](./split-view)                                      | Escolha Frame split ou UIKit split e siga as restrições de raiz/composição                                                          |
| Compartilhar uma ação entre header e menu          | [Ações da página](./page-actions)                                    | Operações do negócio, confirmações e permissões continuam no app                                                                    |
| Buscar dentro de uma página preservada             | [Busca nativa](./native-bars)                                        | A consulta é estado da aplicação; digitar não adiciona entradas de navegação                                                        |
| Abrir um destino por link do sistema               | [Deep links](./deep-links)                                           | Configure manifest/entitlements nativos, mapeamento da rota e pilha de destino                                                      |
| Receber uma imagem ou documento do sistema         | [Fluxos nativos](./native-flows)                                     | Diferencie cancelamento de erro e respeite o contexto da página/janela                                                              |
| Recuperar o app depois que o SO encerra o processo | [Restauração de estado](./restore)                                   | Persista estado serializável; Promises JavaScript não sobrevivem ao encerramento                                                    |
| Devolver foco acessível depois de um modal         | [Foco de navegação](./accessibility)                                 | Use IDs nativos estáveis e teste com tecnologias assistivas reais                                                                   |
| Entender uma navegação lenta ou que falhou         | [Diagnósticos](./diagnostics) e [visualizador](./diagnostics-viewer) | Exporte do app afetado; relatórios sintéticos não são benchmarks do aparelho                                                        |

## Escolha o próximo nível de detalhe

- **Aprender um fluxo completo:** [primeiro app](./first-app), depois [Fieldnotes](./native-showcase).
- **Encontrar padrões nativos copiáveis:** [catálogo por funcionalidade](./demo).
- **Consultar método ou tipo:** [referência da API](./api).
- **Decidir se um recurso atende uma plataforma:** [mapa de capacidades](./capabilities) e [compatibilidade](./compatibility).

## Quando os recursos opcionais ajudam

[Rotas por arquivos](./file-routing) podem substituir uma tabela explícita grande; [layouts](./layouts) e [middleware](./middleware) organizam convenções compartilhadas. [Loaders](./data-loading), [Suspense nativo](./suspense), [janelas](./windows) e hosts/destinos personalizados continuam experimentais onde indicado. Adicione-os por uma necessidade concreta depois que o fluxo básico funcionar.
