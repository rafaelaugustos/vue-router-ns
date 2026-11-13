# Navegación en múltiples ventanas nativas {#navigation-in-multiple-native-windows}

Esta característica es experimental y requiere las dependencias compatibles de Core 9.1.4+ / NativeScript-Vue 3.1.2+ más la configuración de ventanas múltiples de la plataforma.

El enrutador posee las aplicaciones Vue detrás de las páginas Frame y las retiene mientras sus rutas permanecen en el historial nativo. Android La recreación de actividad está validada con Core 9.1.3 y NativeScript-Vue 3.1.2 publicados; no se requiere ningún parche de dependencia. Page y el diseño HMR todavía usan el reemplazo nativo Page. Se valida la restauración de las tareas Android originales y las sesiones de escena UIKit después de la terminación del proceso. La desconexión/reconexión de la escena iPad dentro del mismo proceso en ejecución también se valida: las páginas originales, el estado de Vue, el guards y los resultados de navegación pendientes sobreviven. La suite nativa solicita una desconexión de escena UIKit real utilizando un controlador exclusivo de simulador; esto es independiente del currículum en segundo plano y la restauración en frío.

La demo ahora usa Core 9.1.4 / NativeScript-Vue 3.1.3. El [informe de 9.1.4](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-core-9.1.4.md) registra las nuevas pruebas de ventanas; el [informe de 3.1.3](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-vue-3.1.3.md) conserva la evidencia anterior con Core 9.1.3. Las correcciones upstream no sustituyen el ciclo de vida de páginas ni los adaptadores de restauración del router. Multi-window sigue siendo experimental; [#175](https://github.com/rafaelaugustos/vue-router-ns/issues/175) recoge la matriz soportada, las pruebas repetidas de ciclo de vida/recursos y la decisión de estabilidad.

## Decisión de soporte del ciclo de vida (2026-11-13) {#lifecycle-support-decision-2026-11-13}

Multi-window sigue siendo **experimental**. Este contrato cubre un router por ventana de la aplicación, Pages de Frame gestionadas por el router, historiales/resultados aislados, sustitución temporal de la superficie nativa y cierre permanente. No certifica combinaciones arbitrarias de plugins, contenedores o dispositivos.

| Alcance                        | Base seleccionada                                                                                                              | Límite de la evidencia                                                                                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Android                        | Core 9.1.4, NativeScript-Vue 3.1.3, runtime Android 9.1.1                                                                      | Aceptación en emuladores API 34/36; reconstruir tareas originales requiere API 29+. Ese mínimo no certifica las API 29–33.                                           |
| iPad                           | Core 9.1.4, NativeScript-Vue 3.1.3, runtime iOS 9.1.0                                                                          | Simulador iPadOS 18.6: regreso del segundo plano, reconstrucción de escenas originales y una desconexión/reconexión en el mismo proceso.                             |
| iPad físico                    | iPad Pro de 11″ (3.ª generación), iPadOS 27.0 (24A5418b); mismas versiones de Core/Vue/iOS                                     | Historiales independientes, guards, resultados modales, regreso del segundo plano, HMR/navegación y cierre con desmontaje de páginas; solo API públicas.             |
| Limpieza repetida de recursos  | Fixture Android, presupuesto fijo de recolección                                                                               | Seis ventanas secundarias, dos sustituciones de Activity por ventana, resultados/guards pendientes, recuentos de listeners y observaciones débiles de Page/Activity. |
| Fuera del subconjunto validado | Android físico, Stage Manager, pantallas externas, cambio de tamaño/rotación durante la navegación, presión natural de memoria | Sin nueva garantía de aceptación. Falta medir recursos en desconexiones/cierres repetidos de iPad.                                                                   |

El [informe versionado del ciclo de vida](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-window-lifecycle.md) registra revisiones, entornos exactos, resultados, límites y la grabación de la aplicación real. Recrear una Activity en el emulador no demuestra rotación física ni presión natural de memoria. El driver de reconexión de iPad solicita una desconexión real al sistema mediante inyección de fallos exclusiva del simulador.

La desconexión temporal conserva las Pages, el estado Vue y los resultados pendientes existentes. El cierre permanente libera las páginas de esa ventana y resuelve sus resultados una vez; un guard tardío no puede confirmar navegación en la pila cerrada. La muerte del proceso inicia otro proceso JavaScript: solo se reconstruye el estado de rutas/páginas persistido explícitamente, nunca las Promises anteriores ni objetos nativos arbitrarios. La aplicación debe liberar sus propias suscripciones y referencias externas.

La [#188](https://github.com/rafaelaugustos/vue-router-ns/issues/188) sigue la ampliación de cobertura de iPad y gestión de ventanas. La aceptación en simulador/emulador es válida para este alcance; el hardware físico solo es necesario cuando un escenario seleccionado no puede reproducirse adecuadamente allí.

## Un enrutador por ventana {#one-router-per-window}

Cada `NativeWindow` posee un enrutador. Sus vistas con nombre, modal stack, cola de navegación, guards y resultados son independientes. Dos ventanas pueden tener una vista denominada `inbox`.

```ts
const router = createRouter({ routes, window: request.window })
```

El enrutador puede inferir su ventana a partir del `getNativeWindow()` de la primera vista montada. Pase `window` al iniciar una ventana secundaria para que se conozca la propiedad y la restauración antes de que se cargue la primera página. `router.window` es un ref de solo lectura para ese propietario; permanece indefinido en el modo heredado. Vincular otro enrutador a la misma ventana o montar vistas desde un enrutador en diferentes ventanas es un error.

## Abrir una ruta en una nueva ventana {#opening-a-route-in-a-new-window}

```ts
router.openWindow(
  { name: 'message', params: { id: 42 } },
  { data: { documentId: 'message:42' } },
)
```

La ubicación se resuelve con los tipos de ruta del llamante. En Android, un enrutador vinculado lanza una intención explícita a través de su actividad de propiedad en vivo, utilizando indicadores de ventana y metadatos serializados de Core. Otros casos utilizan `Application.openWindow()`. La fuente stack permanece en su lugar y su salida guards no se ejecuta. La navegación inicial de la nueva ventana ejecuta su propio guards. Esta es una solicitud del sistema operativo, no una Promise que confirma que apareció una nueva escena; configuración nativa o el sistema operativo puede negarla. Las API de NativeWindow que faltan generan un error.

La aplicación suministra el nuevo contenido a través de `Application.setWindowContentResolver`. `getWindowRoute(request.data)` lee la ruta resuelta proporcionada por `openWindow`; la clave de datos `__vueRouterNS` está reservada. Otros datos deben ser serializables por la plataforma.

```ts
import { Application } from '@nativescript/core'
import { createApp, h } from 'nativescript-vue'
import { createRouter, getWindowRoute, RouterView } from 'vue-router-ns'
import App from './App.vue'
import { routes } from './routes'

// Register this before starting the primary app. Return undefined to keep
// its usual root. Other application-owned window roles can be handled here too.
Application.setWindowContentResolver((request) => {
  if (request.window.rootView) return request.window.rootView
  const initial = getWindowRoute(request.data)
  if (request.isPrimary && !initial) return undefined

  const router = createRouter({ routes, window: request.window })
  const app = createApp({
    render: () => h(RouterView, { initial: initial ?? '/' }),
  }).use(router)
  const vm = app.mount()
  request.window.on('close', () => app.unmount())
  return vm.$el.nativeView
})

const router = createRouter({ routes })
createApp(App).use(router).start()
```

Se monta una raíz secundaria y se devuelve a su ventana; no vuelve a llamar a `start()`. Las aplicaciones de páginas navegadas de NativeScript-Vue heredan el contexto de la aplicación principal, mientras que el contenedor del enrutador proporciona la ruta y el enrutador vinculado a la ventana de cada página. Compartir servicios de aplicaciones desde la aplicación principal; Los contextos de complemento/proporción independientes por ventana no se propagan automáticamente a las páginas navegadas.

Este solucionador es propiedad de la aplicación. Compóngalo con el manejo de ventanas existente en lugar de reemplazar silenciosamente el solucionador de otro complemento. La entrega inicial de URL/notificación sigue siendo un trabajo de integración de la aplicación; consulte enlaces profundos [Enlaces profundos](./deep-links).

## Configuración nativa {#native-configuration}

En Android, la actividad de inicio debe admitir múltiples instancias: los modos `singleTask`/`singleInstance` de la plantilla habitual reutilizan una actividad. Utilice una configuración compatible con su núcleo/tiempo de ejecución, como `standard` o `singleInstancePerTask` en versiones compatibles de Android. En iPadOS, habilite `UIApplicationSupportsMultipleScenes` en el manifiesto de escena y utilice el ciclo de vida de la escena. Es posible que un teléfono o una versión de vista previa no admitan la apertura de otra escena.

Utilice la guía de ventanas múltiples [NativeScript](https://docs.nativescript.org/guide/multi-window) para una configuración nativa completa. `openWindow` reenvía la solicitud; no puede cambiar el manifiesto instalado, los derechos o las capacidades del dispositivo. Ofrezca una acción `push()` normal cuando la interfaz de usuario de ventanas múltiples no esté disponible en su aplicación.

El router Android vinculado usa la clase de la Activity superviviente para abrir otra ventana, incluso tras cerrar la Activity original. Core 9.1.4 también corrige la llamada directa a `Application.openWindow()` mediante #11552, resolviendo [#11526](https://github.com/NativeScript/NativeScript/issues/11526). El router conserva su ruta vinculada a la ventana; la aceptación está en el [informe de 9.1.4](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-core-9.1.4.md).

## Desconectar, reconectar y cerrar {#detach-reconnect-and-close}

Back y los gestos predictivos son manejados por su Actividad/ventana de origen. La presentación modal apunta a una página en esa ventana en lugar del objetivo modal global de NativeScript-Vue. Una ventana inactiva no puede consumir la parte posterior de la ventana activa.

Un evento temporal `detached` mantiene el stacks lógico y las promesas de resultados, libera devoluciones de llamadas de gestos de actividad y guarda la instantánea actual. `attached` vincula devoluciones de llamada a la actividad de reemplazo. Un `close` permanente derriba a los oyentes propietarios de stacks y establece resultados sobresalientes con `undefined`; no puede esperar a que se deje asíncrono guards. Mantenga el mismo enrutador cuando vuelva a conectar una ventana existente; cree un nuevo enrutador al reconstruir una ventana después de que se inicie un nuevo proceso JS.

En iOS, el enrutador también reconstruye el controlador nativo stack de un Frame retenido cuando regresa su escena. De lo contrario, Core 9.1.3 recrea un controlador vacío manteniendo el historial de JavaScript. Esta capa de compatibilidad con alcance utiliza los metadatos del ciclo de vida Frame/Page de Core y las API públicas UIKit stack; no parchea dependencias ni utiliza API privadas de Apple. Sus ganchos temporales se retiran después de la reconstrucción o de la eliminación del enrutador.

## Persistencia por ventana {#persistence-by-window}

```ts
const router = createRouter({
  routes,
  window: request.window,
  restore: {
    key: String(request.data?.documentId ?? request.window.id),
    save: (state, scope) => {
      ApplicationSettings.setString(`router:${scope!.key}`, JSON.stringify(state))
    },
    load: (scope) =>
      JSON.parse(ApplicationSettings.getString(`router:${scope!.key}`, 'null')),
  },
})
```

Importar `ApplicationSettings` desde `@nativescript/core`. El segundo argumento opcional para `save` y el argumento para `load` son `RestoreContext`: `{ windowId, key }`. Se proporcionan para enrutadores con ámbito y se omiten en el modo heredado. Las devoluciones de llamada existentes siguen siendo válidas; las tiendas de ventanas múltiples deben usar el contexto para mantener las instantáneas separadas. `key` tiene como valor predeterminado `primary` para una ventana primaria inferida automáticamente, preservando los almacenes de ventana única existentes durante la terminación del proceso; El valor predeterminado de Windows proporcionado explícitamente es el ID nativo. El valor predeterminado se captura cuando la propiedad está vinculada y no cambia si otra ventana se convierte en principal. Proporcione un documento de aplicación/clave de sesión para cada ventana explícita para mantenerla estable durante los reinicios del proceso.

Las instantáneas con alcance incluyen `windowKey`; una clave que no coincide se ignora durante la carga. Las instantáneas heredadas sin él siguen siendo legibles. Al cerrar una ventana, se guarda `null` solo con el contexto de esa ventana. Una salida a nivel de proceso guarda los historiales de alcance existentes en lugar de borrar todas las ventanas; El modo heredado conserva su comportamiento existente de borrado al salir.

Elija la política de ruta entrante versus historial restaurado en su resolución de contenido. Una nueva solicitud `openWindow` normalmente comienza en la ruta solicitada y omite una instantánea anterior; una reconstrucción del sistema operativo normalmente restaura la ventana guardada. Utilice la información de sesión/estado guardado de la solicitud nativa y los metadatos de su aplicación para distinguir esos casos. Utilice `usePageState()` para habilitar el estado de la página versionada; Las promesas pendientes y los objetos nativos no pueden sobrevivir a la terminación del proceso.

### Tareas originales y sesiones de escena. {#original-tasks-and-scene-sessions}

En Android 10/API 29 y posteriores, el enrutador registra un observador del ciclo de vida de la actividad mientras posee ventanas nativas. Marca paquetes guardados de sus propias actividades con un token de proceso. Cuando un proceso posterior reanuda una de esas tareas, una devolución de llamada previa a la creación elimina los obsoletos Core Frame/identificadores raíz y el estado AndroidX FragmentManager antes de que se ejecute la restauración nativa. La recreación de actividades dentro del mismo proceso queda intacta. El observador deja intactos los metadatos de la ventana, el estado de ActivityResult, los datos de la aplicación y otros proveedores de estado guardado, y se da de baja cuando se libera el último propietario del enrutador. Este es un adaptador de compatibilidad para la ruta de restauración Core 9.1.3, que utiliza claves de paquete Core/AndroidX conocidas; no parchea las dependencias instaladas.

La ID de la ventana nativa principal puede cambiar durante el reinicio del proceso Android incluso cuando se conserva la ID de la tarea. Conserve las claves de los documentos en lugar de tratar los ID de las ventanas generadas como identidades de la aplicación. En Android por debajo de API 29, este adaptador no está disponible: use la reconstrucción propiedad de la aplicación en ventanas nuevas o mantenga un flujo de ventana única. Allí no se admite la reconstrucción automática de las múltiples tareas originales.

UIKit puede volver a conectar las sesiones guardadas en un orden diferente. Conserve una asignación desde el ID de ventana persistente de cada escena a la clave del documento de su aplicación cuando la abra por primera vez y consulte esa asignación en el solucionador de contenido **antes de** para decidir que la primera escena que llega es su documento predeterminado. Es posible que una conexión fría no tenga la carga útil original `openWindow()`. La asignación de documentos por `request.isPrimary` o por orden de llegada únicamente puede intercambiar sus historiales. Elimine la asignación cuando su sesión se descarte permanentemente. El dispositivo nativo en `demo/src/testing/windows-app.ts` demuestra este mapeo propiedad de la aplicación y valida los documentos restaurados con sus ID de escena originales.

## Enlaces entregados a una ventana {#links-delivered-to-a-window}

Con `links` habilitado, los intents cálidos Android y las URL de escena iOS, las actividades del usuario y las acciones rápidas van solo al enrutador que posee la actividad/escena del evento. Cerrar un enrutador elimina sus oyentes y deshabilita las devoluciones de llamadas de delegados heredados que Core no puede cancelar el registro.

Para una nueva ventana secundaria, Core invoca al solucionador de contenido **after** emitiendo su evento de intención/escena inicial. Páselo como `links: { initial: request }` al crear el enrutador, o reenvíe la URL con `router.openLink(url, { source: 'launch' })`; la llamada espera la restauración y el primer host nativo. Lea la URL de `request.android?.intent` o `request.ios?.connectionOptions`. En Android, no reproduzca la intención anterior cuando exista `request.android?.savedInstanceState`. Aplique la política elegida de vínculo nuevo versus historial guardado antes de esta transferencia. Un nuevo enlace entrante normalmente aterriza encima del historial restaurado; `clearHistory: true` inicia un nuevo stack.

El enrutador no adivina a qué ventana de documento debe dirigirse una notificación sin propietario. La aplicación elige el enrutador/ventana y llama a su `openLink()`.

## Política explícita de ventanas para intents {#intent-window-policy}

El [ejemplo de aplicación](https://github.com/rafaelaugustos/vue-router-ns/tree/main/examples/intent-windows) combina las APIs de intents existentes con tu registro de ventanas. Es código para copiar en la aplicación, no una nueva API del paquete ni un registro global de propietarios. La aplicación proporciona el catálogo de rutas, el registro por cuenta y los callbacks nativos de creación/activación siguientes. Los propietarios del ejemplo comparten rutas y mapeo de URLs.

```ts
// Copy examples/intent-windows/policy.ts into your application.
import { createWindowIntentPolicy } from './policy'

const deliveries = createWindowIntentPolicy({
  resolve: (request) => routingCatalog.resolveIntent(request),
  find: (key) => accountWindows.get(key),
  open: openApplicationWindow,
  focus: activateApplicationWindow,
})

await deliveries.dispatch(intent, {
  mode: 'focus',
  key: 'account-a:document-42',
  history: 'append',
})
await deliveries.dispatch(anotherIntent, {
  mode: 'new',
  key: 'account-a:document-43',
  restore: 'saved',
  history: 'reset',
})

// Before replacing the account session:
deliveries.dispose()
```

Usa `reuse` para navegar en un propietario registrado sin pedir foco, `focus` para esperar su activación nativa o `new` para crear una clave de aplicación nueva. Los propietarios ausentes o cerrados no tienen fallback. Una solicitud nueva no puede incluir un `target.windowId` existente; una afirmación sobre un propietario existente debe coincidir con el id nativo seleccionado. El receptor vuelve a resolver el destino. El sistema puede rechazar la creación o activación, por lo que la aplicación debe limitar las esperas y observar la disponibilidad real. Consulta la [API de activación de escenas de Apple](https://developer.apple.com/documentation/uikit/uiapplication/activatescenesession%28for%3Aerrorhandler%3A%29).

`append` fuerza `replace: false` y `clearHistory: false`; `reset` fuerza `replace: false` y `clearHistory: true`. Ambos usan los guards normales del stack seleccionado. Para propietarios nuevos, `restore: 'saved'` habilita la carga de su snapshot antes de la entrega; `restore: 'fresh'` lo omite. Crea una ruta inicial pública y entrega el destino una vez después de la disponibilidad; no utilices también el destino como ruta inicial. Los historiales de los demás propietarios permanecen intactos.

El ejemplo reserva la identidad de entrega antes de los efectos nativos: hasta 32 solicitudes pendientes y los últimos 256 pares scope/id completados, incluidos los intentos rechazados. Los callbacks repetidos devuelven `repeat` sin crear ni enfocar otra ventana. Usa un id nuevo para un reintento intencional. Las creaciones simultáneas de la misma clave de aplicación devuelven `busy`. Este registro limitado pertenece a una instancia de sesión de cuenta y es independiente del registro de cada router receptor; ninguno persiste entre procesos.

Usa claves de cuenta/documento controladas por la aplicación y un token único por solicitud de creación al sistema. Comprueba `current()` antes de adoptar su llegada nativa; una escena tardía no debe reemplazar un propietario más reciente. Solo la política de la aplicación elige ventanas e historial: etiquetas y claves del payload no autorizan acceso. Al cambiar de cuenta, llama a `dispose()`, cancela los handles de login y limpia las ventanas protegidas. La disposición evita que las esperas de adquisición/foco entren en navegación; un intento ya dentro de `openIntent` sigue las reglas de esa API y no se revierte. El login sigue usando el `suspendIntent` del propietario elegido y los guards de autorización de la aplicación.

El [informe nativo](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-intent-window-policy-stage4.md) verifica escenas reales de iPad, historial guardado/nuevo, entrega duplicada, foco explícito, propietario incorrecto, cierre y rechazo por guard. Los historiales guardados son snapshots controlados, no reconstrucción tras terminar un proceso. B se activa antes de cerrarse; cierre en segundo plano, activación en Android, Stage Manager y pantallas externas quedan fuera de esta etapa.

La prueba observa la activación nativa en primer plano tras una solicitud explícita a UIKit. Varias escenas del iPad pueden seguir activas; esto no certifica el foco del teclado del sistema.

<Clip name="intent-window-policy" :width="640" aspect="3 / 4" caption="Simulador real de iPad: crea, reutiliza y enfoca escenas separadas, elige historial guardado/nuevo, limpia solo el stack seleccionado y rechaza solicitudes obsoletas. La ventana A conserva su Page original y su borrador; textos en inglés." />
