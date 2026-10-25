# Salpicadura encima de la primera página {#splash-above-the-first-page}

Mantenga un inicio de inicio encima de `<RouterView>` para que la primera página nativa pueda montarse debajo de él. Al eliminar la superposición se muestra esa misma página, sin agregar una entrada de bienvenida al historial de navegación.

Si el Splash es una ruta, llamar a `replace()` crea el destino cuando el Splash sale. En Android, ese trabajo puede competir con la animación de salida en el hilo de la interfaz de usuario. Una superposición permite que la creación de la página finalice antes de que comience la animación de salida; no saca el trabajo de inicialización del subproceso de la interfaz de usuario.

## Mantener RouterView montado {#keep-routerview-mounted}

Después de la instalación normal del enrutador [Instalar y abrir una página](./install), guarde esto como `App.vue` y el siguiente componente como `Splash.vue` en el mismo directorio:

<<< ../../snippets/SplashApp.vue

Ambos niños ocupan la misma celda `GridLayout`. El chapoteo viene al final, encima del enrutador. El contenedor mantiene la página cubierta fuera de la interacción táctil y la accesibilidad transversal hasta que se elimina la presentación.

Solo la superposición tiene `v-if`. No coloque `<RouterView>` detrás de `v-if="!showSplash"`: eso pospondría la creación de la página hasta que desaparezca el mensaje. Tampoco espere a `router.isReady()` antes que a `createApp(App).use(router).start()`: el enrutador necesita su vista para montarse primero.

## Revelar la página {#reveal-the-page}

Este componente espera la navegación inicial, desvanece la superposición y emite `done`. Permanece visible con un mensaje de error si la inicialización arroja o el guard inicial no deja destino:

<<< ../../snippets/Splash.vue

El desvanecimiento es una animación de la aplicación. Vincule `:fade="false"` cuando la preferencia de movimiento reducido de su aplicación esté habilitada; La política de movimiento [del enrutador](./accessibility#reduced-motion) controla las transiciones enrutadas, no esta animación personalizada.

`isReady()` espera la navegación inicial, no todas las pestañas ocultas o las solicitudes de la propia red de la página. Agregue cualquier inicialización de aplicación requerida a la condición de preparación. Para la incorporación, emita `done` cuando el usuario complete la incorporación; mantenga el `<RouterView>` montado en todo momento.

## Coincide con la pantalla de inicio de iOS {#match-the-ios-launch-screen}

Configure `iosOverflowSafeArea="true"` en el diseño raíz de la superposición para que su fondo se extienda más allá del área segura. Utilice el mismo fondo, diseño, tamaño y posición que `App_Resources/iOS/LaunchScreen.storyboard` para evitar un salto visible cuando iOS pase el control a la aplicación en ejecución. Verifique la alineación en los tamaños iPhone y iPad que admite.

Esta superposición aparece después de que se inicia NativeScript. Complementa la pantalla de inicio del sistema operativo; no puede reemplazar la pantalla que se muestra antes de que se ejecute JavaScript. `iosOverflowSafeArea` es específico de iOS.

## Los guardias todavía corren debajo {#guards-still-run-underneath}

La navegación inicial, las redirecciones y [guards](./guards) se ejecutan como de costumbre mientras el mensaje de bienvenida está visible. Oculta la página visualmente; no retrasa la autenticación ni omite guards. Redirigir una visita inicial no autenticada a una página de inicio de sesión utilizable. Un chapoteo no es un límite de control de acceso.

No se necesita ningún cambio de API del enrutador, se necesita ruta adicional, `push()` o `replace()` para eliminar la superposición. Back regresa al historial real de la aplicación y no muestra el mensaje.
