# Vistas previas del menú contextual {#context-menu-previews}

Para compartir el estado, la ejecución asincrónica y el manejo de errores en el encabezado, el menú y el teclado, consulte [acciones de página](./page-actions).

Mantenga presionada una fila, vea a dónde lleva y luego decida. En iOS, `UIContextMenuInteraction` muestra una vista previa del destino con un menú de acciones, y al tocar la vista previa se envía a una navegación. Android no tiene vista previa en vivo, por lo que las mismas opciones se convierten en un menú emergente: primero la ruta, luego las acciones.

```vue
<script setup lang="ts">
import { vRoutePreview, type RoutePreviewOptions } from 'vue-router-ns'
import MessagePreview from '../components/MessagePreview.vue'

function menuFor(item: Message): RoutePreviewOptions {
  return {
    to: { name: 'message', params: { id: item.id } },
    preview: MessagePreview,
    props: { id: item.id },
    actions: [
      { title: 'Reply', image: 'arrowshape.turn.up.left', run: () => reply(item) },
      {
        title: 'Archive',
        image: 'archivebox',
        destructive: true,
        run: () => archive(item),
      },
    ],
  }
}
</script>

<template>
  <ListView :items="messages" @itemTap="open">
    <template #default="{ item }">
      <GridLayout v-route-preview="menuFor(item)" columns="auto, *">
        <!-- the row -->
      </GridLayout>
    </template>
  </ListView>
</template>
```

<Clip name="ios-context-menu" caption="Una pulsación larga muestra una vista previa de un mensaje; al tocar la vista previa se abre su ruta. Simulador iOS 26." />

`v-route-preview` funciona en cualquier vista, incluidas las filas de lista; las opciones se leen nuevamente cada vez que se presiona, por lo que una fila reciclada muestra una vista previa del elemento que se muestra ahora. `<RouterLink>` toma las mismas opciones sin `to` a través de su accesorio `menu`:

```vue
<RouterLink to="/messages/1" :menu="{ preview: MessagePreview, props: { id: 1 } }">
  <Label text="Lunch on Friday?" />
</RouterLink>
```

## Opciones {#options}

| Opción             | Significado                                                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `to`               | El destino, confirmado con `router.push` (o `replace`). También se aplican `clearHistory`, `withParents`, `frame`, `transition` y `zoom`.   |
| `preview`, `props` | El componente que se muestra en la vista previa de UIKit, montado con esos accesorios.                                                      |
| `canPreview`       | Llamado al momento de esta publicación. `false` mantiene el contenido protegido fuera de la vista previa; Las acciones todavía se muestran. |
| `size`             | Píxeles independientes del dispositivo. Sin altura, el contenido se mide según el ancho de la fuente.                                       |
| `actions`          | `{ title, image?, destructive?, to?, run? }`. `image` es un símbolo SF en iOS; `to` navega por guards, `run` hace cualquier cosa.           |
| `openTitle`        | Android: el primer elemento de la ventana emergente, "Abrir" de forma predeterminada.                                                       |

## Lo que no es una vista previa {#what-a-preview-is-not}

La vista previa se representa en una aplicación Vue propia y se elimina cuando se cierra el menú. No es una entrada stack: no se ejecuta ningún guard, `afterEach` no se activa, no persiste nada y no se cumple ninguna promesa de resultado. Al confirmar se ejecuta la navegación habitual, por lo que la página se monta nueva; una vista previa nunca se reutiliza como página.

La autorización pertenece a `canPreview`. Un guard que redirigiría a un inicio de sesión todavía se ejecuta en la confirmación, y al presionar una fila protegida se muestran solo las acciones hasta ese momento.

## Plataforma {#platform}

| Plataforma | Presentación                                                                                                                                                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| iOS 13+    | `UIContextMenuInteraction` en la vista, un `UIMenu` de `UIAction`, la vista previa en un controlador de vista de diseño dimensionado según el contenido. La confirmación usa el estilo pop, luego la navegación.                     |
| Android    | `PopupMenu` de títulos. Las vistas independientes utilizan el gesto de pulsación prolongada; Las filas de la lista utilizan el clic largo del elemento de la lista, por lo que un gesto nunca hace que la fila se trague los toques. |

La interacción sigue los `loaded` y `unloaded` de la fila, que es cómo el reciclaje de listas mantiene una interacción por vista. Las comprobaciones nativas se encuentran en el `test/native-context-menus.md` del repositorio.
