# Enfoque de accesibilidad y movimiento. {#accessibility-focus-and-motion}

NativeScript ya anuncia un Page después de la navegación nativa e intenta restaurar su última vista centrada en la accesibilidad en la parte posterior. El enrutador deja ese comportamiento como está a menos que una página opte por un enfoque explícito. UIKit y TalkBack continúan teniendo enfoque en accesibilidad transversal, voz, tamaño de texto y entrada de teclado.

## Objetivos de enfoque explícitos {#explicit-focus-targets}

```vue
<script setup lang="ts">
import { useNavigationFocus, useRouter } from 'vue-router-ns'

const router = useRouter()
const focus = useNavigationFocus({ initial: 'heading', return: 'reply' })
async function reply() {
  focus.remember('reply')
  await router.pushForResult('/compose')
}
</script>

<template>
  <Page>
    <ActionBar title="Message" />
    <StackLayout>
      <Label id="heading" text="Message subject" accessible="true" textWrap="true" />
      <Button id="reply" text="Reply" @tap="reply" />
    </StackLayout>
  </Page>
</template>
```

`useNavigationFocus({ initial?, return? })` se registra una vez durante la configuración de la página enrutada. Los objetivos son identificadores de vistas estables, vistas NativeScript/referencias de plantillas, o captadores que devuelven esas vistas (o nulos/indefinidos mientras no estén disponibles). Los objetivos deben ser descendientes cargados, visibles y accesibles de esta página. Elija un título o control significativo; el enrutador no convierte un contenedor inaccesible en un elemento de accesibilidad.

En Android, deje las filas de `ListView` sin `accessible`: el núcleo hace que una vista accesible sea enfocable y `ListView` luego deja de entregar `itemTap` para esa fila. Un `accessibilityLabel` en la fila es suficiente para que TalkBack lo lea como un solo elemento y la fila sigue siendo un objetivo de enfoque válido. Mantener `accessible` para iOS, donde no afecte a los grifos `UITableView`.

Una transición nativa exitosa solicita un objetivo: `initial` en la inserción y `return` en la parte posterior. El anuncio nativo de la página se mantiene hasta que el historial Frame confirma la transición y luego se reemplaza por una notificación de cambio de diseño UIKit o una acción de enfoque de accesibilidad Android. No hay ningún anuncio adicional junto con el principal. El rechazo de guardia y las transiciones nativas canceladas no requieren atención. Los objetivos faltantes, eliminados o eliminados vuelven al anuncio/restauración de la página normal de NativeScript. Ningún objetivo solicita el foco del teclado ni abre el IME. `accessibilityAnnouncePageEnabled="false"` aún deshabilita los anuncios automáticos.

Llame a `focus.remember(target?)` inmediatamente antes de una navegación modal o de resultados para identificar su página y elemento de inicio. Sin argumentos, utiliza el destino de retorno configurado. Esto también funciona desde una lista dividida visible mientras hay una página de detalles en la pantalla: al cerrar el modal se restaura el elemento de la lista de inicio, no el último panel en el stack lógico. Sin un iniciador explícito, el modal regresa a la página principal del stack. `focus.focus('initial' | 'return')` es un intento explícito de centrarse en la accesibilidad inmediata y devuelve un valor booleano; Úselo cuando el contenido asincrónico esté disponible después de la transición.

Las páginas habilitadas ocultan el contenido cubierto de la accesibilidad y restauran su estado oculto original cuando son visibles/eliminados. RouterSplitView también oculta sus paneles cubiertos/vacíos mientras mantiene accesibles ambos paneles expandidos. Cambiar el tamaño no anuncia una nueva ruta. La página de vista previa Android anterior se excluye temporalmente del recorrido mediante un gesto predictivo, incluida la cancelación, y su estado original se restaura posteriormente.

No coloque un anuncio personalizado en cada `onPageActivated`: ese enlace precede a la finalización de la transición nativa y también activa ambos paneles divididos expandidos. Mantenga el ajuste de texto, las fuentes escalables y los controles nativos en la página; Este elemento componible no implementa un árbol de accesibilidad alternativo.

## Movimiento reducido {#reduced-motion}

`createRouter({ routes, motion: 'system' })` es el valor predeterminado. En cada inicio de navegación enrutada o vista previa hacia atrás, se lee UIKit Reducir movimiento o la configuración habilitada para animador de Android (con el respaldo de escala de duración anterior a 26 de Android).

| Política  | Comportamiento del enrutador                                                                                                                 |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `system`  | Respeta la preferencia actual del sistema operativo. No es necesario reiniciar.                                                              |
| `reduced` | Omitir vista previa/zoom/transiciones compartidas propiedad del enrutador; Solicite presentación push, back y modal no animada.              |
| `full`    | Deje disponibles las opciones de transición normal/nativa de enrutador. UIKit/Android aún puede aplicar su propia política de accesibilidad. |

El movimiento reducido no cambia las rutas, guards, los resultados modales o el historial. Se libera el estado de transición compartida que se omite. Los gestos interactivos nativos y las transiciones fuera de este enrutador continúan siguiendo el comportamiento de la plataforma. Las aplicaciones que se excluyen con `full` deberían ofrecer una preferencia de aplicación considerada.

## Validación {#validation}

Consulte el `test/native-accessibility.md` del repositorio para ver aserciones nativas y comprobaciones manuales destacadas de VoiceOver/TalkBack. Pruebe un modal sucio, un deslizamiento cancelado, ambos anchos de división, objetivos no disponibles y texto grande en la aplicación real. Consulte [NativeScript accesibilidad](https://docs.nativescript.org/guide/accessibility), [UIKit cambios de diseño](https://developer.apple.com/documentation/uikit/uiaccessibility/notification/layoutchanged), [guards](./guards) y [transiciones](./transitions).
