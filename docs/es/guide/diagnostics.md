# Diagnóstico de navegación {#navigation-diagnostics}

Consulte [Capacidades nativas y opciones de contenedor](./capabilities) para conocer la propiedad, los límites de la plataforma y la distinción rc.2/rc.3.

[Abre el visor de informes visual](./diagnostics-viewer) para importar JSON exportado, comparar stacks e inspeccionar líneas de tiempo correlacionadas sin conectarse a una aplicación.

Habilite una línea de tiempo limitada y una comparación de solo lectura del historial lógico del enrutador con sus marcos nativos:

```ts
const router = createRouter({
  routes,
  diagnostics: __DEV__ ? { maxEvents: 500 } : false,
})

const inspector = router.diagnostics
inspector?.snapshot()
inspector?.events
inspector?.export() // versioned JSON string
```

`diagnostics` por defecto es `false`. `true` utiliza una capacidad de 500 eventos; `maxEvents` debe ser un número entero entre 1 y 10.000. Un recopilador deshabilitado es `undefined`: no lee un reloj, no inspecciona ventanas nativas, no registra escuchas nativas de diagnóstico ni retiene un búfer de eventos. La colección utiliza los eventos del ciclo de vida existentes del enrutador.

## Leyendo la línea de tiempo {#reading-the-timeline}

Los eventos tienen un `id` que aumenta monótonamente, un `routerId` opaco, un `time` transcurrido en milisegundos, un `phase` y un `status`. Los intervalos tienen valores `spanId` coincidentes en `start`/`end`; su extremo lleva `duration` y `outcome`. Los tramos relacionados con la navegación comparten un `navigationId`. Una redirección termina con `redirected` y la nueva solicitud tiene `parentNavigationId`. Las solicitudes entrelazadas deben correlacionarse mediante ID en lugar de suponerse que están anidadas.

| Fase           | Lo que observa                                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------------------------- |
| `navigation`   | Una solicitud de enrutador resuelta mediante finalización, rechazo o falla. La raíz trasera es `noop`.              |
| `queue`        | Esperando operaciones nativas ya comprometidas.                                                                     |
| `guard`        | Cada invocación guard; `detail` identifica `leave`, `beforeEach`, `beforeEnter` o `beforeResolve`.                  |
| `load`         | Resolución de componentes, incluyendo un detalle de `cached` para un registro ya cargado.                           |
| `mount`        | Trabajo sincrónico de `$navigateTo`/`$showModal`, incluida la configuración de Vue y la creación de vistas nativas. |
| `transition`   | La confirmación a través de la señal de finalización modal Frame/, incluido su trabajo de montaje.                  |
| `native`       | Frame finalización, `pop` iniciado externamente u otra sincronización nativa.                                       |
| `page`, `host` | Page vinculación/desvinculación y adjunto/eliminación de host.                                                      |
| `hmr`          | Recarga solicitada, diferida mientras está cubierta, aplicada o revinculada a un Page de reemplazo.                 |
| `result`       | Liquidación del resultado de un asiento, sin su valor.                                                              |
| `issue`        | Una violación invariante observada.                                                                                 |

Estas son mediciones de solicitud hasta finalización del enrutador. Excluyen el trabajo antes de que la solicitud resuelta llegue al enrutador, como la entrega de entrada del sistema operativo o la espera de la preparación inicial. `transition` se superpone a `mount`; no sume sus duraciones. La finalización nativa no establece cuándo se mostraron los primeros píxeles, no mide FPS ni reemplaza un generador de perfiles nativo. El trabajo del suscriptor puede afectar las duraciones medidas.

