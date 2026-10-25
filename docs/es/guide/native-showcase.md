# Notas de campo: un ejemplo de navegación nativa integrada {#fieldnotes-an-integrated-native-navigation-example}

¿Nuevo en el enrutador? Comience con [Notas de bolsillo](./first-app), luego use esta guía para redactar las funciones nativas. Consulte las páginas [, stacks y state](./mental-model) para conocer el modelo de por vida.

<Clip name="native-showcase" aspect="402 / 874" caption="Simulador actual de iOS 26: drawer, búsqueda y menús nativos, acciones de encabezado compartido, resultado modal, edición no guardada de guards y regreso a la lista retenida." />

Fieldnotes es una pequeña aplicación de lista/detalle ejecutable. Un drawer abre destinos; los encabezados de página nativos y la búsqueda conducen a una nota; las acciones del encabezado y del menú contextual comparten estado; un editor protege los cambios no guardados; un modal nativo devuelve un resultado a la misma página de detalles.

Utiliza las API de enrutador público y **0.1.0-rc.3**. El rc.2 anterior ya proporciona encabezados nativos, títulos grandes iOS, búsqueda, menús contextuales, guards, resultados modales y enfoque de navegación. Las acciones iOS drawer y de página compartida que se utilizan aquí son adiciones de rc.3. Cree esta caja para ejecutar el ejemplo completo; La instalación de rc.2 por sí sola no proporciona esas adiciones.

## Ejecutar desde una caja {#run-from-a-checkout}

Instale la CLI NativeScript y los SDK de plataforma utilizando la configuración [NativeScript](https://docs.nativescript.org/setup/). Desde la raíz del repositorio:

```sh
npm ci
npm run build

# Generate native resources once; App_Resources is ignored by Git.
if [ ! -d demo/App_Resources ]; then
  showcase_resources=$(mktemp -d)
  ns create showcase-resources --template @nativescript/template-blank-ts --path "$showcase_resources"
  cp -R "$showcase_resources/showcase-resources/App_Resources" demo/App_Resources
fi

cd demo
npm install
npm run showcase:ios
# or:
npm run showcase:android
```

Estos scripts seleccionan `--env.showcase`; la demostración de correo sigue siendo la entrada predeterminada. Ambos usan `org.nativescript.vuerouterns`, por lo que instalar uno reemplaza al otro en el dispositivo elegido. Pase `-- --device <id>` para seleccionar un simulador/emulador. La línea base probada es Core 9.1.3, NativeScript-Vue 3.1.2, iOS runtime 9.1.0 y Android runtime 9.1.1.

## Sigue el flujo completo {#follow-the-complete-flow}

1. Abra **Menú → Acerca de este ejemplo**, luego **Regrese a la biblioteca**. La superposición se cierra cuando se confirma la navegación. El propio drawer no añade ninguna entrada en el historial.
2. Toca **Search**, escribe `coast` y mantén presionada la tarjeta correspondiente. Elija **Nota estrella**. La acción pertenece a ese artículo, no a otra nota del catálogo.
3. Abierto **Aa lo largo de la costa**. Su encabezado muestra **Unstar** porque la acción de contexto cambió la misma nota en memoria. Cambie la acción del encabezado o mantenga presionada la tarjeta de detalles para usar su menú nativo compartido.
4. Toque **Revisar en un modal → Marcar como revisado**. La hoja se cierra y se muestra la página de detalles original **Revisado hoy**. Cancelar una revisión posterior deja intacto el valor anterior.
5. Abra **Edit**, cambie la nota y luego use Back nativo. Elija **Seguir editando**. Abra el drawer y pruebe con **Library**: el mismo guard protege esa salida, y la negativa mantiene abierto el drawer. Cierre el panel y luego **Save**.
6. Regresar del detalle a la lista. La página de lista original y su consulta `coast` permanecen; La búsqueda no vuelve a abrir el teclado automáticamente.

Las notas de muestra son ficticias y se almacenan únicamente en la memoria. Guarde las actualizaciones en esa nota en la memoria; Esto no es sincronización en la nube ni persistencia durante el reinicio. La consulta de lista pertenece a la lista retenida Page; el borrador pertenece a la edición Page. Para persistir después de la terminación del proceso, agregue almacenamiento de aplicaciones y opte por la restauración del estado de página [Restaurando el stack después de que se cierre la aplicación](./restore).

## Dónde vive cada característica {#where-each-feature-lives}

| Fuente bajo `demo/src/showcase`                                                                                                  | Responsabilidad                                                                                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`App.vue`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/showcase/App.vue)                                 | Un `RouterDrawer` alrededor de un `RouterView`. La biblioteca vuelve explícitamente a la raíz; Acerca de empuja una ruta. La selección del cajón no crea una segunda implementación de navegación. |
| [`router.ts`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/showcase/router.ts)                             | Lista/detalle/edición/acerca de rutas diferidas y la ruta modal nativa.                                                                                                                            |
| [`pages/Library.vue`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/showcase/pages/Library.vue)             | Nativo `ActionBar`, `iosLargeTitle`, `useNativeSearch`, consulta de página propia y un ScrollView nativo. La navegación permite que la integración de búsqueda administre su ciclo de vida.        |
| [`components/NoteCard.vue`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/showcase/components/NoteCard.vue) | Botón Abrir nativo accesible más un menú contextual específico del elemento. Las claves estables mantienen la propiedad de la acción vinculada a la nota correcta.                                 |
| [`pages/Note.vue`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/showcase/pages/Note.vue)                   | `usePageActions` compartido por `PageActionItem` y un menú nativo; un resultado modal escrito; objetivo de retorno de enfoque.                                                                     |
| [`pages/Edit.vue`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/showcase/pages/Edit.vue)                   | Page: borrador local, permiso condicional guard y un diálogo de confirmación nativo. Guarde los datos de la aplicación de actualizaciones antes de regresar.                                       |
| [`pages/Review.vue`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/showcase/pages/Review.vue)               | Modal nativo Page, cancelar y `back({ result })`.                                                                                                                                                  |
| [`state.ts`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/showcase/state.ts)                               | Pequeño catálogo ficticio y un drawer ref compartido. No posee historia nativa.                                                                                                                    |

