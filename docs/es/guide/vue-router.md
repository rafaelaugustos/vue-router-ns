# Diferencias con el Vue Router {#differences-from-vue-router}

| Vue Enrutador                                        | vue-router-ns                                                                                                           |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `createWebHistory()` y amigos                        | Sin opción de historial: el stack nativo es el historial.                                                               |
| `<RouterView>` intercambia componentes               | `<RouterView>` es un `Frame`. Cada navegación es una página en su stack.                                                |
| `useRoute()` es la ruta actual                       | Dentro de una página, es la ruta de esa página.                                                                         |
| `onBeforeRouteLeave` se ejecuta en cualquier salida  | Se ejecuta cuando la página sale del stack. Un empujón en la parte superior lo mantiene vivo.                           |
| `onBeforeRouteUpdate`                                | No disponible: diferentes parámetros significan una nueva página.                                                       |
| `router.forward()`, `go(n > 0)`                      | No hay historial de reenvíos.                                                                                           |
| Anida las rutas de `<RouterView>` a `children`       | `children` y fusiona `meta`. La interfaz de usuario anidada es otro `<RouterView>`.                                     |
| `beforeEnter` se ejecuta en navegaciones hacia atrás | Al retroceder se revela una página que ya existe, así que solo deje en ejecución guards y guards global.                |
| Una redirección guard durante la devolución          | Se convierte en un envío al destino de la redirección.                                                                  |
| `next()` en guards                                   | Solo valores de retorno.                                                                                                |
| Las rutas desconocidas no muestran nada.             | `push` rechaza con `No route matches`. Agregue una ruta general (`/:pathMatch(.*)*`) si desea una página no encontrada. |
| `scrollBehavior`                                     | No aplicable. `hash` se mantiene en ubicaciones para lograr paridad.                                                    |

## ¿Qué hay solo aquí? {#what-s-only-here}

`backTo()`, `backToRoot()`, `setStack()`, `pushForResult()`, `back({ result })`, `onPageActivated()`, `onPageDeactivated()`, `useBackGesture()`, rutas modales, tramas con nombre, `withParents`, `restore`, y un `router.stack` reactivo.
