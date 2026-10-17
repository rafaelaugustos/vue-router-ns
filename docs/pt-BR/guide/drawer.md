# Drawer no Android

No Android, um drawer que desliza a partir da borda inicial é um contêiner nativo: o `DrawerLayout` do AndroidX cuida do arrasto, do assentamento, do scrim e da acessibilidade do painel. O `<RouterDrawer>` coloca as suas pilhas dentro de um sem mover página nenhuma:

```vue
<RouterDrawer ref="drawer" :width="280">
  <template #drawer>
    <StackLayout class="menu">
      <Button text="Caixa de entrada" @tap="router.openLink('/')" />
      <Button text="Configurações" @tap="router.openLink('/settings')" />
      <Button text="Conta" @tap="router.openLink('/settings/account')" />
    </StackLayout>
  </template>

  <TabView>
    <TabViewItem title="Inbox"><RouterView name="inbox" /></TabViewItem>
    <TabViewItem title="Settings"><RouterView name="settings" initial="/settings" /></TabViewItem>
  </TabView>
</RouterDrawer>
```

O slot padrão é o conteúdo: um `<TabView>`, um `<RouterView>`, um `<RouterSplitView>`. O slot `drawer` é o painel. Abrir ou fechar o menu não é uma navegação e não cria entrada de rota; os destinos são o que o painel navegar, e cada um mantém a própria pilha nomeada. Levar os destinos pelo `openLink` deixa a política `links.frame` selecionar a aba além da pilha. Destaque o destino atual a partir de `router.currentRoute`.

## Abrir, fechar, voltar

- `drawer.open()`, `drawer.close()`, `drawer.toggle()` e `drawer.isOpen` na ref do componente; `v-model:open` e os eventos `opened` e `closed` seguem o estado nativo, então um swipe da borda também os atualiza.
- O botão de voltar do Android, e o swipe de voltar no Android 14 ou mais novo, fecham um drawer aberto antes de qualquer página sair. Isso passa pelo `router.claimSystemBack()`, que qualquer contêiner nativo pode usar: `claimSystemBack({ owns: () => isOpen, back: close })` devolve o que libera a reivindicação.
- Uma navegação fecha o drawer, a menos que `closeOnNavigate` seja `false`.

## Estilo e plataformas

O painel é um `GridLayout` com a classe `router-drawer` e fundo branco; dê à raiz do seu slot o próprio fundo e espaçamento. `width` é em pixels independentes de densidade. O `DrawerLayout` vem com o AppCompat, então nada é adicionado ao build; o `NavigationView` opcional do Material não é usado, as suas próprias views são o menu.

No iOS, o `<RouterDrawer>` renderiza só o conteúdo e o slot `drawer` é ignorado: uma barra lateral lá é o split view do UIKit, que o NativeScript expõe como `SplitView`, não um painel deslizante customizado. Acompanhado à parte.
