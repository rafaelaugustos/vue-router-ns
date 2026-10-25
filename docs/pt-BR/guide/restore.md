# Restaurando a pilha depois que o app é morto

O Android mata apps em segundo plano o tempo todo, e traz um app nativo de volta na tela em que ele estava, com a back stack. Aqui toda página é um path, então a pilha é uma lista de strings e o router pode salvá-la para você:

```ts
import { ApplicationSettings } from '@nativescript/core'

const router = createRouter({
  routes,
  restore: {
    save: (state) => ApplicationSettings.setString('stacks', JSON.stringify(state)),
    load: () => JSON.parse(ApplicationSettings.getString('stacks', 'null')),
  },
})
```

<Clip name="android-restore" aspect="9 / 20" caption="O nome digitado volta depois que o demo vai para segundo plano, tem o processo encerrado e abre novamente. Emulador Android 16." />

O `save` roda depois de cada navegação e quando o app vai para o segundo plano, com os paths de cada `<RouterView>` nomeado, e com `null` quando o app sai por conta própria, para um início depois que o usuário saiu continuar limpo. Quando um `<RouterView>` monta, o router chama o `load` uma vez (pode ser assíncrono) e reconstrói a pilha salva sem animar, passando pelos guards, então uma página que precisa de sessão ainda manda você para o login.

Saves mais velhos que `maxAge` (30 minutos por padrão) são ignorados; passe `Infinity` para restaurar sempre.

## O que não volta

Modais, e `props` passadas pelo `push`. Uma página que depende delas deve lidar com a ausência, lendo os params no lugar. Se um path salvo não corresponde mais a nenhuma rota, depois de uma atualização por exemplo, a pilha começa do `initial`.

## Formato e limites

`SavedStacks` tem a forma `{ version: 2, savedAt: number, stacks: Record<string, string[]>, entries: Record<string, SavedEntry[]> }`. `savedAt` é um timestamp em milissegundos. Use nomes de pilha estáveis; o split view salva lista e detalhes como uma única pilha. `load()` é chamado uma vez por instância do router, e cada view restaura sua pilha quando é montada.

