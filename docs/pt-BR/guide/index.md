# Aprenda vue-router-ns

Construa a navegação de um app NativeScript-Vue 3 com rotas, params, guards e resultados. O router coordena pilhas nativas reais: páginas continuam vivas umas sob as outras, cada aba pode ter seu próprio histórico e o Back nativo faz parte do fluxo.

<a id="por-onde-comecar"></a>

## Comece aqui

| Seu objetivo                | Por onde começar                           | O que você terá                                                             |
| --------------------------- | ------------------------------------------ | --------------------------------------------------------------------------- |
| Adicionar o router a um app | [Instalação](./install)                    | Uma Page nativa renderizada pelo `RouterView`                               |
| Aprender construindo        | [Seu primeiro app](./first-app)            | Lista, detalhe e editor modal protegido, com código completo                |
| Entender o comportamento    | [Páginas, pilhas e estado](./mental-model) | Um modelo para o ciclo da página, Back nativo, abas e modais                |
| Avaliar as possibilidades   | [Galeria de exemplos](./examples)          | Gravações reais ligadas a guias, código executável e limites por plataforma |
| Resolver uma tarefa do app  | [Tarefas comuns](./recipes)                | Um caminho até a API relevante e suas restrições importantes                |

O tutorial inicial pressupõe conhecimento básico de componentes Vue e um projeto NativeScript-Vue funcionando. Ele apresenta uma pilha antes de adicionar resultados e guards. O [Fieldnotes](./native-showcase) vem depois: drawer, busca nativa, ações compartilhadas e as mesmas regras de preservação de estado.

<a id="o-que-ele-cobre"></a>

## Escolha a estrutura de navegação

Comece com um `RouterView`. Adicione [abas](./tabs) para destinos com históricos independentes, um [drawer](./drawer) para envolver o conteúdo com um menu, ou [lista/detalhe](./split-view) para layouts compactos e expandidos. Um [modal](./modals) controla temporariamente uma pilha separada e pode devolver um valor.

O [guia de containers](./capabilities#choose-a-container) explica as combinações suportadas e por que drawer, sidebar de abas e split UIKit têm responsabilidades diferentes.

## Adicione a experiência nativa

Mantenha títulos e botões no [ActionBar](./native-bars) do NativeScript. Use [ações da página](./page-actions) para compartilhar comportamento entre headers, menus e comandos de teclado suportados. Adicione [menus contextuais](./context-menus), [transições](./transitions), [foco e movimento](./accessibility) conforme o fluxo precisar.

Para integrar o app ao sistema, siga com [deep links](./deep-links), [pickers](./native-flows), [restauração de estado](./restore) e [diagnósticos](./diagnostics). Convenções de arquivos e integrações experimentais ficam nos guias avançados; rotas explícitas continuam sendo o padrão.

<a id="por-que-nao-o-proprio-vue-router"></a>

## Vindo do Vue Router

Os nomes familiares ajudam, mas um app móvel pode ter várias pilhas nativas e páginas preservadas. Leia [as diferenças](./vue-router) e o [modelo de navegação](./mental-model) antes de aplicar pressupostos do ciclo de páginas da web.

O pacote é uma release candidate. A página de [compatibilidade](./compatibility) identifica dependências suportadas, APIs experimentais e limites da validação. A [referência da API](./api) serve para consulta depois que você sabe qual parte do sistema precisa usar.
