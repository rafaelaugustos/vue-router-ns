# Navegação em múltiplas janelas nativas

Este recurso é experimental e exige as dependências suportadas Core 9.1.3+ / NativeScript-Vue 3.1.2+, além da configuração nativa de múltiplas janelas.

O router controla os apps Vue das páginas em Frames e os mantém enquanto suas rotas permanecem no histórico nativo. A recriação de Activity Android foi validada com Core 9.1.3 e NativeScript-Vue 3.1.2 publicados, sem patch de dependência. O HMR de páginas e layouts continua usando substituição de Page nativa. A restauração das tarefas Android e sessões UIKit originais após morte do processo foi validada. A desconexão/reconexão de cenas no iPad dentro do mesmo processo também foi validada: as Pages originais, o estado Vue, os guards e os resultados de navegação pendentes são preservados. A suíte solicita uma desconexão real pelo UIKit usando um driver exclusivo do simulador; esse teste é separado da volta do background e da restauração após morte do processo.

O demo agora usa NativeScript-Vue 3.1.3. A correção upstream de `$navigateTo` não substitui o ciclo de vida das páginas controlado pelo router, descrito acima. O [relatório de validação da 3.1.3](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-vue-3.1.3.md) separa os novos resultados da evidência anterior em 3.1.2 e registra os limites por plataforma.

## Um router por janela

Cada `NativeWindow` possui um router. Views nomeadas, pilha de modais, fila de navegação, guards e resultados são independentes. Duas janelas podem ter uma view chamada `inbox`.

```ts
const router = createRouter({ routes, window: request.window })
```

O router pode inferir a janela pelo `getNativeWindow()` da primeira view montada. Passe `window` ao inicializar uma janela secundária para definir a propriedade e a restauração antes da primeira página carregar. `router.window` é uma ref readonly dessa janela; fica undefined no modo legado. Ligar outro router à mesma janela ou montar views de um router em janelas diferentes é um erro.

## Abrindo uma rota em outra janela

```ts
router.openWindow(
  { name: 'message', params: { id: 42 } },
  { data: { documentId: 'message:42' } },
)
```

A localização é resolvida com os tipos de rota do chamador e enviada a `Application.openWindow()`. A pilha de origem permanece e seus leave guards não rodam. A navegação inicial da nova janela passa pelos próprios guards. Isso é uma solicitação ao sistema, não uma Promise que confirma a abertura da cena; a configuração nativa ou o sistema pode recusá-la. A ausência das APIs NativeWindow gera erro.

O app fornece o novo conteúdo por `Application.setWindowContentResolver`. `getWindowRoute(request.data)` lê o path resolvido enviado por `openWindow`; a chave de dados `__vueRouterNS` é reservada. Os outros dados precisam ser serializáveis pela plataforma.

```ts
import { Application } from '@nativescript/core'
import { createApp, h } from 'nativescript-vue'
import { createRouter, getWindowRoute, RouterView } from 'vue-router-ns'
import App from './App.vue'
import { routes } from './routes'

// Registre antes de iniciar o app principal. undefined mantém sua raiz
// habitual. Outros papéis de janela do app também podem ser tratados aqui.
Application.setWindowContentResolver((request) => {
  if (request.window.rootView) return request.window.rootView
  const initial = getWindowRoute(request.data)
  if (request.isPrimary && !initial) return undefined

  const router = createRouter({ routes, window: request.window })
  const app = createApp({
    render: () => h(RouterView, { initial: initial ?? '/' }),
  }).use(router)
  const vm = app.mount()
  request.window.on('close', () => app.unmount())
  return vm.$el.nativeView
})

const router = createRouter({ routes })
createApp(App).use(router).start()
```

A raiz secundária é montada e devolvida à janela; não chama `start()` novamente. Os apps de páginas navegadas do NativeScript-Vue herdam o contexto do app principal; o wrapper do router fornece a cada página seu router e sua rota ligados à janela. Compartilhe serviços pelo app principal; contextos independentes de plugins/provides por janela não são propagados automaticamente às páginas navegadas.

O resolver pertence ao app. Componha-o com os handlers existentes em vez de substituir silenciosamente o resolver de outro plugin. O recebimento de URLs/notificações continua sendo integração do app; veja [deep links](./deep-links).

## Configuração nativa

No Android, a Activity de entrada precisa permitir várias instâncias: `singleTask`/`singleInstance` do template habitual reutilizam uma Activity. Use uma configuração suportada pelo core/runtime, como `standard` ou `singleInstancePerTask` em versões compatíveis do Android. No iPadOS, ative `UIApplicationSupportsMultipleScenes` no manifesto de cenas e use o ciclo de vida de cenas. Um telefone ou build Preview pode não permitir abrir outra cena.

