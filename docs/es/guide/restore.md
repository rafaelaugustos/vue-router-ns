# Restaurando el stack después de que se cierre la aplicación {#restoring-the-stack-after-the-app-is-killed}

Android elimina aplicaciones en segundo plano todo el tiempo y devuelve una aplicación nativa a la pantalla en la que estaba, con su parte posterior stack. Cada página aquí es una ruta, por lo que stack es una lista de cadenas y el enrutador puede guardarla por usted:

```ts
import { ApplicationSettings } from '@nativescript/core'

const router = createRouter({
  routes,
  restore: {
    save: (state) => ApplicationSettings.setString('stacks', JSON.stringify(state)),
    load: () => JSON.parse(ApplicationSettings.getString('stacks', 'null')),
  },
})
```

<Clip name="android-restore" aspect="9 / 20" caption="Un nombre escrito regresa después de que la demostración pasa a segundo plano, su proceso finaliza y se abre nuevamente. Emulador Android 16." />

`save` se ejecuta después de cada navegación y cuando la aplicación pasa a segundo plano, con las rutas de cada `<RouterView>` con nombre y con `null` cuando la aplicación se cierra por sí sola, por lo que un nuevo comienzo después de que el usuario se fue se mantiene fresco. Cuando se monta un `<RouterView>`, el enrutador solicita `load` una vez (puede ser asíncrono) y reconstruye el stack guardado sin animación, a través del guards, por lo que una página que necesita una sesión aún lo envía al inicio de sesión.

Se ignoran los guardados anteriores a `maxAge` (30 minutos de forma predeterminada); pase `Infinity` para restaurar siempre.

## Lo que no puede volver {#what-can-t-come-back}

Modales, y `props` pasaron por `push`. Una página que depende de ellos debería hacer frente a su ausencia leyendo sus parámetros. Si una ruta guardada ya no coincide con ninguna ruta, después de una actualización, por ejemplo, el stack comienza desde `initial`.

## Formato y límites {#format-and-limits}

`SavedStacks` tiene la forma `{ version: 2, savedAt: number, stacks: Record<string, string[]>, entries: Record<string, SavedEntry[]> }`. `savedAt` es una marca de tiempo en milisegundos. Mantenga estables los nombres stack; una vista dividida guarda la lista y los detalles como un stack. `load()` se ejecuta una vez por instancia de enrutador y cada vista restaura su stack cuando se monta.

