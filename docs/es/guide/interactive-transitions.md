# Transiciones interactivas: propiedad y límites {#interactive-transitions-ownership-and-limits}

Un gesto interactivo no es solo una animación con un valor de progreso. El host nativo decide qué controladores o páginas participan, si el gesto puede iniciarse, cuándo se confirma y cuándo se pueden eliminar esas páginas. El enrutador debe mantener su historial, guards y sus promesas de resultados consistentes con esa decisión.

Esta investigación de rc.3 **no** agrega una API de transición interactiva uniforme. Documenta la línea base publicada (NativeScript Core 9.1.3, NativeScript-Vue 3.1.2, iOS runtime 9.1.0 y Android runtime 9.1.1) y la separa del trabajo experimental anterior.

<Clip name="interactive-transitions" aspect="402 / 874" caption="Simulador actual de iOS 26: gestos invertidos y comprometidos, zoom, guards y eliminación de fuente." />

## Matriz de capacidades {#capability-matrix}

| Surface                                              | Propietario y progreso                                                                                                    | Confirmar/cancelar                                                                 | Integración y límites del enrutador                                                                                                                                                                               |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| programática `push` / `back`                         | Core Frame o el host nativo seleccionado es propietario de la transición; `transition` selecciona su animación            | Sin búsqueda pública/control inverso                                               | Las guardias se ejecutan antes de la navegación del enrutador. Espere a que finalice la navegación; no interprete la duración de un diagnóstico como el progreso del gesto.                                       |
| iOS Frame borde Back                                 | UIKit El controlador de navegación posee la transición interactiva                                                        | UIKit decide a partir del gesto real                                               | El enrutador concilia la historia nativa comprometida. Página activa, deje guards y mantenga presionado el gesto antes de que comience. `useBackGesture()` es `null` en iOS.                                      |
| iOS 18+ `zoomFrom`                                   | UIKit `preferredTransition`, cuando se expone por el tiempo de ejecución                                                  | UIKit controla el zoom y el descarte interactivo                                   | El enrutador proporciona una vista de fuente débil y un predicado de admisión sincrónica. Una fuente faltante/descargada devuelve `nil`. Una transición predeterminada Frame explícita puede anular el zoom.      |
| Core `SharedTransition` descarte interactivo         | La implementación de transición compartida iOS de Core posee su reconocedor/animador                                      | Un pop nativo; sin sesión reversible propiedad del enrutador                       | Un guard de salida no puede vetar este despido. No lo utilice para un flujo de edición no guardado que dependa de ese guard. Los elementos compartidos en Android no implican un despido interactivo equivalente. |
| Android 14+ la devolución de llamada predictiva Back | AndroidX proporciona progreso; la vista previa predeterminada del enrutador presenta la presentación nativa anterior Page | Cancelar restablece la presentación; La versión ejecuta el enrutador Back y guards | `useBackGesture()` observa el progreso. No adquiere la propiedad del historial ni de una transacción de Fragmento nativo. El comportamiento de raíz/raíz modal y de página protegida difiere.                     |
| Experimental Android Core vista previa               | Versión propuesta-1 Frame `beginBackPreview` sesión                                                                       | Solo presentación `update/cancel/finish/dispose`; `finish` nunca aparece           | Requiere el candidato fijado a continuación. Publicado Core vuelve a la vista previa existente. No es una implementación de pop predictivo de FragmentManager AndroidX.                                           |
| UIKit hosts divididos/personalizados                 | Cada host posee sus controladores y su ciclo de vida                                                                      | Depende de ese host                                                                | Frame La evidencia no establece paridad para columnas divididas, ventanas múltiples o hosts de terceros.                                                                                                          |

Ver [zoom/elementos compartidos](./transitions), [Android Back](./android-back), [guards](./guards) y [nativo hosts](./native-hosts) para las API admitidas.

## Observación no es control {#observation-is-not-control}

Las devoluciones de llamada de progreso de Android pueden impulsar la interfaz de usuario decorativa de propiedad de la página. No autorizan llamar a `popBackStack`, deshacerse de una página o resolver un resultado modal. Con `backPreview: false`, la aplicación puede animar su propio contenido desde `useBackGesture()`; todavía delega la navegación al enrutador.

El coordinador de transición de UIKit expone el contexto de interacción/finalización. El dispositivo de investigación lo toma como muestra y adjunta observadores de finalización sin reemplazar el delegado del controlador de navegación o el reconocedor de gestos. `percentComplete` es **no** un contrato de progreso documentado, multiplataforma y continuamente muestreado: la descripción de Apple lo vincula a la transición a su fase no interactiva. Un futuro observador necesita un modelo de disponibilidad explícito, no valores `0…1` fabricados en cada host.

La implementación Android Frame utiliza su propio historial de entradas y reemplazo de Fragmentos; no establece un FragmentManager en la parte posterior stack. Agregar `addToBackStack` únicamente para obtener la búsqueda de AndroidX cambiaría los contratos de actualización, borrado de historial, modales y de recreación. Ese es un trabajo de arquitectura ascendente, no un adaptador de biblioteca de animación.

## Ordenamiento de guardia y ciclo de vida {#guard-and-lifecycle-ordering}

