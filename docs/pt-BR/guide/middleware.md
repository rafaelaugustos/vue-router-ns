# Middleware e helpers opcionais

A declaração explícita de rotas e `router.push()` continuam sendo a API padrão. Você pode usar middleware nomeado e helpers opcionais com essas mesmas rotas. Tudo passa pelo matcher, pela transação de guards e pelas pilhas nativas existentes; Nuxt e Vue Router não são dependências.

Esta é a parte de middleware/helpers das convenções opcionais inspiradas no Nuxt. Rotas por arquivos, layouts nomeados e ferramentas de auto-import são outros itens do roadmap; estas APIs não os ativam. Os exemplos usam imports explícitos.

## Registre no seu router

```ts
import { createRouter, defineRouteMiddleware } from 'vue-router-ns'

const auth = defineRouteMiddleware((to, from, { type }) => {
  if (!session.user) {
    return { name: 'login', query: { next: to.fullPath }, replace: true }
  }
})

const router = createRouter({
  routes: [
    { path: '/', component: () => import('./Home.vue') },
    { path: '/login', name: 'login', component: () => import('./Login.vue') },
    {
      path: '/account',
      component: () => import('./Account.vue'),
      meta: { middleware: ['auth'] },
    },
  ],
})

const removeAuth = router.addRouteMiddleware('auth', auth)
router.addRouteMiddleware(
  'metrics',
  (to, from, info) => {
    // Observe a navegação. Não retorne nada para continuar.
  },
  { global: true },
)
```

Registre antes de montar o app para incluir a navegação inicial. O registro pertence àquela instância do router, incluindo suas pilhas e modais, sem singleton global. Nomes duplicados geram erro. A função retornada remove aquele registro e pode ser chamada várias vezes. `defineRouteMiddleware()` apenas tipa a função; não a registra.

`meta.middleware` aceita um nome, uma função ou um array readonly de nomes/funções. O merge de metadados continua igual: a lista do filho substitui a do pai. Use `[]` para limpar middleware herdado; middleware global continua executando. Nomes desconhecidos geram erro e chegam ao `router.onError()`.

## Ordem e resultados

Cada navegação que passa por guards executa:

1. Leave guards das entradas que serão removidas.
2. `beforeEach`, na ordem de registro.
3. Middleware global, na ordem de registro, seguido do middleware do destino, na ordem declarada.
4. `beforeEnter` dos novos registros e o carregamento do componente, para push/replace.
5. `beforeResolve`, a operação nativa e `afterEach`.

O mesmo nome ou a mesma referência de função inline executa uma vez na fase de middleware. Um nome global também listado nos metadados executa uma vez. A lista é capturada depois de `beforeEach`; remover um registro durante um middleware assíncrono não altera aquela tentativa. Uma função registrada separadamente em `beforeEach` é outro registro e também executa nessa fase.

Middleware recebe os mesmos `(to, from, { type })` dos [guards](./guards): `false` cancela; uma localização nativa redireciona; `true`/`undefined` continua; promises são aguardadas. Lançar um erro rejeita a navegação e chega a `onError()` uma vez. O redirecionamento usa o mecanismo e o limite de redirecionamentos existentes. **Retorne o destino; não chame `router.push()` ou `navigateTo()` dentro do middleware.** Essas chamadas iniciam outra navegação, com as regras de cancelamento existentes, em vez de retornar uma decisão de guard.

Middleware executa na navegação inicial, push, replace e back coordenado pelo router, incluindo visitas repetidas ao mesmo registro. Navegações duplicadas para a página atual continuam sendo ignoradas, salvo com `force`. No back, são verificados os metadados do destino. Para proteger um formulário na página que está saindo, use o leave guard dela.

## Navegue na pilha da página

Capture o helper no setup da página roteada:

```vue
<script setup lang="ts">
import { useNavigateTo, useRoute } from 'vue-router-ns'

const navigateTo = useNavigateTo()
const route = useRoute()

function openAccount() {
  return navigateTo('/account')
}
</script>

<template>
  <Page>
    <Button text="Conta" @tap="openAccount" />
  </Page>
</template>
```

O helper mantém a pilha da página mesmo quando outra pilha está em foco. `useRoute()` continua descrevendo aquela entrada enquanto ela estiver coberta. Depois da desmontagem do componente ou descarte da entrada, chamar o helper rejeita, em vez de navegar em outra pilha. `useNavigateTo()` exige o setup de uma página roteada.

Fora do setup, passe o router responsável explicitamente:

```ts
import { navigateTo } from 'vue-router-ns'

await navigateTo(router, '/account', { frame: 'settings', replace: true })
```

Localizações nomeadas herdam os tipos de nomes e parâmetros do router fornecido. `useNavigateTo()` usa o [registro de tipos](./typed-routes). As opções são `NavigationOptions` mais `replace`: frame, modal, transition, animated, clearHistory, props, withParents e zoomFrom mantêm os significados nativos. `replace: true` na própria localização também mantém o comportamento existente.

A promise tem o resultado de `router.push()`/`replace()`: `undefined` no sucesso, `NavigationFailure` na recusa/cancelamento/duplicação ou rejeição no erro. Ela termina quando a operação nativa termina. Abrir um modal resolve após a apresentação; use `router.pushForResult<T>()` para aguardar o resultado entregue no fechamento. Não existe outro histórico nem pilha de avanço de navegador.

## Limites nativos e convenções suportadas

Middleware tem os mesmos limites de gestos dos guards globais. O Back Android passa pelo router. Um pop nativo iOS sem proteção pode terminar antes de chegar ao JavaScript; o middleware não pode vetá-lo depois. Um `onBeforeRouteLeave()` ativo bloqueia swipe-back no iOS e segura o fechamento de modais canceláveis enquanto aguarda sua decisão assíncrona; veja [guards](./guards). Middleware sozinho não instala leave guards nem desativa gestos nativos.

Os helpers aceitam localizações de rotas nativas. URLs externas, opções de navegador `open`/`external` e `redirectCode` de servidor não são suportados e rejeitam. Redirecionamentos de middleware também rejeitam URLs externas. Para um App Link/Universal Link, use `router.openLink()` com sua política de URLs; para abrir um navegador, chame a API do NativeScript explicitamente.

Esta API não instala descoberta por arquivos nem auto-imports. Imports e registros explícitos funcionam sem ferramentas de build. Uma futura descoberta deve usar o mesmo registro e reportar colisões de nomes, sem substituir handlers silenciosamente.
