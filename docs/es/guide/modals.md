# Modales y resultados {#modals-and-results}

Marcar una ruta con `modal: true`, o pasar `ModalOptions` (`fullscreen`, `animated`, `cancelable`, `ios.presentationStyle`…):

```ts
{ path: '/compose', component: Compose, modal: { fullscreen: true } }
```

<div class="clips">
<Clip name="ios-sheet" caption="Componga aperturas en una hoja nativa con retenes medianos y grandes. Simulador iOS 26." />
<Clip name="android-sheet" aspect="9 / 20" caption="Redactar se abre en un Material bottom sheet; El sistema Back lo descarta. Emulador Android 16." />
</div>

`router.push('/compose')` lo presenta dentro de su propio marco, por lo que tiene una ActionBar y su propio stack. Las páginas interiores se empujan dentro del modal. `router.back()` desde la primera página del modal lo cierra. Deslizándolo hacia abajo, tocando afuera o presionando el botón Android atrás, se cierra también, a través de la salida guards de sus páginas. El enrutador sigue y ejecuta `afterEach`.

`push` también toma como opción `modal`, para presentar modalmente cualquier ruta sin importar lo que diga su registro.

## Hojas en iOS {#sheets-on-ios}

Las hojas iOS pueden detenerse a media altura, a altura completa o en una fracción de la pantalla, mostrar un capturador y mantener la página detrás utilizable, como Mapas. Establezca eso en `ios` de las opciones modales:

```ts
{
  path: '/filters',
  component: Filters,
  modal: {
    ios: {
      detents: ['medium', 'large'], // or a fraction of the screen: 0.4 (iOS 16)
      selectedDetent: 'medium', // the height it opens at
      largestUndimmedDetent: 'medium', // the page behind stays usable up to here
      grabber: true,
      cornerRadius: 24,
    },
  },
}
```

La hoja se configura antes de ser presentada, por lo que se abre a la altura adecuada. `push` puede pasar las mismas opciones en `modal.ios`, fusionadas con las del registro. Android los ignora; tiene [bottom sheets](#bottom-sheets-on-android) propio.

## Sábanas inferiores en Android {#bottom-sheets-on-android}

Android no tiene retenes. En cambio, el bottom sheet de Material tiene estados de reposo: colapsado a una altura mínima, expandido a la mitad en una parte de la pantalla o expandido a su contenido. Configure `sheet` en `android` de las opciones modales para presentar la ruta en una, con `true` para los valores predeterminados de Material:

```ts
{
  path: '/filters',
  component: Filters,
  modal: {
    ios: { detents: ['medium', 'large'] },
    android: {
      sheet: {
        peekHeight: 320, // the collapsed height, in device-independent pixels
        state: 'expanded', // or 'collapsed' (the default) or 'halfExpanded'
        fitToContents: false, // needed for the half-expanded state
        halfExpandedRatio: 0.6,
        skipCollapsed: true, // hiding from expanded skips the collapsed stop
        height: 520, // the content's height; by default, as tall as the content
      },
    },
  },
}
```

La ruta aún tiene su propio Frame, por lo que las páginas se insertan dentro de la hoja, `pushForResult()` funciona y `router.back()` en su primera página la cierra. Arrastrando la hoja, golpeando hacia afuera o presionando hacia atrás se cierra por la hoja guards: mientras un guard está activo la hoja no se puede arrastrar, y un golpe afuera o hacia atrás pide el guard. El material no tiene devolución de llamada para rechazar un gesto de ocultar: una hoja retenida aún puede colapsar, pero no puede arrastrarse a su estado oculto. `cancelable: false` evita que el usuario lo cierre. `push` fusiona su `modal.android.sheet` con el del disco, como `ios`.

Utilice un `ScrollView` nativo para contenido de hojas largas. El `height` de la hoja limita su área visible y el desplazamiento anidado nativo permite que su contenido se desplace dentro de ella. Back primero descarta un teclado abierto antes de actuar sobre el historial de la hoja.

La hoja utiliza el manejo Back del enrutador para que guards se ejecute antes del despido. La animación interactiva de la hoja posterior predictiva del material no es compatible. Consulte el informe de validación nativo [informe de validación](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-bottom-sheets.md) para conocer el comportamiento comprobado y los límites de la plataforma.

Dentro de sus páginas, `useNativeHost()` reporta `kind: 'bottom-sheet'`, y `native` es el Frame.

::: warning Agregar material para lanzar versiones
El tiempo de ejecución NativeScript Android solo incluye `com.google.android.material` en compilaciones de depuración. Agréguelo a `App_Resources/Android/app.gradle` antes de enviar una hoja:

```groovy
dependencies {
  implementation "com.google.android.material:material:1.12.0"
}
```

Sin él, `push` rechaza con un error que lo dice en lugar de presentar un diálogo simple. `supportsBottomSheets()` te lo indica en tiempo de ejecución.
:::

## Obteniendo un resultado {#getting-a-result-back}

<Clip name="ios-modal-result" caption="Responder abre el modal; Enviar devuelve el texto al mensaje de origen a través de pushForResult. Simulador iOS 26." />

Una página puede devolver un valor a quien la abrió. Esto funciona con modales y con páginas simples:

```ts
// Message.vue
const reply = await router.pushForResult<string>('/compose')
if (reply) send(reply)
```

```ts
// Compose.vue
router.back({ result: text.value })
```

Si la página se cierra de cualquier otra manera (deslizando el dedo, el botón Atrás) o un guard impide que se abra, la promesa se resuelve con `undefined`.

## Versiones de despido y plataforma {#dismissal-and-platform-versions}

`cancelable: false` evita el despido del usuario (como Android nuevamente en la raíz modal); El código aún puede llamar a `router.back()`, a través de guards. Una página encima de la raíz modal aún puede retroceder dentro de ese stack.

Las hojas con alturas `'medium'` y `'large'` requieren iOS 15+; las alturas fraccionarias requieren iOS 16+. La presentación debe soportar hojas. Android ignora las opciones de `ios` y iOS ignora las de `android`. `pushForResult<T>()` no valida el resultado en tiempo de ejecución: `T` describe el contrato entre las páginas.
