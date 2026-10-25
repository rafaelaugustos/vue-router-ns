# Destinos nativos (experimental) {#native-destinations-experimental}

`defineNativeDestination()` permite que una ruta muestre un UIKit `UIViewController` o AndroidX `Fragment` existente. Úselo como `component` de la ruta. La navegación todavía utiliza marcos nativos, páginas y el historial existente del enrutador, guards y resultados.

El enrutador posee un Page que contiene y el controlador/fragmento secundario. Su SDK posee la interfaz de usuario de la pantalla. Esto es diferente de un flujo nativo [Selectores de sistema y flujos nativos](./native-flows): un destino ocupa una entrada del historial; un selector de sistema no lo hace.

## Definir un destino {#define-a-destination}

```ts
import { defineNativeDestination, createRouter } from 'vue-router-ns'

const Editor = defineNativeDestination<{ documentId: string }, { saved: boolean }>({
  id: 'vendor.document-editor',
  input: (route) => ({ documentId: String(route.params.id) }),
  ios(context) {
    const editor = makeUIKitEditor(context.input.documentId)
    editor.onSave = () => context.complete({ saved: true })
    editor.onCancel = () => context.cancel()
    return {
      native: editor,
      dispose() {
        editor.onSave = null
        editor.onCancel = null
      },
    }
  },
  android(context) {
    const editor = makeAndroidXEditor(context.input.documentId)
    editor.setOnSave(() => context.complete({ saved: true }))
    editor.setOnCancel(() => context.cancel())
    return {
      native: editor,
      dispose() {
        editor.setOnSave(null)
        editor.setOnCancel(null)
      },
    }
  },
})

const router = createRouter({
  routes: [
    { path: '/', component: Home },
    {
      path: '/documents/:id',
      name: 'document-editor',
      component: Editor,
      meta: { layout: false },
    },
  ],
})

const result = await router.pushForResult<{ saved: boolean }>({
  name: 'document-editor',
  params: { id: '42' },
})
```

`makeUIKitEditor` y `makeAndroidXEditor` anteriores representan las fábricas de su SDK, no las exportaciones de enrutadores. Cada llamada debe devolver un objeto nativo nuevo y sin parentesco de forma sincrónica. Una fábrica de plataformas omitida produce un claro error de navegación antes de entrar en esa ruta.

El asignador de entrada también recibe accesorios de ruta como segundo argumento. El contexto proporciona `route`, `input` y un captador `page`. `page` pasa a estar disponible después del montaje y se convierte en `null` después de su eliminación. Presente cuadros de diálogo de SDK adicionales desde el controlador o Actividad de ese Page para preservar la propiedad de la ventana.

Los destinos nativos poseen su Page y no pueden usar un diseño Vue con nombre. Configure `meta.layout: false` cuando el enrutador tenga un diseño predeterminado. Los modales a nivel de ruta también funcionan.

## Resultados, guards y eliminación externa {#results-guards-and-external-removal}

| Operación                                        | Comportamiento                                                                                                                    |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `context.complete(value)`                        | Solicita al enrutador que regrese con un resultado tipado; se resuelve con un fallo de navegación si un guard lo bloquea.         |
| `context.cancel()`                               | Solicita la devolución del enrutador sin obtener resultado; ejecuta guards.                                                       |
| `context.beforeLeave(guard)`                     | Registra un guard de salida; devuelve una función para cancelar el registro.                                                      |
| UIKit navegación emergente / Android Page atrás  | La conciliación del host existente elimina la entrada del historial y liquida su resultado pendiente.                             |
| SDK elimina su fragmento Android                 | El oyente secundario FragmentManager observa la eliminación y concilia el Page.                                                   |
| SDK elimina su hijo UIKit de forma independiente | Llame a `context.dismissed()` desde la devolución de llamada de eliminación del SDK después de las confirmaciones de eliminación. |

`dismissed()` informa de un cambio irreversible. **No** ejecuta guards de salida ni puede deshacer un cierre ya completado por el SDK. Si el SDK permite interceptar una solicitud de cierre, llama y espera a `cancel()` o `complete()` **antes de** que retire su interfaz.

El pop interactivo de UIKit está deshabilitado mientras una entrada tiene un guard de salida activo, al igual que para las páginas Vue. Las llamadas directas arbitrarias del SDK a `popViewController` no se pueden vetar después de que UIKit las confirme. Este adaptador no reemplaza a los delegados del SDK ni intercepta globalmente los métodos UIKit.

Las devoluciones de llamada de finalización/cancelación de entradas que ya se han cerrado o que están debajo de otra entrada no hacen nada. Un destino raíz no tiene una página anterior a la que regresar; `dismissed()` rechaza un intento de eliminar una raíz no modal. Utilice una página de inicio Vue o un modal cuando la pantalla deba cerrarse.

## Propiedad y restauración {#ownership-and-restoration}

El adaptador iOS realiza la contención del controlador hijo en el controlador Page. El adaptador Android utiliza el FragmentManager **child** del fragmento Page propietario; no agrega transacciones del SDK a la navegación de la Actividad hacia atrás stack.

Las fábricas pueden ejecutarse nuevamente cuando NativeScript reconstruya una vista nativa. `dispose()` se ejecuta una vez por instancia de fábrica después de desconectarla. Libera allí los listeners, las suscripciones y las referencias de la aplicación al SDK. Mantenga el estado de la aplicación serializable fuera de la instancia nativa; nunca reutilice un controlador o fragmento desechado.

La restauración del historial [existente](./restore) recrea la ruta e invoca su fábrica registrada con entrada reconstruida. Mantenga estables la identidad/ruta de ruta y el `id` de fábrica, y migre las rutas guardadas al cambiarles el nombre. No se serializa ningún controlador, fragmento, devolución de llamada o resultado pendiente Promise. Esto no promete la recuperación automática del estado de la interfaz de usuario privada de un SDK ni la restauración de escenas de ventanas múltiples.

## Dependencias nativas y ejemplos {#native-dependencies-and-examples}

El enrutador no incluye un SDK de proveedor. Agregue sus dependencias nativas a su aplicación. Un SwiftUI `UIHostingController`, un puente Compose o un SDK con API no disponibles para el puente NativeScript pueden necesitar un contenedor Swift/Kotlin compilado. Los ejemplos de este prototipo utilizan UIKit y AndroidX directamente.

El dispositivo de aceptación [ejecutable](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/testing/destinations-app.ts) contiene fábricas nativas, botones, cancelación y devoluciones de llamadas de despido de SDK. Constrúyalo con `ns build ios --emulator --env.destinationsTest` o `ns build android --env.destinationsTest` desde `demo` después de compilar el paquete.

La contención sigue el contrato de controlador hijo de [UIKit](https://developer.apple.com/documentation/uikit/creating-a-custom-container-view-controller) y [AndroidX Transacciones de fragmentos](https://developer.android.com/guide/fragments/transactions). El informe de validación nativo [informe de validación](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-destinations.md) registra las versiones y los límites de la plataforma probada.
