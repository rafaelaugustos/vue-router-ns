# Drawer nativo

O `<RouterDrawer>` coloca um menu na borda inicial ao redor das pilhas nativas existentes. No Android, usa o `DrawerLayout` do AndroidX; no iOS, views, gestos e animações do UIKit. Ambos mantêm os slots montados sem criar rotas.

::: info Próxima rc.3
A implementação iOS e a apresentação adaptativa fazem parte da próxima `0.1.0-rc.3`. A versão publicada `0.1.0-rc.2` suporta o drawer sobreposto apenas no Android.
:::

O mesmo template funciona nas duas plataformas:

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

O drawer não apaga o histórico de um destino ao selecioná-lo novamente. O botão define a ação: navegar com `openLink` ou `push`, ou voltar explicitamente à raiz da pilha com `router.backToRoot({ frame: 'inbox' })`. Selecionar uma rota que já está no topo também fecha o painel. O `backToRootOnReselect` do `RouterView` responde à nova seleção da aba, não a qualquer botão do drawer.

## Abrir, fechar, voltar

- `drawer.open()`, `drawer.close()`, `drawer.toggle()` e `drawer.isOpen` na ref do componente; `v-model:open` e os eventos `opened` e `closed` seguem o estado nativo, então um swipe da borda também os atualiza.
- O botão de voltar do Android, e o swipe de voltar no Android 14 ou mais novo, fecham um drawer aberto antes de qualquer página sair. Isso passa pelo `router.claimSystemBack()`, que qualquer contêiner nativo pode usar: `claimSystemBack({ owns: () => isOpen, back: close })` devolve o que libera a reivindicação.
- Uma navegação concluída fecha o drawer, a menos que `closeOnNavigate` seja `false`. Se um guard recusar a navegação, ele continua aberto.
- Uma modal ou bottom sheet sobre o drawer recebe o Back primeiro, incluindo seus guards e resultado. Se mantiver o drawer aberto com `:closeOnNavigate="false"`, o Back volta para ele após dispensar a modal.

## Apresentação adaptativa

Ative com `presentation="auto"`. O drawer mede a **largura disponível no próprio contêiner**. Rotação, redução do pai e redimensionamento da janela podem mudar a apresentação sem substituir o componente, seus slots, Frames, Pages ou instâncias Vue.

```vue
<RouterDrawer
  ref="drawer"
  presentation="auto"
  :breakpoint="840"
  :width="280"
  v-model:open="menuOpen"
  @presentationChange="mode = $event"
>
  <template #drawer><!-- Botões dos destinos --></template>
  <RouterView />
</RouterDrawer>
```

| API                   | Comportamento                                                                                                                                                  |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `presentation`        | `overlay` (padrão), `permanent` ou `auto`.                                                                                                                     |
| `breakpoint`          | Largura mínima do contêiner para o modo permanente automático; padrão de 840 DIPs. Não depende do modelo do aparelho.                                          |
| `width`               | Largura desejada do painel. O modo permanente limita a metade do contêiner, exceto quando uma dobra vertical separadora determina as duas regiões.             |
| `foldAware`           | Padrão `true`. Reutiliza a integração opcional com AndroidX WindowManager no modo permanente. Sem a dependência, a adaptação por largura continua funcionando. |
| `drawer.presentation` | Modo resolvido, somente leitura: `overlay` ou `permanent`.                                                                                                     |
| `presentationChange`  | Emite o modo resolvido quando ele muda. O primeiro layout medido pode resolver `auto`; consulte a ref para obter o modo atual.                                 |

`open`, `drawer.isOpen`, `opened` e `closed` descrevem a **sobreposição**. O painel permanente fica visível com `isOpen=false`: `open()`, `close()` e `toggle()` não alteram sua visibilidade, e uma tentativa de definir `v-model:open=true` é normalizada para `false`. Não há scrim nem gesto de drawer, o painel não reivindica o Back e `closeOnNavigate` não o oculta. Menu e conteúdo ficam disponíveis para toque e navegação por acessibilidade.

Entrar no modo permanente cancela o gesto/animação de drawer em andamento e normaliza o model. Uma sobreposição já aberta emite `closed` uma vez; uma abertura que não terminou não emite `opened` atrasado. Ao voltar para `overlay`, o painel começa fechado e fora da árvore de acessibilidade. A troca não navega, não executa guards, não dispensa modais de rota e não resolve resultados pendentes. No iOS, a troca é imediata, inclusive com Reduzir Movimento; as animações normais do overlay mantêm sua política existente.

Com a [dependência opcional para dobráveis](./split-view), uma dobra vertical separadora ou oclusiva coloca o painel permanente na região inicial e o conteúdo na outra, excluindo a dobradiça. Uma dobradiça horizontal mantém ambos lado a lado na maior região utilizável. `foldAware=false` desativa isso. A dobra não força `auto` abaixo do breakpoint; o overlay mantém o comportamento existente sobre todo o contêiner. Use o modo permanente quando o app precisar separar a navegação pela dobradiça abaixo desse limite.

Mantenha um único `RouterDrawer` montado durante a adaptação. Não alterne entre duas árvores de `RouterView` com `v-if` e keys diferentes. O drawer acrescenta um menu ao redor de pilhas existentes; [`RouterTabs sidebar`](./tabs) pede ao UIKit uma sidebar com os destinos das abas no iPad, e [`RouterSplitView`](./split-view) organiza a navegação lista/detalhe. No iOS, o drawer permanente é um menu persistente próprio, não `UISplitViewController` nem a sidebar de abas do UIKit. `RouterUIKitSplitView` continua exigindo a raiz da janela e não pode ser envolvido por ele.

