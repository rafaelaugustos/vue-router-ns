# Configurando todo el stack {#setting-the-whole-stack}

## Seleccionar una entrada retenida exacta {#selecting-an-exact-retained-entry}

`router.stack` enumera rutas. `router.history` añade un snapshot congelado con una dirección de instancia para cada entrada retenida, de abajo hacia arriba. Dos entradas con la misma ruta tienen direcciones distintas:

```ts
const snapshot = router.getHistory({ frame: 'inbox' })
const selected = snapshot?.entries[1]
if (selected) await router.backToEntry(selected, { animated: false })
```

`history.value` sigue el stack del llamador: el enfocado en el router de la aplicación o el propietario dentro de una página. `getHistory()` lee el mismo ámbito; `{ frame }` selecciona un frame con nombre en este router/ventana. Leer no revela una pestaña ni navega. Usa `computed(() => router.getHistory({ frame: 'inbox' }))` para una vista reactiva de un stack con nombre. Un ámbito ausente o cerrado devuelve `undefined`. El historial de una página cerrada no pasa a representar otro stack.

Cada snapshot contiene `scope` y `entries`. El ámbito contiene `id`, `name`, `kind` (`frame` o `modal`), `windowId` cuando está vinculado a una ventana nativa y `pinnedRoot`. Cada entrada contiene:

| Campo           | Significado                                                                                                                                                |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scopeId`, `id` | Dirección exacta aceptada por `backToEntry()`. Es estable mientras existan el stack y la entrada, incluso durante descargas temporales y HMR de la página. |
| `key`           | Identidad del estado de página. La restauración versión 2 la conserva, pero crea una nueva dirección de instancia.                                         |
| `route`         | Copias independientes de `path`, `fullPath`, `name`, `params`, `query` y `hash`. Sin registros de ruta, componentes, metadatos ni referencias nativas.     |
| `restored`      | Esta página se reconstruyó desde un stack guardado, incluido un snapshot antiguo que solo contiene rutas. Es un objeto nativo nuevo.                       |

Los snapshots, las entradas, los datos de ruta y los arrays internos de parámetros/query están congelados. Un snapshot anterior sigue siendo una observación de aquel momento; vuelve a leer para consultar las entradas actuales. Conservar un snapshot no retiene las Pages nativas del router.

`backToEntry(selected, { animated, result })` selecciona el stack propietario de la entrada, aunque otro stack con nombre haya obtenido el foco. Revela la pestaña de ese stack antes de navegar. No admite sustituir `frame` ni buscar otra entrada por coincidencia de ruta. El resultado indicado se entrega solo a la página superior que sale; los demás resultados eliminados se resuelven con `undefined`. Los guards de salida se ejecutan de arriba hacia abajo por el flujo existente de Back, incluidos redireccionamientos, confirmación nativa y liberación.

- Seleccionar la entrada superior actual devuelve un fallo `duplicated` sin ejecutar guards ni cambiar el historial.
- Una entrada ausente, otro router/ventana o un stack cerrado/reemplazado rechaza con un error. Reutilizar el nombre del frame o restaurar la misma ruta/clave no vuelve válida una dirección antigua.
- Un guard que rechaza devuelve `aborted` y conserva el stack. Una navegación más reciente, el cierre del propietario o un cambio nativo del destino o de la página superior durante la espera devuelve `cancelled`.
- Un stack retenido y descargado encola Back hasta que cargue su host; otros stacks pueden seguir navegando. Un stack todavía sin abrir no tiene una entrada retenida para seleccionar.
- La raíz fija de un split puede seleccionarse y permanece fija. La selección nunca la elimina.
- Mientras haya un modal abierto, la selección se limita al stack del modal superior. Seleccionar un historial cubierto rechaza sin cerrar el modal; usa primero el flujo existente de Back del modal. Seleccionar la raíz del modal lo mantiene abierto.

Persiste rutas y estado de la aplicación mediante la [restauración](./restore), no estas direcciones de instancia. Las entradas eliminadas desaparecen: no hay historial de avance y reconstruirlas no resucita sus objetos nativos. Los controles nativos de Back permanecen. Un menú opcional de historial corresponde a otra etapa; esta API no instala uno.

<Clip name="entry-history" :width="480" aspect="3 / 4" caption="Dos stacks nativos: selección exacta entre duplicados, guard que rechaza, dirección obsoleta, Back nativo cancelado/completado y cierre de propietarios. Simulador iOS 18.6; etiquetas del app en inglés." />

## Reconciliar una lista de rutas {#reconciling-a-list-of-routes}

Al igual que el `NavigationStack(path:)` de SwiftUI, el stack se puede configurar como una lista y las páginas siguientes:

```ts
await router.setStack(['/', '/orders', { name: 'order', params: { id: 42 } }])
```

El enrutador mantiene las páginas que ambos stacks comparten de abajo hacia arriba, regresa a la última de ellas y luego envía el resto. Sólo el último paso anima. Los guardias corren a cada paso y el primer fallo lo detiene. Una ruta modal en la lista se convierte en una página simple: la lista describe el stack de un cuadro.

Toma `frame`, `animated` y `transition` como segundo argumento. Es en lo que se basan [`withParents`](./deep-links#bringing-the-parents-along) y [para restaurar un stack](./restore) guardado.

La lista no puede estar vacía. Si un guard interrumpe la conciliación, los pasos completados permanecen: `setStack()` no es una transacción. En un `RouterSplitView`, la lista permanece fijada como la primera entrada, incluso cuando se omite en el argumento.

## Volviendo atrás sin animar {#going-back-without-animating}

`back()`, `backTo()` y `backToRoot()` toman `animated: false`. `go(delta)` sólo acepta el desplazamiento; utilice `backTo()` o `backToRoot()` cuando necesite opciones. Un marco anima una ventana emergente en la forma en que entró la página que se está abriendo, por lo que el enrutador configura eso en la página antes de abrirla.
