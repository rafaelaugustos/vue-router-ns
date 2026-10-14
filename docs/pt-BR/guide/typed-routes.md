# Rotas tipadas

Registre o router uma vez, e os nomes de rota e os params passam a ser checados no app inteiro, inferidos da tabela de rotas sem geração de código:

```ts
declare module 'vue-router-ns' {
  interface Register {
    router: typeof router
  }
  interface RouteMeta {
    requiresAuth?: boolean
  }
}
```

```ts
router.push({ name: 'message', params: { id: 1 } }) // ✓
router.push({ name: 'mesage' }) // ✗ Did you mean 'message'?
router.push({ name: 'message' }) // ✗ missing param `id`

const route = useRoute('message')
route.params.id // string
```

Os params vêm do path: `/users/:id` dá `{ id: string }`, `:id?` o torna opcional, `:path+` e `:path*` dão arrays. `children` aninhados juntam seus paths.

## Páginas importadas direto

Declare `routes` inline no `createRouter`, como acima, e passe os componentes por uma função: `() => import('./Message.vue')`, ou `() => Message` para uma página que você prefere importar de cara.

Referenciada direto (`component: Message`), o tipo de uma página `<script setup>` passa a fazer parte do tipo da tabela de rotas, enquanto a própria página usa os tipos da tabela, e o TypeScript desiste do ciclo com `'router' implicitly has type 'any'`. Atrás de uma função, o tipo da página só é olhado depois.
