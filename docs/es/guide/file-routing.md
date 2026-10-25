# Rutas opcionales desde archivos (experimental) {#optional-routes-from-files-experimental}

El enrutamiento de archivos genera una matriz de rutas escrita ordinaria para el enrutador nativo existente. Las aplicaciones pueden seguir declarando rutas en JavaScript/TypeScript, generarlas a partir de páginas nativas Vue o combinar tablas independientes. Las páginas aún se representan a través de páginas/marcos NativeScript, con el mismo guards, resultados e historial.

Los complementos opcionales webpack y Vite manejan la generación, la compilación de metadatos y el HMR nativo. Las aplicaciones de ruta explícita no necesitan cambios de compilación. Esto utiliza componentes NativeScript en todas partes; no ejecuta Nuxt, el Vue Router web, un renderizador DOM o navegación WebView, y no convierte plantillas web.

## Configuración de NativeScript webpack {#nativescript-webpack-setup}

Instale `@vue/compiler-sfc@^3.5` y `webpack@^5` como dependencias de desarrollo junto con `@nativescript/webpack` de la aplicación. El compilador sigue siendo un par opcional; el paquete pertenece a la aplicación y el complemento busca webpack 5 cuando se aplica. Agregue el complemento al `webpack.config.js` existente:

```js
const webpack = require('@nativescript/webpack')
const { NativeFileRoutesPlugin } = require('vue-router-ns/file-routing/webpack')

module.exports = (env) => {
  webpack.init(env)
  webpack.chainWebpack((config) => {
    config.plugin('native-file-routes').use(NativeFileRoutesPlugin, [
      {
        platform: env.android ? 'android' : 'ios',
        pagesDir: 'src/pages',
        outDir: 'src/generated/router',
        layoutsDir: 'src/layouts', // optional discovery
        middlewareDir: 'src/middleware', // optional discovery
        autoImports: true, // only the definePageMeta macro
      },
    ])
  })
  return webpack.resolveConfig()
}
```

Las rutas son relativas al contexto del proyecto de webpack (`rootDir` lo anula). La salida debe estar fuera de todos los directorios escaneados. Incluya el directorio generado en `include` de TypeScript e ignórelo en Git. Omita `layoutsDir`/`middlewareDir` o configúrelos en `false` para mantener el registro explícito.

```ts
import { createRouter } from 'vue-router-ns'
import { routes, layouts, installFileRouting } from './generated/router'

export const router = createRouter({ routes, layouts, defaultLayout: 'default' })
const disposeFileRouting = installFileRouting(router)
// Then app.use(router). Dispose with the app/window when it is destroyed.
```

Crea el enrutador una vez. `installFileRouting` registra el middleware descubierto y acepta HMR de tabla de rutas en esa instancia; devuelve una función de limpieza. Elimine `layouts` y `defaultLayout` cuando no utilice un diseño. La aplicación todavía monta normalmente `RouterView`/otros contenedores de enrutadores nativos.

La generación se ejecuta antes de la compilación de webpack, incluidas las compilaciones de reloj `ns run`. Antes de un `tsc --noEmit` independiente, prepare tipos con las mismas opciones en un script de Nodo:

```js
import { prepareFileRouting } from 'vue-router-ns/file-routing/setup'

await prepareFileRouting({
  platform: 'android',
  pagesDir: 'src/pages',
  outDir: 'src/generated/router',
  layoutsDir: 'src/layouts',
  middlewareDir: 'src/middleware',
  autoImports: true,
})
```

Comparta estas opciones entre el script y la configuración webpack. El `index.d.ts` generado describe la plataforma **preparada más recientemente**; Prepare y verifique cada plataforma en secuencia. No genere ambas plataformas simultáneamente en el mismo directorio de salida. NativeScript selecciona `index.android.ts`/`index.ios.ts` en tiempo de ejecución. Los módulos de configuración/complemento/compilador de Node nunca pertenecen a las importaciones de aplicaciones.

## Configuración de NativeScript Vite {#nativescript-vite-setup}

