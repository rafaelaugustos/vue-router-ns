# Page acciones {#page-actions}

Defina una acción una vez en una página enrutada y reutilice su estado y devolución de llamada en el encabezado nativo y el menú contextual. `usePageActions` compone con `ActionBar` de NativeScript, los menús de ruta y comandos de teclado existentes; no reemplaza el controlador de navegación nativo ni el botón de retroceso.

<Clip name="page-actions" caption="Acciones de encabezado/menú compartido, estado deshabilitado, localización y errores en la aplicación nativa real." />

```vue
<script setup lang="ts">
import { ref } from 'nativescript-vue'
import { usePageActions, vRoutePreview } from 'vue-router-ns'

const title = ref('Save')
const canSave = ref(true)
const errorMessage = ref('')
const actions = usePageActions(
  [
    {
      id: 'save',
      title,
      enabled: canSave,
      busyTitle: 'Saving…',
      image: 'square.and.arrow.down',
      async run({ signal }) {
        // Your application implements persistence and honors cancellation.
        await saveDraft({ signal })
      },
    },
    { id: 'details', title: 'Details', run: ({ router }) => router.push('/details') },
  ],
  {
    onError: (error) => {
      errorMessage.value = String(error)
    },
  },
)
// Keep the options object stable while only action state changes.
const menu = { to: '/details', actions: actions.menu(['save', 'details']) }
</script>

<template>
  <Page>
    <ActionBar title="Editor">
      <PageActionItem :actions="actions" action="save" ios.position="right" />
      <!-- Ordinary ActionItems can coexist here. -->
    </ActionBar>
    <StackLayout>
      <Label v-route-preview="menu" text="Hold for actions" />
      <Label :text="errorMessage" textWrap="true" />
    </StackLayout>
  </Page>
</template>
```

`PageActionItem` está registrado por el complemento del enrutador y también se puede importar. Colóquelo dentro de la ActionBar de la página enrutada propietaria. Las referencias y los captadores mantienen los títulos localizados sin reconstruir el registro. El `saveDraft` anterior es el código de la aplicación, no la API del enrutador.

## Definición y ejecución {#definition-and-execution}

`usePageActions(source, { onError? })` acepta una matriz, ref o getter. Los ID deben ser únicos y no estar vacíos dentro de ese registro; Los ID literales se infieren mediante TypeScript.

| Campo de acción                 | Significado                                                                                         |
| ------------------------------- | --------------------------------------------------------------------------------------------------- |
| `id`, `run({ router, signal })` | ID estable y devolución de llamada de aplicación sincrónica o asincrónica.                          |
| `title`, `busyTitle?`           | Cadena, ref o getter; el título ocupado reemplaza el título normal mientras se ejecuta.             |
| `enabled?`, `visible?`          | booleano, ref o getter; ambos por defecto son verdaderos.                                           |
| `destructive?`                  | Booleano, ref o getter. Sólo presentación; la confirmación sigue siendo el código de la aplicación. |
| `image?`                        | SF Nombre del símbolo, ref o captador, solo para el menú contextual iOS.                            |

Los `get(id)` y `list()` devueltos exponen el estado resuelto (`id`, `title`, `enabled`, `visible`, `busy`, `image`, `destructive`). `busy` es un ref de solo lectura que contiene el ID de ejecución o `undefined`. `menu(ids?)` produce fijaciones para `RouteMenuOptions.actions`; las ID seleccionadas se capturan cuando se las llama, mientras que su estado permanece activo. Regenere los enlaces si el conjunto de ID cambia.

Cada registro admite una devolución de llamada a la vez. Mientras está en ejecución, todas sus acciones están deshabilitadas en todas las superficies. Los toques repetidos devuelven falso en lugar de hacer cola. Los registros separados son independientes.

- `await actions.execute(id)` devuelve verdadero cuando se cumple la devolución de llamada, falso cuando no está disponible y rechaza fallas ordinarias. Verdadero describe la finalización de la devolución de llamada, **, no el éxito de la navegación.**: inspeccione el resultado del error de navegación del enrutador dentro de `run` cuando sea necesario.
- `await actions.dispatch(id)` es el adaptador de eventos utilizado por encabezados y menús. Informa fallas una vez a través de `onError(error, id)` y resuelve falso. Sin un controlador, las fallas se registran en desarrollo y producción; También se contiene y registra un controlador de errores de lanzamiento.
- Una devolución de llamada que se rechaza con `AbortError` después de que se cancela su señal de eliminación se resuelve como falsa. Una devolución de llamada que ignora la cancelación y se cumple aún se resuelve como verdadera, incluida una acción que abre con éxito su propia página.

