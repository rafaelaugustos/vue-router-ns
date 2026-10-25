# Configurando todo el stack {#setting-the-whole-stack}

Al igual que el `NavigationStack(path:)` de SwiftUI, el stack se puede configurar como una lista y las páginas siguientes:

```ts
await router.setStack(['/', '/orders', { name: 'order', params: { id: 42 } }])
```

El enrutador mantiene las páginas que ambos stacks comparten de abajo hacia arriba, regresa a la última de ellas y luego envía el resto. Sólo el último paso anima. Los guardias corren a cada paso y el primer fallo lo detiene. Una ruta modal en la lista se convierte en una página simple: la lista describe el stack de un cuadro.

Toma `frame`, `animated` y `transition` como segundo argumento. Es en lo que se basan [`withParents`](./deep-links#bringing-the-parents-along) y [para restaurar un stack](./restore) guardado.

La lista no puede estar vacía. Si un guard interrumpe la conciliación, los pasos completados permanecen: `setStack()` no es una transacción. En un `RouterSplitView`, la lista permanece fijada como la primera entrada, incluso cuando se omite en el argumento.

## Volviendo atrás sin animar {#going-back-without-animating}

`back()`, `backTo()` y `backToRoot()` toman `animated: false`. `go(delta)` sólo acepta el desplazamiento; utilice `backTo()` o `backToRoot()` cuando necesite opciones. Un marco anima una ventana emergente en la forma en que entró la página que se está abriendo, por lo que el enrutador configura eso en la página antes de abrirla.
