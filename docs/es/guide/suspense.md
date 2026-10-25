# Composición nativa de Suspense (experimental) {#native-suspense-composition-experimental}

Mantenga el **Page enrutado sincrónico** y coloque el `Suspense` del Vue alrededor de su asíncrono.
contenido. El Page, ActionBar, transición e historial siguen siendo nativos
enrutador. Esta receta es voluntaria y no agrega ningún componente de enrutador ni contenedor automático.

## La compatibilidad del renderizador es lo primero {#renderer-compatibility-comes-first}

En **NativeScript-Vue 3.1.2 / Vue 3.5.44**, lanzamientos de suspenso originales
`No known component for element div.` Vue le pide al renderizador una puesta en escena oculta
contenedor; este renderizador no registra ese elemento. Exportar `Suspense` no
por sí solo no lo hace utilizable en páginas nativas.

El ejemplo registra explícitamente ese nombre como un diseño nativo antes de iniciar la aplicación:

```ts
import { GridLayout } from '@nativescript/core'
import { getViewMeta, registerElement } from 'nativescript-vue'

registerElement('div', () => GridLayout, getViewMeta('GridLayout'))
```

Este es un registro de compatibilidad de toda la aplicación , que utiliza un renderizador público
API. El nombre debe estar sin usar; no sobrescriba un registro existente ni coloque
esta llamada en cada página. Crea un GridLayout nativo separado para que Vue lo coloque en escena.
contenido pendiente, luego mueve la rama resuelta al árbol nativo visible.
No introduce HTML, renderizado del navegador ni WebView.

Utiliza la receta sólo con las versiones que hayas validado. Vue El suspenso es experimental,
y el nombre provisional es un detalle de implementación del tiempo de ejecución Vue probado. Vuelva a comprobar
esta adaptación después de actualizar cualquiera de los renderizadores; una futura implementación nativa
puede hacerlo innecesario. El comportamiento del stock y la receta adaptada se prueban por separado.
en el informe de compatibilidad [informe de validación](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-suspense.md).

## Consumir un cargador de rutas explícitamente {#consume-a-route-loader-explicitly}

Declarar `productData` mediante [carga de datos de ruta](./data-loading). La ruta comienza
la solicitud después de la autorización. Este niño consume el intento existente de esa entrada:

```vue
<!-- ProductContent.vue -->
<script setup lang="ts">
import { useRouteData } from 'vue-router-ns'
import { productData } from './product-data'

const product = useRouteData(productData)
const ready = product.ready
await ready
const current = product.ready === ready
if (current && product.status.value === 'error') throw product.error.value
const data = current ? product.data.value : undefined
</script>

<template>
  <StackLayout v-if="data">
    <Label :text="data.title" />
    <Label :text="'$' + data.price" />
  </StackLayout>
</template>
```

`ready` se resuelve con éxito, error **y cancelación**. Inspeccionar el estado en lugar
que asumir la resolución significa éxito. El `await` en la configuración secundaria es el asíncrono
dependencia; Devolver un Promise desde un cargador por sí solo no hace que el Vue se suspenda.
La verificación de identidad del intento descarta un intento reemplazado. El niño no vuelve a buscar. La captura de `data` aquí es una instantánea intencional
de este intento, para que el contenido antiguo pueda permanecer visible durante un tiempo de espera posterior.

La página síncrona posee la captura de errores y el reintento explícito:

```vue
<script setup lang="ts">
import { onErrorCaptured, ref } from 'nativescript-vue'
import { useRouteData } from 'vue-router-ns'
import ProductContent from './ProductContent.vue'
import { productData } from './product-data'

const product = useRouteData(productData)
const error = ref(false)
const attempt = ref(0)
onErrorCaptured(() => {
  error.value = true
  return false
})
function retry() {
  // Invalidate your application cache here if it retains the failed request.
  void product.reload()
  error.value = false
  attempt.value++
}
</script>

<template>
  <Page>
    <ActionBar title="Product" />
    <StackLayout padding="24">
      <Label text="Product details" />
      <StackLayout v-if="error">
        <Label text="Could not load product. Please try again." />
        <Button text="Retry" @tap="retry" />
      </StackLayout>
      <Suspense v-else :timeout="0">
        <ProductContent :key="attempt" />
        <template #fallback>
          <StackLayout>
            <ActivityIndicator :busy="true" />
            <Label text="Loading product…" />
          </StackLayout>
        </template>
      </Suspense>
    </StackLayout>
  </Page>
</template>
```

