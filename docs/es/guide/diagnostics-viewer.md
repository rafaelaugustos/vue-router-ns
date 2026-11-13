# Visor de diagnóstico visual {#visual-diagnostics-viewer}

[Abre el visor de informes](/diagnostics-viewer/index.html?lang=es). Importe un informe JSON desde `router.diagnostics.export()` para comparar el historial lógico y nativo, inspeccionar los tramos de navegación y seguir redirecciones. Funciona sin conectarse a una aplicación.

<Clip name="diagnostic-replay" :width="780" aspect="1440 / 1100" caption="Visor offline real con capturas nativas de iOS 18.6: divergencia y recuperación, selección de guard/cancelación, modal, reproducir/pausar, huecos tras limpieza/truncamiento y compatibilidad v1. Los archivos con orden dañado son explícitamente sintéticos; no es una nueva ejecución nativa." />

## Recopilar y abrir un informe {#collect-and-open-a-report}

Habilite el recopilador de suscripción existente en la aplicación:

```ts
const router = createRouter({
  routes,
  diagnostics: __DEV__ ? { maxEvents: 1000 } : false,
})

// Use the application's own file/debug sharing mechanism to save this as JSON.
const report = router.diagnostics?.export()
```

Abra el visor y elija **Abrir informes JSON**. Se conservan hasta ocho archivos independientes, de como máximo 10 MiB cada uno. V1 acepta hasta 10.000 eventos; v2 también aplica sus presupuestos declarados de registros/bytes, hasta 10.000 registros y 8 MiB de datos compactos. JSON inválido, versiones no compatibles y campos malformados producen un error por archivo sin reemplazar los informes abiertos. Los campos adicionales desconocidos se descartan en lugar de mostrarse como cargas arbitrarias.

**Explorar informes de ejemplo** reemplaza los archivos abiertos con tres informes de enseñanza explícitamente sintéticos: una investigación de navegación, un búfer truncado y una ventana independiente. El guard de 350 ms y la montura de 80 ms ilustran la línea de tiempo; no son un umbral de desempeño ni un punto de referencia.

## Reproducir observaciones v2 {#replay-v2-observations}

