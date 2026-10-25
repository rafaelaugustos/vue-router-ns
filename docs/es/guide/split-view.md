# Listado y detalle {#list-and-detail}

Consulte [Capacidades nativas y opciones de contenedor](./capabilities) para conocer la propiedad, los límites de la plataforma y la distinción rc.2/rc.3.

`RouterSplitView` muestra una lista y su detalle uno al lado del otro cuando hay suficiente espacio. En una ventana estrecha, el detalle cubre la lista. Utiliza las mismas rutas y métodos de navegación en ambos diseños:

```vue
<RouterSplitView name="inbox" list="/messages">
  <template #empty>
    <Label text="Select a message" horizontalAlignment="center" verticalAlignment="middle" />
  </template>
</RouterSplitView>
```

<Clip name="ipad-split" :width="480" aspect="3 / 4" caption="La bandeja de entrada permanece visible a medida que los mensajes se envían al detalle stack. Simulador iPadOS 26." />

La ruta `list` es la primera página fijada. Cada ruta no modal insertada en este stack se convierte en un detalle, independientemente de su ruta o de su anidación en la tabla de rutas. Las rutas con `modal` aún están abiertas por separado. Una vista dividida con nombre puede coexistir con `RouterView` normales, incluso en diferentes pestañas.

```ts
// Inside either pane, useRouter() is bound to the whole split stack.
await router.push('/messages/42')
await router.push('/messages/42/edit')

// From elsewhere, name the stack.
await router.push('/messages/42', { frame: 'inbox' })
```

## Diseño y estado {#layout-and-state}

El diseño sigue el ancho disponible del componente, en píxeles independientes del dispositivo, en lugar del tipo de dispositivo o el tamaño de pantalla completa. Por lo tanto, la rotación, el cambio de tamaño de la ventana y el plegado que cambian el ancho disponible pueden cambiar el diseño. El punto de interrupción predeterminado es 840 y la columna de la lista tiene 320 de ancho:

```vue
<RouterSplitView list="/messages" :breakpoint="900" :listWidth="300" />
```

Ambos fotogramas nativos permanecen montados. Cambiar el tamaño no recrea páginas, no ejecuta la navegación guards ni cambia la ruta seleccionada. La posición de desplazamiento de la lista, el estado del componente local, los campos de detalles no guardados y el respaldo nativo del detalle stack permanecen en su lugar. En el diseño ampliado, la lista y el detalle superior están activos para `onPageActivated`; un modal desactiva ambos. `router.currentRoute` sigue siendo el detalle superior hasta que el usuario vuelve a la lista.

La ranura `empty` aparece en la columna de detalles cuando el diseño expandido no tiene detalles seleccionados. No es una ruta ni una entrada del historial.

## Android diseños plegables {#android-foldable-layouts}

![División nativa con reconocimiento de pliegue](/media/android-fold-hinge.png)

Emulador Android: los paneles nativos dejan vacía el área de bisagra informada por el sistema operativo.

Instale el puente de devolución de llamada Java AndroidX opcional en `App_Resources/Android/app.gradle`:

```groovy
dependencies {
  implementation 'androidx.window:window-java:1.5.1'
}
```

Reconstruya la aplicación nativa después de agregar la dependencia. Para RTL, habilite `android:supportsRtl="true"` en el `<application>` del manifiesto Android, como para otros diseños nativos Android. `foldAware` por defecto es `true`; cuando el puente está disponible, cada vista dividida montada observa `WindowLayoutInfo` desde su propia Actividad. Elimina al oyente cuando se descarga o se desmonta y se suscribe nuevamente cuando se carga. Ninguna actividad en primer plano de todo el proceso o heurística de modelo de dispositivo selecciona a su propietario.

Un pliegue de separación o una bisagra totalmente oclusiva tienen prioridad sobre `breakpoint` y `listWidth`. Una característica vertical coloca la lista y los detalles en las dos regiones físicas; la lista está a la derecha en RTL. Una característica horizontal coloca la lista encima del detalle. El espacio excluye la bisagra, con redondeo hacia afuera para las longitudes enteras de la rejilla de NativeScript. Una vista que cruza solo un lado utilizable mantiene ambos fotogramas en ese lado, mediante navegación compacta.

Un pliegue plano, no separador y no oclusivo no cambia el diseño. Sin una característica relevante, sin la dependencia opcional y en iOS, se aplica el diseño habitual basado en el ancho. Para excluirse explícitamente:

```vue
<RouterSplitView list="/messages" :foldAware="false" />
```

Los mismos Marcos y Páginas sobreviven a los cambios de postura; El historial de navegación, los borradores y el estado de desplazamiento permanecen adjuntos a sus entradas originales. La ranura `empty` ocupa la región de detalle. Este es un diseño de dos paneles para una única función de plegado que se cruza, no para la incrustación de actividad Android ni para una ventana nativa adicional. La aplicación que la contiene aún posee su política de restauración de procesos y cambio de configuración Android.

