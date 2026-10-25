# Aprender vue-router-ns {#learn-vue-router-ns}

Crea navegación nativa en una aplicación NativeScript-Vue 3 usando rutas, parámetros, guards y resultados. El enrutador coordina los stacks nativos real: las páginas permanecen vivas una debajo de la otra, cada pestaña puede tener su propio historial y el Back nativo es parte del flujo de navegación.

<a id="where-to-start"></a>

## Comienza aquí {#start-here}

| Tu objetivo                           | Comienza con                             | Lo que tendrás                                                                               |
| ------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------- |
| Agregar el enrutador a una aplicación | [Instalación](./install)                 | Una Page nativa renderizada a través de `RouterView`                                         |
| Aprenda construyendo                  | [Tu primera aplicación](./first-app)     | Una lista, una página de detalles y un editor modal protegido, con el código fuente completo |
| Comprender el comportamiento          | [Pages, stacks y estado](./mental-model) | Un modelo para la ciclo de vida de la página, Back nativo, pestañas y propiedad modal        |
| Evalúa las posibilidades              | [Galería de ejemplos](./examples)        | Grabaciones reales vinculadas a guías, código ejecutable y límites de la plataforma          |
| Resolver una tarea de aplicación      | [Tareas comunes](./recipes)              | Una ruta a la API relevante y sus restricciones importantes                                  |

El tutorial presupone conocimientos básicos de componentes Vue de un solo archivo y un proyecto NativeScript-Vue en funcionamiento. Introduce un stack antes de añadir resultados y guards. [Fieldnotes](./native-showcase) es el siguiente paso: drawer, búsqueda nativa, acciones compartidas y las mismas reglas de conservación del estado.

<a id="what-it-covers"></a>

## Elige una estructura de navegación {#choose-a-navigation-structure}

Comience con un `RouterView`. Agregue [tabs](./tabs) para historiales de destinos independientes, [drawer](./drawer) para un menú sobre contenido existente, o [list/detail](./split-view) para un diseño compacto/ampliado. Un [modal](./modals) posee temporalmente un stack separado y puede devolver un valor.

La guía del contenedor [Capacidades nativas y opciones de contenedores](./capabilities#choose-a-container) explica las combinaciones admitidas, incluido por qué un drawer, una barra lateral de pestañas nativa y un controlador dividido UIKit son propietarios diferentes.

## Agregar la experiencia nativa {#add-the-native-experience}

Mantener títulos y botones en [ActionBar](./native-bars) de NativeScript. Utilice acciones de página [Page acciones](./page-actions) para compartir el comportamiento entre encabezados, menús y comandos de teclado compatibles. Agregue menús contextuales [Vistas previas del menú contextual](./context-menus), [transiciones](./transitions), [enfoque y comportamiento de movimiento](./accessibility) según el flujo los necesite.

Para la integración de aplicaciones, continúe con [enlaces profundos](./deep-links), [selectores de sistema](./native-flows), [restauración de estado](./restore) y [diagnósticos](./diagnostics). Las convenciones de archivos y las integraciones experimentales tienen sus propias guías avanzadas; las rutas explícitas siguen siendo las predeterminadas.

<a id="why-not-vue-router-itself"></a>

## Si vienes de Vue Router {#coming-from-vue-router}

Los nombres de métodos familiares ayudan, pero una aplicación móvil tiene varias páginas stacks nativas y retenidas posibles. Lea [las diferencias](./vue-router), luego el modelo mental [Páginas, stacks y estado](./mental-model), antes de confiar en las suposiciones de ciclo de vida de la página web.

El paquete es un candidato de lanzamiento. [Compatibilidad](./compatibility) identifica las dependencias admitidas, las API experimentales y los límites de validación restantes. La referencia [API](./api) es el índice de búsqueda una vez que sabes qué parte del sistema necesitas.
