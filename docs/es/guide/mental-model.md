# Páginas, stacks y estado {#pages-stacks-and-state}

Una ruta describe adónde ir. Un stack nativo posee las páginas que se abrieron. `RouterView` crea un NativeScript Frame; el enrutador coordina la navegación y sigue la historia nativa del Frame.

La distinción importa cuando regresas de una página de detalles, cambias de pestaña o cierras un modal. Siga el siguiente ejemplo paso a paso.

<StackModel />

## Una página es una entrada con su propia duración {#a-page-is-an-entry-with-its-own-lifetime}

`push` agrega una nueva entrada. La siguiente página permanece montada. Un `ref` local, como una consulta de lista, pertenece a esa página retenida y sigue ahí después de Back. `replace` elimina la entrada actual; Back elimina la entrada superior. Las páginas eliminadas se desmontan.

Dentro de una página enrutada, `useRoute()` se refiere a **la ruta de esa página**. Abrir otra página no convierte todas las páginas subyacentes en el nuevo destino. `useRouter()` tiene como alcance el stack propietario de la página. Fuera de las páginas, `router.currentRoute` puede gestionar la interfaz de usuario de navegación a nivel de aplicación; no sustituye al `useRoute()` propio de una página.

| Estado                                                                    | Ponlo aquí                                                          | Vida útil                                                            |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Consulta de lista o interfaz de usuario relacionada con el desplazamiento | Page: referencias locales/vistas nativas                            | Mientras se conserva esa entrada de página                           |
| Texto del editor no guardado                                              | Página del editor local ref                                         | Hasta que se elimine el editor, a menos que se guarde explícitamente |
| Datos de notas compartidos por lista/detalle                              | Tienda de aplicaciones                                              | Cualquiera que sea la persistencia que implemente la aplicación      |
| Estado después de la terminación del proceso                              | Almacenamiento de aplicaciones y restauración de enrutador opcional | Debe serializarse y recuperarse explícitamente                       |

Las páginas retenidas no son almacenamiento persistente. La primera aplicación [Crea tu primera aplicación](./first-app) mantiene notas en la memoria; cerrar el proceso los pierde. Consulte [restoration](./restore) cuando la aplicación necesite recuperación después de la terminación del proceso.

## La visibilidad es diferente al montaje. {#visibility-is-different-from-mounting}

Al abrir un detalle o modal se puede cubrir una página sin eliminarla. Al regresar no vuelve a llamar a su `onMounted`. Utilice `onPageActivated` para actualizar cuando se muestre, `onPageDeactivated` para pausar el trabajo mientras está cubierto y `onUnmounted` para la limpieza final. La guía del ciclo de vida de la página [Cada página mantiene su ruta](./pages) explica estos ganchos.

## Los contenedores poseen cosas diferentes {#containers-own-different-things}

- Un `RouterView` posee un Frame stack.
- Las pestañas pueden seleccionar entre las llamadas stacks; Cambiar de pestaña no significa comenzar de nuevo sus historias.
- Un drawer rodea el contenido existente. Abrirlo no crea ninguna entrada de ruta; sus botones deciden qué navegación solicitar.
- Una ruta modal recibe un Frame separado. `useRouter()` en su interior navega por el stack de ese modal; Back en su raíz cierra el modal.
- Un diseño dividido tiene reglas explícitas de historial compacto/expandido. Elija el propietario admitido antes de componerlo con otros contenedores.

Utilice las opciones de contenedor [Capacidades nativas y opciones de contenedores](./capabilities#choose-a-container) antes de anidar componentes. Más contenedores no significan automáticamente historias independientes.

## Nativo Back y guards {#native-back-and-guards}

La aplicación puede solicitar `router.back()`, y la plataforma también tiene botones y gestos nativos. El enrutador sincroniza la navegación nativa completada con su estado. Deje que se aplique guards cuando una página **sea eliminada** y no simplemente cubierta por una inserción.

Un gesto interactivo iOS no puede esperar una confirmación asincrónica. Una salida activa guard desactiva el deslizamiento hacia atrás de esa página; el uso de `{ when: dirty }` lo deja disponible mientras está limpio. El comportamiento del botón nativo, modal y Android tiene sus propias rutas admitidas. Consulte [guards](./guards) para conocer la matriz de la plataforma.

**Siguiente:** [construya el flujo](./first-app) o [elija contenedores para su aplicación](./capabilities).
