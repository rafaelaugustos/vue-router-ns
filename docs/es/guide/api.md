# API {#api}

Esta es la referencia de búsqueda. Comience con [su primera aplicación](./first-app) para conocer el flujo, [tareas comunes](./recipes) para elegir una API o [opciones de contenedor](./capabilities) para decidir la propiedad de la navegación.

## Creando un enrutador {#creating-a-router}

```ts
import { createRouter } from 'vue-router-ns'

const router = createRouter({ routes, restore, backPreview: true })
```

| Opción        | Predeterminado | Significado                                                                                                                                                                                                                        |
| ------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `diagnostics` | `false`        | `true` o `{ maxEvents }` para una línea de tiempo limitada e instantáneas nativas. Consulte [diagnósticos](./diagnostics).                                                                                                         |
| `routes`      | Requerido      | Matriz de solo lectura de `RouteRecordRaw`.                                                                                                                                                                                        |
| `restore`     | Deshabilitado  | `save(state)`, `load()`, opcional `maxAge` en milisegundos (predeterminado: 30 minutos) y `stateLimit` en bytes por página (predeterminado: 8 KiB). Ver [restauración](./restore).                                                 |
| `backPreview` | `true`         | Revelar la página anterior durante Android 14+ gestos de retroceso. `false` lo desactiva; El experimento `'core'` prueba la API Core propuesta con respaldo heredado. Requiere la plataforma [opt-in](./android-back#enabling-it). |
| `links`       | Deshabilitado  | `true` o `{ schemes, hosts, map, frame, options, system }` para tomar las URL del sistema operativo. Consulte enlaces profundos [Enlaces profundos](./deep-links#receiving-operating-system-urls).                                 |

Instalar una vez con `createApp(App).use(router).start()`. Esto registra los componentes y proporciona `$router` y `$route` en plantillas. `router.install(app)` es el gancho del complemento Vue.

## Métodos de enrutador {#router-methods}

`to` es un `RouteLocationRaw`: una cadena de ruta, `{ path, query?, hash? }`, `{ name, params?, query?, hash? }`, o una ubicación relativa a la ruta actual. Las ubicaciones de objetos también aceptan `replace` y `force`. Utilice `force: true` para enviar otra instancia de la ubicación actual. Los parámetros pertenecen a ubicaciones con nombre o relativas, no a un objeto `path`.

| Método                           | Comportamiento                                                                                                                                                                                             |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `push(to, options?)`             | Agregar una página o presentar un modal.                                                                                                                                                                   |
| `replace(to, options?)`          | Reemplazar la página actual.                                                                                                                                                                               |
| `back(options?)`                 | Pop una página; cerrar un modal en su raíz. En una raíz no modal no hace nada. El sistema de Android aún puede salir de la aplicación.                                                                     |
| `go(delta)`                      | Retroceder un número negativo de páginas. Los valores cero y positivos no hacen nada. No acepta argumentos de opciones.                                                                                    |
| `backTo(to, options?)`           | Volver a la página que coincida más cercana debajo de la parte superior; rechaza si está ausente.                                                                                                          |
| `backToRoot(options?)`           | Regresar a la primera página del stack actual.                                                                                                                                                             |
| `setStack(locations, options?)`  | Concilie una lista no vacía de ubicaciones con el stack. Conserva el prefijo común; se detiene ante el primer error sin retroceder los pasos completados.                                                  |
| `pushForResult<T>(to, options?)` | Abra una página y espere `back({ result })`. Resuelve `T \| undefined` cuando se cierra o se impide la apertura.                                                                                           |
| `resolve(to)`                    | Resolver una ubicación de forma sincrónica sin navegar. Devuelve `RouteLocation`; lanza por una ruta inigualable.                                                                                          |
| `isReady()`                      | Promise que se estabiliza después de la navegación inicial; no espera a que se carguen todas las pestañas ocultas.                                                                                         |
| `openLink(url, options?)`        | Abre una URL completa o una ruta simple como lo haría el sistema operativo: a través de `links`, con los padres, después de la primera página y el stack de destino. Resuelve un `LinkResult`.             |
| `resolveLink(url)`               | La URL `RouteLocation` apunta a debajo de `links` o `undefined`.                                                                                                                                           |
| `onLink(listener)`               | Escucha cada enlace que el enrutador fue entregado, tomado o no. Devuelve una función para cancelar la suscripción.                                                                                        |
| `setShortcuts(shortcuts)`        | Reemplaza los accesos directos de la pantalla de inicio (atajos dinámicos Android, acciones rápidas iOS) con `RouteShortcut` que se abren a través de `openLink`. Devuelve los identificadores publicados. |
| `shortcutURL(id, to)`            | Carga útil versionada para recursos de acceso directo estáticos o integración nativa propiedad de la aplicación.                                                                                           |
| `pinShortcut(shortcut)`          | Solicita fijación del lanzador Android; `true` significa solicitado, no confirmado por el usuario.                                                                                                         |
| `claimSystemBack(claimant)`      | Permite que un contenedor nativo (`{ owns(), back() }`) tome el Android hacia atrás y deslice hacia atrás primero, como un drawer abierto. Devuelve la función de liberación.                              |

`push`, `replace`, `back`, `go`, `backTo`, `backToRoot` y `setStack` se resuelven en `NavigationFailure | undefined`. Los errores inesperados se rechazan; ver [fallos](./navigating#failures-and-errors). Los métodos Back tienen la semántica de vista dividida [Listado y detalle](./split-view#history-and-back) cuando se llaman en un stack dividido.

### Opciones de navegación {#navigation-options}

`push`, `replace` y `pushForResult` aceptan `NavigationOptions`:

| Opción         | Significado                                                                                                                                                                  |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `frame`        | Nombrado stack para apuntar. De lo contrario, utilice la página de la persona que llama stack, o la stack enfocada fuera de una página. No selecciona una pestaña `TabView`. |
| `transition`   | Un nombre como `'fade'` o un objeto de transición NativeScript; anula la ruta predeterminada. Incluye `SharedTransition`.                                                    |
| `animated`     | Configure `false` para omitir la animación.                                                                                                                                  |
| `clearHistory` | Eliminar páginas anteriores, sujeto a guards. Un stack dividido conserva su lista.                                                                                           |
| `props`        | Accesorios de página adicionales, fusionados sobre accesorios de registro de ruta. No persistido por `restore`.                                                              |
| `modal`        | `true`, `false` o `ModalOptions`; anula la presentación de la ruta.                                                                                                          |
| `withParents`  | Empuje los ancestros de los componentes antes del destino.                                                                                                                   |
| `zoomFrom`     | Vista, elemento ref, componente, o `null`; fuente de zoom nativa iOS 18+.                                                                                                    |

`back`, `backTo` y `backToRoot` aceptan `BackOptions`: `animated`, `frame` y `result`. `go(delta)` no tiene ningún parámetro de opciones. `setStack` acepta `SetStackOptions`: `frame`, `animated` y `transition`; La animación se aplica sólo al último paso.

### Rutas y ganchos {#routes-and-hooks}

| Método                                              | Valor de retorno                                                        |
| --------------------------------------------------- | ----------------------------------------------------------------------- |
| `addRoute(record)` / `addRoute(parentName, record)` | Callback que elimina la ruta agregada.                                  |
| `removeRoute(name)`                                 | `void`. Elimina una ruta registrada; no muestra las páginas existentes. |
| `hasRoute(name)`                                    | `boolean`.                                                              |
| `getRoutes()`                                       | Normalizado `RouteRecord[]`.                                            |
| `beforeEach(guard)` / `beforeResolve(guard)`        | Callback que da de baja el guard.                                       |
| `afterEach((to, from, failure?) => …)`              | Callback que da de baja el gancho.                                      |
| `onError((error, to, from) => …)`                   | Devolución de llamada que da de baja el controlador.                    |

Un `NavigationGuard` recibe `(to, from, { type })`, donde `type` es `'push'`, `'replace'` o `'back'`. Puede devolver una promesa. Devuelva `false` para cancelar, una ubicación para redirigir o `undefined`/`true` para continuar. Los guardias usan valores de retorno, no `next()`. Ver [guards](./guards).

### Middleware y ayudas opcionales {#optional-middleware-and-helpers}

`router.addRouteMiddleware(name, guard, { global }?)` registra un middleware con nombre y devuelve su eliminador. El destino `meta.middleware` acepta nombres/funciones o una matriz de solo lectura. El middleware se ejecuta después de `beforeEach`, primero los globales, luego la lista de destinos, antes de `beforeEnter`. `defineRouteMiddleware(guard)` escribe una función sin registrarla.

`useNavigateTo()` captura un asistente en la configuración de la página, vinculado al stack de esa página. La configuración externa utiliza `navigateTo(router, to, options?)` con contexto explícito. Ambos delegan para enviar/reemplazar y devolver `Promise<NavigationFailure | undefined>`. Opciones: `NavigationOptions` más `replace`. Tipos: `RouteMiddleware`, `RouteMiddlewareReference`, `RouteMiddlewareOptions`, `NavigateTo`, `NavigateToOptions`. Consulte [middleware opcional y ayudas](./middleware) para realizar pedidos, eliminarlos, convenciones admitidas y límites de gestos nativos.

### Estado {#state}

- `currentRoute`: solo lectura ref a la ruta enfocada, incluido el modal activo.
- `stack`: solo lectura ref para rutas en orden de abajo hacia arriba. Un enrutador vinculado a una página expone el stack de esa página; el enrutador exportado sigue el stack enfocado.
- `diagnostics`: `RouterDiagnostics` cuando está habilitado; en caso contrario `undefined`. Consulte [diagnósticos](./diagnostics).
- `options`: la configuración del enrutador.
- `START_LOCATION`: ubicación vacía antes de la navegación inicial (`path: '/'`, no hay registros coincidentes).

## Ubicaciones y registros de ruta {#locations-and-route-records}

`RouteLocation` contiene `path`, `fullPath`, `name`, `params`, `query`, `hash`, `meta`, `matched` y `redirectedFrom`. Los parámetros resueltos son cadenas o matrices de cadenas. Los valores de consulta son cadenas, `null` o matrices; Los valores de consulta de entrada también aceptan números, valores booleanos y `undefined`. `meta` fusiona padre con hijo.

`RouteRecordRaw` acepta `path`, `name` (cadena o símbolo), `component` (cargador de componentes o sincronización/asíncrono), `children`, `redirect` (ubicación o función), `meta`, `props`. (`true`, objeto o asignador), `beforeEnter` (guard o matriz), `modal` (`boolean` o `ModalOptions`) y `transition`.

Las rutas admiten parámetros con nombre, parámetros opcionales/repetidos y patrones personalizados. Consulte [rutas escritas](./typed-routes). `children` anida rutas y metadatos; no crea una interfaz de usuario anidada automáticamente.

`ModalOptions` reenvía las opciones de NativeScript `showModal` excepto `context` y `closeCallback`, que son propiedad del enrutador. Sus opciones `ios` también aceptan `detents`, `selectedDetent`, `largestUndimmedDetent`, `grabber` y `cornerRadius`. Ver [modales y hojas](./modals).

## API de enrutamiento de archivos opcionales {#optional-file-routing-apis}

`vue-router-ns/file-routing/webpack` de solo nodo exporta `NativeFileRoutesPlugin` compatible con CommonJS para webpack 5. `vue-router-ns/file-routing/setup` exporta `prepareFileRouting(options)`, `FileRoutingOptions` y `PreparedFileRouting`. Estas entradas de compilación opcionales generan módulos y tipos de plataforma; sus registros `installFileRouting(router)` generados descubrieron middleware y manejan HMR de tabla de rutas. Consulte [configuración y soporte](./file-routing).

`vue-router-ns/file-routing/vite` de solo nodo exporta `nativeFileRoutes(options)` y `NativeFileRoutesOptions` para Vite 8. HMR nativo utiliza metadatos JSON adyacentes opcionales (`metadataFiles: true`); `definePageMeta` requiere compilaciones Vite incluidas, mientras que la limitación de macrotransformación ascendente permanece. La configuración independiente acepta `bundler: 'vite'`; el valor predeterminado sigue siendo webpack.

`vue-router-ns/file-routing` exporta la macro `definePageMeta()` escrita en tiempo de compilación, `PageMeta`, `PageMetaValue`, `mergeFileRoutes(generated, explicit)` y `createFileRouteUpdater(router, routes)` (`FileRouteUpdater`). El actualizador cambia las coincidencias futuras conservando las entradas nativas.

Exportaciones `vue-router-ns/file-routing/generator` de solo nodo `generateFileRoutes(options)`, `writeFileRoutes(options)`, `watchFileRoutes(options, callbacks)`, `transformPageMeta(source, filename)` y `FileRouteError`; tipos: `FileRoutesOptions`, `GeneratedFileRoutes`, `FilePage`. El compilador del mismo nivel es opcional y solo lo necesitan las herramientas de compilación. Consulte [enrutamiento de archivos](./file-routing) para conocer las convenciones, las restricciones de metadatos, la propiedad de HMR y el estado de integración.

## Diseños nativos opcionales {#optional-native-layouts}

`createRouter({ layouts, defaultLayout })` registra componentes/fábricas de diseño nativo por enrutador. `defaultLayout` por defecto es `false`; `meta.layout` selecciona un nombre registrado o se excluye con `false`. El diseño posee la raíz Page y ActionBar opcional; el destino suministra su cuerpo a través de la ranura predeterminada. La selección de diseño es fija para cada entrada, con instancias de diseño/contenido separadas para cada visita. Los nombres desconocidos/fallos de importación se rechazan antes del montaje. Consulte [diseños nativos](./layouts) para ejemplos de ciclo de vida, HMR, diagnóstico y creación.

## Datos de ruta (experimental) {#route-data-experimental}

`defineRouteLoader(load)` infiere un resultado de datos de `(context) => value | PromiseLike<value>`. Declararlo en `meta.loaders`; `createRouter({ loaders })` registra opcionalmente nombres para metadatos explícitos/generados por archivos. Las declaraciones de padres e hijos coincidentes son aditivas y deduplicadas por definición.

`useRouteData(loader)` devuelve referencias de solo lectura por entrada `data`, `error`, `status`, un intento actual `ready` Promise y `reload()`. Ambas promesas resuelven por éxito, fracaso o cancelación; los errores de datos permanecen en el estado. Las cargas comienzan después de la autorización y no bloquean la presentación nativa. Consulte [carga de datos](./data-loading) para cancelación, ciclo de vida, propiedad de caché y ejemplos nativos.

Tipos exportados: `RouteLoader<T>`, `RouteLoaderContext`, `RouteLoaderReference`, `RouteData<T>`, `RouteDataStatus`.

## Componibles {#composables}

| Función                                | Contrato                                                                                                                                                                                                                                                                                    |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useRouter()`                          | Enrutador vinculado al stack de la página actual; enrutador de aplicaciones fuera de una página. Requiere una aplicación que utilice el enrutador.                                                                                                                                          |
| `useRoute(name?)`                      | La ruta fija de esta página, o la ruta enfocada fuera de las páginas. El nombre opcional limita los tipos; no selecciona otra ruta.                                                                                                                                                         |
| `onBeforeRouteLeave(guard, { when }?)` | Page salir de guard. `when` acepta un valor booleano, ref o getter. Se elimina al desmontar.                                                                                                                                                                                                |
| `onPageActivated(hook)`                | Se llama cuando la página se vuelve visible, incluida su primera activación y retornos.                                                                                                                                                                                                     |
| `onPageDeactivated(hook)`              | Llamado cuando está cubierto. Para su extracción utilice el `onUnmounted` de Vue.                                                                                                                                                                                                           |
| `useBackGesture()`                     | Solo lectura superficial ref a `{ progress, edge }` o `null`; Android 14+. `edge` es `'left'`, `'right'` o `'none'`.                                                                                                                                                                        |
| `usePageState(key, options)`           | Mantiene el estado de la página compatible con JSON durante la terminación del proceso: `save`, `restore(value, { version, page })`, `version` y `migrate` opcionales. Necesita `restore` en el enrutador. Consulte [estado de página](./restore#page-state).                               |
| `useNativeFlow(flow)`                  | Vincula un `NativeFlow` (un selector de sistema, la actividad de otra aplicación) a la página: `run(input, { before })` se resuelve una vez con `completed`, `cancelled` o `failed`; `running` ref. `createDocumentPicker()` es el flujo incorporado. Ver [flujos nativos](./native-flows). |

Registre enlaces de página en la configuración del componente enrutado. En una vista dividida expandida, tanto la lista como los detalles superiores están activos. Consulte Ciclo de vida de la página [y HMR](./pages).

## Componentes {#components}

| Componente             | Accesorios y ranuras                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RouterView`           | `name` (`'default'`), `initial` (`'/'`), `backToRootOnReselect` (`false`). Monta un Frame.                                                                                                                                                                                                                                                                                                                                              |
| `RouterSplitView`      | Requerido `list`; `name` (`'default'`), `breakpoint` (840), `listWidth` (320), `foldAware` (`true`, Android), `backToRootOnReselect` (`false`). Ranura: `empty`.                                                                                                                                                                                                                                                                        |
| `RouterUIKitSplitView` | Requerido `list`; `name` (`'default'`), `primaryWidthFraction` (`0.32`). Columnas primarias/secundarias UIKit de raíz de ventana, iOS 18+ con Core SplitView. Consulte las columnas [UIKit](./split-view#opt-in-uikit-columns).                                                                                                                                                                                                         |
| `RouterDrawer`         | `width` (300), `open` (`v-model:open`), `closeOnNavigate` (`true`). Ranuras: contenido predeterminado y `drawer`. Eventos `opened`, `closed`; ref `open()`, `close()`, `toggle()`, `isOpen`. Solo Android; iOS representa el contenido. Ver [Android drawer](./drawer).                                                                                                                                                                 |
| `RouterTabs`           | `selected` (`v-model:selected`, un nombre de pestaña), `canSelect(name)`, `sidebar` (iOS 18+), `minimize` (`'never'`, iOS 26 `'onScrollDown'`/`'onScrollUp'`), `rail` (600, Android); `tabBackgroundColor`, `tabTextColor`, `selectedTabTextColor`, `labelVisibility` (Materiales). Eventos `select`, `reselect`. Niños: `RouterTab` con `name`, `title`, `icon` (Símbolo SF), `androidIcon`, `badge`, `role`. Consulte [tabs](./tabs). |
| `RouterLink`           | Requerido `to`; `replace`, `clearHistory`, `withParents`, `zoom` (todos `false`); `transition`, `frame`; `menu` (`RouteMenuOptions`: una pulsación larga previsualiza la ruta). Un niño con el espacio predeterminado; la ranura recibe `{ navigate }`. Agrega un controlador de grifo sin un contenedor nativo.                                                                                                                        |
| `Deferred`             | Sin accesorios. Ranuras: contenido predeterminado y `fallback`. Muestra el contenido después de la primera activación de la página y lo mantiene montado después. Fuera de una página enrutada, se representa inmediatamente.                                                                                                                                                                                                           |

`v-route-preview` (exportado como `vRoutePreview`, registrado por `install`) toma `RoutePreviewOptions` en cualquier vista: `to`, `preview`, `props`, `canPreview`, `size`, `actions`, `openTitle` y las opciones de navegación. `attachRouteMenu(view, router, options)` y `detachRouteMenu(view)` hacen lo mismo sin Vue. Consulte las vistas previas del menú contextual [Vistas previas del menú contextual](./context-menus).

Los nombres de las vistas del enrutador deben ser únicos, incluidas las vistas divididas. `name` y la ruta inicial (`initial`/`list`) se leen en el montaje; utilice un nuevo Vue `key` para crear un stack diferente. Las dimensiones de la vista dividida son píxeles independientes del dispositivo; El ancho de la lista tiene un límite de la mitad del ancho disponible. Consulte [vista dividida](./split-view).

## Fallos y tipos exportados {#failures-and-exported-types}

`isNavigationFailure(value, type?)` identifica un `NavigationFailure` (`Error` con `type`, `to`, `from`). `NavigationFailureType` tiene `aborted` (4), `cancelled` (8) y `duplicated` (16); el argumento de tipo opcional también acepta una máscara de bits.

Los tipos públicos se exportan desde la raíz del paquete:

- Pestañas: `RouterTabDescriptor`, `TabMinimize`, `TabRole`, `TabLabelVisibility`, `TabBarVisibility`; `supportsNativeTabs()`.
- Configuración del enrutador: `Router`, `RouterOptions`, `SystemBackClaimant`, `RouterDrawerHandle`, `RestoreOptions`, `SavedStacks`, `SavedEntry`, `SavedState`, `PageStateOptions`, `PageStateContext`.
- Rutas: `RouteRecordRaw`, `RouteRecord`, `RouteRecordName`, `RouteMeta`, `RouteProps`, `RouteComponent`, `RawRouteComponent`, `Lazy`.
- Ubicaciones: `RouteLocation`, `RouteLocationRaw`, `RouteLocationPathRaw`, `RouteLocationNamedRaw`, `RouteLocationRelativeRaw`, `RouteParams`, `RouteParamsRaw`, `RouteParamValue`, `RouteParamValueRaw`, `LocationQuery`, `LocationQueryRaw`, `LocationQueryValue`, `LocationQueryValueRaw`.
- Navegación: `NavigationOptions`, `BackOptions`, `SetStackOptions`, `NavigationType`, `NavigationInfo`, `NavigationGuard`, `NavigationGuardReturn`, `NavigationHookAfter`, `NavigationErrorHandler`, `NavigationFailure`, `LeaveGuardOptions`.
- Flujos nativos: `NativeFlow`, `NativeFlowContext`, `NativeFlowOutcome`, `NativeFlowHandle`, `NativeFlowRunOptions`, `DocumentPickerInput`, `DocumentPickerResult`; `startNativeFlow(flow, input, page)` ejecuta uno fuera de una página.
- Enlaces: `LinksOptions`, `LinkOptions`, `LinkWindow`, `InitialLinkRequest`, `IncomingLink`, `LinkResult`, `LinkIgnoredReason`, `LinkSource`, `LinkListener`, `RouteShortcut`. `supportsShortcuts()` informa si la plataforma muestra accesos directos en la pantalla de inicio.
- Presentación nativa: `ModalOptions`, `SheetOptions`, `SheetDetent`, `AndroidModalOptions`, `BottomSheetOptions`, `BottomSheetState`, `TransitionOption`, `ZoomSource`, `BackGesture`, `BackGestureEdge`. `supportsBottomSheets()` informa si la compilación Android incluye Material.
- Tipos de ruta inferidos: `Register`, `RegisteredRouter`, `RouteMapFrom`, `RouteMapGeneric`, `RouteNames`, `RouteLocationOf`, `RouteLocationRawOf`, `ParamsFromPath`.

Aumente `Register` y `RouteMeta` como se muestra en las rutas escritas [Rutas escritas](./typed-routes).

## Diagnóstico {#diagnostics}

`RouterDiagnostics` expone `routerId`, `stopped`, `events`, `droppedEvents`, `snapshot()`, `subscribe(listener)`, `toJSON()`, `export()`, `clear()` y `stop()`. Los datos son de solo lectura, están delimitados y redactados; `stop()` publica fuentes en vivo. Tipos exportados: `DiagnosticsOptions`, `RouterDiagnostics`, `DiagnosticsExport`, `DiagnosticSnapshot`, `DiagnosticStack`, `DiagnosticHost`, `DiagnosticEntry`, `DiagnosticIssue`, `DiagnosticIssueCode`, `DiagnosticEvent`, `DiagnosticPhase` y `DiagnosticOutcome`. Consulte [diagnostics](./diagnostics) para conocer el formato, la semántica de temporización y la ciclo de vida.

## Búsqueda nativa {#native-search}

`useNativeSearch(options)` registra la búsqueda nativa propiedad de la página. Exportaciones: `NativeSearchOptions`, `NativeSearch`. Consulte [barras nativas y search](./native-bars) para conocer las diferencias de propiedad, activación y plataforma de las consultas.

## Page acciones {#page-actions}

`usePageActions(source, { onError? })` comparte devoluciones de llamada escritas, propiedad de la página y estado reactivo entre `PageActionItem` y los menús de ruta. Exportaciones: `PageAction`, `PageActionContext`, `PageActionState`, `PageActions`, `PageActionsOptions`. Consulte las acciones de la página [Page acciones](./page-actions) para conocer la ejecución, cancelación, propiedad y reutilización opcional del teclado.

## Comandos de teclado {#keyboard-commands}

`useNavigationCommands(source)` y `NavigationCommandScope` vinculan comandos de suscripción a una página/ventana. Tipos: `NavigationCommand`, `NavigationCommandState`, `NavigationCommands`, `NavigationShortcut`, `KeyModifier`. Consulte [comandos de teclado](./keyboard).

## Accesibilidad y movimiento {#accessibility-and-motion}

`useNavigationFocus(options)` proporciona objetivos de accesibilidad inicial/de retorno opcionales y restauración del iniciador modal. Tipos: `NavigationFocus`, `NavigationFocusOptions`, `NavigationFocusTarget`. `RouterOptions.motion` acepta `MotionPolicy` (`system`, `reduced`, `full`); predeterminado `system`. Ver [accesibilidad y movimiento](./accessibility).

## Hosts nativos (experimentales) {#native-hosts-experimental}

`mountNativeHost(router, name, host, initial?)` controla un stack en un `NativeHost` y devuelve su función de desmontaje. `useNativeHost<TNative>()` proporciona a una página el contenedor `kind`, `capabilities` y `native` de su host. `createFrameHost(frame, { modal? })` y `createSplitFrameHost(list, detail, { expanded, detailVisible })` son los hosts integrados; `NATIVE_HOST_VERSION` es la versión de contrato que acepta el enrutador. Tipos: `NativeHost`, `NativeHostCapabilities`, `NativeHostDelegate`, `NativeHostPushOptions`, `NativeHostBackOptions`, `NativeHostPart`, `NativeHostRole`, `NativeHostHandle`, `NativeHostVersion`, `FrameHostOptions`, `SplitFrameHostOptions`, `SplitFrames`, `BackGestureSession`, `BackPreview`. Consulte [hosts nativos](./native-hosts).

`defineNativeDestination<Input, Output>({ id, input, ios?, android? })` devuelve un componente de ruta que contiene un controlador UIKit existente o un fragmento AndroidX. Las fábricas devuelven `{ native, dispose? }`; su contexto proporciona `input`, `route`, `page`, `complete(value)`, `cancel()`, `dismissed()` y `beforeLeave(guard)`. Tipos: `NativeDestinationOptions`, `NativeDestinationContext`, `NativeDestinationInstance`. Consulte [destinos nativos](./native-destinations) para contención, límites y restauración de guard.

`supportsUIKitSplitView()` comprueba si el backend opcional UIKit está disponible.

## Windows nativo (experimental, core 9.1+) {#native-windows-experimental-core-9-1}

`RouterOptions.window?: RouterWindow` vincula un enrutador a una ventana nativa; de lo contrario, la primera vista montada suministra a su propietario. `router.window` es un ref de solo lectura para ese propietario. `router.openWindow(to, options?: OpenWindowOptions): void` resuelve una ubicación escrita y solicita una ventana del sistema operativo. `OpenWindowOptions.data` contiene metadatos de aplicaciones serializables. `getWindowRoute(data)` lee su ruta en un solucionador de contenido de ventana.

`RestoreOptions.key` proporciona una clave de instantánea de aplicación estable. Las devoluciones de llamada con alcance reciben `RestoreContext` opcional (`windowId`, `key`) en `save(state, context)` y `load(context)`. El `SavedStacks` con alcance incluye `windowKey`; se ignora una discrepancia. `RouterWindow` es un subconjunto estructural de NativeWindow, por lo que las declaraciones del paquete siguen siendo utilizables con versiones principales compatibles más antiguas. Consulte [Windows nativos](./windows) para conocer el arranque, el ciclo de vida, la configuración y los límites.

El punto de entrada opcional `vue-router-ns/system-search` exporta `createSystemSearch`, `SystemSearch`, `SystemSearchOptions` y `SearchItem`. `supportsPinnedShortcuts()` se exporta desde la raíz del paquete. Consulte enlaces profundos [Enlaces profundos](./deep-links).

## Tipos exportados adicionales y análisis de metadatos {#additional-exported-types-and-metadata-parsing}

| Exportar                     | Contrato                                                                                                                                                          |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RouteMenuAction`            | Descriptor de acción del menú contextual nativo; consulte [menús contextuales](./context-menus).                                                                  |
| `SearchBarPlacement`         | `'automatic'`, `'stacked'`, `'inline'` o `'integrated'` para la ubicación de búsqueda compatible con UIKit. La disponibilidad sigue dependiendo de la plataforma. |
| `DrawerPresentation`         | Modo solicitado `'overlay'`, `'permanent'` o `'auto'`.                                                                                                            |
| `ResolvedDrawerPresentation` | Modo efectivo `'overlay'` o `'permanent'` informado por el evento de presentación y identificador drawer.                                                         |
| `UIKitSplitFrames`           | Carga útil de host nativo experimental que extiende `SplitFrames` con `view: UIKitSplitView` de solo lectura.                                                     |
| `PageMetaTransform`          | Resultado del generador experimental: `hasMacro`, `metadata`, transformado `code` y su fuente `map`.                                                              |

La entrada experimental `vue-router-ns/file-routing/generator` de solo nodo también exporta `parsePageMetadataJson(source, filename): PageMeta`. Valida un objeto de metadatos JSON y arroja `FileRouteError` para metadatos no válidos o no compatibles. Úselo al integrar archivos de metadatos adyacentes; no ejecuta código de ruta.
