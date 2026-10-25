# Navegando {#navigating}

Utilice `push` para abrir una página, `back` para regresar y `replace` para intercambiar la entrada actual. Dentro de una página enrutada, obtenga la instancia con `const router = useRouter()` de `vue-router-ns`; páginas externas, importe su enrutador configurado. El tutorial de la primera aplicación [Crea tu primera aplicación](./first-app) muestra la configuración completa.

```ts
router.push('/messages/42?from=push')
router.push({ name: 'message', params: { id: 42 }, query: { from: 'push' } })
router.replace('/login')
router.back()
router.go(-2)
router.backTo({ name: 'inbox' }) // closest page below that matches
router.backToRoot() // first page of the stack
```

<Clip name="ios-navigation" caption="Abrir dos mensajes y luego regresar a la bandeja de entrada en una sola navegación. Simulador iOS 26." />

Todo devuelve una promesa que se liquida una vez que la página está en pantalla, con un `NavigationFailure` cuando un guard lo detuvo, como Vue Router.

## Opciones {#options}

Un segundo argumento toma lo que sólo tiene sentido en un dispositivo:

```ts
router.push('/messages/42', {
  transition: 'slideLeft', // or a full NativeScript transition object
  animated: false,
  clearHistory: true, // nothing left to go back to
  props: { preview }, // any value, unlike params
  frame: 'profile', // a named <RouterView>
  modal: true, // present modally, whatever the route says
  withParents: true, // push the route's parents first
  zoomFrom: thumbnail, // iOS 18: grow out of this view
})
```

`back()` toma `animated`, `frame` y `result` (ver [Modales y resultados](./modals)).

## Doble toque {#double-taps}

Las navegaciones se ponen en cola detrás de las transiciones nativas, por lo que un doble toque en un botón abre la página una vez: el segundo `push` encuentra la página que ya está en la parte superior y se resuelve con una falla `duplicated`.

## `<RouterLink>`

`RouterLink` hace que su único hijo navegue con un toque, sin agregar una vista:

```vue
<RouterLink to="/settings">
  <Button text="Settings" />
</RouterLink>
```

Se necesitan `to`, `replace`, `clearHistory`, `withParents`, `zoom`, `transition` y `frame`.

## Fallas y errores {#failures-and-errors}

Una navegación completa se resuelve en `undefined`. Una interrupción esperada se resuelve en `NavigationFailure`: `aborted` cuando un guard devuelve `false`, `duplicated` cuando el destino ya está en la parte superior o `cancelled` cuando una navegación más nueva reemplaza a una que aún está pendiente.

```ts
import { isNavigationFailure, NavigationFailureType } from 'vue-router-ns'

const failure = await router.push('/messages/42')
if (isNavigationFailure(failure, NavigationFailureType.aborted)) {
  // The current page remains open.
}
```

Una ruta no coincidente, un cargador fallido o un error guard rechazan la promesa. Utilice `try/catch` en el sitio de llamada y `router.onError((error, to, from) => …)` para observación global. `afterEach((to, from, failure) => …)` recibe fallas de navegación esperadas; estos son distintos de las excepciones.

Para enviar otra instancia de la ubicación actual, use `router.push({ path: '/messages/42', force: true })`. Sin `force`, los cambios en los parámetros, la consulta o el hash ya representan una ubicación diferente.
