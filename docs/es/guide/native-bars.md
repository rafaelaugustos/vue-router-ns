# Barras nativas y búsqueda {#native-bars-and-search}

Consulte [Capacidades nativas y opciones de contenedor](./capabilities) para conocer la propiedad, los límites de la plataforma y la distinción rc.2/rc.3.

Para compartir el estado, la ejecución asincrónica y el manejo de errores en el encabezado, el menú y el teclado, consulte [acciones de página](./page-actions).

Mantener títulos y acciones en NativeScript's `ActionBar`. Posee la barra de herramientas nativa/UINavigationBar, los delegados y el botón Atrás. Los títulos reactivos y los enlaces `ActionItem` ya funcionan, incluso al regresar del detalle. En iOS, `iosLargeTitle="true"` habilita el título colapsable nativo; Utilice una vista de desplazamiento nativa como contenido de la página. Android no tiene una política de títulos grandes equivalente en la ActionBar estándar.

<Clip name="ios-search" caption="El campo de búsqueda nativo filtra la bandeja de entrada sin agregar una ruta. Simulador iOS 26." />

## Búsqueda propiedad de una página {#search-owned-by-a-page}

```vue
<script setup lang="ts">
import { computed, ref } from 'nativescript-vue'
import { useNativeSearch } from 'vue-router-ns'

const query = ref('')
const search = useNativeSearch({ query, placeholder: 'Search messages' })
const messages = ref([{ subject: 'Welcome' }])
const filtered = computed(() =>
  messages.value.filter((message) =>
    message.subject.toLowerCase().includes(query.value.toLowerCase()),
  ),
)
</script>

<template>
  <Page>
    <ActionBar title="Inbox" iosLargeTitle="true">
      <ActionItem text="Search" ios.position="right" @tap="search.activate()" />
    </ActionBar>
    <ListView :items="filtered">
      <template #default="{ item }"><Label :text="item.subject" /></template>
    </ListView>
  </Page>
</template>
```

`useNativeSearch({ query, placeholder?, onSubmit?, ios?: { hidesWhenScrolling?, placement? } })` se registra una vez en la configuración de la página enrutada. `query` es un ref grabable propiedad de la aplicación. Manténgalo en la página durante su ciclo de vida posterior a stack, o en una tienda para que persista durante la eliminación o el reinicio de la página. Escribir nunca empuja rutas ni cambia consultas de URL; navegue explícitamente al enviar si esa es la política de su aplicación. `placeholder` acepta una cadena, ref o getter. `onSubmit(query)` es opcional.

El resultado tiene un `active`, un ref, un `activate(): boolean` y un `dismiss(): boolean` de solo lectura. La activación requiere que la página esté cargada, actualizada en su propio Frame, en su pestaña seleccionada y no cubierta por un modal. El descarte cierra la interfaz de usuario/teclado de búsqueda y conserva la consulta. Al regresar a una página no se activa automáticamente el teclado. Ambos paneles divididos visibles pueden poseer su propia búsqueda de forma independiente. Un rechazo guard deja la búsqueda intacta.

| Plataforma | Presentación                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| iOS 11+    | Una página local `UISearchController` en su `UINavigationItem`. De forma predeterminada, el campo de búsqueda se oculta mientras se desplaza; configure `ios.hidesWhenScrolling: false` para mantenerlo visible. `ios.placement` es `automatic`, `stacked`, `inline` o `integrated` (iOS 26, en la parte inferior). Dentro de un `TabView` el valor predeterminado es `stacked`, bajo el título: La ubicación automática de iOS 26 coloca la barra en la parte inferior, detrás de la barra de pestañas. |
| Android    | NativeScript `SearchBar` (`androidx.appcompat.widget.SearchView`) se convierte temporalmente en la vista de título de la ActionBar existente mientras está activa. La vista del título anterior vuelve al despido. Los ActionItems siguen siendo propiedad de NativeScript.                                                                                                                                                                                                                              |

Los controladores de búsqueda existentes se dejan tranquilos: la activación devuelve falso y las compilaciones de desarrollo explican el conflicto. Registre solo un propietario de búsqueda por página. Los enlaces de búsqueda y los delegados nativos se publican en la eliminación de páginas, la eliminación de enrutador-host y el reemplazo de HMR. No se reemplaza ninguna barra global ni delegado de navegación y la intercepción de left-guard `backAction` permanece intacta.

## Apariencia más allá de los estilos NativeScript {#appearance-beyond-nativescript-styles}

Prefiere ActionBar `color`, `backgroundColor`, `flat`, `title`, `titleView` y ActionItems. Si se necesita una apariencia específica de UIKit, configure el elemento de navegación de la página , no una barra de navegación compartida. Un controlador cargado tiene acceso a `event.object.ios.navigationItem`:

```ts
function loaded({ object: page }) {
  if (!__IOS__ || !page.ios) return
  const appearance = UINavigationBarAppearance.new()
  appearance.configureWithDefaultBackground()
  page.ios.navigationItem.standardAppearance = appearance
  page.ios.navigationItem.scrollEdgeAppearance = appearance
}
```

Esta es una receta de aplicación iOS 13+ y requiere tipificaciones iOS. Conserve cualquier apariencia existente por elemento si varias funciones de la aplicación la modifican. Mantenga los ActionItems declarativos y no asigne `backAction` ni reemplace los delegados del controlador de navegación: el enrutador los usa para la navegación trasera protegida. UIKit restaura el elemento de navegación propio de la página anterior en la ventana emergente, incluida una ventana emergente interactiva cancelada.

Consulte [NativeScript ActionBar](https://docs.nativescript.org/ui/action-bar), [UISearchController](https://developer.apple.com/documentation/uikit/uisearchcontroller) y [ciclo de vida de la página](./pages).
