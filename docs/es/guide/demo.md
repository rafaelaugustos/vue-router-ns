# Ejemplos y videos por característica {#examples-and-videos-by-feature}

Pruebe [Fieldnotes, el ejemplo nativo integrado](./native-showcase), para seguir drawer, búsqueda, acciones compartidas, guards y un resultado modal en una sola aplicación.

Consulte [Capacidades nativas y opciones de contenedor](./capabilities) para conocer la propiedad, los límites de la plataforma y la distinción rc.2/rc.3.

Estos clips provienen de los ejemplos de NativeScript-Vue en [`demo/`](https://github.com/rafaelaugustos/vue-router-ns/tree/main/demo), ejecutándose en simuladores y emuladores. Airbnb NS combina funciones de navegación en una aplicación de alojamiento; la aplicación de correo y los accesorios enfocados demuestran API individuales. Ambas aplicaciones utilizan datos de muestra locales.

Los clips son silenciosos, se repiten mientras están visibles y tienen controles de reproducción. Con Reducir movimiento habilitado, esperan a que presiones reproducir.

Elija una función, observe el resultado y copie el fragmento correspondiente. Los ejemplos utilizan componentes NativeScript y la tabla de rutas de demostración. En páginas enrutadas, obtenga `router` con `useRouter()` dentro de `<script setup>`; en la configuración de la aplicación, use la instancia devuelta por `createRouter()`. Importe componentes del enrutador de `vue-router-ns`. Los fragmentos de plantilla pertenecen al componente indicado y no reemplazan la configuración inicial de la aplicación.

[Instalación](./install) · [Transición desde un elemento](./transitions#card-with-routerlink) · [Demo completa](https://github.com/rafaelaugustos/vue-router-ns/tree/main/demo)

<a id="airbnb-ns"></a>

## Airbnb NS: una aplicación de alojamiento {#airbnb-ns-an-accommodation-app}

<Clip name="ios-airbnb" :width="320" caption="Airbnb NS: pestañas nativas, zoom de tarjeta y descarte de gestos, vistas previas del menú contextual y favoritos. Editado a partir de una grabación del simulador iPhone 17 / iOS 26; Las animaciones se reproducen a su velocidad original." />

La grabación de 27 segundos muestra la aplicación usando `vue-router-ns` 0.1.0-rc.2. Tiene un feed de descubrimiento en portugués con carruseles horizontales, favoritos persistentes, pestañas nativas y páginas de detalles que ocultan la barra inferior.

| En la aplicación                                   | Función de enrutador                                                                                                                                                  |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Toca una foto de estancia y regresa con un gesto   | `RouterLink zoom`, con un respaldo `SharedTransition`                                                                                                                 |
| Mantenga presionada una tarjeta                    | `RouterLink menu`: Vista previa de UIKit y acción favorita; Menú emergente Android                                                                                    |
| Explorar y Favoritos                               | Llamado `RouterView` stacks, nativo `RouterTabs`, insignias y accesorios de colores públicos                                                                          |
| Abrir una estadía                                  | `meta.tabBarVisibility: 'hidden'` en hosts nativos compatibles                                                                                                        |
| Aplicar filtros de búsqueda                        | Una hoja que devuelve su valor a través de `pushForResult()`                                                                                                          |
| Cargar detalles y mantener la transición receptiva | Un cargador de rutas fuera de línea experimental y `<Deferred>`                                                                                                       |
| Reabrir una sesión de navegación                   | `restore` y `usePageState()` para historiales, posición de lectura vertical, categoría y galería de fotos; la aplicación persiste en la pestaña seleccionada y filtra |

La grabación cubre las primeras cuatro filas; la búsqueda y la restauración de sesiones en frío son flujos separados. El catálogo y las fotografías están agrupados y el botón de reserva muestra un resumen ficticio. Los viajes, los mensajes y el perfil son marcadores de posición.

Después de la configuración de demostración de [código del ejemplo](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/README.md#airbnb-inspired-navigation-demo), ejecute desde `demo/`:

```sh
npm run airbnb:ios
# or: npm run airbnb:android
```

[Tabla de rutas](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/airbnb/router.ts) · [Pestañas nativas](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/airbnb/App.vue) · [Página de estancia](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/airbnb/pages/Stay.vue) · [Límites completos de fuente y plataforma](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/README.md#airbnb-inspired-navigation-demo)

## Datos del producto, error y reintento {#product-data-error-and-retry}

Declara un cargador de ruta escrito y representa pendiente/error/éxito dentro de un Page nativo. Back y reintentar conservan la navegación nativa; la caché de una aplicación puede compartir solicitudes entre entradas. [Ejemplo completo y vídeos](./data-loading).

## Abrir una página desde una tarjeta {#open-a-page-from-a-card}

<Clip name="ios-zoom" caption="La tarjeta abre el mensaje con zoom UIKit y recibe la transición de retorno. Simulador iOS 26." />

El elemento tocado puede ser la fuente del zoom nativo de UIKit. Dale a `RouterLink` un solo hijo; Android y los tiempos de ejecución sin la API de zoom utilizan la transición normal.

```vue
<RouterLink :to="{ name: 'message', params: { id: 1 } }" zoom>
  <StackLayout padding="24" borderRadius="16" backgroundColor="#dbeafe">
    <Label text="Ana" color="#1e3a8a" />
    <Label text="Lunch on Friday?" color="#1e3a8a" />
  </StackLayout>
</RouterLink>
```

[Ejemplo completo: tarjeta, listado con `zoomFrom`, destino y rutas](./transitions#card-with-routerlink). Zoom requiere iOS 18+ y soporte de tiempo de ejecución. En la demostración, abra Configuración → Zoom desde una tarjeta.

## Pestañas con historias independientes {#tabs-with-independent-histories}

Abre un mensaje, cambia de pestaña y vuelve al mismo mensaje. Toque la pestaña seleccionada nuevamente para volver a su raíz. [Configurar pestañas nativas](./tabs).

<div class="clips">
<Clip name="ios-tabs" caption="Pestañas UIKit en iPhone, incluida la reselección a raíz." />
<Clip name="android-tabs" aspect="9 / 20" caption="La misma navegación con pestañas de Material en Android." />
</div>

<Clip name="ipad-tabs" :width="480" aspect="3 / 4" caption="La barra lateral de UIKit selecciona el mismo nombre stacks en iPad." />

```vue
<RouterTabs sidebar>
  <RouterTab name="inbox" title="Inbox" icon="tray.fill">
    <RouterView name="inbox" initial="/" backToRootOnReselect />
  </RouterTab>
  <RouterTab name="settings" title="Settings" icon="gearshape.fill">
    <RouterView name="settings" initial="/settings" backToRootOnReselect />
  </RouterTab>
</RouterTabs>
```

En la raíz de la aplicación. `sidebar` habilita la barra lateral iPad; cada `RouterView` conserva su propio stack. Navegar con `{ frame: 'settings' }` también selecciona esa pestaña. [Fuente completa](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/App.vue).

## Empujar, retroceder y listar/detallar {#push-back-and-list-detail}

El rastro en la parte inferior es el enrutador en vivo stack. Abrir otro mensaje agrega una entrada; Back a la bandeja de entrada elimina los detalles en una sola navegación. Una ventana amplia mantiene la lista visible. [Navegación](./navigating) · [Lista y detalle](./split-view).

<div class="clips">
<Clip name="ios-navigation" caption="Envía dos mensajes y regresa a la bandeja de entrada en iPhone." />
<Clip name="ipad-split" :width="360" aspect="3 / 4" caption="Envía mensajes al panel de detalles mientras la bandeja de entrada permanece visible en iPad." />
</div>

```ts
await router.push({ name: 'message', params: { id: 1 } })
await router.push({ name: 'message', params: { id: 2 } })
await router.backToRoot()
```

En una ventana amplia, reemplace la bandeja de entrada `RouterView` con:

```vue
<RouterSplitView name="inbox" list="/" :breakpoint="840" :listWidth="320" />
```

Debajo del punto de interrupción, la lista y los detalles utilizan la navegación de una sola columna. Encima, la lista permanece visible mientras se abren los detalles. [Fuente completa](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/pages/Message.vue).

## Hojas en ambas plataformas {#sheets-on-both-platforms}

Compose utiliza una hoja UIKit con retenes en iOS y un material bottom sheet en Android. Ambos albergan una página enrutada con su propia barra de navegación nativa. [Modales y resultados](./modals).

<div class="clips">
<Clip name="ios-sheet" caption="Abra, expanda y cierre la hoja de redacción en iPhone." />
<Clip name="android-sheet" aspect="9 / 20" caption="Abrir la hoja de Material y descartarla con el sistema Back." />
</div>

```ts
router.push('/compose', {
  modal: {
    ios: { detents: ['medium', 'large'], grabber: true },
    android: { sheet: { state: 'expanded', height: 520 } },
  },
})
```

Toque Redactar, arrastre la hoja y ciérrela con Cancelar o Back. Agregue material a la versión de lanzamiento Android como se describe en la guía [Modales y resultados](./modals). [Fuente completa](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/pages/Inbox.vue).

## Vista previa antes de navegar {#preview-before-navigating}

Una pulsación larga muestra una vista previa del mensaje y acciones. Al tocar la vista previa se abre la ruta. [Menús contextuales](./context-menus).

<Clip name="ios-context-menu" caption="Vista previa nativa de UIKit y la página de mensaje resultante." />

```vue
<RouterLink to="/messages/1" :menu="{ preview: MessagePreview, props: { id: 1 } }">
  <Label text="Lunch on Friday?" padding="24" />
</RouterLink>
```

Importar `MessagePreview` desde `demo/src/components/MessagePreview.vue`. La vista previa no agrega una página al stack; al tocar la vista previa se confirma la navegación. Android presenta un menú sin vista previa en vivo. [Fuente completa](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/pages/Inbox.vue).

## Guardas y restauración de formas {#guards-and-form-restoration}

La cuenta requiere una sesión. El guard redirige al inicio de sesión y al escribir un nombre se activa un permiso para salir del guard. En Android, ese estado de formulario también puede sobrevivir a que el sistema operativo elimine el proceso en segundo plano. [Guardias](./guards) · [Restauración](./restore).

<div class="clips">
<Clip name="ios-guards" caption="Stay mantiene el nombre escrito; Salir permite que la página se cierre." />
<Clip name="android-restore" aspect="9 / 20" caption="Escriba un nombre, ponga en segundo plano la demostración, finalice su proceso y luego vuelva a abrirla con el formulario restaurado." />
</div>

```ts
import { Dialogs } from '@nativescript/core'
import { ref } from 'nativescript-vue'
import { onBeforeRouteLeave, usePageState } from 'vue-router-ns'

const name = ref('')
onBeforeRouteLeave(() => Dialogs.confirm('Discard this draft?'), {
  when: () => name.value.trim() !== '',
})
usePageState<{ name: string }>('form', {
  save: () => ({ name: name.value }),
  restore: (saved) => {
    name.value = saved.name
  },
})
```

Vincula `name` a un `<TextField v-model="name" />`. La persistencia después de la terminación del proceso también requiere [`restore.save` y `restore.load`](./restore). La autenticación guard reside en [`demo/src/router.ts`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/router.ts). [Fuente completa](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/pages/Login.vue).

## Búsqueda nativa y drawer {#native-search-and-drawer}

La búsqueda filtra la página actual sin agregar rutas. El Android drawer toma destinos a través de la política de enlace del enrutador y se cierra antes de que aparezca una página. [Búsqueda nativa](./native-bars) · [Cajón](./drawer).

<div class="clips">
<Clip name="ios-search" caption="La página posee su campo de búsqueda y consulta nativos." />
<Clip name="android-drawer" aspect="9 / 20" caption="Seleccione Configuración desde el drawer, luego cierre el drawer con el sistema Back." />
</div>

```ts
import { computed, ref } from 'nativescript-vue'
import { useNativeSearch } from 'vue-router-ns'

const query = ref('')
const messages = [{ subject: 'Lunch on Friday?' }, { subject: 'Release notes' }]
const search = useNativeSearch({ query, placeholder: 'Search messages' })
const filtered = computed(() =>
  messages.filter((message) =>
    message.subject.toLowerCase().includes(query.value.toLowerCase()),
  ),
)
```

Utilice `filtered` como `:items` de `ListView` y llame a `search.activate()` desde un `ActionItem`. Para drawer, declare `const menuOpen = ref(false)` en la raíz de la aplicación y alterne con un botón:

```vue
<RouterDrawer v-model:open="menuOpen">
  <template #drawer>
    <StackLayout>
      <Button text="Inbox" @tap="router.push('/')" />
      <Button text="Settings" @tap="router.push('/settings')" />
    </StackLayout>
  </template>
  <RouterView />
</RouterDrawer>
```

Este ejemplo mínimo tiene un stack. La demostración completa combina drawer y pestañas; en iOS el contenido permanece visible y el drawer se omite. [Fuente completa](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/App.vue).

## Elija convenciones de archivo {#choose-file-conventions}

El ejemplo de colección separada utiliza rutas generadas, un diseño nativo, middleware de autenticación y un resultado modal escrito. Ambos estilos de creación utilizan el mismo enrutador nativo. [Configuración y fuente opcionales](./file-routing).

<div class="clips">
<Clip name="ios-file-routing" caption="Rutas generadas en iOS: detalle, resultado modal y cuenta custodiada." />
<Clip name="android-file-routing" aspect="9 / 20" caption="El mismo flujo de recopilación en las páginas nativas Android." />
</div>

```text
src/pages/
  index.vue          → /
  messages/[id].vue  → /messages/:id
  compose.vue        → /compose
```

Elija el complemento [webpack o Vite](./file-routing) para generar esta tabla. Los ejemplos [layouts](./layouts) y [middleware](./middleware) muestran cómo agregar convenciones; declarar `routes` en TypeScript sigue siendo una opción independiente. [Fuente completa](https://github.com/rafaelaugustos/vue-router-ns/blob/main/examples/file-routing/README.md).

## Recibir un resultado de otra página {#receive-a-result-from-another-page}

<Clip name="ios-modal-result" caption="Responder abre el modal; Enviar devuelve el texto al mensaje de origen a través de pushForResult. Simulador iOS 26." />

Abrir Responder en un mensaje. Al enviar, la respuesta aparece en la página que abrió el modal.

```ts
import { ref } from 'nativescript-vue'
import { useRouter } from 'vue-router-ns'

const router = useRouter()
const reply = ref<string>()
async function compose() {
  reply.value = await router.pushForResult<string>('/compose')
}
```

En Redactar, llame a `router.back({ result: text.value })`. Cerrar sin enviar resuelve con `undefined`. El tipo describe el contrato entre páginas. [Guía](./modals) · [Fuente completa](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/pages/Message.vue).

## Abrir un enlace en la pestaña correcta {#open-a-link-in-the-correct-tab}

<Clip name="ios-deep-link" caption="El sistema entrega vuerouterns://settings/account. Se selecciona Configuración y su guard abre el inicio de sesión. Simulador iOS 26." />

En la configuración de la aplicación, use los mismos nombres stack que `RouterTabs`.

```ts
const router = createRouter({
  routes,
  links: {
    schemes: ['https', 'vuerouterns'],
    hosts: ['vue-router-ns.rafaelaugusto.dev'],
    frame: (to) => (to.path.startsWith('/settings') ? 'settings' : 'inbox'),
  },
})

await router.openLink('vuerouterns://messages/1')
```

Pruebe también `vuerouterns://settings/account` sin iniciar sesión: el guard debería abrir el inicio de sesión en Configuración. La entrega de URL del sistema operativo requiere una configuración de asociación de dominio/esquema nativo; `openLink()` envía pruebas dentro de la aplicación. [Ejemplos de configuración y notificación](./deep-links).

## Atajos en el ícono de la aplicación {#shortcuts-on-the-app-icon}

<Clip name="ios-shortcuts" caption="Mantenga presionado el ícono de demostración y elija Nuevo mensaje para abrir su ruta a través de una acción rápida nativa. Simulador iOS 26." />

Publicar destinos después de que la aplicación esté lista, como en `demo/src/app.ts`.

```ts
router.setShortcuts([
  {
    id: 'compose',
    title: 'New message',
    to: '/compose',
    icon: { ios: 'square.and.pencil' },
  },
  { id: 'settings', title: 'Settings', to: '/settings' },
])
```

Mantenga presionado el ícono de la aplicación en el iniciador/SpringBoard y elija Nuevo mensaje. La ruta utiliza la misma guards. Utilice `setShortcuts([])` para eliminar accesos directos dinámicos al cerrar sesión. [Límites y atajos fijados](./deep-links).

## Adjuntar un documento del sistema {#attach-a-system-document}

<Clip name="ios-document-picker" caption="Adjuntar abre el selector de documentos iOS. Al cancelar se regresa al formulario con Picker cancelado, sin agregar una ruta." />

En la configuración de una página enrutada, prepare el selector y llame a `attach()` desde un botón Adjuntar.

```ts
import { ref } from 'nativescript-vue'
import { createDocumentPicker, useNativeFlow } from 'vue-router-ns'

const attachments = ref<string[]>([])
const picker = useNativeFlow(createDocumentPicker())
async function attach() {
  const outcome = await picker.run({ types: ['application/pdf'], multiple: true })
  if (outcome.status === 'completed') attachments.value = outcome.value.uris
  else if (outcome.status === 'failed') console.error(outcome.error)
}
```

Elija un PDF o cancele. La página permanece en la misma entrada del historial; La cancelación conserva la selección anterior. Los URI no garantizan un permiso permanente: la lectura y el acceso persistente pertenecen a la aplicación. [Selector completo y ciclo de vida](./native-flows).

## Devolver el foco al botón que abrió un modal {#return-focus-to-the-button-that-opened-a-modal}

Con VoiceOver o TalkBack habilitado, abre y cierra Responder. El foco debería volver al botón de inicio.

```ts
import { useNavigationFocus, useRouter } from 'vue-router-ns'

const router = useRouter()
const focus = useNavigationFocus({ initial: 'heading', return: 'reply' })
async function reply() {
  focus.remember('reply')
  await router.pushForResult('/compose')
}
```

```vue
<Label id="heading" text="Message" accessible="true" />
<Button id="reply" text="Reply" @tap="reply" />
```

Coloca los controles dentro de la página. Este es un enfoque de accesibilidad, no de teclado. El `motion: 'system'` predeterminado respeta el movimiento reducido. [Ejemplo completo y límites](./accessibility).

## Construye un stack con un camino de regreso predecible {#build-a-stack-with-a-predictable-way-back}

Utilice una lista de destinos cuando un punto de entrada necesite un historial específico.

```ts
await router.setStack(['/', '/messages/1', '/messages/2'])
await router.back()
await router.backToRoot({ animated: false })
```

Después de `setStack`, Back abre el mensaje 1; el último comando regresa a la bandeja de entrada sin animación. Los guardias pueden interrumpir la secuencia y los pasos completados permanecen. [Configuración del stack](./stack).

## Ejemplos más completos {#more-complete-examples}

- [Comandos de teclado](./keyboard): Cmd/Ctrl, Escape y ámbitos de página.
- [Rutas mecanografiadas](./typed-routes): nombres y parámetros comprobados por TypeScript.
- [Destinos nativos](./native-destinations): integrar UIViewController y Fragment (experimental).
- [Predictive back](./android-back): Android vistas previas y cancelación de gestos.
- [Diagnostics](./diagnostics): observar fallas, transiciones e historial.

Los videos son grabaciones de navegación nativa. El ejemplo de enfoque incluye pasos de VoiceOver/TalkBack: un vídeo silencioso no muestra anuncios del lector de pantalla.

## Ejecute la misma aplicación {#run-the-same-app}

Instale [NativeScript CLI](https://docs.nativescript.org/setup/), luego cree el enrutador local desde la raíz del repositorio:

```sh
npm install
npm run build
cd demo
npm install
ns run ios
# or: ns run android
```

La demostración resuelve `vue-router-ns` desde el directorio local `dist`. Utilice `npm run dev` en una terminal separada mientras cambia el enrutador. Consulte la demostración [REDME](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/README.md) para conocer las API utilizadas por cada página.