Utilice una raíz nativa por ranura. Errores de captura en un padre síncrono del
límite, renderizar una vista de error separada y devolver `false` para los errores manejados.
El respaldo de carga de Suspense no es un límite de error. Poner inyección y ciclo de vida.
registro anterior a `await` en un `async setup()` ordinario; compilado de alto nivel
await restaura el contexto de configuración de Vue, pero no cambia la propiedad de la solicitud.

## Ciclo de vida del contenido {#content-lifecycle}

| Caso                                                             | Contrato                                                                                                                                                  |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Primer hijo pendiente                                            | Aparece un respaldo nativo dentro del Page existente.                                                                                                     |
| Resolución                                                       | El contenido reemplaza el respaldo; el Page, la ActionBar y el historial permanecen intactos.                                                             |
| `reload()` solo                                                  | No vuelve a ejecutar la configuración asíncrona montada ni muestra automáticamente un respaldo.                                                           |
| Reemplazo con clave de la raíz de ranura predeterminada          | Inicia un nuevo hijo asíncrono. `timeout="0"` muestra el respaldo inmediatamente; un tiempo de espera positivo retiene la rama anterior hasta que expire. |
| Contenido recientemente asíncrono debajo de una raíz sin cambios | No devuelve automáticamente el límite exterior a pendiente. Utilice un límite anidado explícito cuando sea necesario.                                     |
| `<Suspense suspensible>` anidado                                 | El límite interno participa en el manejo de dependencias asíncronas de su padre.                                                                          |
| Página cubierta o pestaña inactiva                               | Su solicitud propia puede finalizar; la resolución no selecciona esa página.                                                                              |
| Back o despido modal                                             | Eliminación del router cancela la publicación de resultados; Vue descarta el subárbol asíncrono eliminado.                                                |
| Gesto nativo Back cancelado                                      | El Page, el hijo pendiente y la solicitud permanecen.                                                                                                     |

El ejemplo registra los eventos `pending`, `fallback` y `resolve`. Estos describen el
Límite de contenido Vue, no finalización de navegación nativa. La guía [Vue](https://vuejs.org/guide/built-ins/suspense.html)
define su semántica; esta receta no proporciona renderizado concurrente de React
o API de transición de React.

La aplicación es propietaria de su caché y trabajo de red. Dos páginas pueden esperar una solicitud; eliminando
no se debe abortar la solicitud compartida. Una configuración asíncrona sin formato sigue siendo JavaScript y
continúa después de que se desecha su componente. Efectos secundarios y uso de la aplicación Guard
la cancelación del contrato del cargador por trabajos de propiedad exclusiva de esa entrada. nunca
navega desde una finalización asíncrona para publicar un resultado en una página eliminada.

## Page límites, Diferidos y accesibilidad {#page-boundaries-deferred-and-accessibility}

Un suspenso alrededor de `RouterView` no incluye aplicaciones de páginas nativas montadas por separado.
No haga que el Page sea asíncrono, coloque el Page dentro del límite de carga, o
usa esta receta para envolver un navegador nativo completo. La ruta diferida importa el código de carga
antes de la presentación; los cargadores inician el trabajo de datos; El suspenso espera un contenido asíncrono.
componente. Estas son tres etapas distintas.

`Deferred` espera la activación de la página nativa antes de montar su contenido. lo hace
no esperar datos. Colocar Suspenso **inside** Diferido cuando ambos comportamientos son
necesario; el cargador ya puede estar ejecutándose mientras el niño espera para montarse.

Mantenga la ActionBar y un encabezado accesible fuera del contenido cambiante. el
usa `useNavigationFocus` con ese encabezado estable. No mueve el foco
nuevamente cuando HTTP complete o agregue una animación de contenido; la política de movimiento nativo permanece
responsabilidad del enrutador. Page y la identidad del rumbo se verifican automáticamente;
esto no es una afirmación de que los anuncios de VoiceOver/TalkBack hayan sido auditados manualmente.
Esta receta no introduce ningún área segura o distribución de teclado separada.

## Ejemplo nativo {#native-example}

El accesorio completo [código del ejemplo](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/testing/suspense-app.ts)
incluye el control negativo stock-renderista, el registro explícito, un
caché HTTP propiedad de la aplicación, configuración asíncrona/SFC/hijos diferidos y comprobaciones del ciclo de vida.
Consulte los comandos de reproducción [y el alcance probado](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-suspense.md).

<div class="clips">
<Clip name="ios-suspense" caption="iOS: contenido pendiente, error capturado y reintento dentro del mismo Page nativo." />
<Clip name="android-suspense" aspect="9 / 20" caption="Android: Vue Suspense con un contenedor de preparación nativo explícito y datos de ruta compartidos." />
</div>
