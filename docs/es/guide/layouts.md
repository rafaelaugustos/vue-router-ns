# Diseños nativos opcionales {#optional-native-layouts}

Los registros de ruta explícitos siguen siendo los predeterminados. Registre diseños solo cuando desee compartir un `Page` nativo, su `ActionBar` y la estructura de la carrocería entre destinos. Los diseños utilizan componentes y ranuras NativeScript-Vue, con las mismas entradas nativas, guards e historial que las páginas existentes. No se agrega tiempo de ejecución de Nuxt, Vue Router o WebView.

## Un propietario para Page y ActionBar {#one-owner-for-page-and-actionbar}

Un diseño seleccionado posee la raíz **one de la entrada `Page`** y su **one `ActionBar`** opcional, directamente dentro de ese Page. Su ranura predeterminada muestra el destino exactamente una vez. El destino suministra contenido del cuerpo, sin otro `Page` o `ActionBar`.

```vue
<!-- layouts/Default.vue -->
<script setup lang="ts">
import { useRoute } from 'vue-router-ns'

const route = useRoute()
</script>

<template>
  <Page>
    <ActionBar :title="String(route.meta.title ?? 'My app')" />
    <GridLayout padding="16">
      <slot />
    </GridLayout>
  </Page>
</template>
```

```vue
<!-- pages/Account.vue: content for a configured layout -->
<script setup lang="ts">
import { ref } from 'nativescript-vue'

const name = ref('')
</script>

<template>
  <StackLayout>
    <Label text="Account" />
    <TextField v-model="name" hint="Your name" />
  </StackLayout>
</template>
```

Coloque ActionItems compartidos, botones de navegación y propiedades nativas Page en el diseño. Puede leer el `useRoute().meta` de la entrada para elegir su título/acciones. Los diseños de Browser Nuxt y el marcado HTML no se convierten en vistas nativas.

## Regístrate y selecciona explícitamente {#register-and-select-explicitly}

```ts
import { createRouter } from 'vue-router-ns'

const router = createRouter({
  layouts: {
    default: () => import('./layouts/Default.vue'),
    compact: () => import('./layouts/Compact.vue'),
  },
  defaultLayout: 'default',
  routes: [
    {
      path: '/account',
      component: () => import('./pages/Account.vue'),
      meta: { title: 'Account' },
    },
    {
      path: '/preview',
      component: () => import('./pages/PreviewBody.vue'),
      meta: { layout: 'compact', title: 'Preview' },
      modal: true,
    },
    {
      path: '/legacy',
      component: () => import('./pages/LegacyPage.vue'),
      meta: { layout: false },
    },
  ],
})
```

`layouts` acepta objetos o fábricas de componentes, incluidas importaciones diferidas de `.vue`. El registro se captura cuando se crea el enrutador. `defaultLayout` es `false` a menos que se establezca explícitamente: registrar un componente llamado `default` por sí solo no lo activa. `meta.layout` selecciona un nombre registrado o `false` para optar por no participar. Sin un diseño seleccionado, el destino sigue el contrato existente y posee su propia raíz `Page`, como lo hace `LegacyPage.vue` arriba.

Los metadatos se fusionan de padre a hijo. Un hijo hereda el diseño de su padre a menos que proporcione otro nombre o `false`. La selección/carga del diseño ocurre después de la entrada guards y el middleware, con la carga de componentes, antes de `beforeResolve`; elija el diseño en los registros de ruta o en un guard anterior. Un valor predeterminado desconocido falla en la creación del enrutador. Un diseño de ruta desconocido o una importación fallida rechaza la navegación y llega a `onError()` antes de que se monte cualquier página nativa. Se puede volver a intentar una importación fallida.

No hay descubrimiento de sistema de archivos en esta API de tiempo de ejecución. El enrutamiento de archivos opcional y la integración de compilación siguen siendo trabajos de hoja de ruta separados; Las matrices de rutas explícitas ahora funcionan con diseños.

## Vida y comportamiento nativo {#lifetime-and-native-behavior}

El código de diseño se puede almacenar en caché, pero **cada entrada nativa obtiene su propio diseño y instancias de destino**. Las referencias locales no se comparten entre visitas, incluidas las rutas repetidas. Una entrada cubierta permanece montada; regresar con Back revela su Page existente y su estado. Al hacer estallar o reemplazar esa entrada, se desmonta su diseño y contenido con la página nativa.

Ambos componentes reciben el mismo `useRoute()` asociado a la entrada, el `useRouter()` asociado al stack y el host nativo. Las props de ruta y las `props` de navegación llegan al destino. Los hooks de activación de layout y página, los guards de salida, los resultados modales y el foco de accesibilidad usan el ciclo de vida existente de la entrada. Un guard registrado en un layout puede proteger la entrada igual que un guard en su contenido.

El diseño y el contenido comparten los espacios de nombres de enlace de la entrada: proporcione claves distintas a `usePageState()` e instale solo un propietario de `useNavigationFocus()` para esa entrada. Sus objetivos pueden estar dentro de cualquiera de los componentes. Se siguen aplicando los límites normales de gestos nativos; consulte [guards](./guards) y [accesibilidad](./accessibility).

Un diseño es por página, mientras que `RouterTabs`, `RouterDrawer` y `RouterSplitView` son contenedores de aplicaciones persistentes. Mantenga esos contenedores fuera del diseño de la página. Seleccionar otro diseño no debe crear otro Frame, reemplazar la barra de pestañas o aplanar un stack.

## Cambios, HMR y diagnósticos {#changes-hmr-and-diagnostics}

El diseño elegido se fija cuando se crea una entrada. Cambiar los metadatos de una ruta o el `meta.layout` de una ruta activa no intercambia el Page nativo de una entrada existente. Para mostrar un diseño diferente, navegue hasta una nueva entrada o reemplace explícitamente la actual (`force: true` al reemplazar la misma ruta). Cambiar el registro o la configuración de `defaultLayout` requiere crear un nuevo enrutador; no se proporciona ninguna API de mutación de registro dinámica.

Durante el desarrollo, el script HMR del diseño o del destino utiliza el reemplazo nativo existente de NativeScript-Vue, Page. Si otra página cubre la entrada en su Frame, el reemplazo espera a que regrese el Frame. Una entrada descartada elimina su recarga pendiente. Se conserva la identidad de entrada/historial; volver a montarlo puede restablecer las referencias de configuración local. Las actualizaciones de solo plantilla siguen el comportamiento normal de HMR de Vue.

Los diagnósticos de desarrollo identifican una raíz Page faltante, páginas de destino anidadas, ActionBars en conflicto/fuera de lugar y ranuras de destino omitidas/repetidas. Estas son advertencias de creación, no un renderizador de producción ni un mecanismo de reparación: los árboles nativos no válidos siguen sin ser compatibles y NativeScript-Vue/Core puede rechazarlos. Mantenga exactamente una raíz Page propiedad del diseño y renderice su ranura predeterminada una vez.
