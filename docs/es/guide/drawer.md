# Nativo drawer {#native-drawer}

Consulte [Capacidades nativas y opciones de contenedor](./capabilities) para conocer la propiedad, los límites de la plataforma y la distinción rc.2/rc.3.

`<RouterDrawer>` coloca un menú de inicio alrededor dlos stacks nativos existente. Android utiliza AndroidX `DrawerLayout`; iOS utiliza vistas, gestos panorámicos y animaciones de UIKit. Ambos mantienen el contenido y los slots drawer montados sin añadir rutas.

::: info Agregado en rc.3
La implementación de iOS y la presentación adaptativa son parte de `0.1.0-rc.3`. El modelo `0.1.0-rc.2` anterior admite la superposición drawer únicamente en Android.
:::

La misma plantilla funciona en ambas plataformas:

```vue
<RouterDrawer ref="drawer" :width="280">
  <template #drawer>
    <StackLayout class="menu">
      <Button text="Inbox" @tap="router.openLink('/')" />
      <Button text="Settings" @tap="router.openLink('/settings')" />
      <Button text="Account" @tap="router.openLink('/settings/account')" />
    </StackLayout>
  </template>

  <RouterTabs>
    <RouterTab name="inbox" title="Inbox" icon="tray.fill">
      <RouterView name="inbox" />
    </RouterTab>
    <RouterTab name="settings" title="Settings" icon="gearshape.fill">
      <RouterView name="settings" initial="/settings" />
    </RouterTab>
  </RouterTabs>
</RouterDrawer>
```

<Clip name="android-drawer" aspect="9 / 20" caption="El drawer abre Configuración; El sistema Back cierra el drawer antes de abrir una página. Emulador Android 16." />

La ranura predeterminada es el contenido: un `<RouterTabs>`, un `<TabView>`, un `<RouterView>` o un `<RouterSplitView>`. La ranura `drawer` es el panel. Abrir o cerrar el menú no es una navegación y no crea ninguna entrada de ruta; los destinos son aquello a lo que navega el panel y cada uno mantiene su propio nombre stack. Tomar destinos a través de `openLink` permite que la política `links.frame` seleccione la pestaña así como stack. Resalte el destino actual de `router.currentRoute`.

El drawer no restablece el historial de un destino cuando se selecciona nuevamente. Su botón decide la acción: navegar con `openLink` o `push`, o regresar explícitamente a la raíz de un stack con `router.backToRoot({ frame: 'inbox' })`. Al seleccionar una ruta ya actual se cierra el panel. `backToRootOnReselect` en un `RouterView` se aplica al evento de reselección de su pestaña, no a botones drawer arbitrarios.

## Abrir, cerrar, volver {#open-close-back}

- `drawer.open()`, `drawer.close()`, `drawer.toggle()` y `drawer.isOpen` en el ref del componente; Los eventos `v-model:open` y `opened` y `closed` siguen el estado nativo, por lo que un deslizamiento desde el borde también los actualiza.
- El botón Atrás de Android y el deslizamiento hacia atrás en Android 14 y posteriores, cierran un drawer abierto antes de que aparezca cualquier página. Esto pasa por `router.claimSystemBack()`, que cualquier contenedor nativo puede usar: `claimSystemBack({ owns: () => isOpen, back: close })` devuelve lo que libera el reclamo.
- Una navegación exitosa cierra el drawer, a menos que `closeOnNavigate` sea `false`. Un guard que rechaza la navegación la deja abierta.
- Un modal o bottom sheet por encima del drawer recibe primero el Back, incluyendo su salida guards y el resultado. Si mantiene abierto el drawer con `:closeOnNavigate="false"`, Back vuelve a ese drawer después de descartar el modal.

## Presentación adaptativa {#adaptive-presentation}

Inscríbase con `presentation="auto"`. El drawer mide su propio ancho disponible , por lo que la rotación, un padre más estrecho y el cambio de tamaño de la ventana pueden cambiar la presentación sin reemplazar el componente, sus dos ranuras, marcos, páginas o instancias de Vue.

```vue
<RouterDrawer
  ref="drawer"
  presentation="auto"
  :breakpoint="840"
  :width="280"
  v-model:open="menuOpen"
  @presentationChange="mode = $event"
>
  <template #drawer><!-- Destination buttons --></template>
  <RouterView />
</RouterDrawer>
```

| API                   | Comportamiento                                                                                                                                                                         |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `presentation`        | `overlay` (predeterminado), `permanent` o `auto`.                                                                                                                                      |
| `breakpoint`          | Ancho mínimo del contenedor para presentación permanente automática; predeterminado 840 DIP. Sin detección de modelo de dispositivo.                                                   |
| `width`               | Ancho de panel solicitado. La presentación permanente lo tapa a la mitad del envase, excepto cuando un pliegue vertical separador determine las dos regiones.                          |
| `foldAware`           | Predeterminado `true`. Utiliza la integración opcional existente de WindowManager AndroidX en modo permanente. Sin esa dependencia, la adaptación basada en el ancho todavía funciona. |
| `drawer.presentation` | Solo lectura resuelto `overlay` o `permanent`.                                                                                                                                         |
| `presentationChange`  | Emite el modo resuelto cuando cambia. El primer diseño medido puede resolver `auto`; lea el identificador del modo actual.                                                             |

