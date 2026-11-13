# Enlaces profundos {#deep-links}

Las rutas son caminos, por lo que dondequiera que tu aplicación reciba un enlace (un controlador de URL, una carga útil de notificación), entrega la ruta al enrutador:

<Clip name="ios-deep-link" caption="El sistema entrega vuerouterns://settings/account. Se selecciona Configuración y su guard abre el inicio de sesión. Simulador iOS 26." />

```ts
router.push('/messages/42')
```

Eso es seguro en un inicio en frío: una navegación solicitada antes de que aparezca la primera página la espera y stacks en la parte superior, por lo que la parte posterior aún llega a su página de inicio.

## Trayendo a los padres {#bringing-the-parents-along}

Un enlace a una página anidada puede atraer a sus padres, por lo que retrocede en la jerarquía de la aplicación en lugar de saltar a casa:

```ts
router.push('/settings/account', { withParents: true })
// stack: / → /settings → /settings/account
```

Los padres provienen de `children` anidando en la tabla de rutas, y solo los que tienen un componente se convierten en páginas:

```ts
{
  path: '/settings',
  component: Settings,
  children: [{ path: 'account', name: 'account', component: Account }],
}
```

Los padres que ya están en la parte superior se omiten, solo se anima la última página y se ejecuta guards para cada página. Con `clearHistory`, los padres y la página se convierten en el stack completo. `<RouterLink>` también acepta `withParents`.

## Recepción de URL del sistema operativo {#receiving-operating-system-urls}

Opte por `links`, y el enrutador toma las URL que la plataforma entrega a la aplicación, junto a los controladores que la aplicación ya tiene: lanzamiento de Android y nuevas intenciones, iOS `openURL`, actividades de enlace universal y conexiones de escena.

```ts
const router = createRouter({
  routes,
  links: {
    schemes: ['https', 'myapp'], // others are ignored
    hosts: ['example.com'], // for http and https links
    map: (link) =>
      link.path.startsWith('/m/')
        ? { name: 'message', params: { id: link.path.slice(3) } }
        : { path: link.path, query: link.query, hash: link.hash },
    frame(location) {
      const settings = location.path.startsWith('/settings')
      // RouterTabs selects the tab that owns this stack.
      return settings ? 'settings' : 'inbox'
    },
  },
})
```

`links: true` toma cada URL como una ruta. Cada URL se convierte en un `IncomingLink`: un `scheme` en minúscula, un `host` para `http` y `https` (para un esquema personalizado como `myapp://messages/42`, todo lo que está después de `://` es la ruta), el `path`, el `query` analizado, el `hash` y de dónde viene: `'launch'`, `'resume'` o `'app'`. El comparador decodifica los parámetros de la misma manera que lo hace para `push`. Sin `map`, la ruta, la consulta y el hash del enlace son la ubicación; una URL que no coincide con ninguna ruta se ignora, a menos que la tome una ruta general. Devuelva `null` desde `map` para ignorar un enlace usted mismo. Los porcentajes de escape/UTF-8 rotos, los servidores web, las credenciales, los espacios en blanco y las URL relativas al protocolo que faltan son `malformed`. Los parámetros se decodifican una vez; La consulta `+` es un espacio, las claves repetidas son matrices y una clave sin `=` es `null`. Los valores de consulta son cadenas que no son de confianza: valide formatos específicos de la aplicación en `map`; devolver `null` o lanzar rechaza el destino como `unmatched`.

Un enlace llega de la manera que lo hace `push(path, { withParents: true })`, a través de guards, por lo que una ruta autenticada aún lo envía al inicio de sesión. Configure `options` para cambiar eso para cada enlace o por enlace con una función. En un arranque en frío, el enlace espera la primera página, y cuando `restore` reconstruye un stack, llega encima de él: primero el historial guardado y luego el enlace. Con `frame`, espera a que ese `<RouterView>` muestre su primera página, hasta diez segundos. [`RouterTabs`](./tabs) selecciona la pestaña de destino automáticamente. Con un `TabView` simple, configure su `selectedIndex` dentro de `frame` para que aparezca una pestaña descargada antes de la navegación.

