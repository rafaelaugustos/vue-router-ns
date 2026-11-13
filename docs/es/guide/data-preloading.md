# Precarga de datos de rutas (experimental) {#route-data-preloading-experimental}

Prepara un loader que haya permitido explícitamente la anticipación cuando el usuario toque una tarjeta. El destino consume datos preparados/en curso válidos solo después de sus guards normales. La preparación no importa componentes, monta vistas Vue/nativas, muestra pestañas, cambia el historial ni ejecuta guards de navegación. Los loaders existentes y la [precarga de código](./preloading) siguen siendo independientes; no hay tráfico especulativo automático ni un framework de caché obligatorio.

## Autorizar un loader explícitamente seguro {#authorize-an-explicitly-safe-loader}

Pasa una política `preload` como segundo argumento de `defineRouteLoader()`. `scope()` debe devolver un objeto estable para la sesión/época de permisos actual, o `null`/`undefined` para denegar la preparación. `authorize({ to, from })` debe devolver el booleano `true` de forma síncrona. Debe ser una comprobación de permisos sin efectos secundarios; se deniegan las políticas asíncronas. Resuelve la autenticación asíncrona en la app antes de permitir la preparación. Estas comprobaciones no sustituyen la autorización del servidor ni los guards.

```ts
import { defineRouteLoader } from 'vue-router-ns'

type Session = { accessToken: string; mayReadProducts: boolean }
type Product = { id: string; title: string }
let session: Session | null = null

export function updateSession(next: Session | null) {
  session = next ? { ...next } : null
}
export const productData = defineRouteLoader(
  async ({ to }) => {
    const account = session
    if (!account?.mayReadProducts) throw new Error('Product access denied')
    const response = await fetch(
      `https://api.example.com/products/${encodeURIComponent(String(to.params.id))}`,
      { headers: { Authorization: `Bearer ${account.accessToken}` } },
    )
    if (!response.ok) throw new Error('Could not load product')
    return response.json() as Promise<Product>
  },
  {
    preload: {
      scope: () => session,
      authorize: () => session?.mayReadProducts === true,
    },
  },
)
```

El ejemplo captura las credenciales al invocarse. Reemplaza el objeto de ámbito cuando cambien la cuenta, las credenciales o los permisos. No devuelvas un objeto nuevo en cada lectura. Tras actualizar la sesión, limpia el trabajo preparado como se muestra abajo.

Declara la misma definición del loader en los metadatos de ruta. También funcionan las definiciones con nombre y las declaraciones de padres coincidentes. Solo se prepara la definición solicitada; los loaders hermanos no se inician. La configuración muestra los valores predeterminados de un pool independiente para datos:

```ts
const router = createRouter({
  routes: [
    { path: '/', component: () => import('./Home.vue') },
    {
      path: '/products/:id',
      name: 'product',
      component: () => import('./Product.vue'),
      meta: { loaders: productData },
    },
  ],
  preloadData: { concurrency: 2, maxEntries: 16, ttl: 30_000 },
})
```

## Preparar desde una página {#prepare-from-a-page}

Captura `useRouteDataPreload()` durante el setup de la página enrutada. Conecta estas funciones al inicio del toque, arrastre abandonado/cancelación y liberación mediante el [handler completo](./preloading#prepare-from-a-page); conserva su botón accesible normal como otra forma de abrir. El helper libera el interés al eliminar la página/scope. Mantén el handle durante la navegación para que los guards asíncronos puedan reutilizarlo. Los identificadores y etiquetas del ejemplo están en inglés.

```ts
import { useRouter, useRouteDataPreload, type RoutePreload } from 'vue-router-ns'
import { productData } from './product-data'

const router = useRouter()
const prepare = useRouteDataPreload()
const to = { name: 'product', params: { id: '42' } } as const
let interest: RoutePreload | undefined

