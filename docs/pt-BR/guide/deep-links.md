# Deep links

Rotas são paths, então onde quer que seu app receba um link (um handler de URL, o payload de uma notificação), entregue o path ao router:

```ts
router.push('/messages/42')
```

Isso é seguro num cold start: uma navegação pedida antes da primeira página aparecer espera por ela e empilha por cima, então o back ainda cai na sua página inicial.

## Trazendo os pais junto

Um link para uma página aninhada pode trazer os pais dela, para o back subir pela hierarquia do app em vez de pular para a home:

```ts
router.push('/settings/account', { withParents: true })
// pilha: / → /settings → /settings/account
```

Os pais vêm do aninhamento por `children` na tabela de rotas, e só os que têm componente viram páginas:

```ts
{
  path: '/settings',
  component: Settings,
  children: [{ path: 'account', name: 'account', component: Account }],
}
```

Pais que já estão no topo são pulados, só a última página anima, e os guards rodam para cada página. Com `clearHistory`, os pais e a página viram a pilha inteira. O `<RouterLink>` também aceita `withParents`.

## Recebendo URLs do sistema

Ative com `links`, e o router passa a receber as URLs que a plataforma entrega ao app, ao lado dos handlers que o app já tem: intents de lançamento e novos intents no Android, `openURL`, atividades de Universal Link e conexões de scene no iOS.

```ts
const router = createRouter({
  routes,
  links: {
    schemes: ['https', 'myapp'], // os outros são ignorados
    hosts: ['example.com'], // para links http e https
    map: (link) =>
      link.path.startsWith('/m/')
        ? { name: 'message', params: { id: link.path.slice(3) } }
        : { path: link.path, query: link.query, hash: link.hash },
    frame(location) {
      const settings = location.path.startsWith('/settings')
      // RouterTabs seleciona a aba que contém esta pilha.
      return settings ? 'settings' : 'inbox'
    },
  },
})
```

`links: true` recebe toda URL como um path. Cada URL vira um `IncomingLink`: um `scheme` em minúsculas, um `host` para `http` e `https` (num scheme próprio como `myapp://messages/42`, tudo depois de `://` é o path), o `path`, a `query` já analisada, o `hash` e de onde veio: `'launch'`, `'resume'` ou `'app'`. O matcher decodifica os params como faz no `push`. Sem `map`, o path, a query e o hash do link são a localização; uma URL que não casa com nenhuma rota é ignorada, a menos que uma rota curinga a receba. Devolva `null` do `map` para ignorar um link. Escapes percentuais/UTF-8 inválidos, host web ausente, credenciais, espaços e URLs relativas ao protocolo são `malformed`. Params são decodificados uma vez; na query, `+` vira espaço, chaves repetidas viram arrays e uma chave sem `=` vale `null`. Valide os formatos específicos do app em `map`: devolver `null` ou lançar um erro rejeita o destino como `unmatched`.

Um link chega como um `push(path, { withParents: true })`, passando pelos guards, então uma rota autenticada ainda o manda para o login. Defina `options` para mudar isso para todo link, ou por link com uma função. Num cold start o link espera a primeira página, e quando o `restore` reconstruiu uma pilha ele chega em cima dela: primeiro o histórico salvo, depois o link. Com `frame`, ele espera aquele `<RouterView>` mostrar a primeira página, por até dez segundos. [`RouterTabs`](./tabs) seleciona a aba de destino automaticamente. Com um `TabView` comum, defina seu `selectedIndex` dentro de `frame` para que uma aba ainda não carregada apareça antes da navegação.

A plataforma pode entregar a mesma URL no lançamento e novamente no resume. Esse par é deduplicado dentro de 1,5 segundo. Duas entregas com o app já aberto são toques distintos, mesmo próximos. Uma página já no topo produz a falha `duplicated`, como no `push`. Provedores de notificações podem informar `deliveryId` para deduplicar um evento mesmo com outros links entre as entregas; cada toque intencional precisa de um novo id. O router guarda os últimos 256 ids em memória durante sua existência.

### Notificações, widgets e links seus

O `openLink` é a mesma porta para qualquer outra coisa que aponte para um destino:

