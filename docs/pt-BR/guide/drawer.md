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

  <RouterTabs>
    <RouterTab name="inbox" title="Inbox" icon="tray.fill">
      <RouterView name="inbox" />
    </RouterTab>
    <RouterTab name="settings" title="Settings" icon="gearshape.fill">
      <RouterView name="settings" initial="/settings" />
    </RouterTab>
  </RouterTabs>
</RouterDrawer>
```

<Clip name="android-drawer" aspect="9 / 20" caption="O drawer abre Settings; o Voltar do sistema fecha o drawer antes de remover uma página. Emulador Android 16." />

O slot padrão é o conteúdo: um `<RouterTabs>`, um `<TabView>`, um `<RouterView>` ou um `<RouterSplitView>`. O slot `drawer` é o painel. Abrir ou fechar o menu não é uma navegação e não cria entrada de rota; os destinos são o que o painel navegar, e cada um mantém a própria pilha nomeada. Levar os destinos pelo `openLink` deixa a política `links.frame` selecionar a aba além da pilha. Destaque o destino atual a partir de `router.currentRoute`.

## Abrir, fechar, voltar

- `drawer.open()`, `drawer.close()`, `drawer.toggle()` e `drawer.isOpen` na ref do componente; `v-model:open` e os eventos `opened` e `closed` seguem o estado nativo, então um swipe da borda também os atualiza.
- O botão de voltar do Android, e o swipe de voltar no Android 14 ou mais novo, fecham um drawer aberto antes de qualquer página sair. Isso passa pelo `router.claimSystemBack()`, que qualquer contêiner nativo pode usar: `claimSystemBack({ owns: () => isOpen, back: close })` devolve o que libera a reivindicação.
- Uma navegação fecha o drawer, a menos que `closeOnNavigate` seja `false`.

## Estilo e plataformas

O painel é um `GridLayout` com a classe `router-drawer` e fundo branco; dê à raiz do seu slot o próprio fundo e espaçamento. `width` é em pixels independentes de densidade. O `DrawerLayout` vem com o AppCompat, então nada é adicionado ao build; o `NavigationView` opcional do Material não é usado, as suas próprias views são o menu.

No iOS, o `<RouterDrawer>` renderiza só o conteúdo e o slot `drawer` é ignorado. Para navegar entre abas pela sidebar nativa no iPad, use [`<RouterTabs sidebar>`](./tabs).
