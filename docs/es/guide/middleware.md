# Middleware opcional y ayudas de navegación {#optional-middleware-and-navigation-helpers}

Los registros de ruta explícita y `router.push()` siguen siendo la API predeterminada. Opcionalmente, puede utilizar middleware con nombre y ayudantes de navegación con esos mismos registros. Utilizan el comparador existente, la transacción guard y los stacks nativos; Ni Nuxt ni Vue Router son una dependencia.

Esta es la parte middleware/ayudante de las convenciones opcionales de estilo Nuxt. El enrutamiento de archivos, los diseños con nombre y las herramientas de importación automática son elementos de la hoja de ruta independientes que no están habilitados por estas API. Todos los ejemplos utilizan importaciones explícitas.

## Registre middleware en su enrutador {#register-middleware-on-your-router}

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
    // Observe this guarded navigation. Return nothing to continue.
  },
  { global: true },
)
```

Regístrate antes de montar la aplicación para cubrir la navegación inicial. El registro pertenece a esa instancia de enrutador, incluidos su stacks y sus modales. No crea ningún singleton en todo el proceso. Un nombre duplicado arroja; el eliminador devuelto cancela el registro y puede llamar de forma segura repetidamente. `defineRouteMiddleware()` sólo escribe la función; no lo registra.

`meta.middleware` acepta un nombre, una función o una matriz de nombres/funciones de solo lectura. Los metadatos principales se fusionan en el destino como de costumbre: el `middleware` de un niño reemplaza la lista del padre. Utilice `[]` para borrar el middleware heredado; El middleware global todavía se ejecuta. Nombres desconocidos arrojan y llegan a `router.onError()`.

## Ejecución y resultados {#execution-and-results}

Cada navegación vigilada ejecuta:

1. Deje guards en las entradas que se eliminan.
2. `beforeEach` guards, en orden de registro.
3. Middleware global, en orden de registro, luego middleware de destino en orden de declaración.
4. `beforeEnter` en los registros recién ingresados, luego el cargador de componentes, para insertar/reemplazar.
5. `beforeResolve`, la operación nativa, luego `afterEach`.

Un nombre de middleware repetido, o una referencia de función en línea repetida, se ejecuta una vez en la fase de middleware. Un nombre global que también figura en los metadatos se ejecuta una vez. La fase captura los registros después de `beforeEach`; cancelar el registro durante un middleware asincrónico no cambia la instantánea de ese intento. Una función instalada por separado como `beforeEach` guard es un registro separado y aún se ejecuta en esa fase.

El middleware utiliza el mismo `(to, from, { type })` y valores de retorno que [guards](./guards): `false` aborta; una ubicación de ruta nativa redirige; `true`/`undefined` continúa; Se esperan promesas. Al lanzar se rechaza la navegación y se llega a `onError()` una vez. Un redireccionamiento reutiliza la maquinaria de navegación existente y el límite de redireccionamiento. **Devuelve el destino del middleware; no llame a `router.push()` o `navigateTo()` desde dentro.** Estos inician otra navegación, con la semántica de cancelación habitual, en lugar de devolver una decisión guard.

El middleware se ejecuta para la navegación inicial, la inserción, el reemplazo y la devolución mediada por el enrutador, incluidas las visitas repetidas al mismo registro. La navegación duplicada a la página actual aún se omite a menos que se configure `force`. En la parte posterior, verifica los metadatos del destino, no la página que se elimina. Utilice el guard de salida de una página para proteger su trabajo no guardado.

## Navegar en el stack propietario {#navigate-in-the-owning-stack}

En la configuración de una página enrutada, capture el asistente una vez:

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
    <Button text="Account" @tap="openAccount" />
  </Page>
</template>
```

El asistente capturado permanece vinculado al stack de esa página incluso cuando se enfoca otro stack. `useRoute()` todavía describe esa entrada de página en particular mientras está cubierta. Llamar al asistente después de que el componente se desmonta o se elimina su entrada es rechazado, en lugar de navegar en un stack diferente. `useNavigateTo()` requiere la configuración de una página enrutada.

Fuera de la configuración, pasa el enrutador propietario explícitamente:

```ts
import { navigateTo } from 'vue-router-ns'

await navigateTo(router, '/account', { frame: 'settings', replace: true })
```

Las ubicaciones con nombre heredan el nombre de ruta y los tipos de parámetros del enrutador proporcionado. `useNavigateTo()` recoge el registro de tipo [Rutas escritas](./typed-routes) del enrutador. Las opciones son `NavigationOptions` más `replace`: marco, modal, transición, animado, clearHistory, accesorios, withParents y zoomFrom mantienen sus significados nativos. El `replace: true` propio de una ubicación también mantiene su comportamiento actual.

La promesa tiene el mismo resultado que `router.push()`/`replace()`: `undefined` en caso de éxito, un `NavigationFailure` en caso de rechazo/cancelación/duplicación, o rechazo en caso de error. Se liquida cuando se completa la operación nativa. La apertura de un modal se liquida en la presentación; use `router.pushForResult<T>()` para esperar el resultado devuelto cuando se cierre ese modal. No hay un segundo historial ni un avance estilo navegador stack.

## Límites nativos y convenciones admitidas {#native-limits-and-supported-conventions}

El middleware tiene los mismos límites de gestos nativos que el guards global. Android Back pasa por el enrutador. Un pop nativo iOS no protegido puede completarse antes de que JavaScript lo vea, por lo que el middleware no puede vetarlo después. Un `onBeforeRouteLeave()` activo mantiene el despido modal cancelable y de retroceso de iOS mientras se ejecuta su decisión asincrónica; ver comportamiento [guard](./guards#what-the-platform-does-while-a-guard-is-active). El middleware por sí solo no instala una página abandonada guard ni desactiva los gestos nativos.

Estos ayudantes aceptan ubicaciones de ruta nativas. Las URL externas, las opciones del navegador `open`/`external` y el servidor `redirectCode` no son compatibles y se rechazan. Las redirecciones de middleware también rechazan las URL externas. Para una aplicación/enlace universal, utilice `router.openLink()` y su política de URL; para abrir un navegador, utilice explícitamente la API de la plataforma NativeScript.

No hay descubrimiento de sistema de archivos ni instalación de importación automática en esta API. Los registros/importaciones explícitos funcionan sin herramientas de compilación. Cualquier descubrimiento futuro debe registrarse a través de la misma API e informar las colisiones de nombres en lugar de sobrescribir los controladores.