Consulte o [guia de múltiplas janelas do NativeScript](https://docs.nativescript.org/guide/multi-window) para a configuração completa. `openWindow` encaminha o pedido; não altera o manifesto, entitlements ou capacidades do aparelho instalado. Ofereça uma ação normal com `push()` quando seu app não tiver suporte a múltiplas janelas.

O router Android vinculado usa a classe da Activity sobrevivente para abrir outra janela, inclusive depois que a Activity original termina. Isso evita a limitação de [NativeScript #11526](https://github.com/NativeScript/NativeScript/issues/11526) em `router.openWindow()`; chamadas diretas a `Application.openWindow()` mantêm o comportamento do Core.

## Desconexão, reconexão e fechamento

Back e gestos preditivos são tratados pela Activity/janela de origem. A apresentação de modais usa uma página dessa janela em vez do alvo global de modais do NativeScript-Vue. Uma janela inativa não consome o back da janela ativa.

Um evento temporário `detached` mantém as pilhas lógicas e promises de resultados, solta os callbacks de gesto da Activity e salva o snapshot atual. `attached` liga os callbacks à Activity substituta. Um `close` permanente encerra pilhas/listeners daquela janela e resolve resultados pendentes com `undefined`; não pode esperar leave guards assíncronos. Mantenha o mesmo router ao reconectar uma janela existente; crie outro ao reconstruir a janela em um novo processo JS.

No iOS, o router também reconstrói a pilha de controllers nativos do Frame retido quando sua cena retorna. O Core 9.1.3 recria um controller vazio apesar de manter o histórico JavaScript. Essa compatibilidade usa metadados de ciclo de vida de Frame/Page do Core e APIs públicas de pilha do UIKit, sem alterar dependências nem usar APIs privadas da Apple. Os hooks temporários são removidos após a reconstrução ou o descarte do router.

## Persistência por janela

```ts
const router = createRouter({
  routes,
  window: request.window,
  restore: {
    key: String(request.data?.documentId ?? request.window.id),
    save: (state, scope) => {
      ApplicationSettings.setString(`router:${scope!.key}`, JSON.stringify(state))
    },
    load: (scope) =>
      JSON.parse(ApplicationSettings.getString(`router:${scope!.key}`, 'null')),
  },
})
```

Importe `ApplicationSettings` de `@nativescript/core`. O segundo argumento opcional de `save` e o argumento de `load` são `RestoreContext`: `{ windowId, key }`. São fornecidos para routers ligados a janelas e omitidos no modo legado. Os callbacks existentes continuam válidos; stores de múltiplas janelas precisam usar o contexto para separar snapshots. `key` usa `primary` para a janela principal inferida automaticamente, preservando stores existentes de uma janela após a morte do processo; janelas fornecidas explicitamente usam o ID nativo por padrão. Esse valor é capturado ao vincular a janela e não muda quando outra janela se torna principal. Forneça uma chave de documento/sessão do app para cada janela explícita que precise ser restaurada entre processos.

Snapshots de janela incluem `windowKey`; uma chave incompatível é ignorada na leitura. Snapshots legados sem ela continuam legíveis. Fechar uma janela salva `null` apenas com o contexto dela. Sair do processo salva os históricos das janelas em vez de apagar todos; o modo legado mantém o comportamento de limpar ao sair.

Escolha no resolver a prioridade entre rota recebida e histórico restaurado. Um novo pedido `openWindow` normalmente começa na rota solicitada e ignora um snapshot antigo; uma reconstrução pelo sistema normalmente restaura a janela salva. Use os dados de estado/sessão do pedido nativo e os metadados do app para distinguir esses casos. Use `usePageState()` para estado de página opcional e versionado; Promises pendentes e objetos nativos não sobrevivem à morte do processo.

### Tarefas e sessões originais do sistema

No Android 10 / API 29 ou posterior, o router registra um observador de Activity enquanto possui janelas nativas. Ele marca os bundles das suas Activities com um identificador de processo. Quando outro processo retoma essas tarefas, um callback anterior à criação remove os IDs obsoletos de Frame/root do Core e o estado do FragmentManager AndroidX antes da restauração nativa. Recriar a Activity no mesmo processo mantém todo o estado. Metadados da janela, ActivityResult, dados do app e outros provedores de estado são preservados; o observador é removido ao liberar o último router. É um adaptador de compatibilidade para a restauração do Core 9.1.3, usando chaves conhecidas do Core/AndroidX, sem modificar dependências instaladas.

O ID nativo da janela principal pode mudar quando o processo Android reinicia, mesmo mantendo o ID da tarefa. Persista chaves de documento do app. Abaixo da API 29, esse adaptador não está disponível: reconstrua novas janelas pela aplicação ou mantenha um fluxo de janela única. A restauração automática das múltiplas tarefas originais não é suportada nessas versões.

O UIKit pode reconectar sessões salvas em outra ordem. Ao abrir uma cena, persista a associação entre seu ID nativo persistente e a chave de documento do app. Consulte essa associação no resolver **antes** de tratar a primeira cena recebida como o documento padrão. Uma conexão após reinício pode não conter o payload original de `openWindow()`. Usar apenas `request.isPrimary` ou a ordem de chegada pode trocar os históricos entre janelas. Remova a associação quando a sessão for descartada permanentemente. O exemplo nativo em `demo/src/testing/windows-app.ts` demonstra essa política do app e verifica cada documento contra o ID da sua cena original.

## Links entregues a uma janela

Com `links` habilitado, intents Android e URLs, atividades e atalhos de cenas iOS recebidos com o app aberto chegam somente ao router da Activity/cena correspondente. Fechar o router remove seus listeners e desativa os callbacks de delegate legado que o Core não permite remover.

Para uma nova janela secundária, o Core chama o resolver de conteúdo **depois** de emitir o evento inicial. Encaminhe a URL do request explicitamente ao novo router com `router.openLink(url, { source: 'launch' })`; a chamada aguarda a restauração e o primeiro host nativo. Leia a URL de `request.android?.intent` ou `request.ios?.connectionOptions`. No Android, não repita o intent antigo quando existir `request.android?.savedInstanceState`. Defina a política de link novo versus histórico salvo antes desse encaminhamento. Por padrão, o link entra sobre o histórico restaurado; `clearHistory: true` inicia outra pilha.

Uma notificação sem janela de origem depende da política do app: escolha o router/janela e chame seu `openLink()`.
