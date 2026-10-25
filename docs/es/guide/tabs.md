# Fichas y otros independientes stacks {#tabs-and-other-independent-stacks}

Consulte [Capacidades nativas y opciones de contenedor](./capabilities) para conocer la propiedad, los límites de la plataforma y la distinción rc.2/rc.3.

`<RouterTabs>` coloca el nombre stacks detrás de una barra de pestañas nativa y mantiene los dos en el mismo paso:

```vue
<RouterTabs v-model:selected="tab" sidebar minimize="onScrollDown">
  <RouterTab name="inbox" title="Inbox" icon="tray.fill" androidIcon="sys://ic_dialog_email" :badge="unread">
    <RouterSplitView name="inbox" list="/" backToRootOnReselect />
  </RouterTab>
  <RouterTab name="settings" title="Settings" icon="gearshape.fill">
    <RouterView name="settings" initial="/settings" backToRootOnReselect />
  </RouterTab>
</RouterTabs>
```

<div class="clips">
<Clip name="ios-tabs" caption="Las pestañas mantienen su propio historial. Al tocar Bandeja de entrada nuevamente, se regresa a su raíz. Simulador iOS 26." />
<Clip name="android-tabs" aspect="9 / 20" caption="El mismo stacks detrás de la navegación inferior de Material. Emulador Android 16." />
</div>

- **iOS** es `UITabBarController`, con `UITab` en iOS 18 y posteriores: `icon` es un símbolo SF, `badge` va en la pestaña, `sidebar` se enciende La barra lateral de UIKit en iPad, `minimize="onScrollDown"` permite que la barra iOS 26 se reduzca mientras se desplaza, y `role="search"` crea una pestaña de búsqueda.
- **Android** es un `BottomNavigationView` de Material, o un `NavigationRailView` de `rail` (600) píxeles de ancho independientes del dispositivo; `androidIcon` es un nombre dibujable o `sys://` más un nombre `android.R.drawable`. Sin la biblioteca de materiales, el núcleo `TabView` se representa en la parte inferior; `supportsNativeTabs()` lo cuenta.
- Una navegación en un stack que se encuentra en otra pestaña hace que esa pestaña avance primero, por lo que `router.push(to, { frame: 'settings' })` y los enlaces profundos aparecen a la vista. El cambio de pestañas no ejecuta ninguna ruta guard; `canSelect(name)` puede rechazar un grifo y los eventos `select`/`reselect` dicen lo que sucedió. `v-model:selected` contiene el nombre de la pestaña.

Utilice hasta cinco destinos para que se ajusten tanto a la barra inferior Android como al riel. `:rail="0"` mantiene la barra inferior en todos los anchos. Cambiar el tamaño entre la barra y el riel preserva el stacks montado y sus historias.

`canSelect` se aplica a la selección del usuario. Los cambios a `selected` y la navegación a un stack con nombre lo seleccionan directamente; proteger rutas con la ruta guards. La pestaña de destino se revela antes de que se ejecute su navegación, incluso cuando un guard posteriormente rechaza esa navegación. Fuera de una página, `router.currentRoute`, navegación y Android atrás siguen la pestaña visible.

El enrutador guarda los historiales de stack con `restore`. Persista `v-model:selected` por separado si la aplicación debe volver a la misma pestaña después de la terminación del proceso; restaurar el stacks no cambia esa selección.

## Ocultar navegación en una página de detalles {#hide-navigation-on-a-detail-page}

Establecer `meta.tabBarVisibility` en una ruta. La página superior comprometida de la pestaña seleccionada controla su propiedad `RouterTabs`:

```ts
const router = createRouter({
  routes: [
    { path: '/inbox', component: Inbox },
    {
      path: '/inbox/detail',
      component: Message,
      meta: { tabBarVisibility: 'hidden' },
    },
    { path: '/saved', component: Saved },
  ],
})

// From Inbox: the existing Frame pushes Message and the bar disappears.
await router.push('/inbox/detail', { frame: 'inbox' })
// Native Back or router.back() restores Inbox and its bar.
```