Active el [contrato experimental de grabación](./diagnostics#experimental-recording-contract) para conservar estados intermedios. Los archivos v1 siguen siendo informes de la instantánea final, sin controles de reproducción.

```ts
const router = createRouter({
  routes,
  diagnostics: { recording: { maxRecords: 500, maxBytes: 1024 * 1024 } },
})
const recordingJSON = JSON.stringify(router.diagnostics!.recording())
// Save with the app's own file-sharing mechanism, then open it in the viewer.
```

**Observaciones grabadas** añade reproducir/pausar, anterior/siguiente y un control de posición accesible mediante teclado. La reproducción avanza una observación retenida por segundo; no reproduce el tiempo original. Nunca navega en una aplicación, ejecuta guards ni solicita datos. Solo comienza cuando se solicita y se pausa al importar, cambiar captura/filtro/idioma, limpiar u ocultar la pestaña.

Cada posición muestra únicamente su propio checkpoint grabado. Las pilas nativa y lógica, los códigos de incidencia, el instante y los detalles de visibilidad/selección cambian juntos. En **Línea de tiempo**, seleccionar una fila pausa la reproducción y selecciona su checkpoint explícitamente vinculado; una fila de tramo completo selecciona su evento final. Los enlaces de redirección mantienen el filtro por solicitud y las solicitudes superpuestas siguen separadas. La línea de tiempo retenida completa permanece visible: los eventos posteriores no demuestran el futuro del estado seleccionado. Los filtros no redefinen el orden de reproducción ni el análisis de primera divergencia.

Un evento sin checkpoint vinculado retenido muestra un hueco. El visor nunca elige una instantánea cercana, arrastra estados anteriores a través de huecos, interpola estados ni los reconstruye por nombres de operaciones. Los prefijos descartados, las épocas tras limpieza, las inspecciones excesivas/fallidas, los registros internos ausentes y los metadatos de retención incoherentes quedan visibles. Las identidades duplicadas, secuencias o relojes invertidos y épocas mezcladas deshabilitan la reproducción de pilas del archivo afectado. Las estructuras inválidas y presupuestos excedidos rechazan el archivo sin reemplazar capturas existentes. Un checkpoint posterior independiente y válido puede seguir inspeccionándose después de un hueco de registros ausentes.

**Primera divergencia observada** salta a la primera discrepancia comparable retenida. Las pilas ocupadas y observaciones anteriores a la reconciliación aplazan la comparación. La observación comparable anterior, si existe, delimita un intervalo de incertidumbre; no se afirma un inicio ni una causa exactos. El resultado cubre el archivo completo, incluso si los filtros ocultan algunas pilas. La ausencia de divergencias observadas no certifica el historial ausente.

Expanda **Visibilidad, selección y foco** para distinguir actividad de entrada, visibilidad local del host, pestaña/índice seleccionado y pila de destino del router. El foco de entrada del SO y las observaciones no disponibles siguen siendo desconocidos. Los archivos importados por separado nunca se unen, aunque coincidan sus ID locales o de captura. Un hueco no significa una pila vacía.

El vídeo usa grabaciones reales de iOS 18.6 de la etapa anterior; los archivos dañados intencionadamente llevan **SYNTHETIC** en el nombre. Esta etapa valida la herramienta offline del navegador, no una nueva ejecución nativa ni un benchmark de rendimiento. Consulte el [informe de validación](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/diagnostic-replay-stage2.md).

## Comparar la instantánea {#compare-the-snapshot}

La barra lateral selecciona una captura. Los archivos permanecen independientes incluso cuando los ID de su enrutador, stack o ventana coinciden: los ID son locales para un proceso/recolector, y los archivos exportados por separado no son una grabación continua.

**Comparación de stacks** muestra las entradas lógicas de cada stack junto a sus entradas nativas ordenadas, con función de host, ID de ventana y estado de carga. `null` es una página nativa no administrada. El visor resalta las diferentes posiciones y enumera por separado los códigos de emisión de instantáneas del recopilador. Un stack ocupado pospone la comparación en lugar de declarar corrupta una transición en curso. Se paginan grandes colecciones e historias de stack.

Se descubre una entrada **active** en su stack. Eso no prueba que su pestaña/ventana tenga el foco. El filtro de ventana utiliza ID de ventana de evento/host registrados; una identificación omitida se muestra como desconocida. Un stack con hosts en varias ventanas conserva esas etiquetas de host en lugar de que se le asigne un propietario adivinado. Los problemas de instantáneas y las métricas de resumen siempre describen la captura completa seleccionada, incluso cuando el filtro de la ventana reduce el stacks o la línea de tiempo mostrados.

Este es un informe de un momento dado, no un estado de navegación persistente. El espectador no puede editar el stack nativo ni restaurar la aplicación.

## Leer la línea de tiempo {#read-the-timeline}

**Timeline** empareja eventos de inicio/finalización por ID de intervalo dentro de la captura seleccionada, correlaciona solicitudes por ID de navegación y vincula las solicitudes redirigidas a su principal. Filtrar por fase, resultado, solicitud o ventana; seleccione una fila para ver los identificadores y campos registrados. Las solicitudes superpuestas permanecen en filas separadas. Las líneas de tiempo grandes muestran 100 filas por página; Los filtros y la navegación de páginas cubren todo el búfer retenido.

| Observación             | Cómo interpretarlo                                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Largo guard             | Filtro `guard`. Su duración mide esa invocación guard; `detail` identifica la categoría guard.                                              |
| Montaje síncrono grande | Filtro `mount`. Esto incluye la configuración de Vue, la creación de vistas nativas de **y**; no aísla el costo de instalación.             |
| Navegación rechazada    | Filtro `aborted` o `cancelled`; Inspeccione el ID de navegación y las filas guard relacionadas.                                             |
| Redirigir               | `redirected` finaliza la solicitud original; El enlace principal de la fila secundaria selecciona ese ID de navegación original.            |
| Falta el inicio         | La duración de un final se muestra como **reported**, con un punto en el final registrado. No se inventa ninguna posición inicial faltante. |
| Final faltante          | Un punto marca el inicio retenido; no se infiere ninguna duración o finalización a partir del tiempo de la instantánea.                     |
| Límites en conflicto    | Los límites de tramo duplicados o inconsistentes se etiquetan como ambiguos y no obtienen una duración fabricada.                           |

La escala de la línea de tiempo permanece vinculada al rango completo de eventos retenidos cuando cambian los filtros. Las duraciones de las fases se superponen: `transition` incluye montaje y guard/el trabajo en cola se puede intercalar entre solicitudes. No agregue duraciones de filas ni trate su suma como tiempo total de navegación. Las tarjetas guard/mount más largas consideran las duraciones informadas retenidas y no reconstruyen los eventos eliminados. Un lapso de sólo final aún puede tener una duración informada; el banner de truncamiento permanece visible.

Las caídas de búfer, los límites faltantes y las capturas vacías son explícitos. `clear()` también puede eliminar eventos anteriores sin aumentar el recuento de caídas. El origen del reloj de pared es un contexto aproximado; Los valores de la línea de tiempo utilizan el reloj monótono del coleccionista. Estas mediciones no establecen FPS, latencia del primer píxel ni uso del montón nativo. Utilice un generador de perfiles nativo para esas preguntas.

## Uso local y fuera de línea {#local-and-offline-use}

El visor lee archivos en la memoria en la pestaña del navegador. No tiene punto final de carga, transporte en vivo, análisis, almacenamiento en el navegador ni conexión de tiempo de ejecución. Al recargar o elegir **Borrar informes** se eliminan las capturas abiertas. Es una página independiente del shell de documentación; El HTML creado bloquea las conexiones de red a través de la Política de seguridad de contenido y contiene sus propios scripts/estilos.

Elija **Descargar el visor sin conexión** para guardar ese HTML. Abra el archivo descargado en un navegador e importe informes sin conexión a la red. La barra de herramientas admite inglés, portugués, español y chino simplificado. Si un navegador administrado prohíbe la creación de secuencias de comandos de archivos locales, proporcione el directorio creado en localhost.

Para construirlo o desarrollarlo desde un repositorio:

```sh
npm ci
npm run diagnostics:build
# Open docs/public/diagnostics-viewer/index.html in a browser.

npm run diagnostics:dev
npm run diagnostics:typecheck
```

`docs:build` también construye el visor. Su fuente se encuentra en `tools/diagnostics-viewer`, fuera del tiempo de ejecución publicado `src`/`dist`; no se instala ningún visor oyente ni dependencia en una aplicación NativeScript. Las comprobaciones de regresión del navegador y su configuración opcional de Playwright están documentadas en `scripts/diagnostics-viewer/README.md`.

Las reglas de privacidad [Diagnóstico de navegación](./diagnostics#privacy-and-native-demo) del recopilador existente permanecen sin cambios: exporta patrones de ruta y nombres definidos por la aplicación, no parámetros, consultas, accesorios, resultados o cargas útiles de excepción. Mantenga los datos personales fuera de esos nombres. La validación de importación no puede certificar que las cadenas de un informe modificado manualmente no contengan datos confidenciales.