La plataforma puede entregar la misma URL al iniciar y nuevamente al reanudar. Ese par de inicio/reanudación coincidente se deduplica en 1,5 segundos. Dos entregas calientes son grifos separados, incluso muy juntos. Una página que ya está en la parte superior produce un error de navegación `duplicated`, como lo haría `push`. Los proveedores de notificaciones pueden proporcionar `deliveryId` para deduplicar el mismo evento incluso cuando llegan otros enlaces entre sus devoluciones de llamada; use una nueva identificación para cada toque intencional del usuario. El enrutador conserva los últimos 256 identificadores en la memoria durante toda su vida.

### Notificaciones, widgets y enlaces propios {#notifications-widgets-and-links-of-your-own}

`openLink` es la misma puerta para cualquier otra cosa que apunte a un destino:

```ts
const result = await router.openLink(notification.data.url, {
  deliveryId: notification.eventId, // optional, one id per user action
})
result.location // where it pointed, when it matched a route
result.failure // what a guard said, when it stopped it
result.ignored // 'scheme', 'host', 'unmatched', 'malformed' or 'repeat'
```

`resolveLink(url)` indica dónde iría una URL sin ir allí, y `onLink` escucha cada enlace que se entregó al enrutador, se tomó o no. Para reanudar un enlace después de iniciar sesión, haga lo que hace la demostración: guard redirige al inicio de sesión con `query.next` y la página de inicio de sesión se reemplaza con él. `onLink` también funciona: mantenga `result.location` cuando `failure` o la ruta actual indique que un inicio de sesión se interpuso en el camino, y `push` después de iniciar sesión.

## Intents de navegación (experimental) {#navigation-intents}

Usa un `NavigationIntent` versionado cuando diferentes entradas de la aplicación necesiten compartir una solicitud de destino. `resolveIntent` valida y resuelve sin navegar, ejecutar guards, cargar componentes ni seleccionar pestañas. `openIntent` vuelve a validar y utiliza la misma espera y ejecución con guards de los enlaces existentes. Los callbacks de mapeo y redirección de rutas deben ser puros.

```ts
import type { NavigationIntent } from 'vue-router-ns'

const request = {
  version: 1,
  source: 'internal',
  destination: { route: { name: 'message', params: { id: '42' } } },
  target: { frame: 'inbox' },
  delivery: { scope: 'account-session-17', id: 'tap-123' },
  expiresAt: Date.now() + 60_000,
} satisfies NavigationIntent

const preview = router.resolveIntent(request)
if (preview.status === 'resolved') {
  const result = await router.openIntent(request)
  if (result.status === 'handled') {
    console.log(result.location.fullPath, result.failure)
  } else {
    console.log(result.reason)
  }
}
```

El `destination` contiene `{ route: ... }` o `{ url: 'myapp://messages/42' }`. Una ruta utiliza una ruta absoluta o un nombre string con params, query y hash serializables. Una URL utiliza el filtrado de scheme/host y el mapeo existentes; su origen de enlace es `'app'`. El `source` del intent es una etiqueta definida por la aplicación, sin acreditar origen ni permisos. Los callbacks de proveedores de notificaciones y los adaptadores de búsqueda y drag/drop siguen siendo responsabilidad de la aplicación; el helper siguiente valida los datos de destino de la notificación.

Solo se aceptan datos JSON simples: sin objetos nativos/Vue, funciones, accessors, symbols ni campos desconocidos. Las solicitudes se copian y congelan recursivamente. Los límites son 16 KiB de JSON UTF-8 compacto, 8.192 caracteres por string, 32 campos por objeto, 64 elementos por array, profundidad 7 y 1.024 valores. Las etiquetas de origen permiten 128 caracteres; los identificadores de entrega y destino, 256. Analiza el JSON externo y valida su contenido específico antes de entregarlo al router. Validar la estructura no autoriza acceso; los guards normales siguen comprobando permisos.

El router receptor es responsable de la ejecución. `target.windowId` comprueba la identidad de esa ventana; nunca busca ni abre otra. `target.frame` elige su stack con nombre. Si se omite, las solicitudes URL usan la política de frame de los enlaces y después el stack predeterminado; las solicitudes de ruta usan el stack predeterminado. Ningún Frame global elige la ventana. `options` acepta `replace`, `withParents` y `clearHistory`; el historial de padres está habilitado por defecto. Las opciones de la política URL se aplican primero y las opciones explícitas del intent las sobrescriben. La resolución no invoca callbacks de frame ni options.

