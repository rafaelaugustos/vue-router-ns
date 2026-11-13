# Guardias {#guards}

Global guards y `beforeEnter` funcionan como en Vue Router 4: devuelve `false` para cancelar, una ubicación para redirigir o nada para continuar. Pueden ser asíncronos. Un tercer argumento te dice qué tipo de navegación es:

```ts
router.beforeEach((to, from, { type }) => {
  // type: 'push' | 'replace' | 'back'
  if (to.meta.requiresAuth && !session.user) {
    return { name: 'login', query: { next: to.fullPath } }
  }
})
```

<Clip name="ios-guards" caption="La cuenta redirige para iniciar sesión. Un nombre escrito activa la licencia guard, que puede mantener la página abierta. Simulador iOS 26." />

`beforeResolve`, `afterEach` y `onError` también están ahí, con las firmas del Vue Router.

## Salir de guards {#leave-guards}

`onBeforeRouteLeave` se ejecuta cuando su página está a punto de ser eliminada del stack: en la parte posterior, reemplaza o `clearHistory`, y también en el botón Atrás del Android, que el enrutador intercepta para que tu guard pueda opinar. Empujar otra página en la parte superior mantiene viva la página, por lo que el guard no se ejecuta en ese momento.

```ts
import { computed, ref } from 'nativescript-vue'
import { Dialogs } from '@nativescript/core'
import { onBeforeRouteLeave } from 'vue-router-ns'

const draft = ref('')
const dirty = computed(() => draft.value.trim() !== '')

onBeforeRouteLeave(() => Dialogs.confirm('Discard this draft?'), { when: dirty })
```

`when` es opcional e importa en iOS. Un deslizamiento hacia atrás no puede esperar a un guard asíncrono, por lo que mientras un guard de salida está activo, el enrutador desactiva el deslizamiento hacia atrás para esa página. Con `when`, el guard solo bloquea mientras es verdad: con un borrador vacío, la página se desliza como de costumbre.

## Qué hace la plataforma mientras un guard está activo {#what-the-platform-does-while-a-guard-is-active}

| Gesto                                                | Comportamiento                                                                                                                                                                                           |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Android botón de retroceso, o soltando el deslizador | Pasa por el guard.                                                                                                                                                                                       |
| iOS deslizar hacia atrás                             | Desactivado para esa página, ya que no puede esperar una respuesta asíncrona.                                                                                                                            |
| Back/historial de ActionBar en iOS (16+)             | Usa temporalmente un elemento nativo controlado por el router mientras una página eliminable tiene un guard activo; tocar y seleccionar historial ejecutan guards. En iOS 15 el pop sigue siendo nativo. |
| Modal deslizado hacia abajo o tocado afuera          | Ejecuta el guard con la hoja quieta y cierra el modal si lo permite. El correo hace esto.                                                                                                                |

El resto del tiempo, un pop nativo es nativo: el enrutador mantiene sincronizado su stack y ejecuta `afterEach`, pero nada puede vetarlo.

Un salto de historial nativo puede eliminar varias páginas, por lo que la ActionBar protegida incluye los guards bajo la página actual. Su menú usa direcciones estables y el flujo existente de guards, resultados y eliminación. Una confirmación pendiente nunca autoriza seleccionar una nueva aparición de la misma ruta. Los encabezados se amplían mediante el `ActionBar.update()` público de la Page y se restauran al devolver el control o eliminar al propietario; los delegates de navegación no cambian. Se aplica a Pages enrutadas de NativeScript con ActionBar. iOS 15 conserva el límite anterior de pop nativo.

Los guards globales por sí solos no deshabilitan gestos nativos ni activan este control. Sin un guard de salida activo en el historial eliminable, el Back nativo se reconcilia después del pop del sistema. Usa `onBeforeRouteLeave` con `when` para proteger estado frente al historial nativo. Un guard en la raíz no sustituye el control, porque seleccionar la raíz la conserva.

Los cambios del encabezado o de los guards cierran cualquier menú contextual abierto en el encabezado; se ignoran los callbacks de una página cubierta, modificada o eliminada.

<Clip name="guarded-back-history" :width="480" aspect="3 / 4" caption="Back nativo protegido: guards en el tope/página cubierta, confirmación Stay/Leave, selección exacta de duplicados, encabezados y restauración. Simulador iOS 18.6; etiquetas en inglés." />

## Continuar aprendiendo {#continue-learning}

Ejecute el tutorial del editor modal [Crea tu primera aplicación](./first-app) para ejercitar el rechazo, guardado y descarte con el código fuente completo. Para conocer los límites de los gestos nativos, consulte [pages, stacks y state](./mental-model#native-back-and-guards).
