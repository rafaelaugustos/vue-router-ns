# Configurando todo el stack {#setting-the-whole-stack}

## Seleccionar una entrada retenida exacta {#selecting-an-exact-retained-entry}

`router.stack` enumera rutas. `router.history` añade un snapshot congelado con una dirección de instancia para cada entrada retenida, de abajo hacia arriba. Dos entradas con la misma ruta tienen direcciones distintas:

```ts
const snapshot = router.getHistory({ frame: 'inbox' })
const selected = snapshot?.entries[1]
if (selected) await router.backToEntry(selected, { animated: false })
```

`history.value` sigue el stack del llamador: el enfocado en el router de la aplicación o el propietario dentro de una página. `getHistory()` lee el mismo ámbito; `{ frame }` selecciona un frame con nombre en este router/ventana. Leer no revela una pestaña ni navega. Usa `computed(() => router.getHistory({ frame: 'inbox' }))` para una vista reactiva de un stack con nombre. Un ámbito ausente o cerrado devuelve `undefined`. El historial de una página cerrada no pasa a representar otro stack.

Cada snapshot contiene `scope` y `entries`. El ámbito contiene `id`, `name`, `kind` (`frame` o `modal`), `windowId` cuando está vinculado a una ventana nativa y `pinnedRoot`. Cada entrada contiene:

| Campo           | Significado                                                                                                                                                |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scopeId`, `id` | Dirección exacta aceptada por `backToEntry()`. Es estable mientras existan el stack y la entrada, incluso durante descargas temporales y HMR de la página. |
| `key`           | Identidad del estado de página. La restauración versión 2 la conserva, pero crea una nueva dirección de instancia.                                         |
| `route`         | Copias independientes de `path`, `fullPath`, `name`, `params`, `query` y `hash`. Sin registros de ruta, componentes, metadatos ni referencias nativas.     |
| `restored`      | Esta página se reconstruyó desde un stack guardado, incluido un snapshot antiguo que solo contiene rutas. Es un objeto nativo nuevo.                       |

Los snapshots, las entradas, los datos de ruta y los arrays internos de parámetros/query están congelados. Un snapshot anterior sigue siendo una observación de aquel momento; vuelve a leer para consultar las entradas actuales. Conservar un snapshot no retiene las Pages nativas del router.

`backToEntry(selected, { animated, result })` selecciona el stack propietario de la entrada, aunque otro stack con nombre haya obtenido el foco. Revela la pestaña de ese stack antes de navegar. No admite sustituir `frame` ni buscar otra entrada por coincidencia de ruta. El resultado indicado se entrega solo a la página superior que sale; los demás resultados eliminados se resuelven con `undefined`. Los guards de salida se ejecutan de arriba hacia abajo por el flujo existente de Back, incluidos redireccionamientos, confirmación nativa y liberación.

- Seleccionar la entrada superior actual devuelve un fallo `duplicated` sin ejecutar guards ni cambiar el historial.
- Una entrada ausente, otro router/ventana o un stack cerrado/reemplazado rechaza con un error. Reutilizar el nombre del frame o restaurar la misma ruta/clave no vuelve válida una dirección antigua.
- Un guard que rechaza devuelve `aborted` y conserva el stack. Una navegación más reciente, el cierre del propietario o un cambio nativo del destino o de la página superior durante la espera devuelve `cancelled`.
- Un stack retenido y descargado encola Back hasta que cargue su host; otros stacks pueden seguir navegando. Un stack todavía sin abrir no tiene una entrada retenida para seleccionar.
- La raíz fija de un split puede seleccionarse y permanece fija. La selección nunca la elimina.
- Mientras haya un modal abierto, la selección se limita al stack del modal superior. Seleccionar un historial cubierto rechaza sin cerrar el modal; usa primero el flujo existente de Back del modal. Seleccionar la raíz del modal lo mantiene abierto.

Persiste rutas y estado de la aplicación mediante la [restauración](./restore), no estas direcciones de instancia. Las entradas eliminadas desaparecen: no hay historial de avance y reconstruirlas no resucita sus objetos nativos. Los controles nativos de Back permanecen.

<Clip name="entry-history" :width="480" aspect="3 / 4" caption="Dos stacks nativos: selección exacta entre duplicados, guard que rechaza, dirección obsoleta, Back nativo cancelado/completado y cierre de propietarios. Simulador iOS 18.6; etiquetas del app en inglés." />

## Menú opcional de historial en Back {#optional-back-history-menu}

`useBackHistoryMenu()` ofrece el historial retenido de la página a un control de la aplicación. Conserva el botón Back del sistema UIKit y su menú de pulsación larga. El Back de la barra de Android no ofrece un menú de entradas retenidas; esta API proporciona un popup nativo. En iOS, los controles de la aplicación usan un action sheet/popover anclado, que también se abre desde un comando de teclado. No requiere buscar el botón Back mediante APIs privadas ni sustituir delegates de navegación.

Llámalo durante el setup de una página enrutada. Además de la pulsación larga, ofrece un botón de historial con una etiqueta clara y traduce los textos para tu aplicación:

```vue
<script setup lang="ts">
import { ref } from 'nativescript-vue'
import type { View } from '@nativescript/core'
import {
  useRouter,
  useBackHistoryMenu,
  useNavigationCommands,
  NavigationCommandScope,
} from 'vue-router-ns'

