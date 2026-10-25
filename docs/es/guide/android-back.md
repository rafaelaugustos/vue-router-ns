# Android respaldo predictivo {#android-predictive-back}

En Android 14 y posteriores, el enrutador muestra la página anterior al deslizar hacia atrás. La página actual se reduce y sigue el dedo, revelando la que está debajo. La cancelación restaura ambas páginas; soltar finaliza el movimiento y regresa a través del enrutador, incluido su guards.

La vista previa funciona entre páginas del mismo stack, incluidas páginas dentro de un modal. La primera página de un modal todavía usa el despido normal, sin obtener una vista previa del stack debajo. Back de la primera página de la aplicación aún sale de la aplicación. Las páginas con una licencia activa guard no inician una vista previa. Si la vista nativa anterior no está disponible, la navegación hacia atrás normal aún funciona.

## Personalización {#customizing}

La vista previa está habilitada de forma predeterminada. Para reemplazar la animación por la suya propia, desactívela en el enrutador:

```ts
const router = createRouter({
  routes,
  backPreview: false,
})
```

`useBackGesture()` permanece disponible con o sin vista previa. Pasa el progreso a la página que se cerraría al deslizar el dedo:

```vue
<script setup lang="ts">
import { computed } from 'nativescript-vue'
import { useBackGesture } from 'vue-router-ns'

const gesture = useBackGesture()
const scale = computed(() => 1 - (gesture.value?.progress ?? 0) * 0.1)
</script>

<template>
  <Page>
    <GridLayout :scaleX="scale" :scaleY="scale">...</GridLayout>
  </Page>
</template>
```

Mientras el usuario arrastra, es `{ progress, edge }`, con `progress` yendo de 0 a 1. El resto del tiempo es `null`: una vez cancelado o liberado el deslizamiento, en iOS, en la primera página (donde sale atrás la app), en la primera página de un modal con `cancelable: false`, y mientras Un guard de salida está activo, ya que dejarlo ir no cerrará simplemente la página. La liberación regresa a través del enrutador como el botón Atrás, incluido guards.

## Habilitándolo {#enabling-it}

Configure `android:enableOnBackInvokedCallback="true"` en `<application>` en `AndroidManifest.xml` para recibir el progreso predictivo en Android 14 y 15, incluso cuando se dirigen a API 36. La opción predeterminada para aplicaciones orientadas a API 36 se aplica solo cuando se ejecutan en Android 16 o posterior.

Consulte también la documentación de respaldo predictivo [Android](https://developer.android.com/guide/navigation/custom-back/predictive-back-gesture).

## Vista previa experimental propiedad de Core {#experimental-core-owned-preview}

El valor predeterminado sigue siendo la vista previa del enrutador existente. Para probar la API Core propuesta [PR #11558](https://github.com/NativeScript/NativeScript/pull/11558), inscríbase explícitamente:

```ts
const router = createRouter({ routes, backPreview: 'core' })
```

Los hosts Frame detectan funciones en una sesión `beginBackPreview()` versión 1. Core 9.1.3 no expone esta API: con esa dependencia publicada, `'core'` usa la vista previa existente. Probar al candidato requiere construir la revisión Core propuesta; el enrutador no parchea los paquetes instalados ni instala automáticamente un Core no publicado. Otros hosts personalizados conservan su propia implementación de vista previa.

El candidato mantiene el Page anterior separado y en su lugar muestra un mapa de bits nativo temporal. Frame posee su disposición durante la navegación, descarga, desprendimiento y recreación de actividades. Los guardias y el historial de rutas aún pertenecen al enrutador. Una licencia activa guard suprime la vista previa antes de que comience; El guards global/asincrónico se ejecuta después del lanzamiento y puede rechazar la navegación. Una navegación más nueva invalida un gesto anterior.

![Core prototipo durante un Android gesto de retroceso](/media/android-core-back-preview.png) real

Esto intercambia tiempo de captura sincrónico y memoria para una propiedad de vista nativa más clara. La instantánea es estática, está limitada a 16 MiB, está oculta y se publica después de su uso. El contenido de SurfaceView/TextureView, las ventanas seguras, las transiciones personalizadas/compartidas y las capturas no compatibles recurren a la vista previa existente. Un Frame modal muestra solo su propio Page anterior.

El candidato también corrige una carrera adjunta Core existente después de la recreación de la Actividad. Esta corrección pertenece a la propuesta anterior; Esta opción de enrutador por sí sola no repara el Core lanzado. Ver los comandos de comparación y reproducción [Android 15/14/16](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-predictive-back.md). Las mediciones del emulador no son una garantía de rendimiento del dispositivo físico y la configuración predeterminada no activará la potencia de este prototipo por sí solo.
