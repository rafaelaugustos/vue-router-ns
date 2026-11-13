# Precarga de código de rutas (experimental) {#route-code-preloading-experimental}

Prepara el código de un destino lazy cuando el usuario toca una tarjeta. La navegación posterior puede reutilizar ese trabajo. La preparación resuelve el destino y los redirects declarativos y carga únicamente el componente final de la ruta. No navega, muestra pestañas, crea ventanas, monta vistas Vue/nativas, ejecuta guards ni inicia loaders de datos. Las páginas padre y los layouts se cargan normalmente durante la navegación.

Es opcional y experimental. El router no inicia trabajo especulativo hasta llamar a `router.preload(to)` o a la función devuelta por `useRoutePreload()`.

## Preparar desde una página {#prepare-from-a-page}

Limita las fábricas lazy a importar código. Esta configuración muestra los valores predeterminados:

```ts
const router = createRouter({
  routes: [
    { path: '/', component: () => import('./Home.vue') },
    { path: '/products/:id', name: 'product', component: () => import('./Product.vue') },
  ],
  preload: { concurrency: 2, maxEntries: 16, ttl: 30_000 },
})
```

Captura `useRoutePreload()` durante el setup de la página enrutada. Cada llamada mantiene un interés independiente en el código; eliminar la página o el scope libera sus intereses automáticamente. Cancela al abandonar el gesto. Conserva el interés hasta que termine la navegación para que un guard asíncrono pueda reutilizarlo. El botón normal ofrece una vía accesible sin mantener pulsado. Las etiquetas del ejemplo están en inglés.

```vue
<script setup lang="ts">
import type { TouchGestureEventData } from '@nativescript/core'
import { useRouter, useRoutePreload, type RoutePreload } from 'vue-router-ns'

const router = useRouter()
const prepare = useRoutePreload()
const to = { name: 'product', params: { id: '42' } } as const
let interest: RoutePreload | undefined
let inside = false

function abandon() {
  inside = false
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
function touch(event: TouchGestureEventData) {
  if (event.action === 'down') {
    abandon()
    inside = true
    interest = prepare(to)
  } else if (event.action === 'cancel') {
    abandon()
  } else if (event.action === 'move') {
    const size = event.view.getActualSize()
    if (
      event.getX() < 0 ||
      event.getY() < 0 ||
      event.getX() > size.width ||
      event.getY() > size.height
    )
      abandon()
  } else if (event.action === 'up' && inside) {
    inside = false
    void open().catch(console.error)
  }
}
</script>

<template>
  <Page>
    <ActionBar title="Products" />
    <StackLayout>
      <GridLayout height="160" backgroundColor="#19385c" @touch="touch">
        <Label text="Hold to prepare, release to open" color="white" />
      </GridLayout>
      <Button text="Open product" @tap="open().catch(console.error)" />
    </StackLayout>
  </Page>
</template>
```

## Resultados y propiedad {#outcomes-and-ownership}

`RoutePreload` expone `state` de solo lectura, una promesa `ready` y `cancel()`. El estado actual es `queued`, `loading`, `ready`, `error` o `cancelled`. Un error contiene `error`; la cancelación contiene `reason`: `cancelled`, `expired`, `invalidated`, `disposed` o `capacity`.

`ready` nunca rechaza. Se resuelve una vez con el primer resultado listo/error/cancelado. Un interés listo puede cancelarse o caducar después; cambia su estado actual, mientras la promesa conserva el resultado original. Estar listo no autoriza navegar ni garantiza retención futura en caché.

```ts
const interest = router.preload({ name: 'product', params: { id: 42 } })
const result = await interest.ready
if (result.status === 'error') console.error(result.error)
interest.cancel()
router.clearPreloads()
```

El helper de página cancela al eliminar la página o el scope del componente. Una llamada directa a `router.preload(to)` pertenece a ese router; un router vinculado al stack libera sus intereses cuando se cierra el stack. El cierre permanente del router/ventana invalida toda preparación. Dos routers tienen pools independientes. La resolución sigue las reglas de `router.resolve()`, incluido el stack del llamador para params relativos, sin cambiar el foco.

## Límites e invalidación {#budgets-and-invalidation}

| Opción        | Predeterminado | Política                                                                                                                                                                          |
| ------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `concurrency` | 2              | Máximo de fábricas especulativas en ejecución. La navegación autorizada puede promover su destino en cola sin esperar trabajo ajeno.                                              |
| `maxEntries`  | 16             | Máximo de registros pendientes/listos. Al alcanzar el límite, elimina el registro listo usado hace más tiempo; rechaza nuevos intereses con `capacity` si todos están pendientes. |
| `ttl`         | 30.000 ms      | Vida máxima desde la primera solicitud del registro, incluida la espera/carga. Reutilizarlo no la amplía.                                                                         |

Los valores deben ser enteros positivos y finitos. Una importación en ejecución cancelada ocupa su plaza hasta terminar. El trabajo en cola sin consumidores nunca se ejecuta. Los consumidores con diferentes params de una ruta comparten código, no estado de página ni datos. Cancelar un consumidor no cancela a los demás ni una navegación autorizada que ya comparte la importación. También se comparte una importación iniciada primero por la navegación normal.

Eliminar/sustituir una ruta, actualizar la tabla generada mediante HMR o cambiar la fábrica del componente invalida la preparación anterior. Usa `router.clearPreloads()` al cerrar sesión/cambiar de cuenta o invalidar explícitamente. Una finalización tardía no rellena ese pool especulativo. El HMR que modifica un componente Vue en su lugar sigue perteneciendo a Vue. No se conserva preparación tras la muerte del proceso.

El límite controla referencias especulativas del router y cantidades de trabajo, no bytes de módulos importados. Cancelar no interrumpe una importación JavaScript en ejecución, deshace sus efectos de inicialización, descarga la caché de módulos JavaScript ni borra la caché normal de componentes del router tras navegar. Una preparación caducada/fallida recurre a la carga normal cuando la navegación está autorizada.

## Autorización y evidencia nativa {#authorization-and-native-evidence}

Precargar código ejecuta la fábrica lazy y la inicialización del módulo antes de los guards de navegación. No pongas consultas protegidas, credenciales ni efectos de navegación allí. Mantén los datos protegidos en [loaders de ruta autorizados](./data-loading). La navegación real siempre ejecuta sus guards; un redirect de guard puede elegir otro destino. Esta etapa no incluye API de datos especulativos ni exige un framework de caché.

<Clip name="route-code-preload" :width="480" aspect="3 / 4" caption="Toque frío/preparado, arrastre abandonado, rechazo del guard y eliminación del propietario. La fábrica incluye un retraso controlado de 900 ms; los tiempos no son un benchmark de importación. Simulador iOS 18.6; etiquetas en inglés." />

La fixture nativa cuenta construcciones de Page, Frame, UIViewController y apps Vue antes del commit, compara el historial exacto de origen y registra llamadas de guard/datos. Su secuencia táctil real demuestra preparación sin esas asignaciones, rechazo y eliminación. La evidencia nativa proviene de un simulador iOS; no certifica hardware físico, entrada nativa Android ni recolección de memoria. Los contratos cubren consumidores compartidos, límites, invalidación y ventanas. Consulta el [informe de validación](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-route-preload-stage1.md) y la [referencia de API](./api#route-code-preloading).