La sincronización utiliza un reloj monótono (`performance.now`, con respaldos de tiempo de actividad Android/iOS), independientemente de los cambios en el reloj de pared. Las exportaciones incluyen un reloj de pared `startedAt` para una correlación aproximada con los registros de la plataforma. Utilice las herramientas de depuración y creación de perfiles nativas [NativeScript](https://docs.nativescript.org/guide/debugging) para investigar la representación, el uso de la CPU y los objetos nativos retenidos.

## Comparando la historia nativa y lógica {#comparing-native-and-logical-history}

`snapshot()` devuelve datos congelados y desconectados. Cada stack tiene una identificación estable, su `name` proporcionado por el desarrollador, estado modal/ocupado, entradas lógicas y hosts nativos. Las entradas incluyen su patrón de ruta, estado del ciclo de vida `active` y `awaitingResult`. `active` significa descubierto dentro de ese stack; no prueba que su pestaña/ventana esté actualmente enfocada.

Cada host informa su función (`main`, `list`, `detail`), estado de carga, ID de ventana opcional e ID de entrada nativa. Las páginas nativas desconocidas tienen ID `null`. Se omiten los marcadores de posición de vista dividida. Una ID de ventana está disponible una vez que Frame pertenece a una NativeWindow; los núcleos más antiguos pueden omitirlo. Los ID son identidades de diagnóstico locales del proceso, no claves de restauración, identificadores nativos o una API de navegación de múltiples ventanas. Los recolectores de enrutadores separados siguen siendo independientes; consulte [propiedad y reconstrucción de ventanas](./windows) para conocer el modelo de enrutamiento implementado.

El `issues` de la instantánea detecta discrepancias ordenadas en el stack, páginas nativas desconocidas, entradas eliminadas aún presentes de forma nativa y hosts faltantes/cerrados. Las comparaciones esperan mientras su última solicitud u operación nativa está en marcha. La línea de tiempo registra los nuevos problemas observados durante la sincronización; una instantánea explícita también puede detectar un cambio antes de que llegue un evento nativo. El coleccionista observa estas condiciones y no repara el historial. `duplicate-result` detecta señales repetidas de liquidación de resultados. Las fallas de inspección reportan un código sin copiar el error subyacente.

## Suscripción y exportación {#subscribing-and-exporting}

```ts
const stopListening = inspector?.subscribe((event) => {
  // Feed an app-owned viewer/logger. Keep this callback quick.
  consume(event)
})

const json = inspector?.export()
const data = inspector?.toJSON()
stopListening?.()
```

El paquete proporciona un formato JSON independiente y el inspector de demostración nativo. El visor de informes [opcional](./diagnostics-viewer) lee esas exportaciones sin una extensión devtools privada NativeScript-Vue. También puedes inspeccionar el recopilador a través de una referencia propiedad de la aplicación en Chrome DevTools. No se instala automáticamente ningún inspector global de procesos ni transporte de red.

`toJSON()` devuelve `{ version: 1, routerId, clock: 'monotonic', startedAt, droppedEvents, events, snapshot }`. Los eventos más antiguos se descartan al máximo de su capacidad; el final de un tramo retenido puede haber perdido su inicio. `clear()` vacía el búfer y el contador de caídas conservando al mismo tiempo los ID y el origen del reloj.

`stop()` publica fuentes de instantáneas en vivo y suscripciones, congela la última instantánea y retiene solo el informe de datos sin formato limitado. Es permanente para ese coleccionista y no detiene la navegación. El desmontaje de la aplicación lo detiene automáticamente; Vue invoca este enlace antes de eliminar los componentes raíz, de modo que la instantánea final aún pueda describir el último stack activo. Cancelar explícitamente la suscripción de los oyentes propiedad de la página cuando su página se desmonte.

## Privacidad y demostración nativa {#privacy-and-native-demo}

Las rutas están representadas por su **pattern** coincidente, como `/messages/:id(\\d+)`. Los parámetros/valores de ruta resueltos, consultas, hash, metadatos, accesorios, resultados, objetos nativos, mensajes de excepción y stacks nunca se exportan. Los patrones de ruta y los nombres stack son identificadores definidos por la aplicación: mantenga los datos del usuario fuera de esas definiciones. El recopilador no tiene ninguna opción para copiar datos de ruta/página arbitrarios.

En la demostración de depuración, abra **Configuración → Diagnóstico de navegación**. Compare un guard de 350 ms con una configuración de página síncrona de 80 ms, inserte un Page nativo no administrado para observar una discrepancia y una recuperación, y copie un informe JSON redactado. Las comprobaciones nativas se registran por separado de las pruebas de calce; Los ejemplos de sincronización son accesorios de diagnóstico, no garantías de rendimiento.