<Clip name="adaptive-drawer" aspect="834 / 1210" caption="Interação real no iPad: modos sobreposto e permanente, rascunho e abas preservados, RTL e resultado de modal." />

Execute `ns run ios --env.adaptivedrawerTest` ou `ns run android --env.adaptivedrawerTest` em `demo` após compilar o pacote. O [relatório de aceitação](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-drawer-adaptive.md) distingue verificações nativas automatizadas dos testes ainda manuais de leitor de tela falado e múltiplas janelas reais.

## Estilo e plataformas

O painel é um `GridLayout` com a classe `router-drawer` e fundo branco; dê à raiz do seu slot o próprio fundo e espaçamento. `width` é em pixels independentes de densidade. O `DrawerLayout` vem com o AppCompat, então nada é adicionado ao build; o `NavigationView` opcional do Material não é usado, as suas próprias views são o menu.

O pequeno host nativo fica neste pacote e usa as dependências AndroidX já fornecidas pelo runtime do NativeScript. Não exige um plugin de drawer separado nem alterações no core. O [relatório de validação nativa](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-drawer.md) lista as versões de Android e das dependências testadas.

No modo overlay do iOS, o painel se sobrepõe ao conteúdo no iPhone e no iPad. A largura deixa pelo menos 44 pontos disponíveis para fechar pelo scrim em janelas estreitas. No modo permanente, as mesmas views UIKit ficam lado a lado. No Android, o mesmo host AndroidX organiza dois filhos de conteúdo no modo permanente; não mantém um drawer modal travado aberto sobre o conteúdo.

O `RouterUIKitSplitView` precisa ser a raiz da janela: não o coloque dentro de um drawer. O `RouterSplitView`, que compõe pilhas de Frames, pode ser conteúdo do drawer. Veja [navegação dividida](./split-view).

### Gestos e acessibilidade no iOS

- Na raiz da pilha, arraste para dentro a partir dos primeiros 24 pontos da borda inicial. Arraste o painel aberto ou toque no scrim para fechar. Um arrasto revertido ou interrompido termina em um estado consistente.
- Em uma página empilhada, a borda pertence ao Voltar interativo do UIKit. Um guard de saída ativo pode desabilitar esse gesto, como explicado em [guards](./guards). O drawer não substitui o delegate da navegação nem ignora o guard. Mantenha um botão Menu na ActionBar.
- Ao abrir, o drawer dispensa o teclado, isola o conteúdo coberto da navegação do VoiceOver e solicita foco no painel. Ao fechar, restaura o alvo anterior se ele ainda estiver montado. O gesto Escape de acessibilidade fecha o painel. Reduzir Movimento evita a animação de deslizar.
- Uma modal nativa permanece acima do drawer. Com `closeOnNavigate=false`, o drawer continua aberto ao retornar da modal.
- `opened`/`closed` e `v-model:open` representam o estado final, não o progresso intermediário do gesto. O redimensionamento preserva o conteúdo e suas pilhas nativas.

O [relatório de validação iOS](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-drawer-ios.md) distingue verificações automatizadas do estado de acessibilidade de testes manuais com VoiceOver.

### Exemplo executável

[`demo/src/testing/drawer-app.ts`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/testing/drawer-app.ts) inclui configuração do router, três abas independentes, botões Menu, rascunho editável, guards condicionais e resultado de modal. Siga a [configuração do demo](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/README.md), compile o pacote e execute `ns run ios --env.drawerTest` ou `ns run android --env.drawerTest` em `demo`.

<Clip name="ios-drawer" aspect="393 / 852" caption="Drawer nativo no iOS: gestos, pilhas preservadas, guards e resultado de modal. Simulador de iPhone." />

## Direção, interação e acessibilidade

O painel abre na borda inicial: esquerda em LTR, direita em RTL. No iOS acompanha a direção efetiva do UIKit; no Android usa `START`. Para acompanhar o idioma do sistema, habilite [`android:supportsRtl="true"`](https://developer.android.com/guide/topics/manifest/application-element#rtl) no `<application>` de `App_Resources/Android/src/main/AndroidManifest.xml`. Também é possível definir `direction="rtl"` no drawer. A rotação mantém o mesmo contêiner nativo e as páginas montadas.

`direction` aceita `ltr` ou `rtl`; sem a prop, acompanha a plataforma. No iOS, ela configura a direção semântica do contêiner e deixa o UIKit herdá-la, preservando a configuração de gestos das views nativas de navegação.

Mantenha um botão na ActionBar para abrir o drawer. Com navegação por gestos, o Android pode consumir o arrasto da borda como Back; o botão continua disponível. Ao concluir o gesto de Back, o painel fecha sem pré-visualizar ou remover uma página por trás.

O `DrawerLayout` retira o conteúdo coberto da navegação por acessibilidade enquanto está aberto. O conteúdo do menu pertence ao app: prefira destinos com `Button` nativo, rótulos claros e `accessibilityState="selected"` no destino atual. Um layout personalizado com apenas um handler de tap também precisa aceitar ativação por teclado e acessibilidade; definir um rótulo não fornece essas ações.