La aplicación tiene un Frame stack nativo. Acerca de es una ruta en ese stack, no una pestaña independiente. Si se requieren historiales de destino independientes, cree marcos con nombre en pestañas como se explica en [opciones de contenedor](./capabilities). No se requieren adaptadores adaptables drawer, visualización de diagnóstico y transición para ejecutar este ejemplo.

## Presentación nativa y alternativas accesibles {#native-presentation-and-accessible-alternatives}

En iOS, `iosLargeTitle` usa la barra de navegación UIKit real con contenido de desplazamiento nativo, y `useNativeSearch` instala un controlador de búsqueda de propiedad de la página. Android mantiene su barra de herramientas normal y presenta temporalmente SearchView nativo en el área del título. La muestra no dibuja un título grande Android colapsado falso ni reemplaza un stack nativo para imitar una transición.

Todas las rutas siguen siendo accesibles con botones nativos. Las tarjetas tienen un botón Abrir explícito; Las acciones contextuales también están disponibles en el encabezado de detalles o mediante su botón Revisar. `useNavigationFocus` declara encabezados iniciales y destinos de retorno para navegación de lista/detalle/modal. El drawer proporciona aislamiento y restauración de accesibilidad existente. La aplicación solicita la política de movimiento predeterminada del sistema, sin movimiento personalizado adicional.

El ScrollView de tres tarjetas mantiene el ejemplo pequeño. Utilice una lista virtualizada para un catálogo grande y vuelva a probar la reutilización de filas/propiedad del menú y cualquier fuente de zoom. Este ejemplo utiliza deliberadamente transiciones normales; Las limitaciones de transición interactiva [Transiciones interactivas: propiedad y límites](./interactive-transitions) siguen siendo aplicables.

## Validación y grabaciones {#validation-and-recordings}

Ver el informe de aceptación nativo [informe de validación](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-showcase.md) y scripts de reproducción [scripts de validación](https://github.com/rafaelaugustos/vue-router-ns/tree/main/scripts/native/showcase). Distinguen entradas de interfaz de usuario reales, controles de identidad basados ​​en diagnósticos, plataformas registradas y límites de accesibilidad manual. Una construcción exitosa por sí sola no es evidencia de que la navegación o el enfoque funcionen.

La entrada opcional `--env.showcaseTest` ejecuta la misma aplicación y escribe instantáneas de diagnóstico limitadas para su aceptación. El `--env.showcase` normal no incluye ese puente de sondeo/archivo; Ninguno de los dos se envía en el paquete del enrutador.
