# O que é o vue-router-ns

O vue-router-ns dá ao [NativeScript-Vue 3](https://nativescript-vue.org) a API do Vue Router, construída em cima da pilha de navegação nativa em vez de um histórico de URLs.

```ts
const router = createRouter({
  routes: [
    { path: '/', name: 'inbox', component: () => import('./pages/Inbox.vue') },
    {
      path: '/messages/:id',
      name: 'message',
      component: () => import('./pages/Message.vue'),
    },
    { path: '/compose', component: () => import('./pages/Compose.vue'), modal: true },
  ],
})

router.push({ name: 'message', params: { id: 42 } })
```

## Por que não o próprio Vue Router

O Vue Router não consegue guiar um app mobile: ele modela a navegação como uma URL que muda, com um `<RouterView>` que troca componentes. Um app NativeScript tem um `Frame` com uma pilha de páginas que continuam vivas umas sob as outras, um botão de voltar e um swipe no iOS que removem páginas sem perguntar a ninguém, modais, e muitas vezes uma pilha por aba.

Então isto não é um wrapper do Vue Router. A back stack do frame é a fonte da verdade, e o router a espelha depois de cada navegação nativa. O que você recebe é a API que já conhece (`push`, guards, `useRoute`, rotas nomeadas, params) com uma semântica que faz sentido num celular.

## O que ele cobre

- [Uma rota por página](./pages): o `useRoute()` dentro de uma página nunca muda, mesmo com outras páginas por cima.
- [Leave guards](./guards) pelos quais passam o botão de voltar do Android, o botão de voltar do iOS e o swipe para baixo de um modal, e que desligam o swipe do iOS enquanto bloqueariam.
- [Rotas modais](./modals) com a própria pilha, e `pushForResult()` para receber um valor de volta de uma página.
- [Uma pilha por aba](./tabs), com o toque na aba ativa voltando para a primeira página.
- [Lista e detalhe adaptáveis](./split-view), com o mesmo histórico de push nos layouts compacto e expandido.
- [Rotas tipadas](./typed-routes): nomes e params checados no app inteiro, sem geração de código.
- [Zoom e elementos compartilhados](./transitions): o zoom do iOS 18 a partir de uma view, e as transições de elementos compartilhados do NativeScript.
- [Deep links](./deep-links) que trazem os pais junto, [a pilha inteira definida como lista](./stack), e [a restauração dela](./restore) depois que o app é morto.
- [Predictive back no Android](./android-back) para páginas que querem acompanhar o swipe.
- [`<Deferred>`](./pages#paginas-com-muito-para-montar) para páginas que devem animar antes de se preencher.

## Por onde começar

1. [Instale](./install) e monte um `<RouterView>`.
2. Leia [Navegando](./navigating) e [Cada página guarda sua rota](./pages): é onde ele mais difere da web.
3. Vindo do Vue Router, passe pelas [diferenças](./vue-router).

A candidata à versão estável é publicada sob a tag `next`. Testes unitários e suítes nativas em simuladores/emuladores cobrem o [escopo da RC](./compatibility); essa página registra as versões suportadas e os limites restantes.
