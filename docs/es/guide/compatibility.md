# Alcance y compatibilidad de RC {#rc-scope-and-compatibility}

La versión candidata `0.1.0-rc.4` congela la API no experimental documentada mientras la validamos para la versión estable. Las tablas de rutas explícitas JavaScript/TypeScript siguen siendo las predeterminadas. Las convenciones de archivos son opcionales; ambos usan navegación nativa, sin un Vue Router o tiempo de ejecución de Nuxt.

## Línea base admitida {#supported-baseline}

| Dependencia        | Requisito RC                                   | Línea base de aceptación                                                 |
| ------------------ | ---------------------------------------------- | ------------------------------------------------------------------------ |
| NativeScript Core  | `^9.1.3`                                       | 9.1.3                                                                    |
| NativeScript-Vue   | `^3.1.2`                                       | 3.1.2                                                                    |
| Node.js            | `>=20.19.4`                                    | Instalación de Node 20.19.4 y 22.23.3; Compilaciones nativas del nodo 22 |
| npm                | Compatible con la versión de Node seleccionado | 10.8.2 y 11.21.1                                                         |
| webpack (opcional) | webpack 5, NativeScript webpack 5              | webpack 5.112.0 / NativeScript webpack 5.0.38                            |
| Vite (opcional)    | Vite 8, NativeScript Vite 8.0.20+              | Vite 8.3.4 / NativeScript Vite 8.0.20                                    |

El RC reduce las declaraciones Core `>=8.9.0` y NativeScript-Vue `^3.0.0` beta a la línea base validada. Actualice esas dependencias antes de actualizar el enrutador. Un rango de versiones compatibles no es una afirmación de que se hayan probado todas las versiones de dependencia intermedias.

