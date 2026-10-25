# Comandos de teclado nativos {#native-keyboard-commands}

Para compartir el estado, la ejecución asincrónica y el manejo de errores en el encabezado, el menú y el teclado, consulte [acciones de página](./page-actions).

Los comandos son opcionales y pertenecen a una página enrutada. Renderice `NavigationCommandScope` dentro de su Page alrededor del contenido. Es un GridLayout nativo: los atributos de diseño normales (`rows`, `columns`, relleno) funcionan. Su UIView iOS 13+ participa en la cadena de respuesta enfocada, y un toque en su interior mueve el foco del teclado allí sin quitar el toque de la fila o el control debajo; Android escucha claves nativas no controladas a través de ViewCompat, después de que el control enfocado tiene su oportunidad.

```vue
<script setup lang="ts">
import { NavigationCommandScope, useNavigationCommands } from 'vue-router-ns'

const commands = useNavigationCommands([
  {
    id: 'back',
    title: 'Go back',
    shortcut: { input: '[', modifiers: ['meta'] },
    action: 'back',
  },
  {
    id: 'close',
    title: 'Close modal',
    shortcut: { input: 'Escape' },
    action: 'closeModal',
    allowInTextInput: true,
  },
  {
    id: 'compose',
    title: 'Compose',
    shortcut: { input: 'n', modifiers: ['meta'] },
    action: (router) => router.push('/compose'),
  },
])
</script>

<template>
  <Page>
    <ActionBar title="Messages" />
    <NavigationCommandScope :commands="commands">
      <Label text="Use the keyboard or the normal native controls." />
    </NavigationCommandScope>
  </Page>
</template>
```

Elija enlaces de plataforma explícitamente, por ejemplo `isIOS ? 'meta' : 'ctrl'`. Las entradas admitidas son caracteres con modificadores, `Escape`, `ArrowLeft`, `ArrowRight`, `ArrowUp`, `ArrowDown`, `Enter` y `Tab`. Los modificadores son `meta`, `ctrl`, `alt` y `shift`. Mantenga los títulos localizados con referencias o captadores; la lista de comandos en sí puede ser un ref/getter. Los identificadores y los accesos directos deben ser únicos dentro de un registro. Monte un alcance por registro.

`commands.list()` resuelve los títulos actuales y el estado habilitado; `execute(id)` devuelve si se envió un comando habilitado, no si su navegación fue exitosa. Fallos de navegación/guards mantienen el comportamiento normal del router. El envío repetido está deshabilitado mientras se ejecuta esa acción. `focus()` selecciona el respondedor de comandos de este panel y se niega a robar el foco de un editor de texto. Al tocar su contenido también se selecciona el alcance cuando ningún editor posee el foco.

`back` está deshabilitado en una raíz no modal. `closeModal` cierra todo el modal stack durante todo el permiso normal guards y se deshabilita fuera de un modal cancelable. Las acciones definidas por la aplicación reciben el enrutador con tipo enlazado a página, por lo que se dirigen a ese stack sin consultar un Frame de proceso global. La pestaña o el destino siguiente/anterior son acciones de la aplicación: un stack nativo no tiene historial de reenvíos. La demostración incluye enlaces de pestañas siguiente/anterior utilizando la propia ventana nativa de la página.

## Edición y escape {#editing-and-escape}

Los comandos están deshabilitados en los editores de texto a menos que estén marcados explícitamente como `allowInTextInput`. Los enlaces estándar de seleccionar/copiar/pegar/cortar/deshacer/rehacer se rechazan incluso con esa bandera; La composición del IME siempre se deja sola. Las claves imprimibles requieren un modificador. Los accesos directos al sistema de plataforma todavía pertenecen al sistema operativo; no registre combinaciones reservadas por el sistema.

El escape primero pertenece al control nativo/IME enfocado. Para un enlace de escape del enrutador habilitado, se descarta una búsqueda de propiedad de página activa antes de que se ejecute la acción registrada. Las superposiciones de aplicaciones pueden registrar su propia acción de Escape y decidir cuándo delegar; de lo contrario, un enlace `closeModal` explícito pasa a través del guards modal. No se ha instalado ningún enlace Escape/back no registrado. Android observa el Page propietario, por lo que se incluyen los campos de búsqueda de la barra de herramientas. Los campos de búsqueda de UIKit fuera del alcance del contenido mantienen el comportamiento del propio respondedor de UIKit.

En iPad, los comandos habilitados exponen títulos de descubrimiento nativos de `UIKeyCommand`. Android no tiene superposición de descubrimiento estilo UIKit; `list()` puede completar una vista de ayuda de la aplicación. Las pestañas ocultas, las páginas cubiertas y los hosts eliminados no pueden enviar comandos. Varias ventanas tienen árboles de vista/respondedor nativos independientes; Los comandos se vinculan a la vista real, no a la última actividad creada globalmente. La presentación modal se dirige explícitamente a la página de origen.

Esto no agrega soporte para conservar el historial del enrutador durante la recreación de actividades o la reconexión de escenas; que se rastrea por separado en el n.° 46. Consulte Comandos de teclado [guards](./guards), [native search](./native-bars) y [UIKit](https://developer.apple.com/documentation/uikit/uikeycommand).