La entrada opcional `vue-router-ns/file-routing/vite` genera las mismas rutas nativas y elimina `definePageMeta` antes de la compilación de Vue. Requiere Vite 8 y `@vue/compiler-sfc@^3.5` como dependencias de desarrollo. El complemento verifica la versión activa de Vite durante la configuración; La instalación del enrutador por sí sola no resuelve un par Vite. Comience con la configuración [NativeScript Vite Vue](https://docs.nativescript.org/configuration/vite), luego agregue el complemento:

```ts
// vite.config.mts
import { defineConfig, mergeConfig } from 'vite'
import { getCliFlags } from '@nativescript/vite'
import { vueConfig } from '@nativescript/vite/vue'
import { nativeFileRoutes } from 'vue-router-ns/file-routing/vite'

export default defineConfig(({ mode }) => {
  const flags = {
    ...getCliFlags(),
    ...JSON.parse(process.env.NATIVESCRIPT_BUNDLER_ENV ?? '{}'),
  }
  if (!flags.android && !flags.ios) throw new Error('Select an Android or iOS build')
  return mergeConfig(vueConfig({ mode }), {
    plugins: [
      nativeFileRoutes({
        platform: flags.android ? 'android' : 'ios',
        pagesDir: 'src/pages',
        outDir: 'src/generated/router',
        layoutsDir: 'src/layouts',
        middlewareDir: 'src/middleware',
        metadataFiles: true, // adjacent .route.json files; native HMR needs no macro
      }),
    ],
  })
})
```

Configure `bundler: 'vite'` y `bundlerConfigPath: 'vite.config.mts'` en `nativescript.config.ts`. Incluya `vite/client` en sus tipos de TypeScript para generar el código `import.meta.hot`. Utilice también `bundler: 'vite'` en llamadas independientes `prepareFileRouting()`. `installFileRouting`, los diseños nativos, el middleware y la composición de rutas explícitas utilizan la misma API de aplicación que se muestra arriba.

Ejecute `ns run android` o `ns run ios --emulator` con HMR habilitado. Utilice metadatos JSON adyacentes como se muestra a continuación. Las tablas de rutas generadas y las ediciones del middleware existente actualizan el enrutador nativo instalado sin reconstruir sus páginas abiertas.

::: warning definePageMeta y HMR nativo Vite
El Vite HMR nativo aún requiere metadatos JSON con `@nativescript/vite` 8.0.20: el problema separado donde el ensamblado SFC nativo omite las transformaciones del precompilador permanece abierto ([NativeScript#11556](https://github.com/NativeScript/NativeScript/issues/11556)). `definePageMeta` funciona en compilaciones Vite incluidas (`--no-hmr`) y webpack. Para Vite HMR nativo, elimine la llamada y use `metadataFiles: true`; el complemento informa un error procesable si queda una macro. No se requiere ningún parche de dependencia para el flujo de trabajo JSON.
:::

Validado con stock `@nativescript/vite` 8.0.20, Vite 8.3.4, Node 22.23.3, Android API 36 y iOS 26. El dispositivo nativo cubre ediciones de plantillas, reemplazo de middleware existente, ediciones de metadatos, agregar/renombrar/eliminar y metadatos no válidos. recuperación. La inspección del paquete excluye el código del compilador/generador y el enrutador web.

El ensamblador nativo Vite probado también requiere un bloque de script no vacío en los SFC; El ensamblaje SFC de solo plantilla sigue siendo una limitación de la plataforma. Las páginas del ejemplo incluyen scripts. `@nativescript/vite` 8.0.20 incluye [NativeScript#11555](https://github.com/NativeScript/NativeScript/pull/11555), que corrige la coincidencia de nombres de paquetes Vue y las importaciones de ayuda de navegación en HMR. Actualice la dependencia de la aplicación y el archivo de bloqueo para recibirla. El ejemplo mantiene `install-links=true` para probar el enrutador local como un paquete empaquetado, que coincide con su diseño publicado; esta aceptación no valida los enlaces sin formato del espacio de trabajo.

## Metadatos al lado de la página {#metadata-beside-the-page}

Habilite `metadataFiles: true` en el complemento y en las opciones independientes de `prepareFileRouting`. Tanto webpack como Vite admiten este formato opcional; por compatibilidad, el valor predeterminado es `false`. Para `src/pages/products/[id].vue`, cree `src/pages/products/[id].route.json`:

```json
{
  "name": "product",
  "layout": "default",
  "middleware": ["auth"],
  "props": true,
  "meta": { "requiresAuth": true }
}
```

Los campos coinciden con `definePageMeta`; el generador valida los datos JSON y genera registros de ruta escritos sin importar JSON ni crear herramientas en la aplicación. Utilice una fuente de metadatos por página: una macro y un sidecar juntos son un error, incluida una macro vacía. Los sidecars que faltan utilizan convenciones de archivos. Los metadatos no válidos mantienen la última tabla generada hasta que se corrijan; Al eliminar un sidecar se restauran los valores predeterminados del archivo.

Un sidecar pertenece al **exactamente seleccionado SFC**: `product.android.vue` dice `product.android.route.json`; `product.vue` lee `product.route.json`. No hay respaldo ni fusión entre sidecars. Mantenga los metadatos compartidos duplicados en las variantes de la plataforma cuando sea necesario. La edición de JSON actualiza las coincidencias futuras, mientras que las entradas abiertas conservan sus instantáneas de ruta y su estado nativo.

## Descubrimiento e importaciones opcionales {#optional-discovery-and-imports}

`layouts/default.vue` registra `default`; un `layouts/account/settings.vue` anidado registra `account-settings`. Discovery no selecciona un diseño predeterminado: establezca `defaultLayout` o los metadatos de la página de forma explícita. Un diseño posee el único `Page` nativo; El contenido enrutado en su interior no debe introducir otro `Page`. Consulte [layouts](./layouts).

Los archivos de middleware exportan de forma predeterminada una función `RouteMiddleware`. `middleware/auth.ts` registra `auth`; `middleware/01-audit.global.ts` registra el middleware global en un orden determinista de nombre de archivo. Los prefijos numéricos pueden expresar orden. El middleware con nombre se ejecuta cuando lo seleccionan los metadatos de la página. El `router.addRouteMiddleware()` explícito permanece disponible; el descubrimiento no anula silenciosamente los nombres duplicados. Consulte [middleware y ayudantes](./middleware).

Ambos directorios admiten variantes `.ios`/`.android` antes de la extensión (por ejemplo, `auth.global.android.ts`). Los nombres permiten letras, dígitos, guiones bajos y guiones, con carpetas anidadas unidas por `-`; Los nombres ambiguos fallan. Las entradas ocultas/guiones bajos se omiten y los enlaces simbólicos se rechazan. Los directorios configurados deben existir.

Con `autoImports: true`, solo una llamada `definePageMeta()` de nivel superior independiente en el `<script setup>` de una página puede omitir su importación. La declaración generada proporciona su tipo. Los enlaces locales y las importaciones de otros módulos conservan su significado. Los ayudantes de tiempo de ejecución siempre utilizan importaciones explícitas. Con el valor predeterminado `autoImports: false`, escriba `import { definePageMeta } from 'vue-router-ns/file-routing'` en su lugar.

## Ejemplo nativo y soporte verificado {#native-example-and-verified-support}

El ejemplo de enrutamiento de archivos [código del ejemplo](https://github.com/rafaelaugustos/vue-router-ns/tree/main/examples/file-routing) incluye un flujo de recopilación/detalle, un borrador editable, dos pestañas nativas stacks, un diseño, middleware de autenticación y un resultado modal escrito. También combina un destino `/about` explícito con rutas generadas. El parque infantil existente [código del ejemplo](https://github.com/rafaelaugustos/vue-router-ns/tree/main/examples/playground) mantiene una configuración de ruta explícita.

<div class="clips">
  <Clip name="ios-file-routing" caption="iOS: lista/detalle nativo, un resultado modal y autenticación mediante rutas generadas." />
  <Clip name="android-file-routing" caption="Android: las mismas convenciones en Páginas y Marcos nativos." aspect="9 / 20" />
</div>

| Capa                           | Configuración verificada                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Integración del enrutador      | Subrutas opcionales experimentales; La API de ruta explícita permanece disponible                      |
| NativeScript-Vue / Core        | 3.1.2 / 9.1.3; una instancia de cada uno en el paquete inspeccionado                                   |
| Constructor/compilador         | `@nativescript/webpack` 5.0.39, webpack 5.112, `@vue/compiler-sfc` 3.5.44                              |
| Nodo / tipos de ejemplo        | Nodo 20.19.4 localmente y Nodo 22 en CI; TypeScript 6.0.3                                              |
| Android                        | Tiempo de ejecución 9.1.1; API 36 localmente, API 34 en el carril CI nativo                            |
| iOS                            | Tiempo de ejecución 9.1.0; Simulador iOS 26, aceptación nativa local                                   |
| Otros constructores/frameworks | webpack y Vite compatibles; El HMR nativo Vite utiliza metadatos JSON. Sin tiempo de ejecución de Nuxt |

`scripts/native/conventions-watch.mjs android|ios` dirige el ejemplo a través de la CLI NativeScript real y edita sus archivos fuente mientras la aplicación se está ejecutando. Comprueba la identidad nativa de Page, borradores, Back, cancelación, redirecciones de autenticación, resultados modales, visibilidad de accesibilidad/objetivos de enfoque y recuperación de relojes. Restaura sus ediciones temporales al salir. Este dispositivo no afirma el habla del lector de pantalla; La cobertura de accesibilidad independiente del enrutador aún se aplica.

Cada complemento utiliza el observador de su paquete. Agregar, cambiar el nombre o eliminar una página y editar solo sus metadatos actualiza las coincidencias futuras sin volver a crear entradas abiertas u otros stacks. Una generación no válida informa un error de compilación y mantiene el último resultado válido; corrigiendo la fuente del currículum vitae. Al cambiar el contenido del script/plantilla de Vue se utiliza el comportamiento HMR existente de Vue y es posible volver a montar el componente/restablecer el estado local. Agregar, eliminar o cambiar el nombre de registros de diseño/middleware requiere reiniciar la aplicación; editar actualizaciones de middleware existentes en el futuro guards sin reconstruir el enrutador. Las ediciones del script Vue pueden volver a montar componentes; Las ediciones de plantillas compatibles conservan el estado de la página probada.

Para volver a rutas explícitas, reemplace las importaciones generadas con sus propias tablas de ruta/diseño, registre el middleware explícitamente y elimine `installFileRouting`, el complemento, su script de preparación y las declaraciones generadas. Reemplace `definePageMeta` con los campos de ruta correspondientes y elimine sus llamadas. El enrutador nativo y su API de navegación siguen siendo los mismos.

## Generar un módulo de ruta {#generate-a-route-module}

Instale `@vue/compiler-sfc@^3.5` como una dependencia de desarrollo cuando utilice el generador. Es un par opcional; las aplicaciones con rutas explícitas no necesitan esta herramienta. Ejecute este script de Nodo antes de compilar la aplicación:

```js
import { writeFileRoutes } from 'vue-router-ns/file-routing/generator'

await writeFileRoutes({
  pagesDir: 'src/pages',
  outFile: 'src/generated/routes.android.ts',
  platform: 'android',
  exclude: ['components'],
})
```

Utilice `platform: 'ios'` y una salida separada para la compilación iOS. Las importaciones en el módulo generado apuntan al SFC seleccionado, en relación con el archivo de salida. NativeScript puede resolver una importación compartida de `./generated/routes` a su archivo de plataforma; La configuración TypeScript de la aplicación también debe resolver la salida seleccionada (o importarla explícitamente).

```ts
import { createRouter } from 'vue-router-ns'
import { routes } from './generated/routes.android'

export const router = createRouter({ routes })
router.push({ name: 'products-id', params: { id: 42 } })
```

La salida incluye `routes`, `FileRouteMap`, `FileRouteName` y `FileRouteParams<Name>`. Las fábricas de componentes diferidos tienen tipos de retorno explícitos, lo que evita ciclos de inferencia entre las páginas y el enrutador. El registro de enrutador [existente](./typed-routes) proporciona elementos componibles y también vincula los nombres y parámetros generados. La salida no tiene importación de tiempo de ejecución del sistema de archivos, compilador o generador.

## Convenciones de archivos {#file-conventions}

| Archivo                | Ruta              | Nombre           | Parámetros                               |
| ---------------------- | ----------------- | ---------------- | ---------------------------------------- |
| `index.vue`            | `/`               | `index`          | ninguno                                  |
| `products.vue`         | `/products`       | `products`       | ninguno                                  |
| `products/index.vue`   | `/products`       | `products-index` | ninguno                                  |
| `products/[id].vue`    | `/products/:id`   | `products-id`    | `id: string`                             |
| `settings/[[tab]].vue` | `/settings/:tab?` | `settings-tab`   | `tab?: string`                           |
| `files/[...path].vue`  | `/files/:path+`   | `files-path`     | `path: string[]` (uno o más segmentos)   |
| `any/[[...path]].vue`  | `/any/:path*`     | `any-path`       | `path?: string[]` (cero o más segmentos) |

Los nombres mantienen `index`, por lo que agregar una página principal no cambia el nombre de su destino de índice existente. Utilice `definePageMeta({ name: '...' })` para anular un nombre. Los nombres de archivos y carpetas permiten letras y dígitos ASCII, `_` y `-`; Los parámetros utilizan caracteres de palabras. Los segmentos mixtos como `product-[id]`, grupos de rutas y expresiones regulares personalizadas no se admiten en las rutas generadas y producen un diagnóstico de origen. Los registros explícitos conservan sus capacidades de comparación existentes. Los parámetros generales deben ser los últimos.

Las carpetas por sí solas no crean páginas o marcos nativos. Un archivo de página **ancestro más cercano**, como `products.vue`, se convierte en un padre de ruta de `products/[id].vue`. Con `withParents: true`, el enrutador empuja el Page principal real antes del Page detallado. Los archivos índice nunca se convierten en padres. Cuando existen tanto `products.vue` como `products/index.vue`, la navegación de ruta a `/products` selecciona el índice; La navegación con nombre puede seleccionar el padre. La ruta personalizada de un padre se propaga a los niños a menos que un niño declare su propia ruta absoluta; Los parámetros principales requeridos deben permanecer disponibles para `withParents`.

El escáner ordena de forma determinista y el comparador existente clasifica los destinos. Los nombres duplicados, los patrones equivalentes que no distinguen entre mayúsculas y minúsculas (incluidos parámetros con nombres diferentes), los parámetros repetidos y los nombres de archivos no admitidos fallan en los diagnósticos de archivos/líneas/columnas. Un padre y su índice son la excepción intencional del mismo camino.

Los archivos/directorios ocultos y con prefijo `_` y `node_modules` se omiten. `exclude` acepta archivos relativos exactos o prefijos de directorio, sin globos. Se deben excluir los enlaces simbólicos. Un directorio de páginas configurables puede estar vacío.

`page.ios.vue`/`page.android.vue` anula `page.vue` en su plataforma sin agregar otra ruta. Las páginas exclusivas de plataforma no están disponibles en la otra versión. Se debe especificar una plataforma cuando existen variantes. Mantenga los nombres/rutas consistentes en todas las variantes si el código de la aplicación necesita un mapa de ruta compartido; Los tipos generados por cada plataforma describen su propia tabla.

## Metadatos de página en tiempo de compilación {#compile-time-page-metadata}

```vue
<script setup lang="ts">
import { definePageMeta } from 'vue-router-ns/file-routing'

definePageMeta({
  name: 'product',
  layout: 'default',
  middleware: ['auth'],
  props: true,
  transition: 'fade',
  meta: { requiresAuth: true },
})
</script>

<template>
  <StackLayout><Label text="Product" /></StackLayout>
</template>
```

Registre el denominado [layout](./layouts) y [middleware](./middleware) en el enrutador. Aquí el diseño posee el `Page` nativo; sin un diseño, el destino debe poseerlo. `layout: false` se excluye. Para un modal nativo, utilice `modal: true` o un objeto de opciones nativo literal, como `modal: { fullscreen: true }`. Las opciones de hoja nativa y las opciones de transición siguen sus contratos de plataforma existentes.

`definePageMeta` acepta `name`, `path`, `layout`, `middleware`, `meta`, `props`, `modal` y `transition`. Los `layout`/`middleware` de nivel superior se convierten en metadatos de ruta; coloque los campos de aplicación dentro de `meta`. Los tipos generados verifican las formas de las opciones de ruta normales. Las anulaciones de ruta/nombre tienen prioridad sobre las convenciones de archivos.

Los valores deben ser cadenas literales, números finitos, booleanos, nulos, matrices u objetos simples. Se admiten contenedores TypeScript `as`/`satisfies`. Las constantes importadas, variables de configuración, llamadas, funciones, extensiones de objetos, captadores y propiedades calculadas se rechazan sin ejecución. Registre guards/diseños funcionales en el enrutador y consulte sus nombres. Utilice rutas explícitas para accesorios de devolución de llamada, redireccionamientos u objetos de transición nativos que requieran construcción en tiempo de ejecución.

Llame a la macro una vez como una declaración `<script setup>` de nivel superior. Las importaciones explícitas pueden tener alias. Los complementos de compilación webpack y Vite lo transforman automáticamente; la limitación de HMR nativa Vite anterior aún se aplica. Para un generador personalizado, ejecute `transformPageMeta(source, filename, { autoImports: false })` **antes del compilador SFC Vue**, utilizando su `code` devuelto y el origen `map`. La transformación elimina la llamada y su importación de macro, preservando el resto del contenido. La ejecución de una macro sin transformar genera un error de configuración. Discovery pertenece a la API de configuración opcional, no al generador de bajo nivel.

## Combina registros explícitos y generados {#combine-explicit-and-generated-records}

```ts
import { mergeFileRoutes } from 'vue-router-ns/file-routing'

const router = createRouter({
  routes: mergeFileRoutes(routes, [
    { path: '/help', name: 'help', component: () => import('./Help.vue') },
  ]),
})
```

`mergeFileRoutes()` conserva los tipos literales y rechaza nombres/patrones conflictivos entre tablas. No existe una prioridad de anulación implícita entre los registros explícitos y generados. Excluir un archivo antes de declarar explícitamente su reemplazo. Los `addRoute()`/`removeRoute()` ordinarios mantienen su comportamiento actual.

## Regeneración y páginas retenidas {#regeneration-and-retained-pages}

`generateFileRoutes()` devuelve el código, el árbol de páginas, los archivos fuente y el directorio/rutas de salida sin escribir. `writeFileRoutes()` escribe atómicamente solo cuando cambia el código generado. Una generación fallida deja la última salida válida en su lugar; Los constructores siguen siendo responsables de la compilación y el diagnóstico de tipos.

`watchFileRoutes(options, { onGenerated, onError })` es un observador de nodos opcional para integraciones de compilación. Serializa la regeneración durante la creación/edición/cambio de nombre/eliminación, informa fallas y se reanuda después de las correcciones. Espere el mensaje `close()` de su identificador devuelto para detenerlo. Las devoluciones de llamada deben informar errores sin generar errores. La disponibilidad de Watcher sigue el soporte de nodo/sistema de archivos. Los desarrolladores poseen la compilación, el diagnóstico, el cierre y la entrega de actualizaciones de módulos para la aplicación.

En una aplicación que ya acepta HMR de módulo generado, adjunte un actualizador después de crear el enrutador:

```ts
import { createFileRouteUpdater } from 'vue-router-ns/file-routing'

const fileRoutes = createFileRouteUpdater(router, routes)
// In the builder's HMR accept callback:
fileRoutes.update(nextModule.routes)
```

Una actualización cambia **, futura ruta/nombre que coincide con**. Las entradas nativas existentes conservan su Page, la instantánea de la ruta, el diseño, el guards y los borradores, incluso cuando su archivo fue eliminado o renombrado. Back aún regresa a esas entradas retenidas; La orientación a un destino eliminado por ruta/nombre falla. Las ubicaciones relativas de una entrada retenida continúan utilizando su registro coincidente original, incluidos los metadatos, siguiendo la semántica `addRoute`/`removeRoute` existente. Utilice una ruta o un nombre para resolver con la tabla actualizada. Vue script/plantilla HMR sigue siendo una operación de componente independiente y sigue el contrato de página-HMR existente. El actualizador no recrea el enrutador ni restablece otros stacks.

El actualizador rechaza los conflictos con destinos explícitos y registros modificados externamente antes de mutar la tabla. Si `addRoute`/`removeRoute` ha reemplazado uno de sus registros, vuelva a crear el actualizador con la tabla actual generada. Elimine los hijos adjuntos manualmente antes de actualizar su padre generado. Estas reglas mantienen la autoridad del registro directo.

Los ID de archivos generados y los nombres de rutas están separados de la clave de restauración de cada entrada nativa. Cambiar el nombre de un archivo puede cambiar el nombre de su ruta; utilice un nombre estable explícito cuando sea necesario. Las rutas guardadas, las migraciones y los destinos no disponibles siguen regidos por [restoration](./restore). La generación de una nueva tabla no migra los datos guardados de la aplicación.

El dispositivo `--env.filesTest` del repositorio continúa probando la salida generada de bajo nivel en iOS/Android. El ejemplo de convenciones separadas ejercita el complemento público y el HMR de sistema de archivos en vivo al dispositivo descrito anteriormente.
