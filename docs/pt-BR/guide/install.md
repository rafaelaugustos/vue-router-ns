# Instale e abra uma página

Você precisa de Node 20.19.4+, NativeScript-Vue 3.1.2+ (3.x) e NativeScript Core 9.1.3+ (9.x). Prepare os SDKs com a [configuração de ambiente do NativeScript](https://docs.nativescript.org/setup/); compilar iOS localmente exige macOS e Xcode. A base completa testada está em [compatibilidade](./compatibility).

## Crie ou use um projeto NativeScript-Vue

Se já tem um app NativeScript-Vue executando, use o diretório dele. Caso contrário, siga o [starter oficial do NativeScript-Vue](https://nativescript-vue.org/docs/getting-started/installation):

```sh
ns create pocket-notes --template @nativescript-vue/template-blank@latest
cd pocket-notes
```

Instale o router nesse projeto:

```sh
npm install vue-router-ns@next
```

A tag `next` seleciona uma release candidate. Versione o lockfile resultante para instalações reproduzíveis.

<a id="getting-started"></a>

<a id="primeiros-passos"></a>

## Primeira página

Use esta estrutura mínima no diretório `src` do projeto. Substitua o Frame da raiz do starter por `RouterView`; o router cria seu Frame nativo.

```ts
// src/router.ts
import { createRouter } from 'vue-router-ns'

export const router = createRouter({
  routes: [{ path: '/', component: () => import('./pages/Home.vue') }],
})
```

```ts
// src/app.ts
import { createApp } from 'nativescript-vue'
import App from './App.vue'
import { router } from './router'

createApp(App).use(router).start()
```

```vue
<!-- src/App.vue -->
<template>
  <RouterView />
</template>
```

```vue
<!-- src/pages/Home.vue -->
<template>
  <Page>
    <ActionBar title="Pocket notes" />
    <Label text="Your first native page" margin="24" />
  </Page>
</template>
```

Execute em um simulador/emulador configurado ou aparelho conectado:

```sh
ns run ios
# ou:
ns run android
```

Você deve ver **Pocket notes** e **Your first native page**. Continue para [criar seu primeiro app](./first-app): lista, detalhe, resultado de modal e guard de edição, com arquivos completos.

<a id="try-it-online"></a>

## Experimente online

O [playground no StackBlitz](./playground) oferece um editor no navegador conectado ao NativeScript Preview no aparelho. O runtime nativo pré-compilado tem limites; consulte o guia antes de avaliar recursos específicos de plataforma.

<a id="the-demo-app"></a>

<a id="o-app-de-demonstracao"></a>

## O aplicativo de demonstração

Para rodar os exemplos do repositório sem criar um projeto, siga a [preparação do checkout do Fieldnotes](./native-showcase#run-from-a-checkout). No diretório `demo`, use `npm run tutorial:ios` / `tutorial:android` para o tutorial inicial, `showcase:ios` / `showcase:android` para Fieldnotes, ou `ns run ios` / `ns run android` para o app de e-mails padrão. Todas as entradas usam o mesmo ID do demo: instalar uma substitui a outra no aparelho.

## Problemas de instalação

Com npm 10, use beta.15 ou mais recente. O peer opcional do Vite na beta.14 causava `Cannot read properties of null (reading 'edgesOut')`; o router já não declara peers de Vite ou webpack e não exige `--legacy-peer-deps`.

Rotas por arquivos são opcionais. Se escolher usá-las, instale o bundler indicado [no guia](./file-routing). Preserve um lockfile funcional do NativeScript Vite no npm 10: esse builder tem um problema separado de resolução de peers opcionais ao começar sem lockfile. Veja as combinações testadas na [validação de instalação](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/npm-install.md).