function touchDown() {
  interest?.cancel()
  interest = prepare(to, productData)
}
function abandon() {
  interest?.cancel()
  interest = undefined
}
async function open() {
  const held = interest
  interest = undefined
  try {
    await router.push(to)
  } finally {
    held?.cancel()
  }
}
```

Fuera de una página, llama a `router.preloadData(to, productData)`. Un router vinculado a una pila posee sus intereses hasta que esta cierre; los intereses raíz pertenecen al router/ventana. El destino debe resolverse y la definición debe estar declarada y permitir la anticipación; de lo contrario, el handle informa un error. El código puede prepararse por separado con `router.preload(to)`.

## Resultados, coincidencia y navegación {#results-matching-and-navigation}

El resultado es el mismo handle `RoutePreload`: `state` vivo de solo lectura, promise `ready` del primer resultado y `cancel()`. Nunca expone el payload preparado. Los estados son `queued`, `loading`, `ready`, `error` y `cancelled`. La denegación del permiso de datos usa el motivo `unauthorized`; los demás son `cancelled`, `expired`, `invalidated`, `disposed` y `capacity`. La promise nunca rechaza y conserva su primer resultado aunque la disponibilidad expire después.

Compartir exige el mismo loader, identidad de sesión, registros de ruta coincidentes, destino completo y origen completo, incluidos params/query/hash. El origen se incluye porque los loaders pueden depender de él. Los routers/ventanas tienen pools separados. Los consumidores mantienen intereses independientes; cancelar uno no cancela otro ni una entrada que ya consume la solicitud. Una carga normal iniciada antes de la preparación no entra retroactivamente en el pool; una caché de la app puede unir ese trabajo.

Después de todos los guards normales, una entrada nueva adquiere la preparación correspondiente y sigue presentándose sin esperar los datos. `useRouteData(productData)` expone el estado habitual de esa entrada. Pueden reutilizarse valores listos y solicitudes pendientes; la expiración o el fallo especulativo recurre a la carga normal. Los cambios de cuenta/permisos y la invalidación explícita cancelan la publicación pendiente compartida sin repetir silenciosamente trabajo protegido. Una denegación o redirect no crea una entrada para el destino preparado.

`RouteLoaderContext.preloading` distingue la invocación especulativa de la carga normal. `reload()` siempre inicia un intento normal en vez de consumir otra vez la preparación. Las cargas normales sin preparación siguen siendo independientes. Las entradas retenidas por Back/pestañas conservan su estado. Los valores compartidos son referencias superficiales, no se clonan ni congelan profundamente: trata los resultados preparados como inmutables. Los datos nunca se serializan con las pilas guardadas.

## Límites, cancelación y cambios de cuenta {#budgets-cancellation-and-account-changes}

`RouterOptions.preloadData` tiene límites independientes de `concurrency` (2), `maxEntries` (16) y `ttl` (30.000 ms). Los valores deben ser enteros positivos finitos. El límite cuenta trabajos de loaders/resultados retenidos, no bytes ni contenido de la caché de la app. El TTL empieza en la primera solicitud, incluida la cola; reutilizar no lo amplía. Los resultados listos usan expulsión LRU; un pool lleno de trabajos pendientes devuelve `capacity`. La navegación autorizada puede promover su solicitud en cola sin esperar otra especulación.

El trabajo en cola sin consumidores nunca se ejecuta. El último interés pendiente libera el contexto compartido del loader e invoca sus callbacks `onCancel()`. Una solicitud en ejecución sigue ocupando un puesto hasta que termine su promise, incluso cancelada. Conecta el callback al cliente HTTP solo si esa invocación posee la solicitud o su propia suscripción de caché. Cancelar siempre detiene la publicación del router; solo aborta el transporte si el cliente admite e implementa ese adaptador. La fixture nativa permite deliberadamente que HTTP termine tras cancelar.

Llama a esto inmediatamente al cerrar sesión/cambiar cuenta o permisos, e invalida la caché correspondiente de la app:

```ts
updateSession(nextSession)
router.clearPreloads()
```

El ámbito y el permiso se comprueban antes de ejecutar, reutilizar y publicar. Los cambios de ámbito no se observan continuamente: limpiar permite cancelar de inmediato; las comprobaciones también rechazan respuestas tardías sin limpieza. Eliminar/reemplazar rutas, HMR de la tabla generada y cambiar fábricas invalida la preparación. Usa `router.clearPreloads()` tras cambios de metadatos en el mismo objeto o una actualización explícita. Reemplazar registros de loaders con nombre requiere la recarga completa del router ya existente.

La limpieza afecta a la preparación de código y datos, incluidas las entradas que aún esperan trabajo preparado. No borra valores ya consumidos en entradas vivas ni en una caché de la app; la app controla retirar páginas de cuenta y datos en caché. La recarga y eliminación de datos normales conservan su comportamiento. Ningún resultado preparado sobrevive a la muerte del proceso.

## Evidencia nativa {#native-evidence}

<Clip name="route-data-preload" :width="480" aspect="3 / 4" caption="HTTP real frío/preparado, arrastre abandonado, especulación denegada, rechazo del guard, cambio de cuenta durante HTTP y eliminación del propietario. Retraso controlado de 900 ms en el servidor; no es un benchmark de red. Simulador iOS 18.6; etiquetas en inglés." />

La fixture cuenta construcciones antes del commit y comprueba la identidad de Page/historial de origen. Su servidor HTTP verifica independientemente las solicitudes, incluidas cero denegadas y solicitudes separadas de cuentas A/B. Consulta el [informe de validación](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-route-preload-stage2.md) y el [driver reproducible](https://github.com/rafaelaugustos/vue-router-ns/blob/main/scripts/native/preload/README.md). La evidencia nativa cubre un simulador iOS; no establece aceptación táctil en Android, rendimiento en hardware físico ni recolección de memoria.
