# Navegação em múltiplas janelas nativas

Este recurso é experimental e exige NativeScript core 9.1+ e a configuração nativa de múltiplas janelas. O router existente continua funcionando em versões anteriores suportadas do core no modo de uma janela.

A reconexão de Activity/cena exige atualmente a correção do NativeScript-Vue no [PR #1178](https://github.com/nativescript-vue/nativescript-vue/pull/1178). A versão publicada 3.1.2 pode desmontar apps de páginas retidas durante o descarte da UI nativa. Navegação em duas janelas funciona sem o patch, mas a retomada após recriação da superfície nativa não é suportada por esta integração até a correção estar disponível. A reconexão de cena iOS conduzida pelo sistema ainda está pendente de validação nativa.

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

Uma limitação do launcher do core após o fechamento da Activity Android original está registrada em [NativeScript #11526](https://github.com/NativeScript/NativeScript/issues/11526). Em runtimes afetados, pedir outra janela pode lançar erro mesmo com uma janela restante aberta.

## Desconexão, reconexão e fechamento

Back e gestos preditivos são tratados pela Activity/janela de origem. A apresentação de modais usa uma página dessa janela em vez do alvo global de modais do NativeScript-Vue. Uma janela inativa não consome o back da janela ativa.

Um evento temporário `detached` mantém as pilhas lógicas e promises de resultados, solta os callbacks de gesto da Activity e salva o snapshot atual. `attached` liga os callbacks à Activity substituta. Um `close` permanente encerra pilhas/listeners daquela janela e resolve resultados pendentes com `undefined`; não pode esperar leave guards assíncronos. Mantenha o mesmo router ao reconectar uma janela existente; crie outro ao reconstruir a janela em um novo processo JS.

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

Importe `ApplicationSettings` de `@nativescript/core`. O segundo argumento opcional de `save` e o argumento de `load` são `RestoreContext`: `{ windowId, key }`. São fornecidos para routers ligados a janelas e omitidos no modo legado. Os callbacks existentes continuam válidos; stores de múltiplas janelas precisam usar o contexto para separar snapshots. `key` usa o ID nativo por padrão; use uma chave de documento/sessão do app quando precisar de estabilidade entre reinícios de processo.

Snapshots de janela incluem `windowKey`; uma chave incompatível é ignorada na leitura. Snapshots legados sem ela continuam legíveis. Fechar uma janela salva `null` apenas com o contexto dela. Sair do processo salva os históricos das janelas em vez de apagar todos; o modo legado mantém o comportamento de limpar ao sair.

Escolha no resolver a prioridade entre rota recebida e histórico restaurado. Um novo pedido `openWindow` normalmente começa na rota solicitada e ignora um snapshot antigo; uma reconstrução pelo sistema normalmente restaura a janela salva. Use os dados de estado/sessão do pedido nativo e os metadados do app para distinguir esses casos. Use `usePageState()` para estado de página opcional e versionado; Promises pendentes e objetos nativos não sobrevivem à morte do processo.

## Links entregues a uma janela

Com `links` habilitado, intents Android e URLs, atividades e atalhos de cenas iOS recebidos com o app aberto chegam somente ao router da Activity/cena correspondente. Fechar o router remove seus listeners e desativa os callbacks de delegate legado que o Core não permite remover.

Para uma nova janela secundária, o Core chama o resolver de conteúdo **depois** de emitir o evento inicial. Encaminhe a URL do request explicitamente ao novo router com `router.openLink(url, { source: 'launch' })`; a chamada aguarda a restauração e o primeiro host nativo. Leia a URL de `request.android?.intent` ou `request.ios?.connectionOptions`. No Android, não repita o intent antigo quando existir `request.android?.savedInstanceState`. Defina a política de link novo versus histórico salvo antes desse encaminhamento. Por padrão, o link entra sobre o histórico restaurado; `clearHistory: true` inicia outra pilha.

Uma notificação sem janela de origem depende da política do app: escolha o router/janela e chame seu `openLink()`.
