---
layout: home

hero:
  name: vue-router-ns
  text: A API do Vue Router, na pilha nativa.
  tagline: Rotas, guards, params e nomes tipados para NativeScript-Vue 3, com a back stack de um Frame como fonte da verdade em vez de uma URL.
  image:
    light: /logo.png
    dark: /logo-dark.png
    alt: vue-router-ns
  actions:
    - theme: brand
      text: Começar
      link: /pt-BR/guide/install
    - theme: alt
      text: O que é
      link: /pt-BR/guide/
    - theme: alt
      text: Diferenças do Vue Router
      link: /pt-BR/guide/vue-router

features:
  - title: Uma rota por página
    details: As páginas continuam vivas umas sob as outras, então o useRoute() dentro de uma página nunca muda enquanto outras são empurradas por cima.
  - title: Guards que a plataforma respeita
    details: Leave guards rodam no back, no botão de voltar do Android, no botão de voltar do iOS e no modal puxado para baixo, e desligam o swipe do iOS enquanto bloqueariam.
  - title: Modais, resultados e abas
    details: Rotas modais com a própria pilha, pushForResult() para receber um valor de volta, uma pilha por aba, e um toque na aba ativa que volta para a primeira página.
  - title: Rotas tipadas
    details: Nomes e params inferidos da tabela de rotas e checados no app inteiro, sem geração de código.
  - title: Deep links e pilhas inteiras
    details: Empurre uma página com os pais dela, defina a pilha como uma lista, e restaure tudo depois que o Android matou o app em segundo plano.
  - title: Nada roda entre os toques
    details: O router espelha o frame depois de cada navegação nativa. Swipes e pops que ele não iniciou são captados do mesmo jeito que os dele.
---
