# Lista e detalhe

O `RouterSplitView` mostra a lista e o detalhe lado a lado quando há espaço. Numa janela estreita, o detalhe cobre a lista. As rotas e os métodos de navegação são os mesmos nos dois layouts:

```vue
<RouterSplitView name="inbox" list="/messages">
  <template #empty>
    <Label text="Selecione uma mensagem" horizontalAlignment="center" verticalAlignment="middle" />
  </template>
</RouterSplitView>
```

<Clip name="ipad-split" :width="480" aspect="3 / 4" caption="A caixa de entrada continua visível enquanto mensagens entram na pilha de detalhes. Simulador iPadOS 26." />

A rota `list` é a primeira página, fixa. Toda rota não modal empilhada nessa stack vira um detalhe, independentemente do caminho ou da posição na árvore de rotas. Rotas com `modal` continuam abrindo separadamente. Uma split view nomeada pode conviver com `RouterView`s comuns, inclusive em abas diferentes.

```ts
// Dentro dos dois painéis, useRouter() aponta para a stack inteira.
await router.push('/messages/42')
await router.push('/messages/42/edit')

// De outro lugar, informe o nome da stack.
await router.push('/messages/42', { frame: 'inbox' })
```

## Layout e estado

O layout usa a largura disponível do componente, em pixels independentes de densidade, em vez do tipo de aparelho ou da largura total da tela. Rotação, redimensionamento e dobras que alteram essa largura podem trocar o layout. O breakpoint padrão é 840, e a coluna da lista tem largura 320:

```vue
<RouterSplitView list="/messages" :breakpoint="900" :listWidth="300" />
```

Os dois Frames nativos ficam montados. Redimensionar não recria páginas, não executa guards e não muda a rota selecionada. A posição de scroll da lista, o estado local dos componentes, campos não salvos e o histórico nativo do detalhe continuam no lugar. No layout expandido, a lista e o detalhe do topo ficam ativos para `onPageActivated`; um modal desativa os dois. `router.currentRoute` continua sendo o detalhe do topo até voltar para a lista.

O slot `empty` aparece na coluna de detalhe quando o layout expandido não tem detalhe selecionado. Ele não é uma rota nem uma entrada no histórico.

## Layout em dobráveis Android

![Native fold-aware split](/media/android-fold-hinge.png)

Emulador Android: os painéis nativos deixam livre a área da dobradiça informada pelo sistema.

Instale a ponte opcional de callbacks Java do AndroidX em `App_Resources/Android/app.gradle`:

```groovy
dependencies {
  implementation 'androidx.window:window-java:1.5.1'
}
```

Recompile o app nativo após adicionar a dependência. Para RTL, habilite `android:supportsRtl="true"` no `<application>` do manifesto Android, como nos demais layouts nativos Android. `foldAware` tem padrão `true`; com a ponte disponível, cada split view montada observa `WindowLayoutInfo` da própria Activity. O listener é removido ao descarregar ou desmontar a view e registrado novamente quando ela carrega. A integração não escolhe o dono pela Activity global em primeiro plano nem pelo modelo do aparelho.

Uma dobra separadora ou dobradiça totalmente oclusiva tem prioridade sobre `breakpoint` e `listWidth`. Uma dobra vertical coloca lista e detalhe nas duas regiões físicas; em RTL, a lista fica à direita. Uma dobra horizontal coloca a lista acima do detalhe. O espaço reservado exclui a dobradiça, com arredondamento para fora para acomodar as medidas inteiras do GridLayout. Se o componente intersectar apenas um lado utilizável, os dois Frames ficam nesse lado, com navegação compacta.

Uma dobra plana, não separadora e sem oclusão não altera o layout. Sem uma dobra relevante, sem a dependência opcional e no iOS, continua valendo o layout por largura. Para desativar explicitamente:

```vue
<RouterSplitView list="/messages" :foldAware="false" />
```

Os mesmos Frames e Pages sobrevivem às mudanças de postura; histórico, rascunhos e scroll continuam vinculados às entradas originais. O slot `empty` ocupa a região de detalhe. Esse layout de dois painéis considera uma dobra que intersecta o componente; não usa Activity embedding nem cria outra janela nativa. O aplicativo continua responsável por mudanças de configuração Android e restauração após encerramento do processo.

