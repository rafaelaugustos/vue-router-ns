# Instalação

```sh
npm install vue-router-ns@next
```

Por enquanto está em beta, publicado sob a tag `next`. Requer `nativescript-vue` 3 e `@nativescript/core` 8.9 ou mais novo.

## Primeiros passos

Exporte o router de um `router.ts` e instale-o:

```ts
// app.ts
import { createApp } from 'nativescript-vue'
import App from './App.vue'
import { router } from './router'

createApp(App).use(router).start()
```

```vue
<!-- App.vue -->
<template>
  <RouterView />
</template>
```

O `<RouterView>` renderiza um `Frame` e mostra a rota dada em `initial` (`/` por padrão). Todo componente de rota é uma página, então ele renderiza um `<Page>`:

```vue
<!-- pages/Message.vue -->
<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router-ns'

const route = useRoute()
const router = useRouter()
</script>

<template>
  <Page>
    <ActionBar :title="`Message ${route.params.id}`" />
    <Button text="Reply" @tap="router.push('/compose')" />
  </Page>
</template>
```

## O app de demonstração

O repositório traz um pequeno app de e-mail com duas abas em [`demo/`](https://github.com/rafaelaugustos/vue-router-ns/tree/master/demo). Ele cobre params tipados, um modal de composição que devolve o texto, um leave guard que só pergunta enquanto há rascunho, um guard de login, uma página lazy, `clearHistory`, uma página de mensagem que acompanha o swipe de voltar do Android, e abas que voltam para a primeira página quando tocadas de novo.

Com o [NativeScript CLI](https://docs.nativescript.org/setup/) instalado:

```sh
npm install
npm run dev        # compila o router em modo watch

cd demo
npm install
ns run ios         # ou: ns run android
```