```ts
const result = await router.openLink(notification.data.url, {
  deliveryId: notification.eventId, // opcional: um id por ação do usuário
})
result.location // para onde apontava, quando casou com uma rota
result.failure // o que um guard disse, quando o impediu
result.ignored // 'scheme', 'host', 'unmatched', 'malformed' ou 'repeat'
```

O `resolveLink(url)` diz para onde uma URL iria sem ir, e o `onLink` ouve todo link que o router recebeu, aceito ou não. Para retomar um link depois de um login, faça como o demo: o guard redireciona para o login com `query.next`, e a página de login se substitui por ele. O `onLink` também serve: guarde `result.location` quando `failure` ou a rota atual disser que um login entrou na frente, e faça `push` dele depois de entrar.

## Atalhos da tela inicial

Os mesmos destinos podem ser oferecidos antes de o app abrir: atalhos dinâmicos do Android e quick actions do iOS, com uma única chamada:

```ts
router.setShortcuts([
  {
    id: 'compose',
    title: 'Nova mensagem',
    to: '/compose',
    icon: { android: 'ic_compose', ios: 'square.and.pencil' },
  },
  { id: 'account', title: 'Conta', to: { name: 'account' } },
])
```

Cada atalho carrega um payload versionado. A versão 2 preserva o `name` da rota quando ele é uma string, params, query e hash; mudar o path mantendo o nome conserva os atalhos existentes. Trate também o nome da rota como identificador estável: se ele mudar, mantenha um redirecionamento com o nome antigo ou republique os atalhos afetados. Destinos sem nome guardam o path. Payloads da versão 1 continuam aceitos. Um destino removido produz `unmatched`; uma versão desconhecida produz `malformed`. A ativação usa os mesmos guards e o mesmo comportamento de navegação duplicada de `push`, inclusive para atalhos fixados antigos. `link.shortcut` identifica o atalho.

Chame `setShortcuts` novamente quando os dados mudarem. `setShortcuts([])` remove os atalhos dinâmicos e desabilita cópias fixadas obsoletas do router no Android; no iOS remove as quick actions. Os ícones fixados pertencem ao launcher e não podem ser apagados pelo app. Atalhos estáticos do manifest não são desabilitados por essa chamada: mantenha destinos de entrada públicos e autenticação nos guards. No Android, estáticos e dinâmicos compartilham a cota nativa; o iOS oferece quatro posições. Itens dinâmicos excedentes ficam de fora com aviso em desenvolvimento. Uma atualização recusada pelo Android lança erro em vez de informar ids não publicados.

`supportsShortcuts()` verifica a disponibilidade geral. Para solicitar a fixação no Android:

```ts
import { supportsPinnedShortcuts } from 'vue-router-ns'

if (supportsPinnedShortcuts()) {
  const requested = router.pinShortcut({
    id: 'account',
    title: 'Minha conta',
    to: { name: 'account' },
    icon: { android: 'ic_account' },
  })
  // requested indica que o launcher recebeu o pedido; o usuário ainda escolhe.
}
```

### Atalhos estáticos no Android

Os atalhos estáticos são recursos revisados e distribuídos pelo app. Gere o payload com `router.shortcutURL('account', { name: 'account' })` e copie para o XML, escapando `&` como `&amp;`:

```xml
<!-- App_Resources/Android/src/main/res/xml/shortcuts.xml -->
<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">
  <shortcut android:shortcutId="static-account"
    android:enabled="true"
    android:shortcutShortLabel="@string/shortcut_account"
    android:icon="@drawable/ic_account">
    <intent android:action="android.intent.action.VIEW"
      android:targetPackage="com.example.app"
      android:targetClass="org.nativescript.router.ShortcutEntryActivity"
      android:data="vue-router-ns://shortcut/static-account?to=%7B%22name%22%3A%22account%22%7D&amp;v=2" />
  </shortcut>
</shortcuts>
```

Defina o rótulo em `res/values/strings.xml` e coloque esta metadata dentro da activity de launcher no `AndroidManifest.xml`:

```xml
<meta-data android:name="android.app.shortcuts" android:resource="@xml/shortcuts" />
```

