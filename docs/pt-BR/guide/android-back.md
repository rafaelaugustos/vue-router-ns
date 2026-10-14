# Predictive back no Android

Desde o Android 14, o swipe de voltar informa seu progresso enquanto o dedo se move. O `useBackGesture()` entrega isso à página que o swipe fecharia, para ela acompanhar o dedo:

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

## O que não existe

A página de baixo não aparece durante o swipe. O `@nativescript/core` não a mantém numa back stack de fragments que o sistema pudesse mostrar, então o que acontece na tela fica por conta da página. A [#19](https://github.com/rafaelaugustos/vue-router-ns/issues/19) acompanha isso.