La restauración recrea páginas a partir de rutas. No guarda referencias locales, desplazamientos de desplazamiento u objetos arbitrarios por sí solo; una página guarda aquellos con [`usePageState()`](#page-state). `maxAge` pertenece dentro de `restore`, por ejemplo `restore: { save, load, maxAge: Infinity }`.

## Estado Page {#page-state}

Las rutas devuelven las páginas; lo que el usuario tenía en ellos es otra cuestión. Un borrador, una posición de lectura o una selección también pueden volver, si la página dice qué conservar:

```ts
import { usePageState } from 'vue-router-ns'

const body = ref('')
usePageState('draft', {
  save: () => (body.value ? { body: body.value } : undefined),
  restore: (value) => (body.value = value.body),
})
```

`save` se ejecuta después de cada navegación y cuando la aplicación pasa a segundo plano, y debe devolver datos pequeños compatibles con JSON: sin vistas nativas, cierres ni promesas. Devuelve `undefined` para no conservar nada, que es como una página deja fuera un borrador confidencial. `restore` se ejecuta una vez, después de que se haya cargado la vista nativa de la página, con lo que quedó `save`; recibe la versión con la que se guardó y el `Page` nativo, en caso de que un desplazamiento de desplazamiento tenga que esperar un diseño. Una página que solo quiere saber que regresó puede establecer una bandera dentro de `restore`.

Cada página obtiene una clave estable, guardada junto a su ruta, por lo que dos páginas en la misma ruta recuperan cada una su propio estado. Claves y recorridos estatales en `SavedStacks.entries`, alineados con `stacks`; el formato `version: 2` todavía carga un guardado de solo ruta, que simplemente no tiene estado.

### Versiones y migraciones {#versions-and-migrations}

Dale a la forma un `version` cuando cambie, y un `migrate` para recuperar guardados antiguos:

```ts
usePageState('draft', {
  version: 2,
  save: () => ({ subject: subject.value, body: body.value }),
  restore: (value) => Object.assign(form, value),
  migrate: (old, version) =>
    version === 1 ? { subject: '', body: (old as { text: string }).text } : undefined,
})
```

Un guardado de otra versión pasa por `migrate`; sin uno, o cuando devuelve `undefined`, la página comienza de nuevo. Un `restore` o `migrate` que arroja se informa en desarrollo y la página también comienza de nuevo.

### Rutas renombradas y eliminadas {#renamed-and-removed-routes}

Page-state `migrate` cambia la forma de los datos de un gancho. No cambia el nombre de las rutas. El historial guardado contiene rutas, por lo que cambiar el nombre de una ruta por sí solo no cambia su ubicación guardada. Cuando cambie una ruta, tradúzcala a `restore.load` antes de devolver la instantánea:

```ts
import type { SavedStacks } from 'vue-router-ns'

function migratePaths(saved: SavedStacks | null): SavedStacks | null {
  if (!saved) return null
  return {
    ...saved,
    stacks: Object.fromEntries(
      Object.entries(saved.stacks).map(([name, paths]) => [
        name,
        paths.map((path) => (path === '/legacy-edit' ? '/edit' : path)),
      ]),
    ),
  }
}

// Inside restore:
// load: () => migratePaths(JSON.parse(ApplicationSettings.getString('stacks', 'null')))
```

Este ejemplo solo asigna esa ruta exacta. Maneje parámetros/cadenas de consulta explícitamente para las URL antiguas de su aplicación. Mantenga el orden de entrada y `entries` alineados: dos entradas `/legacy-edit` aún conservan sus claves y borradores separados. Si elimina o reordena rutas, transforme sus entradas correspondientes en los mismos índices. Conserve `savedAt` para que la migración no recupere el estado caducado y conserve `windowKey` para que una ventana diferente no pueda consumirlo.

Sin una migración explícita, una ruta no disponible restablece ese stack a su ruta `initial`. Los guardias todavía corren durante la restauración. Si un guard redirige una página guardada a otra ruta, su borrador no se transfiere a la página redirigida. Para cerrar sesión, borre las instantáneas almacenadas y los datos confidenciales de la aplicación, además de hacer cumplir la autorización guards; guards no son un mecanismo de borrado de almacenamiento.

### ¿Qué sigue siendo propiedad de la aplicación? {#what-stays-app-owned}

- El estado que no sobrevive a `JSON.stringify` se elimina con una advertencia en desarrollo, al igual que una página cuyo estado excede `restore.stateLimit` (8 KiB de forma predeterminada).
- Una página restaurada en otro lugar, porque un guard la redirigió, deja atrás su estado guardado: el estado sigue el camino.
- Una promesa `pushForResult()` no sobrevive a la terminación del proceso. La página que estaba esperando regresa sin ella; un flujo que necesita la respuesta más adelante debe mantenerla en su propia tienda o en el estado de la página de solicitud.
- Los modales no se restauran. Persista y vuelva a seleccionar la pestaña activa usted mismo. Las instantáneas con ámbito de ventana contienen `windowKey`, pero la aplicación debe proporcionar una clave de documento estable y volver a conectarla a la ventana nativa correcta; consulte [ventanas nativas](#native-windows).

## Ventanas nativas {#native-windows}

En Core 9.1.3+, un enrutador vinculado a un `NativeWindow` recibe el contexto de ventana en `save(state, context)` y `load(context)`. Utilice `restore.key` y `context.key` para separar instantáneas. En este modo, la salida del proceso conserva el historial; cerrar una ventana guarda `null` solo para esa ventana. El comportamiento de borrar al salir anterior se aplica al modo heredado sin una ventana propietaria. Consulte [Windows nativos](./windows#persistence-by-window) para conocer el arranque y los límites.

### Propiedad y comportamiento validado {#ownership-and-validated-behavior}

| Datos                                                                                             | Propietario                                                                             |
| ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Rutas con nombre-stack, claves de entrada estables y estado de página de participación voluntaria | La instantánea del enrutador, conservada por su devolución de llamada `save`.           |
| Page-migración de esquema de estado                                                               | `version` y `migrate` de cada gancho `usePageState`.                                    |
| Migración de ruta, cambios de cuenta y limpieza de almacenamiento                                 | `load`/política de almacenamiento de su aplicación.                                     |
| Pestaña seleccionada y ventana/identidad del documento                                            | Su aplicación; Utilice claves de instantáneas independientes por documento.             |
| Promesas modales/resultados pendientes y objetos nativos                                          | No persiste. Reconstruya el trabajo recuperable a partir de los datos de la aplicación. |

Ejemplos nativos ejecutables: [`state-app.ts`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/testing/state-app.ts) (`--env.stateTest`) cubre borradores duplicados y posiciones de desplazamiento, migración de esquemas, caducidad, rutas eliminadas y cierre de sesión; [`windows-app.ts`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/testing/windows-app.ts) (`--env.windowsTest`) restaura borradores duplicados y claves de entrada en ventanas independientes. Siga la configuración de demostración y la preparación de recursos de ventana [scripts de validación](https://github.com/rafaelaugustos/vue-router-ns/tree/main/scripts/native/windows) antes de compilarlos.

El CI requerido valida la terminación del proceso Android genuino y la restauración de la tarea original en API 34/36, además de la reconstrucción de la escena original UIKit en un nuevo proceso en iPadOS 18.6. El informe de aceptación [informe de validación](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-page-state.md) distingue esto de la reanudación en segundo plano normal y la reconexión en el mismo proceso. Estos son resultados del emulador/simulador; La propiedad de la ventana sigue siendo experimental y los límites de la plataforma [Navegación en múltiples ventanas nativas](./windows#original-tasks-and-scene-sessions) aún se aplican.
