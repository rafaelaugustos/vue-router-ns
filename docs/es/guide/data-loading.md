# Carga de datos de ruta (experimental) {#route-data-loading-experimental}

Declara la carga de datos en una ruta y renderiza los estados de pendiente, éxito y error dentro del mismo Page nativo. Esta API de suscripción utiliza el enrutador existente y los stacks nativos. Las rutas explícitas siguen siendo las predeterminadas; no requiere enrutamiento de archivos, Vue Router, Nuxt ni una biblioteca de caché.

Un `component: () => import('./Product.vue')` perezoso carga el código de página . Un cargador de rutas recupera**datos**. La carga de datos no bloquea la presentación nativa: `router.push()` se establece cuando finaliza la navegación, independientemente de la solicitud.

## Definir un cargador escrito {#define-a-typed-loader}

Mantener la definición en un módulo compartido por la tabla de rutas y la página:

```ts
// product-data.ts
import { defineRouteLoader } from 'vue-router-ns'

type Product = { id: string; title: string; price: number }

export const productData = defineRouteLoader(async ({ to }) => {
  const response = await fetch(
    `https://api.example.com/products/${encodeURIComponent(String(to.params.id))}`,
  )
  if (!response.ok) throw new Error('Could not load product')
  return response.json() as Promise<Product>
})
```

```ts
// router.ts
import { createRouter } from 'vue-router-ns'
import { productData } from './product-data'

export const router = createRouter({
  routes: [
    { path: '/', component: () => import('./Home.vue') },
    {
      path: '/products/:id',
      component: () => import('./Product.vue'),
      meta: { loaders: productData },
    },
  ],
})
```

```vue
<!-- Product.vue -->
<script setup lang="ts">
import { useRouteData } from 'vue-router-ns'
import { productData } from './product-data'

const product = useRouteData(productData)
// Top-level refs unwrap in the template; data is Product | undefined.
const { data, status } = product
function retry() {
  void product.reload()
}
</script>

<template>
  <Page>
    <ActionBar title="Product" />
    <StackLayout padding="24">
      <StackLayout v-if="status === 'pending'">
        <ActivityIndicator :busy="true" />
        <Label text="Loading product…" />
      </StackLayout>
      <StackLayout v-else-if="status === 'error'">
        <Label text="Could not load product. Please try again." textWrap />
        <Button text="Retry" @tap="retry" />
      </StackLayout>
      <StackLayout v-else-if="data">
        <Label :text="data.title" />
        <Label :text="'$' + data.price" />
      </StackLayout>
    </StackLayout>
  </Page>
</template>
```

Llame a `useRouteData(definition)` en la configuración de la página enrutada, utilizando el mismo objeto de definición declarado por la ruta. Lanza fuera de una página enrutada o para una definición no declarada. Varios consumidores dentro de esa entrada reciben el mismo identificador. Diferentes entradas, stacks y enrutadores tienen identificadores separados, incluso si sus URL y definiciones coinciden.

`data`, `error` y `status` son referencias de solo lectura. Los resultados son superficiales: el enrutador no realiza un proxy profundo de los objetos devueltos. `status` es `pending`, `success`, `error` o `cancelled`. Un cargador exitoso puede devolver `undefined`; utilice `status` para distinguirlo de pendiente.

`await product.ready` espera el intento actual y siempre resuelve, incluso en caso de falla o cancelación. Inspeccione `status`/`error` después. `reload()` borra explícitamente los datos/error antiguos, cancela el intento pendiente anterior e inicia uno nuevo en esta entrada; su promesa tiene las mismas reglas de liquidación. No cambia el Page ni el historial. No hay ningún reintento automático. Llamarlo después de la eliminación no es una operación.

## Autorización y ciclo de vida {#authorization-and-lifecycle}

Las ejecuciones de transacciones existentes dejan guards, `beforeEach`, middleware, `beforeEnter`, importaciones de página/diseño y `beforeResolve` antes de comenzar el trabajo con los datos de destino. Una vez autorizados, los cargadores independientes se inician simultáneamente durante la creación de la entrada; La presentación nativa no espera sus promesas. Una navegación previa a la confirmación abortada, redirigida o reemplazada nunca inicia los cargadores de ese destino. Una importación de código fallida también impide la carga.

| Operación                                                                    | Comportamiento de datos                                                              |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Ruta inicial, inserción, reemplazo, `force`, parámetros/consulta modificados | Una nueva entrada obtiene un nuevo estado del cargador.                              |
| Navegación duplicada sin `force`                                             | No hay nueva entrada ni carga.                                                       |
| Back, cambio de pestaña, que revela una página cubierta                      | Estado retenido; sin recuperación automática.                                        |
| Reconstruido guardado stack                                                  | Nuevos cargadores después de guards; los datos/resultados no están serializados.     |
| Enlace profundo o `setStack`                                                 | Se cargan las entradas recién creadas; un prefijo común retenido conserva sus datos. |
| Modal                                                                        | Entrada propia; despido cancela su publicación pendiente.                            |
| Eliminación de , Back nativo o eliminación de enrutador/ventana              | Cancelar intentos pendientes, borrar resultados, ignorar respuestas tardías.         |
| Cubriendo una página con otra página/modal                                   | La entrada retenida puede finalizar su solicitud.                                    |

`meta.loaders` acepta una definición/nombre o una matriz. Todas las declaraciones de padres e hijos coincidentes contribuyen; El `[]` de un niño no elimina los cargadores de los padres. Los objetos de definición repetidos se ejecutan una vez por entrada, incluido un nombre y una referencia en línea al mismo objeto. Los nombres desconocidos/definiciones no válidas rechazan la navegación antes de iniciar cualquier cargador hermano.

Las excepciones de datos y las promesas rechazadas pasan al estado `error`, incluso cuando llegan después de la presentación. No rechazan `router.push()` ni llaman a `router.onError()`. Los errores de configuración, importación de componentes y navegación nativa mantienen el comportamiento de error de navegación existente. Maneje o registre errores de datos a través del estado devuelto o su cliente de datos.

## Cancelación y un caché existente {#cancellation-and-an-existing-cache}

El contexto contiene `to`, `from` (la ruta de origen de stack), `isCancelled()` y `onCancel(callback)`. `onCancel` devuelve una función de cancelación de suscripción. Se ejecuta cuando se reemplaza un intento **pending** o se elimina su entrada, e inmediatamente si se registra después de la cancelación. Los intentos completados liberan sus devoluciones de llamada. La cancelación liquida `ready` inmediatamente y evita la publicación tardía de éxito/error, incluso si la solicitud subyacente continúa.

Este contrato intencionalmente no expone un navegador `AbortSignal`. La señal de aborto de NativeScript Core 9.1.3 utiliza su contrato de evento Observable; no es intercambiable con la señal de cada cliente HTTP. Para cancelar el trabajo propiedad únicamente de esta invocación, adapte `onCancel` a la API de cancelación admitida de su cliente. El enrutador no cancela solicitudes compartidas indiscriminadamente.

Por ejemplo, reutilice un caché Promise propiedad de la aplicación:

```ts
const products = new Map<string, Promise<Product>>()

