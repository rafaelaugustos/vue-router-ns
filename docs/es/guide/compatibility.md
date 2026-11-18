# Alcance estable y compatibilidad {#rc-scope-and-compatibility}

`0.1.0` es la versión estable de la API documentada no experimental. Las tablas de rutas explícitas JavaScript/TypeScript siguen siendo la opción predeterminada. Las convenciones de archivos son opcionales; ambas usan navegación nativa, sin un runtime de Vue Router o Nuxt.

El [contrato de ciclo de vida de ventanas](./windows#lifecycle-support-decision-2026-11-13) del 2026-11-13 selecciona Core 9.1.4 / Vue 3.1.3 publicados y mantiene el estado experimental. Las mediciones de limpieza repetida en Android no certifican dispositivos Android físicos, Stage Manager, cambios de tamaño en uso ni retención de recursos en ciclos repetidos de iPad. Consulte el informe versionado del guía antes de elegir el alcance de despliegue.

Un iPad Pro físico de 11″ (3.ª generación), con iPadOS 27.0 (24A5418b), también pasó aislamiento de ventanas, regreso del segundo plano, HMR y cierre en 31,9 segundos; esto no certifica la recolección repetida de recursos en iPad.

## Línea base admitida {#supported-baseline}

| Dependencia        | Requisito estable                              | Línea base de aceptación                                                 |
| ------------------ | ---------------------------------------------- | ------------------------------------------------------------------------ |
| NativeScript Core  | `^9.1.4`                                       | 9.1.4                                                                    |
| NativeScript-Vue   | `^3.1.2`                                       | 3.1.3                                                                    |
| Node.js            | `>=20.19.4`                                    | Instalación de Node 20.19.4 y 22.23.3; Compilaciones nativas del nodo 22 |
| npm                | Compatible con la versión de Node seleccionado | 10.8.2 y 11.21.1                                                         |
| webpack (opcional) | webpack 5, NativeScript webpack 5              | webpack 5.112.0 / NativeScript webpack 5.0.38                            |
| Vite (opcional)    | Vite 8, NativeScript Vite 8.0.20+              | Vite 8.3.4 / NativeScript Vite 8.0.20                                    |

El RC reduce las declaraciones Core `>=8.9.0` y NativeScript-Vue `^3.0.0` beta a la línea base validada. Actualice esas dependencias antes de actualizar el enrutador. Un rango de versiones compatibles no es una afirmación de que se hayan probado todas las versiones de dependencia intermedias.

CI nativo cubre los simuladores Android API 34/35/36 y iOS/iPadOS 18.6. Las ejecuciones adicionales de iOS 26 y las comprobaciones de accesibilidad de dispositivos físicos se registran en los informes de validación [validation reports](https://github.com/rafaelaugustos/vue-router-ns/tree/main/test) del repositorio. Estos informes identifican sus revisiones probadas; no implican un nuevo pase de dispositivo físico para cada versión.

La aceptación nativa usa [NativeScript-Vue 3.1.3](https://github.com/nativescript-vue/nativescript-vue/releases/tag/v3.1.3); el requisito peer sigue siendo `^3.1.2`. La versión 3.1.3 conserva las aplicaciones de páginas abiertas con `$navigateTo` durante la recreación de ventanas y las libera al cerrarlas definitivamente. Las páginas Frame del router ya usan `createNativeView()` con un ciclo de vida propio. Consulta el [informe específico](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-vue-3.1.3.md).

Esta versión requiere Core `^9.1.4`. [Core 9.1.4](https://github.com/NativeScript/NativeScript/releases/tag/9.1.4-core) incluye las correcciones de carga diferida del controlador, Back en el contenido y apertura de ventanas tras cerrar la Activity original. Las aplicaciones fijadas en 9.1.3 deben actualizar Core y su lockfile antes de actualizar el router. El [informe de 9.1.4](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-core-9.1.4.md) registra pruebas específicas; la validación completa se ejecuta en el commit del lanzamiento.

## Alcance de la API {#api-scope}

El alcance estable incluye rutas explícitas y ubicaciones tipadas; push/replace/back y resultados; guards y ciclo de vida de navegación; RouterView, RouterLink, pestañas, navegación dividida drawer y Frame; rutas modales; restauración opcional del estado de la página; y las integraciones nativas documentadas fuera de la lista experimental a continuación. La reparación de defectos sigue siendo posible. Los cambios incompatibles futuros requieren una decisión explícita de compatibilidad e instrucciones de migración.

Estas funciones siguen siendo **experimentales y opcionales**:

- [Múltiples ventanas nativas](./windows): un enrutador por ventana, restauración de tareas/escenas independientes y reconexión del mismo proceso en la línea base de plataforma documentada.
- [Composición nativa de Suspense](./suspense): registro de compatibilidad de renderizador explícito y contenido asíncrono dentro de un Page estable.
- [Precarga de código](./preloading): preparación de código con límites. La [preparación de datos](./data-preloading) exige permiso explícito del loader/sesión.
- [Carga de datos de ruta](./data-loading): estado por entrada y cancelación sin bloquear presentación nativa.
- [Enrutamiento de archivos](./file-routing), incluido su contrato de herramienta de generación/compilación. Las rutas explícitas existentes no dependen de ello.
- [Hosts nativos personalizados](./native-hosts) y [Destinos de fragmento/controlador nativo](./native-destinations). La versión del contrato del host debe cambiar en caso de cambios de contrato incompatibles.
- `backPreview: 'core'`, que requiere el prototipo upstream fijado documentado en el informe predictivo [informe de validación](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-predictive-back.md). El Core publicado utiliza el respaldo existente.

La propiedad y restauración de múltiples ventanas se incluyen como características experimentales, con su evidencia de aceptación y límites de plataforma documentados en la guía de ventanas [Navegación en múltiples ventanas nativas](./windows) y el informe de estado de página [informe de validación](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-page-state.md). La hoja de ruta no es un compromiso de entrega. El rc.3 agrega [iOS drawer y presentación adaptativa](./drawer), [acciones de página compartida](./page-actions), [visor de informes de diagnóstico](./diagnostics-viewer) y [ejemplo integrado](./native-showcase). El comportamiento de superposición Android existente permanece disponible; La presentación adaptable y las acciones compartidas son opcionales. Consulte el mapa de capacidades [Capacidades nativas y opciones de contenedores](./capabilities) para conocer propietarios nativos y composiciones compatibles.

## Límites conocidos {#known-limits}

- La cobertura de gestos distingue la entrega de orientación de la rotación visual: UIKit puede aplazar la rotación hasta que termine la navegación. La recolección repetida de recursos en iPad, Stage Manager/redimensionamiento en vivo y Android físico siguen sin verificarse. Consulta la [evidencia de integración](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-gesture-rotation-167-integration.md).
- Core 9.1.3 puede fallar con CSS `direction` heredado alrededor de la navegación nativa porque `requestLayout()` carga la vista del controlador antes del inicio de la aplicación. Core 9.1.4 publicado incluye la corrección (#11587). La [regresión con el tarball actual del router](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-published-direction-139.md) verifica LTR heredado, escritura y Back nativo revertido/completado, incluidas las pestañas, en simuladores iOS/iPadOS 18.6 y iPadOS 27.0. Usa la dependencia publicada sin el parche histórico de investigación. RTL dinámico, hosts personalizados arbitrarios y forzar la carga de la vista del controlador antes del inicio quedan fuera de esta aceptación.
- Las comprobaciones de flags, etiquetas y foco de accesibilidad nativas automatizadas no certifican el recorrido hablado de VoiceOver/TalkBack. La aceptación del escaparate [informe de validación](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-showcase.md) y los informes de características individuales identifican las comprobaciones manuales restantes.

- El HMR nativo Vite utiliza metadatos `.route.json`. `definePageMeta` funciona con webpack y Vite incluido, pero no es compatible con Vite HMR nativo. Agregar o eliminar registros de diseño o middleware requiere reiniciar la aplicación; Las ediciones de script pueden volver a montar páginas. Consulte [enrutamiento de archivos](./file-routing).
- Con npm 10, mantenga un archivo de bloqueo NativeScript Vite en funcionamiento: su propio árbol de dependencia de pares opcional puede fallar en una instalación sin archivo de bloqueo. El fallo de instalación de npm 10 del enrutador se solucionó en la versión beta.15. Consulte [instalación](./install).
- La terminación del proceso nunca preserva las promesas JavaScript. Conserve el estado propiedad de la aplicación pequeña e inicie una nueva operación después de la recuperación. El enrutador conserva las aplicaciones de la Page de un Frame durante la recreación de la actividad Android en las dependencias publicadas admitidas, lo que permite volver a vincular un flujo nativo pendiente. Eliminar la ruta o cerrar permanentemente a su propietario aún cancela ese flujo. Ver [flujos nativos](./native-flows) y [restauración](./restore).
- Las pestañas y bottom sheets de Material requieren su dependencia nativa en la aplicación enviada, incluidas las versiones de lanzamiento. Las funciones de disponibilidad informan lo que está presente; no lo instalan. La indexación/clasificación de Spotlight y el comportamiento del SDK externo siguen siendo responsabilidades del sistema/proveedor.

## Validación de la release {#release-validation}

Se publica una nueva versión de `main` solo después de que el CI completo y los flujos de trabajo del contrato nativo pasan la mismo commit. El tarball npm final se instala en nuevos proyectos de ruta explícita, webpack y Vite antes de su publicación; el tarball y los registros de instalación se conservan como un artefacto del flujo de trabajo. Una suite requerida fallida o cancelada bloquea la publicación. Las pruebas de prototipos upstream no sustituyen a las pruebas de las dependencias publicadas.

Las versiones estables usan la etiqueta `latest` de npm; las RC usan `next`. Una vez que existe una versión estable, las versiones preliminares no mueven `latest`. Usa una versión exacta y conserva el lockfile para compilaciones reproducibles.

Consulte [Versión estable y preparación para 1.0](./stable-readiness) para criterios de publicación, evidencia y trabajo restante.