const router = useRouter()
const back = ref<{ nativeView: View }>()
const menu = useBackHistoryMenu({
  title: 'Back history',
  cancelTitle: 'Cancel',
  label: (entry, index) => `${entry.route.fullPath} · ${index + 1}`,
  onError: console.error,
})
const open = () => (back.value ? menu.show(back.value.nativeView) : false)
const commands = useNavigationCommands([
  {
    id: 'history',
    title: 'Back history',
    shortcut: { input: 'h', modifiers: ['ctrl'] },
    action: open,
  },
  { id: 'back', title: 'Back', shortcut: { input: 'Escape' }, action: 'back' },
])
</script>

<template>
  <Page>
    <NavigationCommandScope :commands="commands">
      <StackLayout>
        <Button
          ref="back"
          text="Back"
          accessibilityLabel="Back; hold for history"
          @tap="!menu.active.value && router.back()"
          @longPress="open"
        />
        <Button text="Show history" accessibilityLabel="Show Back history" @tap="open" />
      </StackLayout>
    </NavigationCommandScope>
  </Page>
</template>
```

`show(source: View)` devuelve si el menú está abierto. Nunca navega ni revela otro stack. Las llamadas repetidas mientras está abierto son idempotentes, incluidas las múltiples fases de pulsación larga de NativeScript. El origen debe estar cargado y pertenecer a esta página visible. En la raíz, durante navegación nativa, detrás de un modal, en una pestaña no seleccionada, tras la eliminación o cuando no está disponible la presentación nativa, devuelve `false`.

El menú captura las entradas anteriores, de la más reciente a la más antigua, excluyendo el tope actual. `label(entry, index, history)` recibe el índice desde la raíz y el historial congelado; por defecto muestra el nombre de la ruta (o su ruta completa) seguido de la posición contando desde uno. Distingue ubicaciones repetidas y entradas reconstruidas en las etiquetas cuando sea útil. `title` y `cancelTitle` aceptan string, ref o getter y se leen al abrir; Android muestra las etiquetas sin encabezado ni fila Cancelar.

Seleccionar cierra el menú y llama a `backToEntry()` con esa dirección exacta. Los guards pueden rechazarlo sin cambiar el historial. Los errores inesperados de navegación se envían a `onError` o a la consola. `active` es una ref de solo lectura; `dismiss()` cierra únicamente este menú y devuelve si estaba abierto. Cubrir la página, descargar el origen, cambiar el historial o eliminar al propietario cierra el menú e invalida callbacks antiguos. Nunca cambia el destino a una nueva aparición de la misma ruta.

La interfaz nativa gestiona selección y cierre. El comando opcional de teclado abre el mismo menú; Escape lo cierra antes del Back de ruta cuando se procesa mediante el ámbito de comandos. Android también admite flechas/Enter y Back físico. UIKit admite cancelación nativa y cierre al tocar fuera en iPad. Las comprobaciones nativas verifican etiquetas accesibles y teclado; no certifican la voz de VoiceOver/TalkBack ni todos los modos de teclado del sistema. Un host personalizado necesita una Page/ancla enrutada de NativeScript cargada para esta interfaz; de lo contrario puede usar la API de historial de solo lectura para mostrar sus propios controles.

En iOS 16 y posteriores, el router protege el historial de la ActionBar cuando podría saltar un guard de salida activo, incluso en una página cubierta. Instala temporalmente un elemento Back nativo: tocar llama a `router.back()` y mantener pulsado ofrece un menú de entradas exactas mediante `backToEntry()`. Las etiquetas usan el título de la página retenida (o la ruta) y su posición. Los guards rechazados o pendientes conservan el historial. Cuando ninguna entrada eliminable tiene un guard activo, vuelve el Back/historial original de UIKit. Un guard solo en la raíz retenida no requiere sustitución. Los controles Back ocultados por la aplicación siguen ocultos; las actualizaciones normales de ActionBar conservan los demás elementos de la aplicación. Consulta [guards](./guards#what-the-platform-does-while-a-guard-is-active) para los límites de los gestos nativos. El `useBackHistoryMenu()` opcional sigue disponible para controles y etiquetas propios.

<Clip name="back-history-menu" :width="480" aspect="3 / 4" caption="Dos stacks: historial original de UIKit, pulsación larga en Back de la aplicación, Ctrl H/Escape, rechazo del guard, selección exacta de duplicados, navegación concurrente y eliminación. Simulador iOS 18.6; etiquetas del app en inglés." />

## Reconciliar una lista de rutas {#reconciling-a-list-of-routes}

Al igual que el `NavigationStack(path:)` de SwiftUI, el stack se puede configurar como una lista y las páginas siguientes:

```ts
await router.setStack(['/', '/orders', { name: 'order', params: { id: 42 } }])
```

El enrutador mantiene las páginas que ambos stacks comparten de abajo hacia arriba, regresa a la última de ellas y luego envía el resto. Sólo el último paso anima. Los guardias corren a cada paso y el primer fallo lo detiene. Una ruta modal en la lista se convierte en una página simple: la lista describe el stack de un cuadro.

Toma `frame`, `animated` y `transition` como segundo argumento. Es en lo que se basan [`withParents`](./deep-links#bringing-the-parents-along) y [para restaurar un stack](./restore) guardado.

La lista no puede estar vacía. Si un guard interrumpe la conciliación, los pasos completados permanecen: `setStack()` no es una transacción. En un `RouterSplitView`, la lista permanece fijada como la primera entrada, incluso cuando se omite en el argumento.

## Volviendo atrás sin animar {#going-back-without-animating}

`back()`, `backTo()` y `backToRoot()` toman `animated: false`. `go(delta)` sólo acepta el desplazamiento; utilice `backTo()` o `backToRoot()` cuando necesite opciones. Un marco anima una ventana emergente en la forma en que entró la página que se está abriendo, por lo que el enrutador configura eso en la página antes de abrirla.
