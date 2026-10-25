# Instalar y abrir una página {#install-and-open-a-page}

Necesita el Nodo 20.19.4+, NativeScript-Vue 3.1.2+ (3.x) y NativeScript Core 9.1.3+ (9.x). Prepare los SDK nativos con la configuración del entorno [NativeScript](https://docs.nativescript.org/setup/); La construcción de iOS localmente requiere macOS y Xcode. La línea de base completamente probada se encuentra en [compatibilidad](./compatibility).

## Crear o utilizar un proyecto NativeScript-Vue {#create-or-use-a-nativescript-vue-project}

Si ya tienes una aplicación NativeScript-Vue en ejecución, usa su directorio. De lo contrario, siga el iniciador oficial NativeScript-Vue [guía de instalación de NativeScript-Vue](https://nativescript-vue.org/docs/getting-started/installation):

```sh
ns create pocket-notes --template @nativescript-vue/template-blank@latest
cd pocket-notes
```

Instale el enrutador en ese proyecto:

```sh
npm install vue-router-ns@next
```

La etiqueta `next` selecciona un candidato de lanzamiento. Confirme el archivo de bloqueo resultante para instalaciones reproducibles.

## Empezando {#getting-started}

Utilice esta estructura mínima en el directorio `src` del proyecto. Reemplace el nivel de aplicación inicial Frame con `RouterView`; el enrutador crea su Frame nativo.

```ts
// src/router.ts
import { createRouter } from 'vue-router-ns'

export const router = createRouter({
  routes: [{ path: '/', component: () => import('./pages/Home.vue') }],
})
```

```ts
// src/app.ts
import { createApp } from 'nativescript-vue'
import App from './App.vue'
import { router } from './router'

createApp(App).use(router).start()
```

```vue
<!-- src/App.vue -->
<template>
  <RouterView />
</template>
```

```vue
<!-- src/pages/Home.vue -->
<template>
  <Page>
    <ActionBar title="Pocket notes" />
    <Label text="Your first native page" margin="24" />
  </Page>
</template>
```

Ejecutar en un simulador/emulador configurado o dispositivo conectado:

```sh
ns run ios
# or:
ns run android
```

Deberías ver **Pocket notes** y **Your first native page**; los textos del ejemplo están en inglés. Continúe con [Crea tu primera aplicación](./first-app): agregue una lista, una página de detalles, un resultado modal y un guard de edición no guardada usando archivos completos.

## Pruébalo en línea {#try-it-online}

El patio de juegos [StackBlitz](./playground) proporciona un editor de navegador conectado a NativeScript Preview en su dispositivo. Su tiempo de ejecución nativo prediseñado tiene límites; Consulte esa guía antes de evaluar las funciones específicas de la plataforma.

## La aplicación de demostración {#the-demo-app}

Para ejecutar los ejemplos del repositorio en lugar de crear un proyecto, siga la configuración de pago de [Fieldnotes](./native-showcase#run-from-a-checkout). Utilice `npm run tutorial:ios` / `tutorial:android` de `demo` para el tutorial de la primera aplicación, `showcase:ios` / `showcase:android` para Fieldnotes o `ns run ios` / `ns run android` para la aplicación de correo predeterminada. Todas las entradas comparten el ID de la aplicación de demostración, por lo que instalar una reemplaza a la otra en ese dispositivo.

## Solución de problemas de instalación {#installation-troubleshooting}

Con npm 10, use beta.15 o más reciente. El par opcional Vite de Beta.14 activó el `Cannot read properties of null (reading 'edgesOut')`; el enrutador ya no declara pares Vite o webpack y no requiere `--legacy-peer-deps`.

El enrutamiento de archivos es opcional. Si lo elige, instale el paquete descrito en [su guía](./file-routing). Mantenga un archivo de bloqueo NativeScript Vite funcional en npm 10: ese constructor tiene un problema de resolución de pares opcional separado cuando se inicia sin un archivo de bloqueo. Consulte [, la evidencia de instalación](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/npm-install.md) para ver las combinaciones probadas.
