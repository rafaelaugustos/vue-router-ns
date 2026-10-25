# Selectores de sistema y flujos nativos {#system-pickers-and-native-flows}

Algunos destinos no son páginas: el selector de documentos, la actividad de otra aplicación, una hoja para compartir. El sistema los posee, pueden sobrevivir a una rotación de pantalla y nada de ellos pertenece a la parte posterior stack. Un flujo nativo les proporciona una entrada escrita, un resultado escrito y uno de tres resultados, liquidados exactamente una vez.

<Clip name="ios-document-picker" caption="Adjuntar abre el selector de documentos iOS. Al cancelar se regresa al formulario con Picker cancelado, sin agregar una ruta." />

```ts
import { createDocumentPicker, useNativeFlow } from 'vue-router-ns'

const picker = useNativeFlow(createDocumentPicker())

async function attach() {
  const outcome = await picker.run({
    types: ['application/pdf', 'image/*'],
    multiple: true,
  })
  if (outcome.status === 'completed') attachments.value = outcome.value.uris
}
```

`run` se resuelve con `{ status: 'completed', value }`, `{ status: 'cancelled', reason }` o `{ status: 'failed', error }`. Los motivos: `'user'` cuando se descartó la interfaz de usuario del sistema, `'guard'` cuando la opción `before` dijo que no, `'replaced'` cuando la misma página volvió a ejecutar el flujo y `'disposed'` cuando la página abandonó su stack primero, en cuyo caso se descarta un resultado que llega más tarde. `running` es un ref que es `true` desde el lanzamiento hasta el desenlace. La página que inició el flujo permanece activa y no ingresa nada en el historial: `onPageDeactivated` no se activa para la interfaz de usuario del sistema que el enrutador no posee.

Ejecutar comprobaciones antes del lanzamiento, no después: `picker.run(input, { before: () => session.user !== '' })` cancela con `'guard'` en lugar de intentar interceptar un despido que el sistema no anuncia.

## El selector de documentos {#the-document-picker}

`createDocumentPicker()` abre `ACTION_OPEN_DOCUMENT` a través del registro de resultados de actividad AndroidX de la página de origen, o `UIDocumentPickerViewController` desde el propio controlador de esa página en iOS 14 y versiones posteriores. Se requiere una página montada. `types` acepta tipos MIME, incluidos `image/*`, `audio/*`, `video/*`, `text/*` y `*/*`; `multiple` permite varios documentos.

Los resultados contienen cadenas URI: `content://` en Android y `file://` en iOS. Un URI no es una ruta del sistema de archivos ni una concesión de acceso permanente. La lectura/copia de datos, los permisos de URI persistentes Android y los marcadores/acceso URL con ámbito de seguridad de iOS pertenecen a la aplicación. Utilice un adaptador personalizado cuando necesite los objetos de resultados nativos originales para administrar ese acceso.

Los controladores separados pueden funcionar de forma independiente en Android. UIKit tiene una ranura de presentación por ventana: un segundo selector de documentos simultáneo se resuelve como `failed`, en lugar de dejar un Promise pendiente. Esperar el despido antes de presentar otro controlador. Una invocación más nueva en el mismo identificador reemplaza el intento anterior; El guards asíncrono no puede iniciar una invocación anterior sobre una más nueva.

## Escribiendo un flujo {#writing-a-flow}

Un flujo tiene un `kind`, opcional `supported()` y `start(input, context)`. El contexto proporciona el `page` de origen, la correlación `id`, `complete`, `cancel` y `fail`. Devuelve una función de limpieza de `start`: se ejecuta en **Ecada terminal result**, incluido el éxito, la cancelación, el error y la eliminación. Libere a los delegados/oyentes y descarte la interfaz de usuario nativa propia allí.

En Android, llame a `context.launchActivity(intent, (resultCode, intent) => { ... })`. Se registra en el registro AndroidX de la actividad de origen, se inicia una vez y elimina el registro cuando se estabiliza el flujo. Analice el resultado nativo y llame a `complete`, `cancel` o `fail`. Las excepciones del analizador se convierten en resultados fallidos. El registro no utiliza una actividad de primer plano seleccionada globalmente.

`requestCode` y `onActivityResult(handler)` permanecen para adaptadores heredados. Su rango numérico reservado no es garantía contra complementos no relacionados que utilicen los mismos códigos; Los nuevos adaptadores deben utilizar `launchActivity`.

```ts
const share: NativeFlow<string, void> = {
  kind: 'share',
  start(text, context) {
    const controller =
      UIActivityViewController.alloc().initWithActivityItemsApplicationActivities(
        [text],
        null,
      )
    controller.completionWithItemsHandler = (_, completed) =>
      completed ? context.complete() : context.cancel()
    context.page?.ios.presentViewControllerAnimatedCompletion(controller, true, null)
  },
}
```

## Rotación y terminación del proceso. {#rotation-and-process-death}

El adaptador AndroidX almacena la clave de registro del intento en el estado de instancia guardada de la Actividad y vuelve a vincular esa clave después de la recreación **mientras la página de origen y el intento JavaScript permanecen activos**. No inicia la actividad externa dos veces. La destrucción del propietario sin cambio de configuración se cancela con `disposed`.

La ciclo de vida de Page tiene prioridad. El enrutador retiene las aplicaciones de la página Frame durante `Activity.recreate()`, lo que permite que el flujo pendiente se vuelva a vincular a la Actividad de reemplazo y reciba su resultado una vez. Eliminar la ruta o cerrar permanentemente a su propietario aún cancela con `cancelled/disposed`; un resultado tardío no puede resolver ese intento nuevamente ni completar uno nuevo.

Ningún Promise sobrevive a la terminación del proceso. Mantenga un marcador de "selector estaba abierto" propiedad de la aplicación en [estado de página](./restore#page-state) o almacenamiento de aplicaciones, luego decida si desea volver a intentarlo o recuperar el acceso previamente otorgado después del reinicio. El enrutador no reproduce un resultado antiguo en un flujo nuevo. Al persistir un marcador, no se conserva el permiso del documento en sí.

`useNativeFlow` descarta intentos con su página. Las personas que llaman al `startNativeFlow` de nivel inferior deben llamar al `dispose()` devuelto cuando su propietario cierra. La interfaz de usuario del sistema no crea una entrada de enrutador ni activa la desactivación de la página del enrutador; Los eventos normales de fondo/primer plano de la plataforma aún se aplican.