O Android força `NEW_TASK | CLEAR_TASK` nos atalhos estáticos. Para preservar um app aberto, copie o [exemplo de Activity de entrada](https://github.com/rafaelaugustos/vue-router-ns/blob/main/examples/shortcuts/Android/src/main/java/org/nativescript/router/ShortcutEntryActivity.java) para `App_Resources/Android/src/main/java/org/nativescript/router/ShortcutEntryActivity.java` e registre-o fora da activity principal:

```xml
<activity android:name="org.nativescript.router.ShortcutEntryActivity"
  android:exported="true" android:taskAffinity=""
  android:excludeFromRecents="true" android:theme="@android:style/Theme.NoDisplay" />
```

Essa Activity temporária encerra sua janela e encaminha o payload à `com.tns.NativeScriptActivity` com `SINGLE_TOP | CLEAR_TOP | NEW_TASK`. Ajuste o destino Java se o app usa uma Activity própria. É uma integração nativa explícita do app, sem substituir arquivos automaticamente. Veja o [comportamento oficial de tasks dos atalhos](https://developer.android.com/develop/ui/compose/system/shortcuts/managing-shortcuts).

Use os nomes reais do pacote, activity e recursos. Ids estáticos precisam ser diferentes dos dinâmicos. O scheme interno `vue-router-ns` usa um destino explícito no intent; não o registre como um deep link público. Veja os [requisitos de recursos e fixação no Android](https://developer.android.com/develop/ui/compose/system/shortcuts/creating-shortcuts).

### Busca opcional do sistema

O módulo experimental `vue-router-ns/system-search` indexa somente conteúdo selecionado explicitamente no Core Spotlight. Ele recebe o `NSUserActivity` resultante por `links.activity`, mantendo a mesma seleção de janela, guards e navegação nativa:

```ts
import { createSystemSearch } from 'vue-router-ns/system-search'

const search = createSystemSearch({
  domain: 'com.example.app.public-guides',
  resolve(id) {
    const guide = publicGuides.get(id)
    return guide ? router.resolve({ name: 'guide', params: { id } }).fullPath : null
  },
})
const router = createRouter({ routes, links: { activity: search.url } })

if (search.supported) {
  await search.index([
    { id: 'getting-started', title: 'Getting started', keywords: ['help'] },
  ])
}
await search.remove(['getting-started']) // deleted content
await search.remove() // sign-out: remove this domain's index
```

O identificador nativo contém versão, domínio e id de conteúdo; não contém params da rota. `resolve` transforma o id estável no destino atual e pode devolver `null` para um item removido ou inacessível. As operações resolvem para `false` quando a API não existe e rejeitam erros nativos. Disponibilidade não garante exibição ou posição nos resultados do Spotlight. `description`, `keywords` e `expiresAt` são opcionais. Veja a [orientação de indexação da Apple](https://developer.apple.com/documentation/CoreSpotlight/adding-your-app-s-content-to-spotlight-indexes).

Escolha rótulos públicos e ids opacos. Payloads de atalhos, títulos e descrições indexadas podem sobreviver à sessão e aparecer no sistema: não inclua credenciais ou segredos. Remova conteúdo da conta no logout e mantenha os guards. O módulo não indexa rotas automaticamente, não oferece widgets/App Intents e não doa atividades à Siri; essas integrações são explícitas e pertencem ao app.

### Janelas de destino e política de abertura

Por padrão, eventos do sistema vão para o router da janela principal. Com a API de janelas do NativeScript, `links.window` restringe o recebimento àquela Activity ou scene. `links.initial` aceita os campos de link de um `WindowContentRequest`: normalmente o router secundário é criado **depois** da emissão do evento nativo inicial, então precisa dessa entrega explícita.

```ts
Application.setWindowContentResolver((request) => {
  if (request.window.rootView) return request.window.rootView
  if (request.isPrimary) return undefined // the primary app starts normally
  const router = createRouter({
    routes,
    links: { window: request.window, initial: request, schemes: ['myapp', 'https'] },
  })
  const app = createApp({ render: () => h(RouterView) }).use(router)
  return app.mount().$el.nativeView
})
```

URLs, user activities e quick actions de uma scene permanecem nela; novos intents do Android permanecem na Activity que os recebeu. Desmontar o app remove seu receptor. `window` também aceita um getter caso a janela seja atribuída depois. Essa opção delimita eventos de entrada; encerramento de janelas, recriação de Activities e estado salvo continuam sendo responsabilidades do ciclo de vida do app.

A política padrão **reutiliza a janela escolhida pelo sistema**; receber um link não cria uma janela nem transfere o foco para outra. Para notificações, o app pode selecionar uma sessão existente, ativar sua scene/task nativa e chamar o `router.openLink` dessa sessão. Para criar uma janela, use `Application.openWindow({ data: { href } })`; no resolver, entregue `request.data.href` ao `openLink` do novo router antes de montar. Não passe o mesmo destino também como rota inicial. O `openLink` espera a montagem. Isso deixa a política de documentos e notificações explícita, sem adivinhar pelo Frame global em foco. Múltiplas Activities no Android exigem um launch mode compatível, como `standard`, e flags explícitas para reutilizar ou criar tasks; o exemplo de janela única abaixo usa `singleTask`.

### Configuração por plataforma

O router lê o que a plataforma entrega; registrar-se para isso é do app. O pacote não consegue verificar a posse de um domínio nem publicar arquivos de associação.

Android, em `App_Resources/Android/src/main/AndroidManifest.xml`, dentro da activity. O launch mode `singleTask` do template do NativeScript faz um link para um app em execução chegar como um novo intent, que o router recebe sem uma segunda activity:

```xml
<intent-filter android:autoVerify="true">
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="https" android:host="example.com" />
</intent-filter>
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="myapp" />
</intent-filter>
```

App Links precisam de `https://example.com/.well-known/assetlinks.json` listando o pacote do app e as impressões digitais do certificado de assinatura; confira com `adb shell pm get-app-links <pacote>`.

iOS, em `App_Resources/iOS/Info.plist` para um scheme próprio, e uma entrada `applinks:example.com` em Associated Domains no `App_Resources/iOS/app.entitlements` para Universal Links, servidos por `https://example.com/.well-known/apple-app-site-association`:

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array><string>myapp</string></array>
  </dict>
</array>
```

Teste um link com `adb shell am start -a android.intent.action.VIEW -d "myapp://messages/42"` e `xcrun simctl openurl booted "myapp://messages/42"`. Janelas nativas independentes são acompanhadas à parte; um link chega no router que o recebe.

### Verificando a associação de domínio

Para links HTTPS em produção, confira o registro nativo e os arquivos do servidor. Separe as identidades de pacote/certificado de debug e release.

`https://example.com/.well-known/assetlinks.json`:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.example.app",
      "sha256_cert_fingerprints": ["SHA256:DO:CERTIFICADO:DE:RELEASE"]
    }
  }
]
```

`https://example.com/.well-known/apple-app-site-association` (sem extensão):

```json
{
  "applinks": {
    "details": [
      {
        "appIDs": ["TEAMID.com.example.app"],
        "components": [{ "/": "/messages/*" }]
      }
    ]
  }
}
```

Adicione `com.apple.developer.associated-domains` com `applinks:example.com` nos entitlements do app assinado. Sirva JSON válido por HTTPS, sem redirecionamentos. Confira host, bundle/package id, certificado/team id e path da versão instalada. Execute `adb shell pm verify-app-links --re-verify com.example.app`, confira `adb shell pm get-app-links com.example.app` e abra uma URL HTTPS **sem componente explícito**. No iOS, instale o app assinado corretamente e abra o link de outro app, com o app fechado e aberto. Um scheme próprio ou intent Android com `-n` prova a entrega ao router, não a associação ao site. Consulte a [verificação do Android](https://developer.android.com/training/app-links/verify-android-applinks) e a [configuração de Universal Links da Apple](https://developer.apple.com/documentation/xcode/supporting-universal-links-in-your-app). A allowlist do router é uma checagem adicional após a entrega pelo sistema, não uma prova de posse do domínio.