`open`, `drawer.isOpen`, `opened` y `closed` describen **overlay**. Un panel permanente permanece visible con `isOpen=false`: `open()`, `close()` y `toggle()` no lo cambian, y un intento de `v-model:open=true` se normaliza a `false`. No tiene malla ni resistencia drawer, no reclama el sistema Back y `closeOnNavigate` no lo oculta. Tanto el menú como el contenido permanecen disponibles para el tacto y la accesibilidad transversal.

Al ingresar al modo permanente se cancela una animación/gesto drawer en vuelo y se normaliza el modelo. Una superposición abierta previamente establecida emite `closed` una vez; una apertura que nunca se estableció no emite ningún retraso `opened`. El regreso a la superposición comienza cerrado, con su panel oculto excluido de la accesibilidad. Los cambios de modo no navegan, ejecutan guards, descartan modos de ruta ni liquidan resultados de ruta pendientes. En iOS, el cambio de modo es inmediato, incluso con Reducir movimiento; las animaciones superpuestas ordinarias conservan su política existente.

Con la [dependencia opcional para dispositivos plegables](./split-view#android-foldable-layouts), una separación vertical sitúa el panel permanente en la región del lado inicial y el contenido en la otra, excluyendo la bisagra. Una bisagra horizontal mantiene ambos elementos juntos en la región utilizable más grande. `foldAware=false` desactiva este comportamiento. La geometría del pliegue no fuerza `auto` por debajo de su punto de ruptura; la superposición conserva el comportamiento del drawer sobre el contenedor completo. Usa el modo permanente si necesitas separar la navegación y el contenido mediante la bisagra por debajo de ese umbral.

Mantenga un `RouterDrawer` montado al realizar la adaptación. No cambie entre dos árboles `RouterView` con clave con `v-if`. Un drawer agrega un menú alrededor del stacks existente; [`RouterTabs sidebar`](./tabs) solicita a UIKit que presente los destinos de sus pestañas como una barra lateral iPad, y [`RouterSplitView`](./split-view) posee una disposición de navegación de lista/detalle. Un drawer permanente es un menú persistente personalizado en iOS, no en la barra lateral de pestañas de `UISplitViewController` o UIKit. `RouterUIKitSplitView` todavía posee la raíz de la ventana y este componente no puede incluirlo.

<Clip name="adaptive-drawer" aspect="834 / 1210" caption="Entrada real iPad: modos superpuestos y permanentes, borrador retenido y pestañas, RTL y un resultado modal." />

Ejecute `ns run ios --env.adaptivedrawerTest` o `ns run android --env.adaptivedrawerTest` desde `demo` después de compilar el paquete. El informe de aceptación [informe de validación](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-drawer-adaptive.md) distingue las verificaciones de estado/entrada nativas automatizadas de las excelentes verificaciones de lectores de pantalla hablados y de múltiples ventanas reales.

## Rotación durante la navegación {#rotation-during-navigation}

En el simulador con iPadOS 18.6, las solicitudes de orientación durante un push animado, una vuelta programática o un gesto interactivo de volver produjeron una **rotación visual después de finalizar la navegación**. Las páginas probadas, las instancias de Vue, los borradores y los historiales nativo y lógico se conservaron en esa secuencia; una vuelta confirmada eliminó su página una sola vez, mientras que un gesto cancelado la mantuvo. Esto demuestra la conservación del estado ante una solicitud de rotación durante la navegación, sin garantizar que UIKit ejecute ambas animaciones simultáneamente.

En iPadOS 26.0, el mismo entorno de prueba también conservó un estado coherente cuando UIKit canceló el gesto largo que pretendía confirmar la vuelta. Respeta el resultado nativo de confirmación o cancelación; no supongas que el gesto continuará sin cambios durante la rotación.

El deslizamiento desde el borde del contenido de la barra lateral permanente no inició una navegación interactiva con el controlador de pruebas actual. Esa dirección sigue siendo una carencia explícita de cobertura. Esta ejecución no valida iPads físicos ni Stage Manager. Consulta el [informe de aceptación de la rotación](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-drawer-rotation.md) para conocer los escenarios, la secuencia observada y los límites pendientes.

## Estilismos y plataformas {#styling-and-platforms}

El panel es un `GridLayout` con la clase `router-drawer` y fondo blanco; Dale a la raíz de tu slot su propio fondo y relleno. `width` está en píxeles independientes del dispositivo. `DrawerLayout` viene con AppCompat, por lo que no se agrega nada a la compilación; el Material opcional `NavigationView` no se utiliza, sus propias vistas son el menú.

El pequeño host nativo se encuentra en este paquete y utiliza las dependencias AndroidX que ya se incluyen con el tiempo de ejecución NativeScript. No requiere un complemento drawer por separado ni un parche principal. Consulte el informe de validación nativo [informe de validación](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-drawer.md) para conocer el Android probado y las versiones de dependencia.

En el modo de superposición en iOS, el panel cubre el contenido de iPhone y iPad. Su ancho está limitado para dejar una franja de 44 puntos para el despido cuando la ventana es estrecha. En modo permanente, las mismas vistas UIKit se colocan una al lado de la otra. En Android, el mismo host AndroidX presenta dos contenidos secundarios en modo permanente; no deja un modal drawer bloqueado abierto sobre el contenido.

`RouterUIKitSplitView` debe ser dueño de la raíz de la ventana: no la coloque dentro de un drawer. `RouterSplitView`, que compone Frame stacks, puede ser contenido de drawer. Consulte [navegación dividida](./split-view).

### iOS gestos y accesibilidad {#ios-gestures-and-accessibility}

- En una raíz stack, arrastre hacia adentro desde los primeros 24 puntos del borde inicial para abrir. Arrastra el panel abierto o toca la tela para cerrar. Un arrastre invertido o interrumpido se establece en un estado abierto/cerrado constante.
- En una página enviada, el borde pertenece al Back interactivo de UIKit. Una salida activa guard puede desactivar ese gesto, como se describe en [guards](./guards). El drawer no reemplaza al delegado del controlador de navegación ni pasa por alto el guard. Mantenga disponible un botón de menú de ActionBar.
- La apertura descarta el teclado, aísla el contenido cubierto del recorrido de VoiceOver y solicita el foco en el panel. Al cerrar se restaura el objetivo de enfoque anterior si aún está adjunto. Accesibilidad Escape cierra el panel. Reducir movimiento omite la animación de deslizamiento.
- Un modal nativo presentado permanece por encima del drawer. `closeOnNavigate=false` deja el drawer en su lugar al regresar de ese modal.
- `opened`/`closed` y `v-model:open` reflejan estados establecidos, no un progreso de arrastre intermedio. El cambio de tamaño conserva el contenido y su stacks nativo.

El informe de validación [iOS](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-drawer-ios.md) separa las comprobaciones automatizadas del estado de accesibilidad de las comprobaciones manuales de VoiceOver.

### Ejemplo de aceptación ejecutable {#runnable-acceptance-example}

[`demo/src/testing/drawer-app.ts`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/testing/drawer-app.ts) incluye la configuración del enrutador, tres pestañas independientes, botones de menú, un borrador editable, guards condicional y resultados modales. Siga la configuración de demostración [código del ejemplo](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/README.md), cree el paquete y luego ejecute `ns run ios --env.drawerTest` o `ns run android --env.drawerTest` desde `demo`.

<Clip name="ios-drawer" aspect="393 / 852" caption="Nativo iOS drawer: gestos, retenidos stacks, guards y un resultado modal. Simulador iPhone." />

## Dirección, entrada y accesibilidad {#direction-input-and-accessibility}

El panel se abre desde el borde inicial: izquierda en LTR, derecha en RTL. iOS sigue la dirección de diseño efectiva de UIKit; Android utiliza `START`. Para obtener dirección automática desde el idioma del sistema, habilite [`android:supportsRtl="true"`](https://developer.android.com/guide/topics/manifest/application-element#rtl) en el `<application>` de su aplicación en `App_Resources/Android/src/main/AndroidManifest.xml`. También puede configurar `direction="rtl"` en el drawer explícitamente. La rotación mantiene el mismo contenedor nativo y las páginas montadas.

`direction` acepta `ltr` o `rtl`; omitiéndolo sigue la plataforma. En iOS, el accesorio establece la dirección semántica del contenedor y permite que UIKit la herede, manteniendo intacta la configuración de gestos de las vistas de navegación nativas.

Mantenga un botón ActionBar para abrir el drawer. Con la navegación por gestos Android, el sistema puede consumir el deslizamiento desde el borde como Back; el botón permanece disponible. Back cierra el panel cuando se confirma el gesto; no muestra una vista previa ni muestra una página detrás del drawer.

`DrawerLayout` oculta el contenido cubierto del recorrido de accesibilidad mientras está abierto. El contenido del menú pertenece a la aplicación: prefiera destinos nativos `Button`, asigne a cada uno una etiqueta clara y exponga el destino actual con `accessibilityState="selected"`. Un diseño personalizado con solo un controlador de toque también necesita activación de teclado y accesibilidad; etiquetarlo por sí solo no proporciona esas acciones.
