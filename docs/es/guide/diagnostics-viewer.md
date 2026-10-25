# Visor de diagnóstico visual {#visual-diagnostics-viewer}

[Abre el visor de informes](/diagnostics-viewer/index.html?lang=es). Importe un informe JSON desde `router.diagnostics.export()` para comparar el historial lógico y nativo, inspeccionar los tramos de navegación y seguir redirecciones. Funciona sin conectarse a una aplicación.

<Clip name="diagnostics-viewer" :width="780" aspect="1440 / 1050" caption="La herramienta de navegador real: importar informes de ejemplo, comparar una discrepancia nativa, filtrar un guard rechazado e inspeccionar un búfer truncado. Datos sintéticos, no puntos de referencia de dispositivos." />

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

Abra el visor y elija **Abrir informes JSON**. Podrás retener hasta ocho capturas independientes, cada una de hasta 10 MiB y 10.000 eventos. Se admiten los informes de la versión 1; JSON no válido, versiones no compatibles y campos con formato incorrecto producen un error específico del archivo sin reemplazar los informes ya abiertos. Los campos adicionales desconocidos se descartan y no se muestran como cargas útiles arbitrarias.

**Explorar informes de ejemplo** reemplaza los archivos abiertos con tres informes de enseñanza explícitamente sintéticos: una investigación de navegación, un búfer truncado y una ventana independiente. El guard de 350 ms y la montura de 80 ms ilustran la línea de tiempo; no son un umbral de desempeño ni un punto de referencia.

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

Elija **Descargar el visor sin conexión** para guardar ese HTML. Abra el archivo descargado en un navegador e importe informes sin conexión a la red. La barra de herramientas admite inglés y portugués. Si un navegador administrado prohíbe la creación de secuencias de comandos de archivos locales, proporcione el directorio creado en localhost.

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
