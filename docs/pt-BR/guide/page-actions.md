# Ações da página

Defina uma ação uma vez na página roteada e reutilize seu estado e callback no header e no menu de contexto nativos. `usePageActions` compõe com a `ActionBar`, os menus de rota e os comandos de teclado existentes. Não substitui o controller de navegação nem o botão de voltar.

<Clip name="page-actions" caption="Ações compartilhadas entre header e menu, estado desabilitado, localização e erros no aplicativo nativo real." />

```vue
<script setup lang="ts">
import { ref } from 'nativescript-vue'
import { usePageActions, vRoutePreview } from 'vue-router-ns'

const title = ref('Salvar')
const canSave = ref(true)
const errorMessage = ref('')
const actions = usePageActions(
  [
    {
      id: 'save',
      title,
      enabled: canSave,
      busyTitle: 'Salvando…',
      image: 'square.and.arrow.down',
      async run({ signal }) {
        // A aplicação implementa a persistência e respeita o cancelamento.
        await saveDraft({ signal })
      },
    },
    { id: 'details', title: 'Details', run: ({ router }) => router.push('/details') },
  ],
  {
    onError: (error) => {
      errorMessage.value = String(error)
    },
  },
)
// Preserve o objeto enquanto apenas o estado das ações muda.
const menu = { to: '/details', actions: actions.menu(['save', 'details']) }
</script>

<template>
  <Page>
    <ActionBar title="Editor">
      <PageActionItem :actions="actions" action="save" ios.position="right" />
      <!-- ActionItems comuns podem coexistir aqui. -->
    </ActionBar>
    <StackLayout>
      <Label v-route-preview="menu" text="Hold for actions" />
      <Label :text="errorMessage" textWrap="true" />
    </StackLayout>
  </Page>
</template>
```

`PageActionItem` é registrado pelo plugin do router e também pode ser importado. Coloque-o na ActionBar da página roteada que criou as ações. Refs e getters permitem localizar os títulos sem reconstruir o registro. `saveDraft` acima pertence à aplicação, não é uma API do router.

## Definição e execução

`usePageActions(source, { onError? })` aceita um array, ref ou getter. IDs precisam ser únicos e não vazios dentro do registro; IDs literais são inferidos pelo TypeScript.

| Campo                           | Significado                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------ |
| `id`, `run({ router, signal })` | ID estável e callback síncrono ou assíncrono da aplicação.                           |
| `title`, `busyTitle?`           | String, ref ou getter; o título de execução substitui o normal enquanto a ação roda. |
| `enabled?`, `visible?`          | Boolean, ref ou getter; ambos são true por padrão.                                   |
| `destructive?`                  | Boolean, ref ou getter. Apenas apresentação; a confirmação continua na aplicação.    |
| `image?`                        | Nome de SF Symbol, ref ou getter, somente para o menu de contexto do iOS.            |

`get(id)` e `list()` expõem o estado resolvido (`id`, `title`, `enabled`, `visible`, `busy`, `image`, `destructive`). `busy` é uma ref somente leitura com o ID em execução ou `undefined`. `menu(ids?)` produz bindings para `RouteMenuOptions.actions`: os IDs são capturados na chamada, mas o estado permanece reativo. Gere novos bindings se o conjunto de IDs mudar.

Cada registro admite um callback por vez. Durante a execução, todas as suas ações ficam desabilitadas em todas as superfícies. Toques repetidos retornam false, sem fila. Registros separados são independentes.

- `await actions.execute(id)` retorna true quando o callback termina, false quando indisponível e rejeita falhas comuns. True representa a conclusão do callback, **não o sucesso da navegação**: examine o resultado de falha retornado pelo router dentro de `run` quando necessário.
- `await actions.dispatch(id)` é o adaptador de eventos usado pelo header e pelo menu. Reporta a falha uma vez por `onError(error, id)` e resolve false. Sem handler, registra erros em desenvolvimento e produção; erros do próprio handler também são contidos e registrados.
- Se o callback rejeita com `AbortError` depois do sinal de descarte abortar, resolve false. Se ignora o cancelamento e conclui, resolve true, inclusive quando a ação remove sua própria página com sucesso.

## Ciclo de vida e navegação

Uma nova execução exige que a página dona esteja atual, carregada, na aba selecionada, sem modal por cima e sem navegação pendente. Header e menu verificam isso novamente antes de executar. Não é possível conectar o registro a outra página ou janela. Use o **router vinculado à página** recebido pelo callback para preservar guards, resultados e a pilha de origem. Compartilhar, editar, excluir, persistir e pedir confirmação continuam sendo responsabilidades da aplicação.

O descarte da página/host e a substituição por HMR abortam o sinal e invalidam os bindings antigos. Cobrir a página com detalhe/modal ou trocar de aba bloqueia novas execuções, mas não aborta uma operação em andamento. Código assíncrono precisa respeitar `signal`, inclusive antes de efeitos após um `await`; o router não desfaz uma requisição que ignora o sinal. Uma falha real tardia continua sendo reportada após o descarte. É possível aguardar `router.pushForResult()`.

Em linhas recicladas, forneça **um novo objeto de opções quando o item de origem mudar**, por exemplo `v-route-preview="menuFor(item)"`. Rebinding, unload e detach fecham/invalidam o menu anterior: callbacks nativos e commits da prévia antiga não podem operar sobre o novo item. Preserve o objeto de opções para atualizar título/estado enquanto o menu está aberto. Capture a identidade do item no código da aplicação quando uma operação em andamento precisar continuar vinculada àquele item após o rebinding.

## Apresentação nativa

| Superfície              | Apresentação suportada                                                                                                                                                           |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Header no iOS e Android | ActionItem com Button nativo de texto como `actionView`. Título, visibilidade, estado desabilitado de acessibilidade e cor destrutiva reativos. `buttonClass` estiliza o Button. |
| Menu no iOS             | Título, SF Symbol e atributos disabled/destructive de UIAction. Menus abertos atualizam no iOS 14+; o iOS 13 lê o estado inicial e sempre verifica novamente ao selecionar.      |
| Menu no Android         | Títulos, visibilidade e estado habilitado do PopupMenu nativo, incluindo atualizações enquanto aberto. Sem mapeamento de ícones ou cor destrutiva.                               |

O adaptador de header usa texto. O NativeScript coloca ActionViews personalizadas diretamente na ActionBar do Android; portanto, `android.position="popup"` não é suportado por esse adaptador. Use ActionItems comuns para outras apresentações nativas. SF Symbols não são convertidos em ícones Material. Nenhuma toolbar, search controller ou delegate de navegação é instalado, e `backAction` permanece com seu dono existente. Veja [barras nativas](./native-bars) e [menus de contexto](./context-menus).

## Teclado opcional

Reutilize o registro existente em vez de instalar outro dispatcher:

```ts
const commands = useNavigationCommands([
  {
    id: 'save',
    title: () => actions.get('save')!.title,
    enabled: () => actions.get('save')!.enabled,
    shortcut: { input: 's', modifiers: [isIOS ? 'meta' : 'ctrl'] },
    action: () => actions.dispatch('save'),
  },
])
```

Importe `useNavigationCommands` de `vue-router-ns` e `isIOS` de `@nativescript/core`. Monte o `NavigationCommandScope` existente como em [comandos de teclado](./keyboard). As regras de foco, edição de texto, IME e atalhos do sistema continuam valendo. Nenhum atalho é registrado automaticamente.

O repositório inclui verificações reproduzíveis de input nativo e limitações em `test/native-page-actions.md`.