As evidências e os comandos estão na [validação de dobráveis](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-folding.md). Veja também [AndroidX WindowManager](https://developer.android.com/jetpack/androidx/releases/window) e a [semântica de FoldingFeature](https://developer.android.com/reference/androidx/window/layout/FoldingFeature).

## Histórico e voltar

O histórico funciona da mesma forma nos dois layouts. Selecionar outro item com `push()` adiciona um detalhe; não descarta a seleção anterior. Na stack:

```text
/messages → /messages/42 → /messages/42/edit
```

Voltar leva primeiro a `/messages/42`, depois à lista. No layout expandido, esse último back limpa a coluna de detalhe. O back nativo e o do router permanecem sincronizados, e leave guards podem impedir a remoção de páginas.

- `push(list)` e `backToRoot()` voltam para a lista existente, passando pelos guards.
- `replace()` substitui o detalhe do topo. Na lista, abre o primeiro detalhe.
- `clearHistory: true` limpa o histórico de detalhes e mantém a lista.
- `setStack()` mantém a lista como primeira entrada, inserindo-a quando omitida.
- `pushForResult()` devolve resultados de detalhes ou modais normalmente.
- `restore` salva e restaura o histórico combinado como uma única stack nomeada.
- `backToRootOnReselect` funciona dentro de um `TabViewItem`, como no `RouterView`.

## Comportamento nativo

Lista e detalhe usam um Frame nativo cada. Uma página raiz transparente no Frame de detalhe fornece o destino do back; esse detalhe de implementação não aparece em `router.stack` nem no estado salvo. O modo compacto coloca o Frame de detalhe sobre a lista; o expandido o coloca ao lado. Nenhuma página muda de Frame ao redimensionar.

O primeiro detalhe abre entre painéis, então não usa shared transitions ou o zoom do iOS a partir da lista. Transições entre páginas de detalhe funcionam normalmente, incluindo o preview do predictive back no Android. Voltar do primeiro detalhe para a lista usa a transição normal do Frame.

`name` e `list` são lidos na montagem. Para criar outra split stack, monte um novo componente com uma `key` do Vue diferente.

## Colunas UIKit opcionais

Use `RouterUIKitSplitView` como **raiz da janela nativa** para deixar o `UISplitViewController` gerenciar as colunas primária e secundária. Requer iOS 18 ou posterior e o `SplitView` do Core; a versão do Core testada é 9.1.3. No Android, ou para colocar o split dentro de abas ou outro layout, escolha o componente adaptativo existente:

```vue
<script setup lang="ts">
import { supportsUIKitSplitView } from 'vue-router-ns'
const nativeColumns = supportsUIKitSplitView()
</script>

<template>
  <RouterUIKitSplitView
    v-if="nativeColumns"
    name="inbox"
    list="/messages"
    :primaryWidthFraction="0.32"
  />
  <RouterSplitView v-else name="inbox" list="/messages" />
</template>
```

O plugin do router registra os dois componentes. Ambos usam a mesma tabela de rotas, Pages nativas, guards, resultados e formato de histórico salvo. A escolha acontece ao criar a janela; não é uma troca entre stacks já montadas.

O UIKit controla o recolhimento, a expansão e os botões nativos da barra lateral. As colunas expandidas usam o layout lado a lado do UIKit. `primaryWidthFraction` indica uma fração preferida da largura disponível, sujeita aos limites do UIKit. Mostrar ou ocultar a coluna primária muda apenas a apresentação: selecionar um item continua chamando `push()`, acrescentando um detalhe e preservando as seleções anteriores. Voltar percorre esses detalhes e finalmente limpa a coluna. Back nativo, fechamento com guard, modais e `restore` mantêm a semântica de histórico descrita acima. A adaptação das colunas preserva as mesmas Pages e seu estado local.

Para redimensionar a janela de verdade no iPad, permita multitarefa no `App_Resources/iOS/Info.plist` e suporte todas as orientações do iPad:

```xml
<key>UIRequiresFullScreen</key>
<false/>
```

O modo de compatibilidade em tela cheia pode apenas escalar a imagem do aplicativo sem entregar uma janela UIKit menor. A [matriz de validação nativa e os comandos](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-uikit-split.md) registram essa diferença e as versões testadas.

O componente oferece `name`, `list` obrigatório e `primaryWidthFraction` (padrão `0.32`). Sem seleção, o detalhe fica vazio; não há slot `empty`, breakpoint, coluna suplementar ou inspector. Ele precisa ser a raiz da janela: não o envolva em `RouterDrawer`, `RouterTabs`, Page ou outro layout. A coluna primária é a barra lateral dessa janela; use `RouterDrawer` separadamente no layout Android. O `RouterSplitView` existente continua disponível nas duas plataformas.