Utilice esta tabla de rutas con los dos `RouterTab` / `RouterView` stacks anteriores. Mantenga un botón nativo Back u otro modo de retroceder en páginas ocultas.

| Valor               | Significado                                                                                              |
| ------------------- | -------------------------------------------------------------------------------------------------------- |
| `hidden`            | Oculta la barra inferior soportada o el riel de material y libera su espacio de diseño.                  |
| `visible`           | Mostrar navegación, incluso dentro de una ruta principal marcada como `hidden`.                          |
| `inherit` u omitido | Utilice el padre coincidente más cercano con un valor explícito; de lo contrario, muestra la navegación. |

La herencia sigue los registros de ruta coincidentes, no la página anterior del historial. Las rutas explícitas y las rutas de archivos (`definePageMeta({ meta: { tabBarVisibility: 'hidden' } })`) utilizan la misma política.

La política cambia **después de que la navegación nativa se confirma**, sin agregar una animación. Push, replace, Back nativo, restablecimientos de raíz, restauración y enlaces entrantes utilizan la ruta confirmada. Un guard pendiente/rechazado, una carga de página fallida o un Back interactivo cancelado mantienen la presentación actual. Durante un gesto interactivo, el estado de la barra de la página actual permanece en su lugar hasta su finalización; El movimiento reducido no obtiene una animación de barra adicional.

Cada pestaña recuerda su propia política. Al seleccionar otra pestaña se utiliza la página actual de esa pestaña; conserva tanto los historiales como las instancias de páginas. Un modal deja sus pestañas de presentación sin cambios. Un `RouterTabs` anidado posee su propia política y los contenedores/ventanas independientes no la comparten. Utilice un `RouterView` o `RouterSplitView` por pestaña; para navegación dividida, la ruta superior lógica proporciona la política. La eliminación restaura el estado original de UIKit.

| Anfitrión                                        | Soporte                                                                                                                                                                |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| iOS 18+ barra de pestañas inferior               | Público UIKit `setTabBarHidden:animated:`; UIKit vuelve a calcular el área segura.                                                                                     |
| `sidebar` en iOS                                 | Mantiene visible la navegación nativa, incluidas las presentaciones compactas. Deshabilite `sidebar` para utilizar la ocultación por página.                           |
| Android Barra/riel inferior de material          | Contrae la vista nativa y su fila/columna de diseño de tamaño automático; La navegación oculta está excluida de la accesibilidad.                                      |
| UIKit / Android Core anterior / simple `TabView` | Sin ocultación por página. La navegación existente permanece visible. `supportsNativeTabs()` por sí solo no verifica la limitación de la versión/barra lateral de iOS. |

<div class="clips">
<Clip name="ios-tabs-visibility" caption="Las páginas de detalles ocultan la barra; la navegación comprometida lo restaura. Simulador iOS 26." />
<Clip name="android-tabs-visibility" aspect="9 / 20" caption="La barra inferior de material y el riel liberan su espacio sin reemplazar la página. Emulador Android 14." />
</div>