La disponibilidad y la restauración del historial preceden a la navegación; un stack con nombre ausente tiene el plazo existente de diez segundos para montarse. Las solicitudes conservan la cancelación normal entre navegaciones superpuestas, sin cola FIFO. `expiresAt` se comprueba al recibir y después de esperar disponibilidad/stack, inmediatamente antes de la admisión; no cancela una navegación que ya entró en los guards. Se vuelven a comprobar las rutas eliminadas y el cierre de la ventana después de las esperas. Los errores de ejecución siguen rechazando la promesa.

El par `delivery` utiliza `scope` e `id` entre etiquetas de origen durante la vida de un router. Usa un ámbito de cuenta/sesión gestionado por la aplicación y un id nuevo por acción intencional, u omite el par. Se retienen hasta 256 solicitudes en curso; otra devuelve `busy`. Los últimos 256 ids de entregas finalizadas permanecen en memoria, incluidos los intentos rechazados por guards o invalidados durante una espera. Una repetición devuelve `repeat`; es deduplicación limitada, sin garantía persistente de entrega única. Los ids de enlaces existentes conservan su espacio de nombres separado por compatibilidad. Los intents no emiten `onLink`; los enlaces existentes mantienen listeners y deduplicación de launch/resume.

La vista previa devuelve `resolved` o `ignored`. La ejecución devuelve `handled` con el destino solicitado en `location` y un posible `failure`, o `ignored` con `reason`. Handled significa que terminó el flujo normal: los guards pueden redirigir, abortar o cancelar y la página solicitada puede no aparecer. Los motivos ignorados incluyen `invalid`, `version`, `expired`, `unmatched`, `scheme`, `host`, `repeat`, `busy`, `wrong-window`, `owner-closed` y `target-unavailable`. Los payloads y los identificadores de entrega no se añaden a los diagnósticos.