export const productData = defineRouteLoader(({ to }) => {
  const id = String(to.params.id)
  let request = products.get(id)
  if (!request) {
    request = fetchProduct(id) // Your existing client, returning Promise<Product>.
    products.set(id, request)
    const own = request
    void own.catch(() => {
      if (products.get(id) === own) products.delete(id)
    })
  }
  return request
})
```

Dos entradas pueden reutilizar una solicitud; eliminar uno solo descarta su suscripción de resultados. El otro todavía recibe los datos. La aplicación posee alcance de caché, límites de cuenta, vencimiento, invalidación y cancelación de red. `reload()` vuelve a llamar al cargador; invalide su caché primero si desea una nueva solicitud de red. Este pequeño ejemplo elimina los errores para que se pueda solicitar un reintento explícito nuevamente, pero mantiene los valores exitosos hasta que la aplicación los invalide.

## Rutas de archivos opcionales {#optional-file-routes}

Registre definiciones con nombre en el mismo enrutador:

```ts
createRouter({ routes, loaders: { product: productData } })
```

Luego, declare un nombre literal con los metadatos de enrutamiento de archivos [Rutas opcionales desde archivos (experimental)](./file-routing) existentes:

```vue
<script setup lang="ts">
import { definePageMeta } from 'vue-router-ns/file-routing'
definePageMeta({ meta: { loaders: ['product'] } })
</script>
```

Para Vite HMR nativo, use el `.route.json` de la página en su lugar, como con otros metadatos:

```json
{ "meta": { "loaders": ["product"] } }
```

Los nombres se resuelven en el registro de ese enrutador, capturados en el momento de la creación. La página todavía importa `productData` y llama a `useRouteData(productData)` para realizar inferencias. No hay descubrimiento de cargador implícito ni importación automática. HMR de solo plantilla puede conservar el mismo estado de entrada; reemplazar una definición de cargador o cambiar su registro requiere una recarga completa para mantener alineada la identidad de la página/registro. Los cambios en la tabla de rutas se aplican a las entradas recién creadas.

## Cuando el destino debe esperar {#when-the-destination-must-wait}

Un [guard](./guards) asíncrono sigue siendo la opción existente para el trabajo que debe finalizar antes de la navegación. Por ejemplo, una autorización guard puede devolver `false` o redirigir; un `beforeResolve` posterior puede esperar el caché de su aplicación. Eso retrasa la navegación y utiliza el manejo de errores de navegación si arroja. Mantener la autorización ante solicitudes protegidas. No inicie otra navegación desde un cargador para implementar la autorización.

Esta API proporciona un estado de IU reactivo explícito. No agrega un límite de Suspense automático ni requiere una configuración de página asincrónica; mantenga la raíz Page sincrónica. Consulte la composición nativa de Suspense [Composición nativa de Suspense (experimental)](./suspense) para conocer la compatibilidad del renderizador, el contenido asíncrono y el consumo explícito del cargador.

## Ejemplo nativo y grabaciones {#native-example-and-recordings}

El ejemplo completo de [código del ejemplo](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/testing/loaders-app.ts) utiliza un punto final HTTP local real y un caché propiedad de la aplicación. Ambas grabaciones muestran pendiente, éxito, error HTTP, reintento en el mismo Page y retorno mientras hay una solicitud pendiente.

<div class="clips">
<Clip name="ios-loaders" caption="iOS: las páginas nativas siguen respondiendo mientras se cargan los datos del producto." />
<Clip name="android-loaders" aspect="9 / 20" caption="Android: Error HTTP y reintento preservan el Page nativo y el historial." />
</div>

Ejecute la demostración con `--env.loadersTest` y `node scripts/native/loaders/server.mjs`. El punto final local necesita una configuración de transporte solo de dispositivo y reenvío de puerto Android. Consulte [reproducción y aceptación](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-route-data.md) para conocer los comandos exactos y el alcance de la validación.
