# Predictive back no Android

No Android 14 ou mais recente, o router mostra a página anterior durante o swipe de voltar. A página atual encolhe e acompanha o dedo, revelando a de baixo. Cancelar restaura as duas páginas; soltar conclui o movimento e volta pelo router, passando pelos guards.

O preview funciona entre páginas da mesma stack, inclusive dentro de um modal. A primeira página de um modal continua usando o fechamento normal, sem preview da stack de baixo. Na primeira página do app, o back continua saindo do app. Páginas com um leave guard ativo não iniciam o preview. Se a view anterior não estiver disponível, o back normal continua funcionando.

## Personalizando

O preview vem ativado. Para substituir a animação por uma sua, desative-o no router:

```ts
const router = createRouter({
  routes,
  backPreview: false,
})
```

O `useBackGesture()` continua disponível com ou sem preview. Ele entrega o progresso à página que o swipe fecharia:

```vue
<script setup lang="ts">
import { computed } from 'nativescript-vue'
import { useBackGesture } from 'vue-router-ns'

const gesture = useBackGesture()
const scale = computed(() => 1 - (gesture.value?.progress ?? 0) * 0.1)
</script>

<template>
  <Page>
    <GridLayout :scaleX="scale" :scaleY="scale">...</GridLayout>
  </Page>
</template>
```

Enquanto o usuário arrasta, é `{ progress, edge }`, com `progress` indo de 0 a 1. No resto do tempo é `null`: depois que o swipe é cancelado ou solto, no iOS, na primeira página (onde o back sai do app), na primeira página de um modal com `cancelable: false`, e enquanto um leave guard está ativo, já que soltar não vai simplesmente fechar a página nesse caso. Soltar volta pelo router como o botão de voltar, guards incluídos.

## Ativando

Defina `android:enableOnBackInvokedCallback="true"` no `<application>` do `AndroidManifest.xml` para receber o progresso do predictive back no Android 14 e 15, mesmo mirando a API 36. A ativação por padrão para apps que miram a API 36 só vale quando executados no Android 16 ou posterior.

Consulte também a [documentação do Android sobre predictive back](https://developer.android.com/guide/navigation/custom-back/predictive-back-gesture).

## Prévia experimental controlada pelo Core

O padrão continua sendo a prévia atual do router. Para testar a [API proposta para o Core](https://github.com/NativeScript/NativeScript/pull/11558), ative explicitamente:

```ts
const router = createRouter({ routes, backPreview: 'core' })
```

Os hosts de Frame detectam uma sessão de versão 1 de `beginBackPreview()`. O Core 9.1.3 não oferece essa API: com essa dependência publicada, `'core'` usa a prévia atual. Testar o protótipo exige compilar a revisão proposta do Core; o router não modifica pacotes instalados nem instala automaticamente um Core não publicado. Hosts customizados continuam usando sua própria implementação de prévia.

O protótipo mantém a Page anterior desanexada e apresenta uma imagem nativa temporária. O Frame cuida do descarte durante navegação, unload, remoção da janela e recriação da Activity. Os guards e o histórico continuam no router. Um leave guard ativo impede a prévia antes de começar; guards globais/assíncronos executam após soltar o gesto e podem recusar a navegação. Uma navegação nova invalida um gesto anterior.

![Protótipo do Core durante um gesto real de voltar no Android](/media/android-core-back-preview.png)

A captura síncrona tem custo de tempo e memória. A imagem é estática, limitada a 16 MiB, oculta da acessibilidade e liberada após o uso. Conteúdo com SurfaceView/TextureView, janelas seguras, transições customizadas/compartilhadas e capturas incompatíveis usam a prévia atual como fallback. Um Frame modal só apresenta sua própria Page anterior.

O protótipo também corrige uma condição de corrida do Core na anexação após recriar a Activity. Essa correção faz parte da proposta upstream; a opção do router, sozinha, não corrige o Core publicado. Veja a [comparação no Android 14/15/16 e os comandos de reprodução](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-predictive-back.md). Medições em emuladores não garantem performance em aparelhos físicos, e o padrão não será alterado apenas com base neste protótipo.