CI nativo cubre los simuladores Android API 34/35/36 y iOS/iPadOS 18.6. Las ejecuciones adicionales de iOS 26 y las comprobaciones de accesibilidad de dispositivos físicos se registran en los informes de validación [validation reports](https://github.com/rafaelaugustos/vue-router-ns/tree/main/test) del repositorio. Estos informes identifican sus revisiones probadas; no implican un nuevo pase de dispositivo físico para cada versión.

## Alcance de la API {#api-scope}

El RC congela rutas explícitas y ubicaciones tipadas; push/replace/back y resultados; guards y ciclo de vida de navegación; RouterView, RouterLink, pestañas, navegación dividida drawer y Frame; rutas modales; restauración opcional del estado de la página; y las integraciones nativas documentadas fuera de la lista experimental a continuación. La reparación de defectos sigue siendo posible. Una corrección incompatible inevitable antes de la estabilidad debe documentarse con instrucciones de migración en un nuevo candidato.

Estas funciones siguen siendo **experimentales y opcionales**:

- [Múltiples ventanas nativas](./windows): un enrutador por ventana, restauración de tareas/escenas independientes y reconexión del mismo proceso en la línea base de plataforma documentada.
- [Composición nativa de Suspense](./suspense): registro de compatibilidad de renderizador explícito y contenido asíncrono dentro de un Page estable.
- [Carga de datos de ruta](./data-loading): estado por entrada y cancelación sin bloquear presentación nativa.
- [Enrutamiento de archivos](./file-routing), incluido su contrato de herramienta de generación/compilación. Las rutas explícitas existentes no dependen de ello.
- [Hosts nativos personalizados](./native-hosts) y [Destinos de fragmento/controlador nativo](./native-destinations). La versión del contrato del host debe cambiar en caso de cambios de contrato incompatibles.
- `backPreview: 'core'`, que requiere el prototipo upstream fijado documentado en el informe predictivo [informe de validación](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-predictive-back.md). El Core publicado utiliza el respaldo existente.

La propiedad y restauración de múltiples ventanas se incluyen como características experimentales, con su evidencia de aceptación y límites de plataforma documentados en la guía de ventanas [Navegación en múltiples ventanas nativas](./windows) y el informe de estado de página [informe de validación](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-page-state.md). La hoja de ruta no es un compromiso de entrega. El rc.3 agrega [iOS drawer y presentación adaptativa](./drawer), [acciones de página compartida](./page-actions), [visor de informes de diagnóstico](./diagnostics-viewer) y [ejemplo integrado](./native-showcase). El comportamiento de superposición Android existente permanece disponible; La presentación adaptable y las acciones compartidas son opcionales. Consulte el mapa de capacidades [Capacidades nativas y opciones de contenedores](./capabilities) para conocer propietarios nativos y composiciones compatibles.

## Límites conocidos {#known-limits}

- NativeScript CSS `direction` heredado alrededor de la navegación nativa genérica puede provocar un bloqueo del gráfico de gestos en iOS 18.6. `RouterDrawer` utiliza su propia prop `direction` y manejo limitado de UIKit; los diseños genéricos permanecen rastreados en [#139](https://github.com/rafaelaugustos/vue-router-ns/issues/139). La reproducción de Core aisló la carga prematura de la vista del controlador dentro de `requestLayout()` antes de `Application.run()`. Una corrección candidata de Core que utiliza `viewIfLoaded` supera los casos de teclado y navegación Back interactiva en iOS/iPadOS 18.6, incluidas las comprobaciones con Vue y el router. Aún no forma parte de las dependencias publicadas; esto sigue siendo una limitación para las aplicaciones. Ni aplazar la dirección ni el parche de investigación de suscripción voluntaria son soluciones alternativas validadas para las aplicaciones.
- Las comprobaciones de flags, etiquetas y foco de accesibilidad nativas automatizadas no certifican el recorrido hablado de VoiceOver/TalkBack. La aceptación del escaparate [informe de validación](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-showcase.md) y los informes de características individuales identifican las comprobaciones manuales restantes.

- El HMR nativo Vite utiliza metadatos `.route.json`. `definePageMeta` funciona con webpack y Vite incluido, pero no es compatible con Vite HMR nativo. Agregar o eliminar registros de diseño o middleware requiere reiniciar la aplicación; Las ediciones de script pueden volver a montar páginas. Consulte [enrutamiento de archivos](./file-routing).
- Con npm 10, mantenga un archivo de bloqueo NativeScript Vite en funcionamiento: su propio árbol de dependencia de pares opcional puede fallar en una instalación sin archivo de bloqueo. El fallo de instalación de npm 10 del enrutador se solucionó en la versión beta.15. Consulte [instalación](./install).
- La terminación del proceso nunca preserva las promesas JavaScript. Conserve el estado propiedad de la aplicación pequeña e inicie una nueva operación después de la recuperación. El enrutador conserva las aplicaciones de la Page de un Frame durante la recreación de la actividad Android en las dependencias publicadas admitidas, lo que permite volver a vincular un flujo nativo pendiente. Eliminar la ruta o cerrar permanentemente a su propietario aún cancela ese flujo. Ver [flujos nativos](./native-flows) y [restauración](./restore).
- Las pestañas y bottom sheets de Material requieren su dependencia nativa en la aplicación enviada, incluidas las versiones de lanzamiento. Las funciones de disponibilidad informan lo que está presente; no lo instalan. La indexación/clasificación de Spotlight y el comportamiento del SDK externo siguen siendo responsabilidades del sistema/proveedor.

## Validación de la release {#release-validation}

Se publica una nueva versión de `main` solo después de que el CI completo y los flujos de trabajo del contrato nativo pasan la mismo commit. El tarball npm final se instala en nuevos proyectos de ruta explícita, webpack y Vite antes de su publicación; el tarball y los registros de instalación se conservan como un artefacto del flujo de trabajo. Una suite requerida fallida o cancelada bloquea la publicación. Las pruebas de prototipos upstream no sustituyen a las pruebas de las dependencias publicadas.

Las compilaciones RC utilizan la etiqueta `next` de npm. Al igual que con las versiones beta, `latest` también sigue la versión preliminar más reciente hasta que exista la primera versión estable. Utilice una versión exacta y confirme su archivo de bloqueo para compilaciones de aplicaciones reproducibles.

Consulte [Versión estable y preparación para 1.0](./stable-readiness) para criterios de publicación, evidencia y trabajo restante.
