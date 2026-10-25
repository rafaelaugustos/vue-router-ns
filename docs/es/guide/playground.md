# Pruébalo con StackBlitz {#try-it-with-stackblitz}

[Obra el área de juegos del enrutador en StackBlitz](https://stackblitz.com/fork/github/rafaelaugustos/vue-router-ns/tree/main/examples/playground?file=src%2Frouter.ts)

Edite una aplicación NativeScript-Vue en el navegador y ejecute su interfaz de usuario nativa en un teléfono o tableta a través de [NativeScript Preview](https://preview.nativescript.org/). El navegador aloja el editor y el proceso de construcción; no emula las vistas UIKit o Android.

## Iniciar una sesión {#start-a-session}

1. Instale NativeScript Preview en su dispositivo utilizando los enlaces de su sitio web.
2. Abre el patio de juegos de arriba. StackBlitz instala dependencias e inicia `ns preview` utilizando la integración oficial NativeScript StackBlitz.
3. Espere la vista previa del código QR y escanéelo con el dispositivo. Mantenga la sesión abierta mientras edita.
4. Abra `src/router.ts` para cambiar rutas, o una página en `src/pages/` para cambiar su UI.

La fuente de ejemplo [código del ejemplo](https://github.com/rafaelaugustos/vue-router-ns/tree/main/examples/playground) es autónoma y tiene pines `vue-router-ns@0.1.0-beta.15`. No es necesario crear este repositorio ni resolver un alias `../dist`.

## Qué probar {#what-to-try}

| Ejercicio                                                       | Donde                                         |
| --------------------------------------------------------------- | --------------------------------------------- |
| Empuja varios elementos, luego vuelve a través de ellos         | `src/pages/Home.vue`, `src/pages/Item.vue`    |
| Abre un modal y devuelve una respuesta                          | `src/pages/Item.vue`, `src/pages/Compose.vue` |
| Cancelar un giro no vacío para ejecutar una licencia guard      | `src/pages/Compose.vue`                       |
| Mantener la lista y los detalles visibles en una ventana amplia | `src/App.vue` (`RouterSplitView`)             |
| Inspecciona la ruta de cada página y el historial combinado     | `src/pages/Item.vue`                          |

Consulte [navigación](./navigating), [guards](./guards), [resultados modales](./modals) y [vista dividida](./split-view) para las API correspondientes.

## Capacidades nativas {#native-capabilities}

La vista previa proporciona una aplicación nativa prediseñadas. Su tiempo de ejecución instalado, sus bibliotecas y su manifiesto determinan qué API de plataforma están disponibles; Agregar una dependencia de npm no puede agregar una biblioteca nativa que falta en esa aplicación. Los cambios en su propio `App_Resources` requieren una compilación nativa completa.

En particular, el progreso predictivo de Android 14/15 requiere una suscripción manifiesta, y el zoom iOS requiere iOS 18+ y un tiempo de ejecución compatible. No utilice una sesión de Vista previa para concluir que esas características funcionan en su propio manifiesto de producción. Utilice la demostración local [Instalar y abrir una página](./install#the-demo-app) para probar la configuración nativa, la restauración de procesos fallidos y las versiones de lanzamiento.

El ejemplo sigue la plantilla oficial [Vue 3 StackBlitz](https://github.com/nativescript-vue/nativescript-vue/tree/main/packages/stackblitz-template). Las comprobaciones de TypeScript y del paquete de plataforma son independientes de la prueba de una sesión de vista previa de un extremo a otro en un dispositivo conectado; este ejemplo no afirma que esto último haya sido verificado.

## Si la sesión no inicia {#if-the-session-does-not-start}

Verifique el terminal StackBlitz para ver si hay errores de instalación/compilación y siga el soporte del navegador [StackBlitz](https://developer.stackblitz.com/platform/webcontainers/browser-support). Confirme que su aplicación de vista previa esté actualizada y pueda conectarse a la sesión. Para probar el mismo código localmente, instale la CLI NativeScript, ejecute `npm install` dentro de `examples/playground` y luego `ns preview`.

La demostración local completa permanece disponible si el tiempo de ejecución nativo de Preview no puede proporcionar una función. Antecedentes: Integración y limitaciones de la vista previa de [NativeScript](https://blog.nativescript.org/nativescript-preview-announcement/).