A restauração recria páginas a partir de paths. Sozinha, não salva refs locais, posição de scroll ou objetos arbitrários; uma página guarda isso com [`usePageState()`](#estado-da-pagina). `maxAge` fica dentro de `restore`, por exemplo `restore: { save, load, maxAge: Infinity }`.

## Estado da página

Os caminhos trazem as páginas de volta; o que o usuário tinha nelas é outra história. Um rascunho, uma posição de leitura ou uma seleção também podem voltar, se a página disser o que guardar:

```ts
import { usePageState } from 'vue-router-ns'

const body = ref('')
usePageState('draft', {
  save: () => (body.value ? { body: body.value } : undefined),
  restore: (value) => (body.value = value.body),
})
```

O `save` roda depois de cada navegação e quando o app vai para o segundo plano, e precisa devolver dados pequenos e compatíveis com JSON: nada de views nativas, closures ou promises. Devolva `undefined` para não guardar nada, que é como uma página deixa um rascunho sensível de fora. O `restore` roda uma vez, depois que a view nativa da página carregou, com o que o `save` guardou; recebe a versão com que foi salvo e a `Page` nativa, caso um offset de rolagem precise esperar o layout. Uma página que só quer saber que voltou pode marcar uma flag dentro do `restore`.

Toda página ganha uma chave estável, salva ao lado do caminho, então duas páginas no mesmo caminho recebem cada uma o próprio estado de volta. Chaves e estado viajam em `SavedStacks.entries`, alinhados com `stacks`; o formato `version: 2` ainda carrega um save só de caminhos, que simplesmente não tem estado.

### Versões e migrações

Dê uma `version` ao formato quando ele mudar, e um `migrate` para trazer saves antigos adiante:

```ts
usePageState('draft', {
  version: 2,
  save: () => ({ subject: subject.value, body: body.value }),
  restore: (value) => Object.assign(form, value),
  migrate: (old, version) =>
    version === 1 ? { subject: '', body: (old as { text: string }).text } : undefined,
})
```

Um save de outra versão passa pelo `migrate`; sem ele, ou quando devolve `undefined`, a página começa do zero. Um `restore` ou `migrate` que lança erro é reportado em desenvolvimento e a página também começa do zero.

### Rotas renomeadas e removidas

O `migrate` de estado da página altera o formato dos dados de um hook. Ele não renomeia rotas. O histórico salvo contém paths, então mudar apenas o nome da rota não altera a localização salva. Quando um path mudar, traduza-o em `restore.load` antes de retornar o snapshot:

```ts
import type { SavedStacks } from 'vue-router-ns'

function migratePaths(saved: SavedStacks | null): SavedStacks | null {
  if (!saved) return null
  return {
    ...saved,
    stacks: Object.fromEntries(
      Object.entries(saved.stacks).map(([name, paths]) => [
        name,
        paths.map((path) => (path === '/legacy-edit' ? '/edit' : path)),
      ]),
    ),
  }
}

// Dentro de restore:
// load: () => migratePaths(JSON.parse(ApplicationSettings.getString('stacks', 'null')))
```

O exemplo mapeia somente esse path exato. Trate params e query strings explicitamente para as URLs antigas do seu app. Mantenha a ordem e o alinhamento com `entries`: duas entradas `/legacy-edit` continuam com chaves e rascunhos próprios. Ao remover ou reordenar paths, transforme também as entradas dos mesmos índices. Preserve `savedAt` para não reativar dados expirados e `windowKey` para impedir que outra janela consuma o snapshot.

Sem migração explícita, um path indisponível reinicia aquela pilha em `initial`. Os guards continuam executando durante a restauração. Se um guard redirecionar uma página salva para outro path, o rascunho não será transferido à página de destino. No logout, limpe os snapshots e dados sensíveis armazenados pelo app, além de aplicar os guards de autorização; guards não apagam o armazenamento.

### O que continua por conta do app

- Estado que não sobrevive ao `JSON.stringify` é descartado com um aviso em desenvolvimento, assim como uma página cujo estado passa de `restore.stateLimit` (8 KiB por padrão).
- Uma página restaurada em outro lugar, porque um guard a redirecionou, deixa o estado salvo para trás: o estado segue o caminho.
- Uma promise de `pushForResult()` não sobrevive à morte do processo. A página que esperava volta sem ela; um fluxo que precisa da resposta depois deve guardá-la na própria store, ou no estado da página que perguntou.
- Modais não são restaurados. Persista e reselecione a aba ativa por conta própria. Snapshots por janela contêm `windowKey`, mas o app precisa fornecer uma chave estável de documento e associá-la à janela nativa correta; veja [janelas nativas](#janelas-nativas).

## Janelas nativas

No Core 9.1.3+, um router ligado a uma `NativeWindow` recebe contexto de janela em `save(state, context)` e `load(context)`. Use `restore.key` e `context.key` para separar os snapshots. Nesse modo, sair do processo preserva a pilha; fechar uma janela grava `null` somente no snapshot dela. O comportamento de limpar ao sair descrito acima se aplica ao modo legado, sem uma janela proprietária. Veja [janelas nativas](./windows#persistencia-por-janela) para inicialização e limites.

### Responsabilidades e comportamento validado

| Dados                                                        | Responsável                                                                       |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| Paths por pilha, chaves estáveis e estado de página opt-in   | Snapshot do router, persistido pelo seu callback `save`.                          |
| Migração do formato do estado de página                      | `version` e `migrate` de cada hook `usePageState`.                                |
| Migração de paths, troca de conta e limpeza do armazenamento | Política de `load`/armazenamento do app.                                          |
| Aba selecionada e identidade da janela/documento             | O app; use chaves de snapshot independentes por documento.                        |
| Promises pendentes de modais/resultados e objetos nativos    | Não são persistidos. Reconstrua operações recuperáveis a partir dos dados do app. |

Exemplos nativos executáveis: [`state-app.ts`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/testing/state-app.ts) (`--env.stateTest`) cobre rascunhos e rolagens de paths duplicados, migração de formato, expiração, rotas removidas e logout; [`windows-app.ts`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/testing/windows-app.ts) (`--env.windowsTest`) restaura rascunhos duplicados e chaves de entradas em janelas independentes. Siga a configuração do demo e a [preparação dos recursos de janelas](https://github.com/rafaelaugustos/vue-router-ns/tree/main/scripts/native/windows) antes de compilá-los.

O CI obrigatório valida encerramento real do processo Android e restauração das tarefas originais nas APIs 34/36, além da reconstrução das cenas UIKit originais em um novo processo no iPadOS 18.6. O [relatório de aceitação](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-page-state.md) distingue isso do retorno de segundo plano e da reconexão no mesmo processo. Os resultados são de emulador/simulador; navegação por janela continua experimental e seus [limites de plataforma](./windows) continuam valendo.
