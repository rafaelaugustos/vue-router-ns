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

## Contrato experimental de grabación {#experimental-recording-contract}

Actívelo por separado para conservar observaciones intermedias del estado nativo y lógico:

```ts
const router = createRouter({
  routes,
  diagnostics: {
    maxEvents: 500,
    recording: { maxRecords: 500, maxBytes: 1024 * 1024 },
  },
})
const inspector = router.diagnostics!
inspector.checkpoint() // e.g. after an app-owned tab selection
const capture = inspector.recording() // readonly v2 object; no live sampling
const recordingJSON = JSON.stringify(capture)
const legacyJSON = inspector.export() // unchanged v1, for the current viewer
```

Esta es la primera etapa del contrato de grabación. El [visor](./diagnostics-viewer) sigue importando v1; la validación de importación v2, los controles de reproducción sincronizada y el análisis de la primera divergencia corresponden a una etapa posterior. Leer una grabación nunca ejecuta guards, solicita datos, navega en la aplicación ni restaura objetos nativos.

`recording: true` utiliza los valores predeterminados anteriores. `maxRecords` acepta 1–10.000 y `maxBytes` acepta 1.024–8.388.608. Ambos límites se aplican al búfer v2 independiente; `maxEvents` sigue limitando v1. `retainedBytes` cuenta la serialización UTF-8 compacta del array de registros, incluidos corchetes y comas. El pequeño envoltorio del informe, los espacios de formato, las copias exportadas y las asignaciones temporales de snapshots quedan fuera de ese presupuesto. Es un límite de retención, no del heap.

El envoltorio v2 incluye `captureId`, `routerId`, `clock`, `startedAt`, `stopped`, `epoch`, `limits`, `retainedBytes`, `droppedRecords`, `clearedRecords`, `overhead` y `records`. Cada registro tiene una `sequence` creciente, su `epoch` y un `time` monotónico. Los eventos conservan los ID de correlación v1. Los checkpoints contienen un `snapshot` completo, `observations`, una `boundary` y un `eventId` opcional del evento desencadenante. Son independientes: descartar uno anterior no invalida otro posterior.

El recopilador observa la inicialización, los eventos, la reconciliación nativa antes y después de actualizar el estado lógico, los checkpoints explícitos, la limpieza y la detención. El historial nativo procede de las páginas observadas del host, no de nombres de operaciones. Solo se observan los instantes de los checkpoints: no hay grabación continua ni interpolación entre ellos. Los cambios externos de pestaña aparecen en la siguiente observación; llame a `checkpoint()` después de seleccionar cuando ese instante importe. No se añaden sondeos ni listeners nativos.

`active` sigue siendo un indicador del ciclo de vida de la entrada. `hostVisible` describe páginas visibles dentro del host, sin afirmar que otro modal o ventana no las oculta. `selected` y `tab` registran pertenencia e índice nativo seleccionado cuando están disponibles. `routerFocused` identifica el stack de destino del router; `inputFocused` siempre es desconocido. Las observaciones nulas deben seguir siendo desconocidas. Los ID estables de entrada/stack/host/ventana/pestaña solo tienen sentido dentro de su captura; no una capturas independientes por coincidencias de ID locales.

Descartar el prefijo incrementa `droppedRecords`. Limpiar avanza `epoch`, cuenta los registros descartados en `clearedRecords`, emite un hueco de limpieza y observa un nuevo checkpoint. Las secuencias e identidades no se reinician. Un registro demasiado grande se convierte en un hueco de tamaño; los fallos de inspección se convierten en huecos de inspección sin datos de excepción ni estado parcial. Un búfer pequeño puede conservar solo un hueco o evento: eso no significa un stack vacío. Un intervalo retenido puede carecer de un extremo. Detener congela la grabación; la navegación puede continuar.

No diagnostique una divergencia estable desde un checkpoint ocupado o anterior a la reconciliación. Otro posterior y comparable puede mostrar la primera **observación retenida** de discrepancia, nunca su causa ni inicio exacto; los registros ausentes amplían esa incertidumbre. Se aplica la misma política de omisión de datos que en v1. `overhead` mide el trabajo síncrono del recopilador v2, excluyendo listeners, exportación y renderizado. Grabar añade coste de inspección/serialización y puede afectar los tiempos de navegación; no mide FPS.

<Clip name="diagnostic-recording" :width="480" aspect="3 / 4" caption="Captura real en iOS 18.6: éxito, rechazo del guard, cancelación, ciclo del modal, divergencia nativa intencional y recuperación, límites de retención, limpieza y detención. Etiquetas en inglés; sin reproducción sintética." />

Pasaron diez comprobaciones nativas. El trabajo medido del recopilador y los tamaños de archivo son mediciones del fixture, no garantías de rendimiento del dispositivo. Consulte el [informe de validación](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-diagnostic-recording-stage1.md) y el [driver reproducible](https://github.com/rafaelaugustos/vue-router-ns/blob/main/scripts/native/recording/README.md).