Los comandos de reproducción y evidencia nativa están en validación plegable [informe de validación](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-folding.md). Consulte también [AndroidX WindowManager](https://developer.android.com/jetpack/androidx/releases/window) y [FoldingFeature semántica](https://developer.android.com/reference/androidx/window/layout/FoldingFeature).

## Historia y regreso {#history-and-back}

El historial funciona igual en ambos diseños. Seleccionar otro elemento con `push()` agrega un detalle; no descarta la selección anterior. Dado:

```text
/messages → /messages/42 → /messages/42/edit
```

Back primero regresa a `/messages/42`, luego a la lista. En el diseño ampliado, el último reverso borra la columna de detalles. La parte posterior nativa y la parte posterior del enrutador permanecen sincronizadas y guards de salida puede evitar que se eliminen páginas.

- `push(list)` y `backToRoot()` regresan a la lista existente a través del guards.
- `replace()` reemplaza el detalle superior. En la lista, abre el primer detalle.
- `clearHistory: true` borra el historial detallado y mantiene la lista.
- `setStack()` mantiene la lista como la primera entrada, anteponiéndola cuando se omite.
- `pushForResult()` devuelve resultados de detalles o modales como de costumbre.
- `restore` guarda y restaura el historial combinado de lista/detalle como uno llamado stack.
- `backToRootOnReselect` funciona dentro de un `TabViewItem`, como en `RouterView`.

## Comportamiento nativo {#native-behavior}

La lista y el detalle utilizan cada uno un Frame nativo. Una raíz nativa transparente en detalle Frame proporciona su destino posterior; Este detalle de implementación nunca aparece en `router.stack` o en estado guardado. El modo compacto coloca el detalle Frame sobre la lista; el modo expandido lo coloca al lado. Las páginas nunca se transfieren entre marcos durante el cambio de tamaño.

El primer detalle se abre en todos los paneles, por lo que las transiciones de zoom de elementos compartidos y iOS de la lista no se utilizan allí. Las transiciones entre páginas de detalles funcionan normalmente, incluidas las vistas previas predictivas Android. Regresar desde el primer detalle a la lista utiliza la transición hacia atrás normal del Frame.

`name` y `list` se leen cuando se monta el componente. Para crear un stack dividido diferente, monte un nuevo componente con un Vue `key` diferente.

## Optar por columnas UIKit {#opt-in-uikit-columns}

Utilice `RouterUIKitSplitView` como raíz **de la ventana nativa** para permitir que `UISplitViewController` administre las columnas primarias/secundarias. Requiere iOS 18 o posterior y `SplitView` de Core; la versión probada de Core es 9.1.3. Elija el componente adaptable existente en Android o al incrustar una división dentro de pestañas u otro diseño:

```vue
<script setup lang="ts">
import { supportsUIKitSplitView } from 'vue-router-ns'
const nativeColumns = supportsUIKitSplitView()
</script>

<template>
  <RouterUIKitSplitView
    v-if="nativeColumns"
    name="inbox"
    list="/messages"
    :primaryWidthFraction="0.32"
  />
  <RouterSplitView v-else name="inbox" list="/messages" />
</template>
```

El complemento del enrutador registra ambos componentes. Cada uno utiliza la misma tabla de rutas, páginas nativas, guards, resultados y formato stack guardado. La elección se realiza al crear la ventana; no es un interruptor de tiempo de ejecución entre stacks montado.

UIKit posee el colapso/expansión y los controles de la barra lateral del sistema. Las columnas expandidas utilizan el diseño en mosaico de UIKit. `primaryWidthFraction` es una fracción preferida del ancho disponible, sujeto a las limitaciones de UIKit. Mostrar u ocultar la columna principal cambia solo la presentación: al seleccionar un elemento aún se llama a `push()`, se agrega un detalle y se conservan las selecciones anteriores. Back vuelve a revisar esos detalles y finalmente borra la columna de detalles. El Back nativo, el despido cauteloso, los modales y el `restore` conservan la semántica histórica descrita anteriormente. La adaptación de columnas mantiene las mismas páginas y su estado local.

Para cambiar el tamaño de la ventana iPad real, permita la multitarea en `App_Resources/iOS/Info.plist` y admita todas las orientaciones de iPad:

```xml
<key>UIRequiresFullScreen</key>
<false/>
```

El modo de compatibilidad de pantalla completa puede escalar la superficie de una aplicación sin darle una ventana UIKit más pequeña. Consulte la matriz de aceptación nativa [y los comandos de reproducción](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-uikit-split.md) para conocer la distinción y las versiones probadas.

Este componente expone `name`, `list` requerido y `primaryWidthFraction` (`0.32` predeterminado). Su detalle vacío está en blanco; no tiene ranura `empty`, punto de interrupción, columna suplementaria o inspectora. Debe poseer la raíz de la ventana: no la envuelva en `RouterDrawer`, `RouterTabs`, Page u otro diseño. La columna principal es la barra lateral de esta ventana; utilice `RouterDrawer` por separado para un diseño Android. El `RouterSplitView` existente sigue estando disponible en ambas plataformas.