1. Una página abandona el estado activo de guard y debe conocerse **antes de que comience el despido nativo de** iOS. Una pregunta asincrónica no puede contener retroactivamente un gesto que ya posee UIKit. Utilice el botón nativo protegido Back o el enrutador Back para preguntar al usuario.
2. Android suprime la vista previa mientras una página abandona guard está activa. El guards global/asincrónico aún puede rechazar la navegación después del lanzamiento; la vista previa debe restaurar la presentación.
3. Un gesto cancelado conserva la entrada, Page y el resultado pendiente. Un pop completo elimina la entrada y liquida su resultado una vez. Una cancelación no debe representarse como un pop temporal seguido de un segundo empujón.
4. La nueva navegación, la descarga del host, el cambio en la parte superior/destino y la eliminación de la fuente invalidan las suposiciones hechas al inicio del gesto. Las devoluciones de llamada de finalización deben verificar la entrada/sesión original antes de mutar algo.
5. El despido de un modal nativo y el pop de un Frame interno son operaciones diferentes. Hacer estallar el detalle interno no debe resolver el resultado modal ni alterar la presentación stack.

La limitación de descarte interactivo de SharedTransition sigue siendo explícita. Los guards globales no son una promesa general de vetar las transiciones nativas arbitrarias de UIKit.

## Decisión y posible límite del adaptador {#decision-and-possible-adapter-boundary}

Mantener las API existentes para rc.3. No introduzca `router.transition.progress`, `seek()` o un método universal `cancel()` a partir de esta evidencia.

Una propuesta futura de capacidad de host debería distinguir:

- **Observation:** notificaciones opcionales de progreso, finalización de interacción y finalización nativa, cada una etiquetada con host/ventana, identidad de entrada y un ID de sesión. El progreso desconocido sigue sin estar disponible. La finalización debe distinguir entre compromiso, cancelación e interrupción.
- **Control de presentación:** una sesión versionada opcional propiedad de un host. Puede actualizar/cancelar/finalizar la presentación, pero nunca modificar el historial del enrutador. La entrada es sincrónica; guards/history/results siguen siendo propiedad del enrutador.
- **Cleanup:** un resultado de terminal; disponer de oyentes/vistas nativas temporales en caso de descarga del host, reemplazo de entrada, cancelación o admisión fallida. Una devolución de llamada obsoleta no puede mostrar una entrada más nueva. Suscríbete solo cuando sea necesario; Evite un bucle de trama JS permanente en el enrutador de envío.
- **Fallback:** navegación nativa ordinaria cuando un host/tiempo de ejecución no puede proporcionar el contrato, sin promesa de paridad visual. Reducir movimiento suprime las transformaciones opcionales y al mismo tiempo conserva la misma navegación/resultados.

Un adaptador Jolt opcional podría animar la decoración propiedad de la aplicación o implementar una sesión de presentación explícitamente compatible. No debe tomar el control del delegado de UIKit, tratar una vista previa de Android como una búsqueda de fragmento ni convertirse en una dependencia de tiempo de ejecución. La implementación del adaptador se pospone hasta que se demuestren las capacidades y la eliminación del host.

## Evidencia y estado ascendente {#evidence-and-upstream-status}

El dispositivo opcional iOS y el corredor Android viven en [`scripts/native/transitions`](https://github.com/rafaelaugustos/vue-router-ns/tree/main/scripts/native/transitions). El informe de validación [informe de validación](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-interactive-transitions.md) identifica versiones, escenarios y brechas. Estas son comprobaciones del simulador/emulador nativo, no resultados de rendimiento del dispositivo físico.

La propuesta Core [NativeScript #11558](https://github.com/NativeScript/NativeScript/pull/11558) todavía estaba abierta y sin fusionar cuando se verificó el 24 de octubre de 2026. Su candidato fijado es `fadb58f034e403933028f86746280375ea9811ff`; Este trabajo no cambia las dependencias publicadas de la demostración. La evidencia candidata [existente](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-predictive-back.md) cubre una matriz API 34/35/36 separada y una corrección de recreación Frame. No debe describirse como comportamiento Core enviado.

Reducir movimiento se lee en la admisión de navegación/gestos (`motion: 'system'`, `'reduced'` o `'full'`). Los controles nativos siguen siendo la alternativa accesible a los gestos. Las etiquetas de accesibilidad y entrada automatizadas no establecen el habla VoiceOver/TalkBack, la restauración del enfoque con tecnología de asistencia ni el movimiento aceptable en dispositivos físicos.

## Referencias primarias {#primary-references}

- [Apple: admisión interacción zoom](https://developer.apple.com/documentation/uikit/uiviewcontroller/transition/zoomoptions/interactioncontext)
- [Apple: semántica de porcentaje del coordinador](https://developer.apple.com/documentation/uikit/uiviewcontrollertransitioncoordinatorcontext/percentcomplete)
- [Android: devoluciones de llamada de progreso y animaciones personalizadas](https://developer.android.com/guide/navigation/custom-back/support-animations-views)
- [Android: Requisitos de transición de fragmento](https://developer.android.com/guide/fragments/animate)

[H El seguimiento de la capacidad del host #145](https://github.com/rafaelaugustos/vue-router-ns/issues/145) permanece fuera de la puerta de lanzamiento rc.3.

## Propuesta de observación v0 {#observation-proposal-v0}

[La propuesta #145 y el prototipo](https://github.com/rafaelaugustos/vue-router-ns/tree/main/research/transition-observation) observan el UIKit Back ordinario sin reemplazar delegados ni realizar encuestas. Los controles nativos de cancelación/confirmación y cancelación de suscripción/reemplazo actual han registrado evidencia, mientras que el mapeo de identidad de entrada, el Back interno modal y varios casos de ciclo de vida/host siguen teniendo lagunas. La decisión es mantenerlo en investigación: no hay un nuevo observador público, una promesa de progreso continuo ni un adaptador Jolt. Consulte [el informe nativo](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-transition-observation.md).
