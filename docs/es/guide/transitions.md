# Zoom y elementos compartidos {#zoom-and-shared-elements}

Toca una tarjeta y deja que la página crezca a partir de ella. En Back, se reduce al mismo elemento. Este es el zoom nativo de UIKit, disponible en iOS 18+ cuando el tiempo de ejecución expone `UIViewControllerTransition`. Android y los tiempos de ejecución sin esa API utilizan la transición normal o un respaldo explícito.

<Clip name="ios-zoom" caption="La tarjeta abre el mensaje con zoom UIKit y recibe la transición de retorno. Simulador iOS 26." />

## Tarjeta con RouterLink {#card-with-routerlink}

Guardar como `Inbox.vue`. El único hijo de `RouterLink` es el elemento fuente; no se necesita ninguna animación ref o JavaScript.

<<< ../../snippets/ZoomCard.vue

## Destino y configuración {#destination-and-setup}

Guarda el destino como `Message.vue`:

<<< ../../snippets/ZoomMessage.vue

Registre ambas páginas e instale el enrutador en la aplicación, como en la guía de instalación [Instalar y abrir una página](./install):

```ts
import { createRouter } from 'vue-router-ns'

export const router = createRouter({
  routes: [
    { path: '/', component: () => import('./Inbox.vue') },
    {
      path: '/messages/:id',
      name: 'message',
      component: () => import('./Message.vue'),
      props: true,
    },
  ],
})
```

Utilice `<RouterView />` en la raíz de la aplicación. Pruebe primero con un único stack: el primer detalle de una división expandida aparece en otro panel, sin hacer zoom en la lista.

## Listar fila con zoomFrom {#list-row-with-zoomfrom}

Reemplace `Inbox.vue` con esta versión para usar la vista proporcionada por `itemTap`. El destino anterior también tiene la etiqueta requerida para la transición compartida utilizada como alternativa.

<<< ../../snippets/ZoomList.vue

### Qué buscar {#what-to-look-for}

- Toca una fila: el mensaje debería abrirse en el mismo stack.
- Cuando el zoom está disponible, la página crece a partir de la fila. Back debería volver a la fuente.
- Con el movimiento reducido habilitado, el enrutador solicita una transición no animada.
- En Android, las etiquetas con el mismo `sharedTransitionTag` participan en la transición compartida.
- Una animación lateral normal no muestra zoom. Verifique la disponibilidad de la API en tiempo de ejecución y evite `Frame.defaultTransition` en este marco.

La bandeja de entrada de demostración [código del ejemplo](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/pages/Inbox.vue) utiliza `zoomFrom` con un respaldo. Para reproducir el video, abra Configuración → Zoom desde una tarjeta en la demostración. Esta página utiliza un único stack; [ver su fuente](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/pages/Transitions.vue).

## Referencia de transición {#transition-reference}

`transition` toma el `SharedTransition` de NativeScript, que transforma las vistas que comparten un `sharedTransitionTag` de una página a la siguiente, en ambas plataformas:

```vue
<!-- in the list -->
<Image :src="photo.thumb" :sharedTransitionTag="`photo-${photo.id}`" />

<!-- in the photo page -->
<Image :src="photo.full" :sharedTransitionTag="`photo-${photo.id}`" />
```

```ts
import { PageTransition, SharedTransition } from '@nativescript/core'

router.push(`/photos/${photo.id}`, {
  transition: SharedTransition.custom(new PageTransition()),
})
```

Al retroceder se reproduce al revés. Su cierre interactivo (solo `interactive: { dismiss }`, iOS) es un pop nativo, como el deslizamiento hacia atrás: el enrutador lo sigue, pero dejar guard no puede detenerlo.

En iOS 18 y posteriores, `zoomFrom` entrega la animación al zoom de UIKit: la página crece fuera de una vista y se contrae cuando se cierra, mediante el botón Atrás, un deslizamiento desde el borde o un arrastre hacia abajo. Mientras está activo un guard de salida, se mantiene el arrastre, al igual que el deslizamiento hacia atrás.

```ts
function open({ index, view }: ItemEventData) {
  router.push(`/photos/${photos[index].id}`, { zoomFrom: view })
}
```

`zoomFrom` toma una vista, un elemento o componente de plantilla ref, y `<RouterLink zoom>` se aleja de su propio hijo. Si la vista desaparece cuando se cierra la página, la página se cierra sin hacer zoom. Cuando no se aplica el zoom (Android, iOS antes del 18, `animated: false`), la página obtiene su transición habitual, por lo que pasar ambas le da a cada plataforma su propia transición:

```ts
router.push(to, {
  zoomFrom: view, // iOS 18
  transition: SharedTransition.custom(new PageTransition()), // everywhere else
})
```

Una transición predeterminada establecida en el cuadro (`Frame.defaultTransition`) recupera la animación de UIKit, así que déjala sin configurar donde haces zoom.

Consulte [propiedad y límites de transición interactiva](./interactive-transitions) antes de diseñar adaptadores de gestos personalizados.