## Page ciclo de vida y navegación {#page-lifetime-and-navigation}

El nuevo envío requiere que la página propietaria esté actualizada, cargada, en la pestaña seleccionada, descubierta por un modal y fuera de una navegación pendiente. Las devoluciones de llamada de encabezado y menú vuelven a verificar esto antes de ejecutar. No se puede adjuntar un registro a una página o ventana diferente. Utilice el enrutador de alcance de página suministrado para la navegación, de modo que el guards existente, los resultados y el stack de origen sigan aplicándose. El enrutador no implementa su lógica de compartir, editar, eliminar, persistencia o confirmación.

La eliminación de la página/host y el reemplazo de HMR cancelan la señal y retiran los enlaces antiguos. Cubrir una página con un detalle o modal, o cambiar pestañas, bloquea el nuevo envío pero no cancela una operación en ejecución. El código comercial asíncrono debe respetar `signal`, incluidos los efectos secundarios anteriores a un `await`; el enrutador no puede deshacer una solicitud ignorada. Después de su eliminación se sigue notificando un auténtico fallo tardío. Se admite la espera de `router.pushForResult()`.

Para filas recicladas, proporcione un objeto de opciones nuevas **cuando el elemento de origen cambie**, por ejemplo, `v-route-preview="menuFor(item)"`. Volver a vincular, descargar y desconectar descarta/invalida el menú anterior, por lo que las devoluciones de llamada nativas antiguas y las confirmaciones de vista previa no pueden funcionar en el nuevo elemento. Mantenga estable el objeto de opciones para títulos en vivo/actualizaciones habilitadas mientras el menú está abierto. Capture la identidad del elemento en el código de la aplicación cuando una operación en ejecución deba continuar apuntando a ese elemento después de volver a vincularlo.

## Presentación nativa {#native-presentation}

| Superficie                 | Presentación soportada                                                                                                                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Encabezado , iOS y Android | Un elemento de acción NativeScript con un botón de texto nativo como `actionView`. Título reactivo, visibilidad, estado de accesibilidad deshabilitado y color de texto destructivo. `buttonClass` diseña el botón. |
| iOS menú contextual        | UIAtítulo de acción, símbolo SF, atributos deshabilitados y destructivos. Actualización de menús abiertos en iOS 14+; iOS 13 lee el estado inicial y siempre vuelve a comprobar la selección.                       |
| Android Menú contextual    | Títulos nativos del PopupMenu, visibilidad y estado habilitado, incluidas las actualizaciones mientras está abierto. Sin mapeo de iconos ni colores destructivos.                                                   |

El adaptador de encabezado es de solo texto. NativeScript coloca ActionViews personalizados directamente en Android ActionBar, por lo que este adaptador no admite `android.position="popup"`. Utilice ActionItems normales para otras presentaciones de encabezados nativos. Los símbolos SF no están asignados a iconos de materiales. No se instala ninguna barra de herramientas, controlador de búsqueda ni delegado de navegación, y `backAction` permanece bajo su propietario actual. Consulte [barras nativas](./native-bars) y [menús contextuales](./context-menus).

## Enlace de teclado opcional {#optional-keyboard-binding}

Reutilice el registro existente en lugar de instalar otro distribuidor de teclado:

```ts
const commands = useNavigationCommands([
  {
    id: 'save',
    title: () => actions.get('save')!.title,
    enabled: () => actions.get('save')!.enabled,
    shortcut: { input: 's', modifiers: [isIOS ? 'meta' : 'ctrl'] },
    action: () => actions.dispatch('save'),
  },
])
```

Importar `useNavigationCommands` desde `vue-router-ns` y `isIOS` desde `@nativescript/core`. Monte el `NavigationCommandScope` existente como se muestra en [comandos de teclado](./keyboard). Sus reglas de enfoque, entrada de texto, IME y accesos directos al sistema siguen vigentes. Nada registra un acceso directo automáticamente.

El repositorio incluye comprobaciones y limitaciones de entradas nativas reproducibles en `test/native-page-actions.md`.