Las solicitudes no se persisten ni seleccionan nuevas ventanas. La reanudación explícita de login en memoria se describe abajo; la autenticación sigue siendo responsabilidad de la aplicación. La [fixture nativa](https://github.com/rafaelaugustos/vue-router-ns/tree/main/scripts/native/intents) comprueba Frames reales, guards y entrega de URL del sistema; el [informe de aceptación](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-navigation-intents-stage1.md) distingue evidencia nativa de cobertura unitaria.

<Clip name="navigation-intents" :width="640" aspect="3 / 4" caption="Simulador real de iPad: vista previa sin navegación, destinos por nombre/URL, repeticiones y guards, cierre de modal y entrega de URL del sistema. Las etiquetas de la app están en inglés." />

## Reanudar después del login (experimental) {#resume-after-login}

Usa `suspendIntent(request, policy)` antes de presentar el login de la aplicación o después de que un guard de enlace existente redirija a él. Devuelve `suspended` con un handle, o `ignored`. La suspensión resuelve y copia la solicitud, pero no navega, ejecuta guards, crea una Page ni detecta autenticación. La aplicación decide cuándo mostrar, reemplazar o cerrar el login.

```ts
import type { NavigationIntent, SuspendedIntent } from 'vue-router-ns'

let authScope = {}
let authenticated = false
let pending: SuspendedIntent | undefined
const policy = {
  scope: () => authScope,
  authorize: () => authenticated,
  maxAge: 120_000,
}

async function requireLogin(request: NavigationIntent) {
  const result = router.suspendIntent(request, policy)
  if (result.status === 'ignored') return result
  pending = result
  await router.push('/login', { frame: 'inbox' })
  return result
}

async function completeLogin() {
  authenticated = true
  return pending?.resume()
}

function cancelLogin() {
  pending?.cancel()
  pending = undefined
}

function accountChanged() {
  authenticated = false
  authScope = {}
  cancelLogin()
}
```

Cuando el proveedor real confirme el login, actualiza la autenticación de la aplicación y llama a `resume()`. No establezcas el booleano del ejemplo a partir de un payload no confiable. `scope()` debe devolver el mismo objeto estable durante el login previsto; reemplázalo al cerrar sesión, cambiar de cuenta o iniciar otro flujo de autenticación. `authorize(location, intent)` debe devolver true de forma síncrona solo mientras ese destino siga permitido. Ambos callbacks deben ser puros; las comprobaciones asíncronas o que lanzan errores deniegan la operación. La identidad de sesión y los callbacks permanecen en memoria y nunca se serializan en la solicitud.

Cada router retiene un flujo de autenticación pendiente. Una suspensión nueva válida o un `openIntent` aceptado lo reemplaza; las entregas malformadas o duplicadas no. La identidad de entrega permanece reservada durante login y reanudación para que un callback repetido no cree otro intento. Una vez autorizado, todas las llamadas a `resume()` devuelven la misma promesa, incluso después de finalizar o rechazar. Llamar antes de la autorización devuelve `unauthorized` y mantiene pendiente la solicitud. `cancel()` impide admisiones posteriores; llámalo al cancelar login o cambiar la sesión. La navegación normal al login no cancela automáticamente el flujo pendiente.

El ref de solo lectura `state` informa `pending`, `resuming`, `settled` o `cancelled`, con un `reason` opcional. Un cambio de ámbito devuelve `scope-changed`; un intent más reciente devuelve `superseded`; la cancelación explícita devuelve `cancelled`. `maxAge` es un entero positivo de hasta 300.000 milisegundos, con cinco minutos por defecto; prevalece una expiración anterior de la solicitud. Un temporizador libera el trabajo pendiente expirado. La expiración, las rutas eliminadas, el cierre del propietario y los permisos se comprueban de nuevo al reanudar. A diferencia de la admisión de intents normales, estas comprobaciones se mantienen tras guards asíncronos, carga de componentes y redirecciones de guards, incluido el destino redirigido.

Siguen aplicándose los guards y fallos normales. La invalidación durante un guard produce el fallo normal de navegación cancelada. No se revierten páginas padre ya confirmadas ni transiciones nativas ya iniciadas; la cancelación bloquea la admisión restante. Un handle suspendido no garantiza entrega persistente exactamente una vez. Representa un intento idempotente durante la vida de este router. No hay persistencia de solicitudes, integración automática con proveedores ni identidad de cuenta inferida.

Pasa `options: { replace: true }` en la solicitud si el destino debe reemplazar el login y selecciona explícitamente el mismo stack con nombre. La aplicación controla permisos, política de la ruta de login y limpieza del historial protegido al cerrar sesión. El `openLink` existente y sus listeners siguen disponibles; un listener puede retener la URL original después de que un guard redirija al login. La [aceptación nativa](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-intent-resume-stage2.md) demuestra esa composición.

<Clip name="intent-resume" :width="640" aspect="3 / 4" caption="Simulador real de iPad: una URL del sistema abre el login de la app, iniciar sesión reanuda una vez, y cancelación, cambio de cuenta, expiración y cierre de sesión durante un guard impiden navegación obsoleta. La autenticación es estado controlado de la fixture, sin proveedor externo; etiquetas en inglés." />

## Destinos de notificaciones {#notification-destinations}

`notificationIntent(payload, context)` convierte el destino JSON definido por la aplicación en un `NavigationIntent` congelado con `source: 'notification'`. No resuelve ni navega. El payload solo acepta `version: 1`, `destination` (ruta o URL) y `expiresAt` opcional; la aplicación proporciona por separado la identidad de entrega, el destino de ventana/stack y las opciones de navegación.

```ts
import { notificationIntent } from 'vue-router-ns'

// The provider adapter extracts this app-defined JSON field from an OPEN action.
const payload = {
  version: 1,
  destination: { route: { name: 'message', params: { id: '42' } } },
  expiresAt: Date.now() + 60_000,
}
const intent = notificationIntent(payload, {
  delivery: { scope: session.deliveryScope, id: response.openEventId },
  target: { frame: 'inbox' },
})
if ('status' in intent) {
  showIgnored(intent.reason)
} else {
  const preview = router.resolveIntent(intent)
  // Use suspendIntent(intent, policy) instead when app-owned login is needed.
  const result = await router.openIntent(intent)
}
```

En el ejemplo, `session`, `response` y `showIgnored` pertenecen a la aplicación. Extrae únicamente el campo de destino revisado del sobre del proveedor; convierte diccionarios nativos en datos JSON simples y limita el texto antes del parseo. Los campos desconocidos, getters, funciones, rutas malformadas y solicitudes que superan los límites de intents (incluidos 16 KiB para el sobre final) devuelven `invalid`. Las versiones incompatibles devuelven `version`; los plazos vencidos, `expired`. Resolución y ejecución siguen rechazando rutas inexistentes, URLs prohibidas y propietarios incorrectos, y vuelven a comprobar la caducidad. Excluye credenciales y metadatos privados del proveedor.

Procesa únicamente una acción explícita de apertura: recibir una notificación, una actualización en segundo plano o descartarla no debe navegar. Completa los callbacks nativos independientemente de la espera por login o montaje. El helper no instala delegate, SDK, solicitud de permisos ni receptor en segundo plano. La respuesta del proveedor sigue siendo responsabilidad de la aplicación; la [guía de respuestas de Apple](https://developer.apple.com/documentation/usernotifications/handling-notifications-and-notification-related-actions) describe el callback utilizado por la fixture.

Vincula la respuesta a la cuenta prevista mediante la política de la aplicación antes de enviarla. Una etiqueta de origen o ruta no demuestra origen, destinatario ni permiso. Nunca copies `delivery`, `target` u `options` de payloads no confiables: esos campos se rechazan en el payload. Usa un scope estable para la cuenta/sesión y un id por acción de apertura, reutilizado en sus callbacks. Un id de mensaje puede representar varios toques intencionales; un id nuevo por callback impide la deduplicación. Si el proveedor no distingue los toques, define esa política en su adaptador. El helper no consume ids; `openIntent` o `suspendIntent` los reserva en la memoria limitada del router receptor.

El login usa el mismo flujo de `suspendIntent` anterior. La entrega con la aplicación cerrada espera al montaje y al historial restaurado; esto no persiste un login pendiente entre procesos. Reutilizar, enfocar o crear ventanas sigue siendo una política explícita de la aplicación. La [fixture nativa y sus límites](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-notification-intents-stage3.md) cubren toques reales en notificaciones locales de iOS con la aplicación abierta y terminada, reanudación después del login, procesamiento duplicado y destinos rechazados. Push remoto, notificaciones nativas de Android y Spotlight quedan fuera de esta etapa.

<Clip name="notification-intents" :width="640" aspect="3 / 4" caption="Simulador real de iPad: abre notificaciones de iOS con la app activa o terminada, reanuda después del login, rechaza destinos inválidos/caducados y conserva un borrador independiente. Notificaciones locales y autenticación controlada; textos en inglés." />

## Atajos de la pantalla de inicio {#home-screen-shortcuts}

<Clip name="ios-shortcuts" caption="Mantenga presionado el ícono de demostración y elija Nuevo mensaje para abrir su ruta a través de una acción rápida nativa. Simulador iOS 26." />

En el video, la Bandeja de entrada ya está seleccionada antes de salir de la aplicación. En la demostración iOS, el presentador nativo puede rechazar abrir Redactar desde su acceso directo mientras se cambia de Configuración a la bandeja de entrada dividida. Prefiere un destino de página para la entrada cruzada; Este clip muestra el modal de la misma pestaña.

Se pueden ofrecer los mismos destinos antes de que se abra la aplicación: atajos dinámicos Android y acciones rápidas iOS, ambos desde una sola llamada:

```ts
router.setShortcuts([
  {
    id: 'compose',
    title: 'New message',
    to: '/compose',
    icon: { android: 'ic_compose', ios: 'square.and.pencil' },
  },
  { id: 'account', title: 'Account', to: { name: 'account' } },
])
```

Cada acceso directo lleva una carga útil versionada. La versión 2 conserva una ruta de cadena `name`, parámetros, consulta y hash; cambiar una ruta manteniendo su nombre mantiene funcionando los accesos directos existentes. Trate los nombres de rutas también como identificadores estables; Si un nombre cambia, mantenga una redirección con su nombre anterior o vuelva a publicar los accesos directos afectados. Los destinos sin nombre conservan su ruta. Las cargas útiles de la ruta de la versión 1 siguen siendo legibles. Al eliminar un destino se obtiene `unmatched`; Las versiones de carga útil no compatibles producen `malformed`. La activación utiliza el mismo comportamiento de navegación duplicada y guards que `push`, incluso para un antiguo acceso directo fijado. El campo `link.shortcut` identifica el acceso directo.

Llame a `setShortcuts` nuevamente cuando cambien los datos de la aplicación. `setShortcuts([])` elimina los accesos directos dinámicos y desactiva las copias fijadas obsoletas propiedad del enrutador en Android, y elimina las acciones rápidas de iOS. Android posee los íconos fijados, por lo que el enrutador no puede eliminarlos del iniciador del usuario. Los accesos directos al manifiesto estático no se pueden desactivar de esta manera: manténgalos como puntos de entrada públicos y aplique la autenticación en guards. Los atajos estáticos y dinámicos de Android comparten su cuota nativa; iOS tiene cuatro ranuras de acción rápida. Los elementos extra dinámicos se omiten con una advertencia de desarrollo. Una actualización Android rechazada arroja, en lugar de informar, identificadores que no se publicaron.

`supportsShortcuts()` verifica la disponibilidad general. Para solicitar fijación en Android:

```ts
import { supportsPinnedShortcuts } from 'vue-router-ns'

if (supportsPinnedShortcuts()) {
  const requested = router.pinShortcut({
    id: 'account',
    title: 'My account',
    to: { name: 'account' },
    icon: { android: 'ic_account' },
  })
  // requested means the launcher accepted the request; the user still chooses.
}
```

### Atajos estáticos de Android {#static-android-shortcuts}

Las entradas estáticas son recursos de la aplicación, revisados ​​y enviados con la aplicación. Genere su URL con `router.shortcutURL('account', { name: 'account' })` y copie el resultado en el XML con `&` con el formato de escape `&amp;`. Para una ruta con nombre sin parámetros, la carga útil puede ser:

```xml
<!-- App_Resources/Android/src/main/res/xml/shortcuts.xml -->
<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">
  <shortcut android:shortcutId="static-account"
    android:enabled="true"
    android:shortcutShortLabel="@string/shortcut_account"
    android:icon="@drawable/ic_account">
    <intent android:action="android.intent.action.VIEW"
      android:targetPackage="com.example.app"
      android:targetClass="org.nativescript.router.ShortcutEntryActivity"
      android:data="vue-router-ns://shortcut/static-account?to=%7B%22name%22%3A%22account%22%7D&amp;v=2" />
  </shortcut>
</shortcuts>
```

Defina la etiqueta en `res/values/strings.xml` y coloque estos metadatos dentro de la actividad del iniciador en `AndroidManifest.xml`:

```xml
<meta-data android:name="android.app.shortcuts" android:resource="@xml/shortcuts" />
```

Android fuerza a `NEW_TASK | CLEAR_TASK` en atajos estáticos. Para conservar una aplicación en ejecución, copie el ejemplo de actividad [entry](https://github.com/rafaelaugustos/vue-router-ns/blob/main/examples/shortcuts/Android/src/main/java/org/nativescript/router/ShortcutEntryActivity.java) en `App_Resources/Android/src/main/java/org/nativescript/router/ShortcutEntryActivity.java` y regístrelo fuera de la actividad principal:

```xml
<activity android:name="org.nativescript.router.ShortcutEntryActivity"
  android:exported="true" android:taskAffinity=""
  android:excludeFromRecents="true" android:theme="@android:style/Theme.NoDisplay" />
```

La Actividad temporal retira su ventana antes de reenviar la carga útil a `com.tns.NativeScriptActivity` con `SINGLE_TOP | CLEAR_TOP | NEW_TASK`. Ajuste ese objetivo de Java si su aplicación utiliza una Actividad personalizada. Esta es una integración nativa explícita propiedad de la aplicación; el paquete no reescribe recursos. Consulte el comportamiento de la tarea de acceso directo de [Android](https://developer.android.com/develop/ui/compose/system/shortcuts/managing-shortcuts).

Utilice el paquete/actividad real y los nombres de recursos de la aplicación. Los identificadores estáticos deben diferir de los identificadores dinámicos. El esquema interno `vue-router-ns` utiliza un objetivo de intención explícito; no lo registre como un esquema público de enlaces profundos. Consulte los requisitos de fijación y recursos de acceso directo de [Android](https://developer.android.com/develop/ui/compose/system/shortcuts/creating-shortcuts).

### Búsqueda opcional del sistema {#optional-system-search}

El punto de entrada experimental `vue-router-ns/system-search` indexa solo contenido seleccionado explícitamente usando Core Spotlight. Consume el `NSUserActivity` resultante hasta el `links.activity`, por lo que la selección de ventana, el guards y la navegación nativa siguen siendo los mismos:

```ts
import { createSystemSearch } from 'vue-router-ns/system-search'

const search = createSystemSearch({
  domain: 'com.example.app.public-guides',
  resolve(id) {
    const guide = publicGuides.get(id)
    return guide ? router.resolve({ name: 'guide', params: { id } }).fullPath : null
  },
})
const router = createRouter({ routes, links: { activity: search.url } })

if (search.supported) {
  await search.index([
    { id: 'getting-started', title: 'Getting started', keywords: ['help'] },
  ])
}
await search.remove(['getting-started']) // deleted content
await search.remove() // sign-out: remove this domain's index
```

El identificador nativo contiene una versión del payload, un dominio y un identificador de contenido. No contiene parámetros de ruta. `resolve` convierte un identificador estable en el destino actual; devuelve `null` para elementos eliminados o inaccesibles. Las operaciones de indexación resuelven con `false` si la función no está disponible y rechazan los errores nativos. La disponibilidad de la API no garantiza que Spotlight muestre un elemento ni su posición en los resultados. `description`, `keywords` y `expiresAt` son metadatos opcionales. Consulta la [guía de indexación de Core Spotlight de Apple](https://developer.apple.com/documentation/CoreSpotlight/adding-your-app-s-content-to-spotlight-indexes).

Elija etiquetas públicas e identificadores opacos. Las cargas útiles de accesos directos, los títulos indexados y las descripciones pueden sobrevivir a una sesión y aparecer en las superficies del sistema: nunca coloque credenciales ni secretos en ellos. Elimine las entradas específicas de la cuenta al cerrar sesión y conserve guards incluso después de la eliminación. Este módulo no indexa rutas automáticamente, no dona actividades a Siri ni proporciona widgets/Intentos de aplicaciones; estos requieren una integración de propiedad de aplicación independiente.

### Recibir ventanas y elegir una política {#receiving-windows-and-choosing-a-policy}

De forma predeterminada, los eventos del sistema van al enrutador de la ventana principal. Con la API de ventana de NativeScript, pase `links.window` para recibir eventos solo para esa actividad o escena. `links.initial` acepta los campos de enlace de un `WindowContentRequest`: generalmente se crea un enrutador secundario **después de que** Core emite el evento nativo inicial, por lo que necesita esa transferencia explícita.

```ts
Application.setWindowContentResolver((request) => {
  if (request.window.rootView) return request.window.rootView
  if (request.isPrimary) return undefined // the primary app starts normally
  const router = createRouter({
    routes,
    links: { window: request.window, initial: request, schemes: ['myapp', 'https'] },
  })
  const app = createApp({ render: () => h(RouterView) }).use(router)
  return app.mount().$el.nativeView
})
```

Las URL de escenas cálidas, las actividades del usuario y las acciones rápidas permanecen en esa escena; Android los nuevos intents permanecen en su actividad de recepción. Al desmontar una aplicación se desconecta su receptor. La opción `window` también puede ser un captador si la aplicación asigna la ventana más tarde. Analiza los eventos entrantes; El desmontaje de ventanas, la recreación de actividades y el estado de ventanas guardadas siguen siendo responsabilidades del ciclo de vida de la aplicación.

La política predeterminada **vuelve a utilizar la ventana elegida por OS**; recibir un enlace no enfoca una ventana diferente ni crea una. Para las notificaciones, una aplicación puede seleccionar una sesión existente, enfocar su escena/tarea nativa y luego llamar al `router.openLink` de esa sesión. Para crear una ventana, llame a `Application.openWindow({ data: { href } })`; en el solucionador de contenido, entregue `request.data.href` al `openLink` del nuevo enrutador antes de montarlo. No pase también por ese mismo destino como ruta inicial. `openLink` espera la montura. La elección explícita del objetivo mantiene las políticas de notificación y ventana de documentos en la aplicación en lugar de adivinar a partir del Frame global enfocado actualmente. Las aplicaciones Android que crean múltiples actividades necesitan un modo de inicio compatible, como `standard`, y marcas explícitas para la reutilización intencional de tareas/nuevas tareas; El siguiente ejemplo normal de ventana única utiliza `singleTask`.

Para un ejemplo ejecutable de reutilización, foco y creación de ventanas con selección explícita del historial restaurado, consulta la [política de ventanas para intents](./windows#intent-window-policy).

### Configuración de la plataforma {#platform-setup}

El enrutador lee lo que entrega la plataforma; registrarse es de la aplicación. El paquete no puede verificar la propiedad del dominio ni publicar archivos de asociación.

Android, en `App_Resources/Android/src/main/AndroidManifest.xml`, dentro de la actividad. El modo de inicio `singleTask` de la plantilla NativeScript hace que llegue un enlace a una aplicación en ejecución como una nueva intención, que el enrutador toma sin una segunda actividad:

```xml
<intent-filter android:autoVerify="true">
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="https" android:host="example.com" />
</intent-filter>
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="myapp" />
</intent-filter>
```

Los enlaces de aplicaciones necesitan que `https://example.com/.well-known/assetlinks.json` enumere el paquete de la aplicación y las huellas digitales del certificado de firma; compruébalo con `adb shell pm get-app-links <package>`.

iOS, en `App_Resources/iOS/Info.plist` para un esquema personalizado, y una entrada `applinks:example.com` en Dominios asociados en `App_Resources/iOS/app.entitlements` para enlaces universales, atendidos por `https://example.com/.well-known/apple-app-site-association`:

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array><string>myapp</string></array>
  </dict>
</array>
```

Pruebe un enlace con `adb shell am start -a android.intent.action.VIEW -d "myapp://messages/42"` y `xcrun simctl openurl booted "myapp://messages/42"`. Las ventanas nativas independientes se rastrean por separado; un enlace aterriza en el enrutador que lo recibe.

### Comprobando asociación de dominio {#checking-domain-association}

Para enlaces HTTPS de producción, verifique tanto el registro nativo como los archivos del servidor. Mantenga separadas las identidades de certificado/paquete de depuración y versión.

`https://example.com/.well-known/assetlinks.json`:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.example.app",
      "sha256_cert_fingerprints": ["YOUR:RELEASE:CERTIFICATE:SHA256"]
    }
  }
]
```

`https://example.com/.well-known/apple-app-site-association` (sin extensión de nombre de archivo):

```json
{
  "applinks": {
    "details": [
      {
        "appIDs": ["TEAMID.com.example.app"],
        "components": [{ "/": "/messages/*" }]
      }
    ]
  }
}
```

Agregue `com.apple.developer.associated-domains` con `applinks:example.com` a los derechos de la aplicación firmada. Sirve JSON válido a través de HTTPS sin redirecciones. Confirme que el host, el ID del paquete/paquete, el ID del certificado/equipo y la ruta coincidan con lo que instaló. Utilice `adb shell pm verify-app-links --re-verify com.example.app`, inspeccione `adb shell pm get-app-links com.example.app` y luego abra una URL HTTPS **sin un componente explícito**. En iOS, instale la aplicación firmada correctamente y abra el enlace desde otra aplicación, probando una aplicación en frío y en ejecución. Una prueba de esquema personalizado o una intención de Android con `-n` demuestra la entrega del enrutador, no la asociación del sitio web. Siga el procedimiento de verificación [Android](https://developer.android.com/training/app-links/verify-android-applinks) y [Configuración de enlaces universales de Apple](https://developer.apple.com/documentation/xcode/supporting-universal-links-in-your-app) para diagnósticos de plataforma. La lista de permitidos del enrutador es una verificación adicional después de la entrega del sistema operativo, no una prueba de propiedad del dominio.
