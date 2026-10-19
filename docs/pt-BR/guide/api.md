# API

## Criando um router

```ts
import { createRouter } from 'vue-router-ns'

const router = createRouter({ routes, restore, backPreview: true })
```

| Opção         | Padrão      | Significado                                                                                                                                                         |
| ------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `diagnostics` | `false`     | `true` ou `{ maxEvents }` para timeline limitada e snapshots nativos. Veja [diagnóstico](./diagnostics).                                                            |
| `routes`      | Obrigatória | Array readonly de `RouteRecordRaw`.                                                                                                                                 |
| `restore`     | Desativado  | `save(state)`, `load()`, `maxAge` opcional em milissegundos (padrão: 30 minutos) e `stateLimit` em bytes por página (padrão: 8 KiB). Veja [restauração](./restore). |
| `backPreview` | `true`      | Revela a página anterior durante o gesto de voltar no Android 14+. Exige a [ativação na plataforma](./android-back#ativando).                                       |
| `links`       | Desativado  | `true` ou `{ schemes, hosts, map, frame, options, system }` para receber URLs do sistema. Veja [deep links](./deep-links#recebendo-urls-do-sistema).                |

Instale uma vez com `createApp(App).use(router).start()`. Isso registra os componentes e fornece `$router` e `$route` nos templates. `router.install(app)` é o hook de plugin do Vue.

## Métodos do router

`to` é um `RouteLocationRaw`: string de path, `{ path, query?, hash? }`, `{ name, params?, query?, hash? }` ou uma localização relativa à rota atual. Localizações em objeto também aceitam `replace` e `force`. Use `force: true` para empurrar outra instância da localização atual. Params pertencem a localizações nomeadas ou relativas, não a um objeto com `path`.

| Método                           | Comportamento                                                                                                                                                        |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `push(to, options?)`             | Adiciona uma página ou apresenta um modal.                                                                                                                           |
| `replace(to, options?)`          | Substitui a página atual.                                                                                                                                            |
| `back(options?)`                 | Remove uma página; fecha um modal na raiz. Na raiz de uma pilha não modal, não faz nada. O back do sistema Android ainda pode sair do app.                           |
| `go(delta)`                      | Volta um número negativo de páginas. Zero e valores positivos não fazem nada. Não recebe opções.                                                                     |
| `backTo(to, options?)`           | Volta à página correspondente mais próxima abaixo do topo; rejeita se não existir.                                                                                   |
| `backToRoot(options?)`           | Volta à primeira página da pilha atual.                                                                                                                              |
| `setStack(locations, options?)`  | Reconcilia uma lista não vazia com a pilha. Preserva o prefixo comum; para na primeira falha sem desfazer os passos concluídos.                                      |
| `pushForResult<T>(to, options?)` | Abre uma página e espera `back({ result })`. Resolve para `T \| undefined` quando ela fecha ou a abertura é impedida.                                                |
| `resolve(to)`                    | Resolve uma localização de forma síncrona sem navegar. Retorna `RouteLocation`; lança erro se não houver rota correspondente.                                        |
| `isReady()`                      | Promise que termina após a navegação inicial; não espera todas as abas ocultas carregarem.                                                                           |
| `openLink(url, options?)`        | Abre uma URL completa ou um path puro como o sistema faria: por `links`, com os pais, depois da primeira página e da pilha alvo. Resolve para um `LinkResult`.       |
| `resolveLink(url)`               | A `RouteLocation` para onde uma URL aponta sob `links`, ou `undefined`.                                                                                              |
| `onLink(listener)`               | Ouve todo link que o router recebeu, aceito ou não. Devolve a função que cancela a inscrição.                                                                        |
| `setShortcuts(shortcuts)`        | Substitui os atalhos da tela inicial (atalhos dinâmicos do Android, quick actions do iOS) por `RouteShortcut`s que abrem pelo `openLink`. Devolve os ids publicados. |
| `claimSystemBack(claimant)`      | Deixa um contêiner nativo (`{ owns(), back() }`) receber o voltar e o swipe de voltar do Android primeiro, como um drawer aberto. Devolve a função que libera.       |

Os métodos de navegação, exceto `pushForResult`, resolvem para `NavigationFailure | undefined`. Erros inesperados rejeitam a promise; veja [falhas](./navigating#falhas-e-erros). Os métodos de voltar seguem a [semântica do split view](./split-view#historico-e-voltar) quando chamados em uma pilha dividida.

### Opções de navegação

`push`, `replace` e `pushForResult` aceitam `NavigationOptions`:

| Opção          | Significado                                                                                                                                   |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `frame`        | Pilha nomeada de destino. Sem ela, usa a pilha da página chamadora ou a pilha em foco fora de uma página. Não seleciona uma aba do `TabView`. |
| `transition`   | Nome como `'fade'` ou objeto de transição do NativeScript; substitui o padrão da rota. Inclui `SharedTransition`.                             |
| `animated`     | `false` desativa a animação.                                                                                                                  |
| `clearHistory` | Remove páginas anteriores, passando pelos guards. Uma pilha split mantém a lista.                                                             |
| `props`        | Props extras da página, mescladas sobre as props do record. Não são persistidas pelo `restore`.                                               |
| `modal`        | `true`, `false` ou `ModalOptions`; substitui a apresentação definida na rota.                                                                 |
| `withParents`  | Empurra os ancestrais com componente antes do destino.                                                                                        |
| `zoomFrom`     | View, ref de elemento, componente ou `null`; origem do zoom nativo do iOS 18+.                                                                |

`back`, `backTo` e `backToRoot` aceitam `BackOptions`: `animated`, `frame` e `result`. `go(delta)` não tem parâmetro de opções. `setStack` aceita `SetStackOptions`: `frame`, `animated` e `transition`; a animação vale apenas para o último passo.

### Rotas e hooks

| Método                                              | Retorno                                                                     |
| --------------------------------------------------- | --------------------------------------------------------------------------- |
| `addRoute(record)` / `addRoute(parentName, record)` | Callback que remove a rota adicionada.                                      |
| `removeRoute(name)`                                 | `void`. Remove uma rota registrada; não remove páginas existentes da pilha. |
| `hasRoute(name)`                                    | `boolean`.                                                                  |
| `getRoutes()`                                       | `RouteRecord[]` normalizado.                                                |
| `beforeEach(guard)` / `beforeResolve(guard)`        | Callback que remove o guard.                                                |
| `afterEach((to, from, failure?) => …)`              | Callback que remove o hook.                                                 |
| `onError((error, to, from) => …)`                   | Callback que remove o handler.                                              |

Um `NavigationGuard` recebe `(to, from, { type })`, com `type` igual a `'push'`, `'replace'` ou `'back'`. Pode retornar uma promise. Retorne `false` para abortar, uma localização para redirecionar, ou `undefined`/`true` para continuar. Guards usam valores de retorno, não `next()`. Veja [guards](./guards).

### Middleware e helpers opcionais

`router.addRouteMiddleware(name, guard, { global }?)` registra middleware nomeado e retorna uma função para removê-lo. `meta.middleware` do destino aceita nomes/funções ou um array readonly. Middleware executa depois de `beforeEach`: globais primeiro, seguidos da lista do destino, antes de `beforeEnter`. `defineRouteMiddleware(guard)` tipa a função sem registrá-la.

`useNavigateTo()` captura no setup um helper vinculado à pilha daquela página. Fora do setup, use `navigateTo(router, to, options?)` com contexto explícito. Ambos delegam para push/replace e retornam `Promise<NavigationFailure | undefined>`. Opções: `NavigationOptions` mais `replace`. Tipos: `RouteMiddleware`, `RouteMiddlewareReference`, `RouteMiddlewareOptions`, `NavigateTo`, `NavigateToOptions`. Veja [middleware e helpers opcionais](./middleware) para ordem, descarte, convenções e limites dos gestos nativos.

### Estado

- `currentRoute`: ref readonly da rota em foco, incluindo o modal ativo.
- `stack`: ref readonly das rotas da base ao topo. Um router ligado a uma página expõe a pilha dela; o router exportado acompanha a pilha em foco.
- `diagnostics`: `RouterDiagnostics` quando ativado; caso contrário, `undefined`. Veja [diagnóstico](./diagnostics).
- `options`: configuração do router.
- `START_LOCATION`: localização vazia antes da navegação inicial (`path: '/'`, nenhum record correspondente).

## Localizações e records de rota

`RouteLocation` contém `path`, `fullPath`, `name`, `params`, `query`, `hash`, `meta`, `matched` e `redirectedFrom`. Params resolvidos são strings ou arrays de strings. Valores de query são strings, `null` ou arrays; na entrada também aceitam números, booleanos e `undefined`. `meta` é mesclado do pai para o filho.

`RouteRecordRaw` aceita `path`, `name` (string ou symbol), `component` (componente ou loader síncrono/assíncrono), `children`, `redirect` (localização ou função), `meta`, `props` (`true`, objeto ou função), `beforeEnter` (guard ou array), `modal` (`boolean` ou `ModalOptions`) e `transition`.

Paths aceitam parâmetros nomeados, opcionais/repetidos e padrões personalizados. Veja [rotas tipadas](./typed-routes). `children` aninha paths e metadados; não cria UI aninhada automaticamente.

`ModalOptions` repassa as opções de `showModal` do NativeScript, exceto `context` e `closeCallback`, controlados pelo router. As opções `ios` também aceitam `detents`, `selectedDetent`, `largestUndimmedDetent`, `grabber` e `cornerRadius`. Veja [modais e sheets](./modals).

## APIs opcionais de rotas por arquivos

`vue-router-ns/file-routing/webpack`, exclusivo do Node, exporta `NativeFileRoutesPlugin`, compatível com CommonJS e webpack 5. `vue-router-ns/file-routing/setup` exporta `prepareFileRouting(options)`, `FileRoutingOptions` e `PreparedFileRouting`. Essas entradas opcionais de build geram módulos por plataforma e tipos; o `installFileRouting(router)` gerado registra middlewares descobertos e trata HMR da tabela. Veja [configuração e suporte](./file-routing).

`vue-router-ns/file-routing` exporta o macro tipado de compilação `definePageMeta()`, `PageMeta`, `PageMetaValue`, `mergeFileRoutes(generated, explicit)` e `createFileRouteUpdater(router, routes)` (`FileRouteUpdater`). O updater altera o matching futuro e preserva as entradas nativas.

`vue-router-ns/file-routing/generator`, exclusivo do Node, exporta `generateFileRoutes(options)`, `writeFileRoutes(options)`, `watchFileRoutes(options, callbacks)`, `transformPageMeta(source, filename)` e `FileRouteError`; tipos: `FileRoutesOptions`, `GeneratedFileRoutes`, `FilePage`. O peer do compilador é opcional e necessário apenas no build. Veja [rotas por arquivos](./file-routing) para convenções, restrições de metadados, ownership de HMR e estado da integração.

## Layouts nativos opcionais

`createRouter({ layouts, defaultLayout })` registra componentes/factories de layouts por router. `defaultLayout` é `false` por padrão; `meta.layout` seleciona um nome ou desativa o layout com `false`. O layout monta a Page raiz e a ActionBar opcional; o destino fornece o corpo pelo slot padrão. A seleção fica fixa por entrada, com instâncias separadas do layout/conteúdo por visita. Nomes desconhecidos/imports com erro rejeitam antes da montagem. Veja [layouts nativos](./layouts) para ciclo de vida, HMR, diagnósticos e exemplos.

## Composables

| Função                                 | Contrato                                                                                                                                                                                                                                                             |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useRouter()`                          | Router ligado à pilha da página atual; router do app fora de páginas. Exige um app usando o router.                                                                                                                                                                  |
| `useRoute(name?)`                      | Rota fixa desta página, ou rota em foco fora de páginas. O nome opcional restringe os tipos; não seleciona outra rota.                                                                                                                                               |
| `onBeforeRouteLeave(guard, { when }?)` | Leave guard da página. `when` aceita boolean, ref ou getter. Removido no unmount.                                                                                                                                                                                    |
| `onPageActivated(hook)`                | Chamado quando a página fica visível, incluindo a primeira ativação e os retornos.                                                                                                                                                                                   |
| `onPageDeactivated(hook)`              | Chamado quando a página é coberta. Para remoção, use `onUnmounted` do Vue.                                                                                                                                                                                           |
| `useBackGesture()`                     | Shallow ref readonly de `{ progress, edge }` ou `null`; Android 14+. `edge` é `'left'`, `'right'` ou `'none'`.                                                                                                                                                       |
| `usePageState(key, options)`           | Mantém estado de página compatível com JSON através da morte do processo: `save`, `restore(value, { version, page })`, `version` e `migrate` opcionais. Precisa de `restore` no router. Veja [estado da página](./restore#estado-da-pagina).                         |
| `useNativeFlow(flow)`                  | Liga um `NativeFlow` (um picker do sistema, a activity de outro app) à página: `run(input, { before })` resolve uma vez com `completed`, `cancelled` ou `failed`; ref `running`. `createDocumentPicker()` é o fluxo embutido. Veja [fluxos nativos](./native-flows). |

Registre os hooks de página no setup do componente roteado. No split view expandido, lista e detalhe do topo ficam ativos. Veja [ciclo de vida e HMR](./pages).

## Componentes

| Componente        | Props e slots                                                                                                                                                                                                                                                                                                                |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RouterView`      | `name` (`'default'`), `initial` (`'/'`), `backToRootOnReselect` (`false`). Monta um Frame.                                                                                                                                                                                                                                   |
| `RouterSplitView` | `list` obrigatório; `name` (`'default'`), `breakpoint` (840), `listWidth` (320), `backToRootOnReselect` (`false`). Slot: `empty`.                                                                                                                                                                                            |
| `RouterDrawer`    | `width` (300), `open` (`v-model:open`), `closeOnNavigate` (`true`). Slots: conteúdo padrão e `drawer`. Eventos `opened`, `closed`; ref `open()`, `close()`, `toggle()`, `isOpen`. Só Android; o iOS renderiza o conteúdo. Veja [drawer no Android](./drawer).                                                                |
| `RouterTabs`      | `selected` (`v-model:selected`, nome da aba), `canSelect(name)`, `sidebar` (iOS 18+), `minimize` (`'never'`, iOS 26 `'onScrollDown'`/`'onScrollUp'`), `rail` (600, Android). Eventos `select`, `reselect`. Filhos: `RouterTab` com `name`, `title`, `icon` (SF Symbol), `androidIcon`, `badge`, `role`. Veja [abas](./tabs). |
| `RouterLink`      | `to` obrigatório; `replace`, `clearHistory`, `withParents`, `zoom` (todos `false`); `transition`, `frame`; `menu` (`RouteMenuOptions`: pressão longa pré-visualiza a rota). Um filho no slot padrão; o slot recebe `{ navigate }`. Adiciona um handler de tap sem wrapper nativo.                                            |
| `Deferred`        | Sem props. Slots: conteúdo padrão e `fallback`. Mostra o conteúdo após a primeira ativação da página e o mantém montado. Fora de página roteada, renderiza imediatamente.                                                                                                                                                    |

Nomes de router views devem ser únicos, incluindo split views. `name` e a rota inicial (`initial`/`list`) são lidos na montagem; use uma nova `key` do Vue para criar outra pilha. Dimensões do split view usam pixels independentes de dispositivo; a largura da lista é limitada à metade da largura disponível. Veja [split view](./split-view).

## Falhas e tipos exportados

`isNavigationFailure(value, type?)` identifica um `NavigationFailure` (`Error` com `type`, `to`, `from`). `NavigationFailureType` contém `aborted` (4), `cancelled` (8) e `duplicated` (16); o argumento opcional também aceita uma máscara de bits.

Os tipos públicos são exportados pela raiz do pacote:

- Abas: `RouterTabDescriptor`, `TabMinimize`, `TabRole`; `supportsNativeTabs()`.
- Configuração: `Router`, `RouterOptions`, `SystemBackClaimant`, `RouterDrawerHandle`, `RestoreOptions`, `SavedStacks`, `SavedEntry`, `SavedState`, `PageStateOptions`, `PageStateContext`.
- Rotas: `RouteRecordRaw`, `RouteRecord`, `RouteRecordName`, `RouteMeta`, `RouteProps`, `RouteComponent`, `RawRouteComponent`, `Lazy`.
- Localizações: `RouteLocation`, `RouteLocationRaw`, `RouteLocationPathRaw`, `RouteLocationNamedRaw`, `RouteLocationRelativeRaw`, `RouteParams`, `RouteParamsRaw`, `RouteParamValue`, `RouteParamValueRaw`, `LocationQuery`, `LocationQueryRaw`, `LocationQueryValue`, `LocationQueryValueRaw`.
- Navegação: `NavigationOptions`, `BackOptions`, `SetStackOptions`, `NavigationType`, `NavigationInfo`, `NavigationGuard`, `NavigationGuardReturn`, `NavigationHookAfter`, `NavigationErrorHandler`, `NavigationFailure`, `LeaveGuardOptions`.
- Fluxos nativos: `NativeFlow`, `NativeFlowContext`, `NativeFlowOutcome`, `NativeFlowHandle`, `NativeFlowRunOptions`, `DocumentPickerInput`, `DocumentPickerResult`; `startNativeFlow(flow, input, page)` roda um fora de uma página.
- Links: `LinksOptions`, `LinkOptions`, `IncomingLink`, `LinkResult`, `LinkIgnoredReason`, `LinkSource`, `LinkListener`, `RouteShortcut`. `supportsShortcuts()` informa se a plataforma mostra atalhos da tela inicial.
- Apresentação nativa: `ModalOptions`, `SheetOptions`, `SheetDetent`, `AndroidModalOptions`, `BottomSheetOptions`, `BottomSheetState`, `TransitionOption`, `ZoomSource`, `BackGesture`, `BackGestureEdge`. `supportsBottomSheets()` informa se o build Android inclui o Material.
- Tipos inferidos: `Register`, `RegisteredRouter`, `RouteMapFrom`, `RouteMapGeneric`, `RouteNames`, `RouteLocationOf`, `RouteLocationRawOf`, `ParamsFromPath`.

Estenda `Register` e `RouteMeta` como mostrado em [rotas tipadas](./typed-routes).

## Diagnóstico

`RouterDiagnostics` expõe `routerId`, `stopped`, `events`, `droppedEvents`, `snapshot()`, `subscribe(listener)`, `toJSON()`, `export()`, `clear()` e `stop()`. Os dados são readonly, limitados e sem valores de rota; `stop()` libera as fontes vivas. Tipos exportados: `DiagnosticsOptions`, `RouterDiagnostics`, `DiagnosticsExport`, `DiagnosticSnapshot`, `DiagnosticStack`, `DiagnosticHost`, `DiagnosticEntry`, `DiagnosticIssue`, `DiagnosticIssueCode`, `DiagnosticEvent`, `DiagnosticPhase` e `DiagnosticOutcome`. Veja [diagnóstico](./diagnostics) para formato, semântica dos tempos e ciclo de vida.

## Busca nativa

`useNativeSearch(options)` registra uma busca própria da página. Tipos: `NativeSearchOptions`, `NativeSearch`. Veja [barras e busca nativas](./native-bars) para persistência da query, ativação e diferenças entre plataformas.

## Comandos de teclado

`useNavigationCommands(source)` e `NavigationCommandScope` vinculam comandos opt-in à página/janela. Tipos: `NavigationCommand`, `NavigationCommandState`, `NavigationCommands`, `NavigationShortcut`, `KeyModifier`. Veja [comandos de teclado](./keyboard).

## Acessibilidade e movimento

`useNavigationFocus(options)` define alvos de foco inicial/retorno e restaura o elemento que iniciou um modal. Tipos: `NavigationFocus`, `NavigationFocusOptions`, `NavigationFocusTarget`. `RouterOptions.motion` aceita `MotionPolicy` (`system`, `reduced`, `full`), com padrão `system`. Veja [acessibilidade e movimento](./accessibility).

## Hosts nativos (experimental)

`mountNativeHost(router, name, host, initial?)` conduz uma pilha em um `NativeHost` e devolve a função que o desmonta. `useNativeHost<TNative>()` dá a uma página o `kind`, as `capabilities` e o contêiner `native` do seu host. `createFrameHost(frame, { modal? })` e `createSplitFrameHost(list, detail, { expanded, detailVisible })` são os hosts embutidos; `NATIVE_HOST_VERSION` é a versão do contrato que o router aceita. Tipos: `NativeHost`, `NativeHostCapabilities`, `NativeHostDelegate`, `NativeHostPushOptions`, `NativeHostBackOptions`, `NativeHostPart`, `NativeHostRole`, `NativeHostHandle`, `NativeHostVersion`, `FrameHostOptions`, `SplitFrameHostOptions`, `SplitFrames`, `BackGestureSession`, `BackPreview`. Veja [hosts nativos](./native-hosts).
