# Abas e outras pilhas independentes

`<RouterTabs>` coloca pilhas nomeadas atrás de uma tab bar nativa e mantém as duas sincronizadas:

```vue
<RouterTabs v-model:selected="tab" sidebar minimize="onScrollDown">
  <RouterTab name="inbox" title="Inbox" icon="tray.fill" androidIcon="sys://ic_dialog_email" :badge="unread">
    <RouterSplitView name="inbox" list="/" backToRootOnReselect />
  </RouterTab>
  <RouterTab name="settings" title="Settings" icon="gearshape.fill">
    <RouterView name="settings" initial="/settings" backToRootOnReselect />
  </RouterTab>
</RouterTabs>
```

<div class="clips">
<Clip name="ios-tabs" caption="Cada aba mantém seu histórico. Tocar em Inbox novamente volta à raiz. Simulador iOS 26." />
<Clip name="android-tabs" aspect="9 / 20" caption="As mesmas pilhas na navegação inferior do Material. Emulador Android 16." />
</div>

- **iOS** é `UITabBarController`, com `UITab` a partir do iOS 18: `icon` é um SF Symbol, `badge` vai na aba, `sidebar` liga a sidebar do UIKit no iPad, `minimize="onScrollDown"` deixa a barra do iOS 26 encolher ao rolar, e `role="search"` cria uma aba de busca.
- **Android** é o `BottomNavigationView` do Material, ou um `NavigationRailView` a partir de `rail` (600) pixels independentes de densidade de largura; `androidIcon` é o nome de um drawable ou `sys://` mais um nome de `android.R.drawable`. Sem a biblioteca Material, o `TabView` do core renderiza embaixo; `supportsNativeTabs()` informa.
- Uma navegação para uma pilha que vive em outra aba traz essa aba para frente antes, então `router.push(to, { frame: 'settings' })` e deep links aparecem na tela. Trocar de aba não roda guard de rota; `canSelect(name)` pode recusar um toque, e os eventos `select`/`reselect` dizem o que aconteceu. `v-model:selected` guarda o nome da aba.

Use até cinco destinos para caberem tanto na barra inferior do Android quanto no rail. `:rail="0"` mantém a barra inferior em qualquer largura. Alternar entre barra e rail ao redimensionar preserva as pilhas montadas e seus históricos.

`canSelect` se aplica à seleção pelo usuário. Alterações em `selected` e navegações para uma pilha nomeada selecionam a aba diretamente; proteja as rotas com guards. A aba de destino aparece antes de a navegação rodar, inclusive se um guard recusar essa navegação depois. Fora de uma página, `router.currentRoute`, as navegações e o Voltar do Android seguem a aba visível.

O router salva os históricos das pilhas com `restore`. Persista `v-model:selected` separadamente se o app deve voltar à mesma aba após a morte do processo; restaurar as pilhas não altera essa seleção.

## Sidebar no iPad

<Clip name="ipad-tabs" :width="480" aspect="3 / 4" caption="A sidebar do UIKit seleciona Inbox e Settings, cada uma com sua própria pilha. Simulador iPadOS 26." />

## Material em builds de release do Android

O runtime de debug do NativeScript inclui Material, mas um build de release precisa da dependência explícita em `App_Resources/Android/app.gradle`:

```groovy
dependencies {
  implementation "com.google.android.material:material:1.12.0"
}
```

`supportsNativeTabs()` informa se Material está disponível. A barra usa o tema Material do app quando existe; caso contrário, aplica um tema Material só ao componente, incluindo seus badges. Sem a dependência, `<RouterTabs>` usa o `TabView` inferior do core e mantém a seleção por nome e as pilhas independentes; badges Material e rail ficam indisponíveis.

## Outros contêineres de abas

Qualquer contêiner de abas funciona, porém. Use um `<RouterView>` por pilha e dê um nome a ele:

```vue
<TabView>
  <TabViewItem title="Inbox">
    <RouterView name="inbox" initial="/" backToRootOnReselect />
  </TabViewItem>
  <TabViewItem title="Settings">
    <RouterView name="settings" initial="/settings" backToRootOnReselect />
  </TabViewItem>
</TabView>
```

As páginas navegam na própria aba. De qualquer outro lugar, mire uma delas com `{ frame: 'settings' }`.

## Tocando na aba ativa

As barras de abas nativas voltam para a primeira página quando você toca na aba em que já está. O `backToRootOnReselect` faz isso para um `<RouterView>` dentro de um `<TabViewItem>`, passando pelos leave guards como qualquer back. O `router.backToRoot()` faz o mesmo sob demanda.

No iOS, o router escuta na frente do delegate da barra de abas, que de outro modo responde "não" ao toque repetido e não avisa ninguém. No Android, ele observa os toques na faixa de abas, já que o click listener dela só troca de aba.

## Abas que ainda não apareceram

No iOS, um `TabView` só carrega a aba selecionada. Um `<RouterView>` em outra aba espera a primeira página até aquela aba ser aberta, e uma navegação para dentro dele (um deep link, por exemplo) espera junto. As navegações nas outras pilhas não ficam presas.

Dentro de `<RouterTabs>`, selecionar `{ frame: 'settings' }` traz a aba para frente antes de mostrar a página. Com um `TabView` comum, atualize o `selectedIndex` por conta própria e então aguarde `router.push(to, { frame: 'settings' })`. Os nomes devem ser únicos entre `RouterView` e `RouterSplitView`.
