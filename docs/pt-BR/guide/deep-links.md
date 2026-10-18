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

`links: true` recebe toda URL como um path. Cada URL vira um `IncomingLink`: um `scheme` em minúsculas, um `host` para `http` e `https` (num scheme próprio como `myapp://messages/42`, tudo depois de `://` é o path), o `path`, a `query` já analisada, o `hash` e de onde veio: `'launch'`, `'resume'` ou `'app'`. O matcher decodifica os params como faz no `push`. Sem `map`, o path, a query e o hash do link são a localização; uma URL que não casa com nenhuma rota é ignorada, a menos que uma rota curinga a receba. Devolva `null` do `map` para ignorar um link você mesmo.

Um link chega como um `push(path, { withParents: true })`, passando pelos guards, então uma rota autenticada ainda o manda para o login. Defina `options` para mudar isso para todo link, ou por link com uma função. Num cold start o link espera a primeira página, e quando o `restore` reconstruiu uma pilha ele chega em cima dela: primeiro o histórico salvo, depois o link. Com `frame`, ele espera aquele `<RouterView>` mostrar a primeira página, por até dez segundos. [`RouterTabs`](./tabs) seleciona a aba de destino automaticamente. Com um `TabView` comum, defina seu `selectedIndex` dentro de `frame` para que uma aba ainda não carregada apareça antes da navegação.

A plataforma pode entregar a mesma URL duas vezes por um toque só, nas opções de lançamento e de novo no resume. Uma segunda entrega do sistema da mesma URL dentro de 1,5 segundo é descartada; uma posterior, ou qualquer chamada do seu próprio código, é aceita. Uma página já no topo transforma a repetição numa falha `duplicated`, como o `push` faria.

### Notificações, widgets e links seus

O `openLink` é a mesma porta para qualquer outra coisa que aponte para um destino:

```ts
const result = await router.openLink(notification.data.url)
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

Cada atalho carrega o próprio id e o path resolvido da rota, com versão, e um toque nele passa pelo `openLink` como qualquer link: pais, guards, cold start e seleção de aba incluídos, com `link.shortcut` igual ao id no `LinkResult`. Chame `setShortcuts` de novo quando os destinos mudarem, com uma lista vazia para remover todos, por exemplo ao sair da conta. O Android mostra até o seu `getMaxShortcutCountPerActivity` e o iOS quatro; os demais ficam de fora com um aviso em desenvolvimento. Os `id`s precisam ser únicos e `to` precisa resolver na hora de definir; um atalho cuja rota deixou de existir depois de uma atualização é ignorado ao ser tocado, como qualquer link sem rota. Os ícones são um nome de drawable no Android e um nome de SF Symbols no iOS. `supportsShortcuts()` diz se a plataforma os mostra. Atalhos estáticos, indexação no Spotlight, widgets e App Intents ficam fora do router.

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
