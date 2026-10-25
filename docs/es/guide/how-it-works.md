# Cómo funciona {#how-it-works}

Cada `<RouterView>` representa un NativeScript `Frame` y lo entrega al enrutador como un host nativo [Hosts nativos](./native-hosts). Las páginas se montan con `$navigateTo`, dentro de un pequeño envoltorio que proporciona su ruta y un enrutador vinculado a su stack. NativeScript-Vue monta cada página como su propia aplicación, por lo que nada de lo proporcionado por `<RouterView>` les llegaría de otra manera.

En un `RouterView`, el stack nativo es la fuente del historial de navegación. Después de cada `navigatedTo`, el host Frame informa un cambio y el enrutador lee las páginas del host y las refleja. Los pops que no inició, como un deslizamiento iOS, se detectan de la misma manera que el suyo propio. `replace` marca la entrada actual `backstackVisible: false` antes de navegar, que es la forma en que el marco coloca una página de forma nativa.

El enrutador habla con cada contenedor a través del mismo contrato de host: el Frame de un `<RouterView>`, el marco dentro de un modal y los dos marcos de un `<RouterSplitView>`. La coincidencia, guards, los resultados y la conciliación se encuentran en el enrutador una vez; La presentación, los gestos y los identificadores nativos viven en el host. El contrato es experimental y está documentado en [hosts nativos](./native-hosts).

## Donde habla con la plataforma {#where-it-talks-to-the-platform}

- **Android botón de retroceso**: `activityBackPressed`, cancelado y convertido en `router.back()`, así que deja que guards tenga voz y voto. En Android 14 y posteriores, un `OnBackPressedCallback` por encima del núcleo sigue el deslizamiento predictivo y entrega su progreso a `useBackGesture()`.
- **iOS deslizar hacia atrás**: `enableSwipeBackNavigation` apagado mientras un guard de salida está activo.
- **iOS botón de retroceso**: `UINavigationItem.backAction` (iOS 16) mientras está activo un salir de guard.
- **Modals**: `modalInPresentation` mientras un guard de salida está activo, y un delegado frente al núcleo escucha un deslizamiento retenido.
- **Tabs**: un delegado frente a la barra de pestañas en iOS, toca a los oyentes en la tira de pestañas en Android, para escuchar un toque en la pestaña seleccionada.

## Pruebas {#tests}

Las pruebas se ejecutan contra un sustituto del `Frame` de NativeScript ([`test/shims/core.ts`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/shims/core.ts)). Sigue el orden real: las navegaciones finalizan en un tic posterior y las páginas descartadas se eliminan antes de que se active `navigatedTo`. Las piezas de arriba que tocan la plataforma se pasan a través de pequeñas costuras que la cuña puede llamar y se revisan en los dispositivos uno por uno.

Lo que el shim no puede ver se ejecuta en un emulador Android real: [`scripts/native/smoke-android.sh`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/scripts/native/smoke-android.sh) instala la demostración y la conduce a través de `adb`, verifica los enlaces del sistema operativo en un inicio en frío y en caliente, el estado de la página después de una finalización genuina del proceso, el Material bottom sheet, pantalla de inicio accesos directos, el drawer y viceversa, y los tiempos propios del enrutador desde su diagnóstico contra [`scripts/native/baselines.json`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/scripts/native/baselines.json). `npm run test:native:android` lo ejecuta en un dispositivo conectado después de `ns build android`; el flujo de trabajo `Native` lo ejecuta en un emulador semanalmente, bajo demanda y cuando la propia suite cambia. Los informes de validación [informe de validación](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-validation.md) registran los pases manuales que quedan.

## Listado y detalle {#list-and-detail}

`RouterSplitView` mantiene dos fotogramas en un `GridLayout` nativo: uno para la lista fijada y otro para detalles. El enrutador los combina en un stack lógico y omite la raíz transparente interna del detalle. Los cambios de ancho reorganizan los marcos sin transferir páginas entre ellos. No utiliza `UISplitViewController` ni implementa un drawer.

## Actualizaciones de desarrollo {#development-updates}

El contenedor reenvía recargas de componentes enrutados a NativeScript-Vue para el reemplazo nativo de Page. Una página cubierta espera el `navigatedTo` del Frame y el siguiente tick del Vue antes de recargarse. Ver [HMR](./pages#hmr-during-development).

Las comprobaciones nativas y sus entornos se registran en el informe de validación [informe de validación](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-validation.md), complementando las pruebas de shim.
