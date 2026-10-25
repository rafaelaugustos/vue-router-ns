# Rutas escritas {#typed-routes}

Registre el enrutador una vez y los nombres y parámetros de las rutas se verificarán en toda la aplicación, inferidos de la tabla de rutas sin generación de código:

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

Los parámetros provienen de la ruta: `/users/:id` da `{ id: string }`, `:id?` lo hace opcional, `:path+` y `:path*` dan arreglos. Nested `children` une sus caminos.

## Páginas importadas por adelantado {#pages-imported-up-front}

Declare `routes` en línea en `createRouter`, como se indicó anteriormente, y proporcione los componentes a través de una función: `() => import('./Message.vue')` o `() => Message` para una página que prefiera importar por adelantado.

Referenciado directamente (`component: Message`), el tipo de página `<script setup>` pasa a formar parte del tipo de la tabla de rutas mientras que la página misma utiliza los tipos de la tabla de rutas, y TypeScript abandona el ciclo con `'router' implicitly has type 'any'`. Detrás de una función, el tipo de página sólo se analiza más tarde.