Ejemplo ejecutable: [`demo/src/testing/tabsvisibility-app.ts`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/testing/tabsvisibility-app.ts). Compile el paquete y luego ejecute `ns run ios --env.tabsvisibilityTest` o `ns run android --env.tabsvisibilityTest` en `demo`. [Instrucciones de aceptación nativas](https://github.com/rafaelaugustos/vue-router-ns/tree/main/scripts/native/tabs-visibility) cubren gestos reales, guards, diseño, restauración y enlaces en frío.

## Colores y etiquetas {#colors-and-labels}

Utilice los nombres de colores de pestañas existentes de NativeScript en `RouterTabs`. Estos actualizan la barra nativa actual sin volver a montar páginas ni restablecer historiales:

```vue
<script setup lang="ts">
import { ref } from 'nativescript-vue'
import { RouterTabs, RouterTab, RouterView } from 'vue-router-ns'
const dark = ref(false)
</script>

<template>
  <RouterTabs
    :tabBackgroundColor="dark ? '#172033' : '#f1f5f9'"
    :tabTextColor="dark ? '#cbd5e1' : '#475569'"
    :selectedTabTextColor="dark ? '#38bdf8' : '#2563eb'"
    labelVisibility="labeled"
  >
    <RouterTab
      name="inbox"
      title="Inbox"
      icon="tray.fill"
      androidIcon="sys://ic_dialog_email"
      :badge="2"
    >
      <RouterView name="inbox" initial="/inbox" />
    </RouterTab>
    <RouterTab
      name="saved"
      title="Saved"
      icon="bookmark.fill"
      androidIcon="sys://ic_menu_save"
    >
      <RouterView name="saved" initial="/saved" />
    </RouterTab>
  </RouterTabs>
</template>
```

| Prop                   | CSS                       | Significado                                                                                             |
| ---------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------- |
| `tabBackgroundColor`   | `tab-background-color`    | Fondo/tinte de barra nativa.                                                                            |
| `tabTextColor`         | `tab-text-color`          | Títulos no seleccionados; también iconos de plantilla en UIKit y Material.                              |
| `selectedTabTextColor` | `selected-tab-text-color` | Títulos seleccionados; también iconos de plantilla en UIKit y Material.                                 |
| `labelVisibility`      | —                         | Material: `auto`, `selected`, `labeled` o `unlabeled`. Omita el uso del tema predeterminado del widget. |

Los accesorios de color aceptan una cadena o NativeScript `Color`. En su lugar, puedes usar una clase en `RouterTabs`:

```css
.app-tabs {
  tab-background-color: #f1f5f9;
  tab-text-color: #475569;
  selected-tab-text-color: #2563eb;
}
.ns-dark .app-tabs {
  tab-background-color: #172033;
  tab-text-color: #cbd5e1;
  selected-tab-text-color: #38bdf8;
}
```

La clase se aplica a la raíz nativa (`TabView` en iOS/refuerzo de núcleo, `RouterTabsHost` en Material). Utilice un selector de clases para ambas plataformas. Estos colores de pestaña no heredan de un padre y no cambian los colores de la página. Los accesorios explícitos y el estilo en línea son valores locales de NativeScript y tienen prioridad sobre las reglas de las hojas de estilo; Evite establecer el mismo color en ambos. Los colores omitidos conservan los valores predeterminados de la plataforma/tema. Los colores fijos no se invierten automáticamente en el modo oscuro: vincule una paleta o use las clases CSS claro/oscuro de NativeScript. Cambiar una paleta o clase actualiza el widget existente, incluido un riel creado después de cambiar el tamaño.

El material admite los cuatro modos de etiqueta tanto en la navegación inferior como en el carril. Ocultar una etiqueta conserva su título y descripción de accesibilidad. UIKit y el núcleo `TabView` ignoran `labelVisibility` y mantienen su diseño de título nativo. El respaldo Core Android admite las tres propiedades de color existentes para fondo/texto; El tinte del icono sigue siendo el comportamiento de Core. El material sigue siendo opcional.

En iOS, estos colores dan estilo a la barra de pestañas utilizando las API de apariencia de Core y el tinte de icono de plantilla de UIKit. No tienen como tema la barra lateral iPad. UIKit controla las filas de la barra lateral, la ubicación, la visibilidad del título y la composición de iOS 26 Liquid Glass; el fondo renderizado puede ser translúcido en lugar de un color exactamente plano. En el registro de aceptación iOS 26, UIKit también conserva el color del sistema para el símbolo SF no seleccionado a pesar de aceptar el tono del icono configurado; los títulos y el icono seleccionado cambian. No dependa del color exacto de los iconos no seleccionados en esa versión. El CSS `TabView` existente (incluidas las fuentes de los títulos) sigue funcionando en ese host; Las propiedades adicionales exclusivas de Core no son un contrato de Material multiplataforma.

<div class="clips">
<Clip name="ios-tabs-style" caption="Cambiando los colores de las pestañas con las páginas de detalles abiertas. Simulador iOS 26." />
<Clip name="android-tabs-style" aspect="9 / 20" caption="Los colores, las etiquetas y el riel de material cambian mientras ambos stacks permanecen montados. Emulador Android 14." />
</div>

Ejecute el ejemplo compartido [código del ejemplo](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/testing/tabsstyle-app.ts) con `cd demo && ns run ios --env.tabsstyleTest` (o `ns run android --env.tabsstyleTest`). Incluye controles de paleta, etiqueta y riel y un campo de borrador. Consulte [aceptación nativa](https://github.com/rafaelaugustos/vue-router-ns/blob/main/scripts/native/tabs-style/README.md) para ver las comprobaciones automatizadas.

## Barra lateral en iPad {#sidebar-on-ipad}

<Clip name="ipad-tabs" :width="480" aspect="3 / 4" caption="La barra lateral de UIKit selecciona Bandeja de entrada y Configuración, cada uno con su propio stack. Simulador iPadOS 26." />

## Material en las versiones de lanzamiento Android {#material-in-android-release-builds}

El tiempo de ejecución de depuración de NativeScript incluye Material, pero una versión de lanzamiento necesita una dependencia explícita en `App_Resources/Android/app.gradle`:

```groovy
dependencies {
  implementation "com.google.android.material:material:1.12.0"
}
```

`supportsNativeTabs()` informa si el Material está disponible. La barra utiliza el tema Material de la aplicación cuando está presente; de lo contrario, aplica un tema Material solo al widget, incluidas sus insignias. Sin la dependencia, `<RouterTabs>` utiliza el núcleo inferior `TabView` y mantiene la selección con nombre y stacks independiente; Las insignias de material y el riel no están disponibles.

## Otros contenedores de pestañas {#other-tab-containers}

Sin embargo, cualquier contenedor de pestañas funciona. Utilice un `<RouterView>` por stack y asígnele el nombre:

```vue
<TabView>
  <TabViewItem title="Inbox">
    <RouterView name="inbox" initial="/" backToRootOnReselect />
  </TabViewItem>
  <TabViewItem title="Settings">
    <RouterView name="settings" initial="/settings" backToRootOnReselect />
  </TabViewItem>
</TabView>
```

Las páginas navegan en su propia pestaña. Desde cualquier otro lugar, apunte a uno con `{ frame: 'settings' }`.

## Tocando la pestaña activa {#tapping-the-active-tab}

`backToRootOnReselect` se aplica solo a un nuevo toque en la pestaña que ya está seleccionada. Cambiar a otra pestaña conserva ambos historiales. Actualizar `v-model:selected` o navegar o establecer vínculos profundos a otra pestaña no cuenta como una nueva selección. Un `canSelect` rechazado deja la selección y los historiales sin cambios; un guard de salida puede rechazar una reselección a root.

Las barras de pestañas nativas regresan a la primera página cuando tocas la pestaña en la que ya estás. `backToRootOnReselect` hace eso para un `<RouterView>` dentro de un `<TabViewItem>`, a través de la izquierda guards como cualquier trasera. `router.backToRoot()` hace lo mismo bajo demanda.

En iOS, el enrutador escucha frente al delegado de la barra de pestañas, que de lo contrario responde "no" al toque repetido y no se lo dice a nadie. En Android, observa los toques de la pestaña, ya que su propio detector de clics solo cambia de pestaña.

## Pestañas que aún no se han mostrado {#tabs-that-haven-t-been-shown-yet}

En iOS, un `TabView` solo carga la pestaña seleccionada. Un `<RouterView>` en otra pestaña espera su primera página hasta que se abre esa pestaña, y con ella espera una navegación hacia ella (un enlace profundo, por ejemplo). La navegación en el otro stacks no se detiene.

Dentro de `<RouterTabs>`, al apuntar a `{ frame: 'settings' }` se selecciona la pestaña antes de que se muestre la página. Con un `TabView` simple, actualice su `selectedIndex` usted mismo y luego espere a `router.push(to, { frame: 'settings' })`. Los nombres deben ser únicos en `RouterView` y `RouterSplitView`.
