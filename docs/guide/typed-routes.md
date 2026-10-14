# Typed routes

Register the router once, and route names and params get checked across the app, inferred from the route table with no code generation:

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

Params come from the path: `/users/:id` gives `{ id: string }`, `:id?` makes it optional, `:path+` and `:path*` give arrays. Nested `children` join their paths.

## Pages imported up front

Declare `routes` inline in `createRouter`, as above, and give components through a function: `() => import('./Message.vue')`, or `() => Message` for a page you'd rather import up front.

Referenced directly (`component: Message`), a `<script setup>` page's type becomes part of the route table's type while the page itself uses the route table's types, and TypeScript gives up on the cycle with `'router' implicitly has type 'any'`. Behind a function, the page's type is only looked at later.
