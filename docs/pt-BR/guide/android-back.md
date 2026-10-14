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

Enquanto o usuário arrasta, é `{ progress, edge }`, com `progress` indo de 0 a 1. No resto do tempo é `null`: depois que o swipe é cancelado ou solto, no iOS, na primeira página (onde o back sai do app), num modal com `cancelable: false`, e enquanto um leave guard está ativo, já que soltar não vai simplesmente fechar a página nesse caso. Soltar volta pelo router como o botão de voltar, guards incluídos.

## Ativando

Apps que miram o Android 16 (API 36) têm predictive back por padrão. Alvos anteriores ativam com `android:enableOnBackInvokedCallback="true"` no `<application>` do `AndroidManifest.xml`.

Consulte também a [documentação do Android sobre predictive back](https://developer.android.com/guide/navigation/custom-back/predictive-back-gesture).
