# Abas e outras pilhas independentes

Use um `<RouterView>` por pilha e dê um nome a ele:

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

Selecionar `{ frame: 'settings' }` não altera `selectedIndex`. Para um deep link em outra aba, atualize o `selectedIndex` do `TabView` e então aguarde `router.push(to, { frame: 'settings' })`. Os nomes devem ser únicos entre `RouterView` e `RouterSplitView`.
