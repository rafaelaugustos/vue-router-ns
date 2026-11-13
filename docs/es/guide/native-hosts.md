# Hosts nativos {#native-hosts}

::: warning Experimentales
El contrato de host es nuevo y puede cambiar entre versiones beta. Los cambios afectan a `NATIVE_HOST_VERSION` y se enumeran en el registro de cambios. Consulte la política de versiones [política de versiones](#versioning-policy).
:::

La revisión de estabilidad y la aceptación de un adaptador independiente se siguen en [#176](https://github.com/rafaelaugustos/vue-router-ns/issues/176). Actualizar las dependencias de NativeScript no elimina el estado experimental de este contrato público.

Un **host** es el contenedor nativo en el que el enrutador controla un stack. `<RouterView>` le entrega al enrutador un NativeScript `Frame`; `<RouterSplitView>` le da dos; una ruta modal obtiene un marco dentro de un modal nativo. Cada uno pasa por el mismo contrato, por lo que el enrutador mantiene una implementación de coincidencia, guards, resultados, historial y conciliación, mientras que el host posee la presentación, los gestos y los identificadores nativos.

El contrato existe para que se puedan agregar drawers nativos, hojas y controladores de plataforma sin bifurcar el enrutador o reimplementar guards dentro de cada adaptador. Los hosts integrados son los primeros usuarios: `createFrameHost(frame)`, `createFrameHost(frame, { modal: true })` y `createSplitFrameHost(list, detail, options)`.

## Qué hace un host {#what-a-host-does}

```ts
import type { NativeHost } from 'vue-router-ns'
```

| Miembro                      | Rol                                                                                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `version`                    | La versión del contrato que implementa. Debe ser igual a `NATIVE_HOST_VERSION`.                                                                                    |
| `kind`                       | Un nombre corto para diagnósticos y errores, como `'frame'`.                                                                                                       |
| `capabilities`               | Qué puede hacer de forma nativa. Consulte [capacidades](#capabilities).                                                                                            |
| `native`                     | El contenedor, `null` una vez desechado.                                                                                                                           |
| `loaded`                     | `false` mientras el contenedor aún no puede mostrar páginas, como una pestaña que iOS nunca ha mostrado. Sus empujones esperan; otros stacks no lo hacen.          |
| `attach(delegate)`           | Llamado una vez antes del primer impulso. El host mantiene al delegado e informa a través de él.                                                                   |
| `pages()`                    | Páginas en orden nativo, de abajo hacia arriba, ya sea que el enrutador las haya montado o no. El enrutador se reconcilia a partir de esto después de cada cambio. |
| `visible()`                  | Opcional. Las páginas en pantalla ahora mismo, cuando más de uno puede estarlo. `onPageActivated` lo sigue.                                                        |
| `push(component, options)`   | Monta el componente como una nueva página en la parte superior. Finalización del informe con `delegate.changed()`. Lanzar o rechazar para fallar la navegación.    |
| `back(target, options)`      | Regresa a `target`, una página de `pages()`, eliminando lo que está encima. `null` cierra el host. Informe con `changed()` o `closed()`.                           |
| `holdDismissal(hold)`        | Opcional. Mantiene la baja del propio usuario mientras esté activa una licencia guard. Informe de intentos con `delegate.dismissAttempted()`.                      |
| `previewBack(top, below, …)` | Opcional. Respaldo predictivo Android 14+: muestra `below` mientras se desliza el dedo y llama a `commit` cuando aterriza. Ver [`BackPreview`](./android-back).    |
| `ownsSystemBack()`           | Opcional. Si el sistema de la ventana actual aterriza en este host.                                                                                                |
| `willAnimate(options)`       | Opcional. `false` cuando la página siguiente aparece en un panel que aún no está en la pantalla, por lo que se omiten los zooms y los elementos compartidos.       |
| `parts()`                    | Opcional. Los contenedores nativos para [diagnostics](./diagnostics), cada uno con un rol, un identificador nativo, `loaded` y sus páginas.                        |
| `dispose()`                  | Detiene la escucha y libera los identificadores. Se llama cuando se cierra el stack. Es seguro llamar dos veces.                                                   |

El delegado que el enrutador pasa a `attach()` tiene cinco métodos: `changed()` después de cada cambio nativo, `closed()` cuando el host se fue por sí solo, `dismissAttempted()` para un despido retenido, `backPressed()` para un sistema que respalda las reclamaciones del host y `backGesture()` para iniciar un regreso interactivo. Un host que informa un cambio que no realizó, como un deslizamiento iOS, recibe el mismo tratamiento que un `<RouterView>`: el enrutador lo refleja, elimina las páginas que salieron y ejecuta `afterEach`.

## Capacidades {#capabilities}

El enrutador pregunta en lugar de adivinar. Una navegación que necesita una capacidad de la que carece el host se rechaza con un error explícito, por lo que un `clearHistory` no compatible nunca parece haber funcionado.

| Capacidad              | Significado                                                                                                                           | Sin ella                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `replace`              | `replace` coloca la página en la parte superior de forma nativa, en el mismo paso que la inserción.                                   | `router.replace()` rechaza.                                  |
| `clearHistory`         | `clearHistory` elimina todas las páginas siguientes de forma nativa, en el mismo paso que el envío.                                   | `push(to, { clearHistory: true })` rechaza.                  |
| `pinnedRoot`           | La primera página permanece, como una lista de vista dividida. `clearHistory` lo conserva, nunca lo elimina y `setStack` le antepone. | La primera página es una entrada normal.                     |
| `close`                | El host como un todo se puede cerrar, como un modal. `back(null)` lo cierra.                                                          | Back en la raíz no hace nada.                                |
| `cancellableDismissal` | El host puede retener un despido que el usuario inicia hasta que se haya ejecutado la licencia guards.                                | Los guardias sólo ven las navegaciones que inicia el router. |
| `multipleVisible`      | Puede haber más de una página en pantalla. `visible()` dice cuál.                                                                     | Sólo la página de arriba está activa.                        |

Las transiciones, `animated` y las fuentes de zoom son presentación: un host puede ignorarlas. Las opciones que recibe un host son `NativeHostPushOptions` (`initial`, `animated`, `transition`, `replace`, `clearHistory`) y `NativeHostBackOptions` (`animated`).

## Montando un host {#mounting-a-host}

`<RouterView>` hace esto para un Frame. Para su propio contenedor, monte el host con un nombre y navegue allí con `{ frame: name }`, exactamente como una vista con nombre:

```ts
import { mountNativeHost } from 'vue-router-ns'

const unmount = mountNativeHost(router, 'sidebar', host, '/menu')
await router.push('/menu/settings', { frame: 'sidebar' })
unmount()
```

Los nombres se comparten con los `<RouterView>` y deben ser únicos. Al desmontar se cierra stack: los resultados pendientes se liquidan con `undefined`, se guards de salida sin ejecutar y el host se elimina.

## Llegando al contenedor nativo {#reaching-the-native-container}

Dentro de una página enrutada, `useNativeHost()` le proporciona al host la página en la que reside el stack. Escriba el contenedor usted mismo:

```ts
import { useNativeHost } from 'vue-router-ns'
import type { Frame } from '@nativescript/core'

const host = useNativeHost<Frame>()
host.kind // 'frame', 'modal-frame', 'split-frame' or your own
host.capabilities.close
host.native?.ios // the UINavigationController, on iOS
```

`native` es `null` una vez que la página ha abandonado su stack o el host ha desaparecido. Léelo cuando lo necesites en lugar de conservarlo: el identificador pertenece al host y el marco de un modal no sobrevive al modal.

## Escribir un host {#writing-a-host}

El host completo más pequeño es el ejemplo en memoria con el que se ejecuta el conjunto de contratos: [`test/hosts/memory.ts`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/hosts/memory.ts). No tiene ningún contenedor nativo; monta páginas con `createNativeView`, las mantiene en una matriz e informa sobre un tick posterior, como lo haría una transición. Un host basado en Frame puede reutilizar `createFrameHost()` y empaquetarlo, que es como se ensamblan los hosts integrados modales y divididos.

En qué se basa el enrutador:

- `pages()` es la verdad. Incluya páginas que el enrutador no montó; Los diagnósticos los informan como `unknown-native-page` en lugar de que el enrutador los adivine.
- Llame a `delegate.changed()` una vez por cambio nativo, después de que se complete y `pages()` lo refleje. Llámelo también para los propios empujones y retrocesos del enrutador: así es como el enrutador sabe que terminaron.
- No finjas lo que no puedes hacer. Declararlo en `capabilities`.
- Desechar por completo. Después de `dispose()`, `native` es `null`, los oyentes desaparecen y los eventos de plataforma posteriores se ignoran.
- Incluye dependencias nativas con el adaptador. Un host que necesita material Android o un contenedor Swift lo empaqueta como su propio complemento; el enrutador permanece libre de él.

Ejecute el conjunto de contratos contra el host antes de reclamar soporte. Vive en [`test/host-contract.ts`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/host-contract.ts) y verifica el orden, las ventanas emergentes externas, las navegaciones canceladas y simultáneas, la eliminación, las operaciones no admitidas y los resultados liquidados exactamente una vez. Se ejecuta contra el host Frame, el host dividido y el host de memoria. No puede reemplazar las comprobaciones de dispositivos: los gestos del sistema, la terminación del proceso y la accesibilidad necesitan la plataforma real, registrada en los informes de validación [informe de validación](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-validation.md).

## Política de versiones {#versioning-policy}

- `NATIVE_HOST_VERSION` es `1`. Un host declara la versión que implementa y el enrutador rechaza una diferente con un error explícito en lugar de ejecutarla basándose en suposiciones que no comparte.
- Si bien es experimental, el contrato puede cambiar en una versión beta. Cualquier cambio incompatible modifica la versión, aparece en el registro de cambios y actualiza los hosts integrados, la memoria de ejemplo y el conjunto de contratos juntos.
- Agregar un miembro o capacidad opcional no mejora la versión. Los hosts que no implementan un miembro opcional mantienen su comportamiento actual.
- Cuando el contrato deja el estado experimental, la versión seguirá el semver de este paquete: el host incompatible cambia solo en una versión principal.

## Validación de adaptadores externos {#external-adapter-acceptance}

La exportación opcional `vue-router-ns/testing/native-host` ofrece `runNativeHostConformance` sin Vitest, APIs de Node ni imports internos del router. `NATIVE_HOST_CONFORMANCE_VERSION` versiona las comprobaciones por separado de `NATIVE_HOST_VERSION`. Ejecútela en una aplicación de prueba desechable:

```ts
import { runNativeHostConformance } from 'vue-router-ns/testing/native-host'

const report = await runNativeHostConformance(createFixture, { timeoutMs: 8000 })
console.log(report.harnessVersion, report.contractVersion, report.checks)
```

`createFixture` recibe los registros de rutas. Instálelos en un router nuevo, monte un host vacío y devuelva `router`, `host`, `unmount` y `popNatively`. Si el host comienza descargado, devuelva la fixture antes de esperar a que esté lista; proporcione `load` para mostrarlo. Los probes opcionales `rejectNext`, `lateEvents` y `dismissAttempted` ejercitan fallos atómicos inyectados, callbacks antiguos e intentos de cierre retenidos. El informe identifica los probes omitidos; no cuentan como cobertura aprobada. `NativeHostConformanceError.report` conserva las comprobaciones hasta el fallo. La factory limpia el montaje parcial; el harness desmonta toda fixture creada correctamente.

Consulte el [paquete independiente del adaptador](https://github.com/rafaelaugustos/vue-router-ns/tree/main/examples/native-host-adapter), el [consumidor y driver](https://github.com/rafaelaugustos/vue-router-ns/tree/main/scripts/native/native-host) y el [informe versionado](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-host-conformance-v1.md). El ejemplo monta vistas Vue directamente mediante exportaciones públicas y se instala desde tarballs. Su alcance es la presentación Frame en iOS con Core 9.1.4 y NativeScript-Vue 3.1.3. Android, cierre modal, raíces fijas, varias páginas visibles y HMR de scripts quedan fuera del soporte de este ejemplo.

### Orden y responsabilidad {#ordering-and-ownership}

- `push` y `back` terminan después de que finalicen tanto la promesa devuelta como la confirmación nativa. Resolver la promesa por sí solo no completa la navegación. `changed()` debe observar el orden nativo final, conservando las identidades de las páginas retenidas. Un gesto cancelado no modifica ese orden.
- Lance un error o rechace antes de modificar el estado nativo o confirmar la operación. Después de confirmarla, resuelva correctamente. Rechazar tras una modificación nativa confirmada viola el contrato; el router no puede deshacer un estado arbitrario de la plataforma.
- La descarga temporal conserva identidades, estado Vue y resultados pendientes. Un host descargado encola la presentación localmente; otra pila puede navegar. La reconexión reutiliza el mismo host vivo. `unmount()` definitivo lo descarta; cree otro adaptador para un nuevo propietario. Un desmontaje antiguo no puede cerrar un reemplazo con el mismo nombre.
- `dispose()` debe desmontar todas las vistas Vue que posee, eliminar listeners y liberar handles, incluso después de un fallo parcial de attach. El router libera las entradas lógicas y la navegación pendiente aunque la limpieza del adaptador lance un error. Los callbacks tardíos no resucitan una pila cerrada.
- `cancellableDismissal` requiere `holdDismissal`; `multipleVisible` requiere `visible`. Ambos métodos se verifican antes de adjuntar el host. Todos los campos de capacidad existentes siguen siendo booleanos obligatorios. Las indicaciones de presentación y los métodos de diagnóstico opcionales siguen siendo opcionales. La observación de transiciones, el control del progreso y la integración con Jolt no añaden requisitos al host.

### Estabilidad y mantenimiento {#stability-and-maintenance}

Esta revisión mantiene el contrato **experimental en la versión 1**. Las correcciones aplican la responsabilidad y las capacidades ya declaradas; los adaptadores conformes no necesitan migración. Quienes declaren una capacidad sin su método obligatorio deben implementarlo o declarar la capacidad falsa. Añadir un miembro obligatorio o cambiar la semántica de finalización exige incrementar la versión del contrato y documentar la migración; los miembros opcionales aditivos conservan la versión 1.

Mantenga juntos los tipos públicos, la versión del harness, el consumidor independiente empaquetado, el driver nativo y las traducciones. El CI específico verifica imports empaquetados en los PR relevantes; su ejecución iOS es manual y semanal. Las pruebas nativas de gestos y ciclo de vida complementan el harness. Esta validación no establece cobertura en dispositivos físicos, soporte para adaptadores Android, recolección repetida de recursos ni una promesa de API estable.

La fixture de ciclo de vida cubre y revela una Page retenida por el propietario. Eliminar un Frame de su padre destruye su controlador UIKit en Core; trátelo como cierre definitivo del propietario y cree otro Frame/adaptador en lugar de reutilizarlo.

<Clip name="native-host-conformance" :width="480" aspect="3 / 4" caption="Adaptador independiente: Back nativo cancelado, bloqueado y completado, descarga/recarga temporal y cierre. Simulador iOS 18.6; etiquetas de la fixture en inglés." />
