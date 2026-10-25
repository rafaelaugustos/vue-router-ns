# Cada página mantiene su ruta {#every-page-keeps-its-route}

Empujar una página no destruye la siguiente: permanece montada hasta que sale del stack. Es por eso que `useRoute()` dentro de una página devuelve la ruta de esa página y nunca cambia. Mientras que `/messages/2` se encuentra encima de `/messages/1`, la primera página todavía ve `id: '1'` y no se vuelve a ejecutar nada porque se movió otra página.

<Clip name="ios-navigation" caption="Cada mensaje agrega su propia entrada al stack que se muestra en la parte inferior. Simulador iOS 26." />

Fuera de las páginas (en `App.vue`, por ejemplo), `useRoute()` sigue a la página en pantalla. `router.currentRoute` es siempre la página en pantalla, y `router.stack` es el stack completo, de abajo hacia arriba, reactivo:

```ts
const { stack } = useRouter()
const canGoBack = computed(() => stack.value.length > 1)
```

`useRouter()` dentro de una página navega en el stack en el que reside esa página: su pestaña, o su modal.

## Accesorios {#props}

El `props` de un registro de ruta funciona como en el Vue Router: `true` pasa los parámetros como accesorios, un objeto se pasa tal cual, una función asigna la ruta. Además de eso, `push` toma `props` para valores que no pueden ser parámetros, como un objeto para obtener una vista previa mientras se carga el real.

## Cuando una página vuelve a aparecer {#when-a-page-comes-back-into-view}

Una página que permanece en stack no se vuelve a montar cuando regresas a ella, por lo que `onMounted` no te ayudará a actualizarla. Utilice estos en su lugar:

```ts
onPageActivated(() => refresh()) // shown, and every time the user comes back
onPageDeactivated(() => pause()) // covered by another page or a modal
```

Cuando la página sale del stack se desmonta, por lo que la limpieza va en `onUnmounted`.

## Páginas con mucho que diseñar {#pages-with-a-lot-to-lay-out}

En NativeScript, el JavaScript se ejecuta en el hilo principal, por lo que una página que tarda un poco en construirse retrasa su propia animación de inserción: el marco espera la vista antes de moverse. `<Deferred>` deja que la transición termine antes de montar su contenido: renderiza su `fallback` hasta que la página está en pantalla, después de la transición, y solo entonces su contenido.

```vue
<Page>
  <ActionBar title="Report" />
  <Deferred>
    <template #fallback><ActivityIndicator busy /></template>
    <ReportBody :report="report" />
  </Deferred>
</Page>
```

Medido en un emulador Android con una página de 400 filas en un `StackLayout`: la transición finalizó entre 1,1 y 2,7 ​​segundos después del tap; con las filas dentro de `<Deferred>`, de 0,3 a 0,7 segundos. Las filas en sí tardan tanto en aparecer como antes, ya que el trabajo no desaparece: ocurre después de que se publica la página en lugar de antes. Para listas largas, un `ListView` o un `CollectionView` sigue siendo la respuesta, ya que solo crean lo que es visible.

## HMR durante el desarrollo {#hmr-during-development}

Desde beta.6, la recarga de un componente enrutado pasa por el reemplazo nativo Page de NativeScript-Vue. Si otra página lo cubre en el mismo stack, la recarga espera hasta que el Frame termine de regresar a él. El orden de stack se conserva y el contenido actualizado aparece al regresar.

Una recarga que vuelve a montar un componente puede restablecer su estado local; Preservar el historial no preserva todas las configuraciones ref. Las actualizaciones de solo plantilla siguen el comportamiento de HMR de Vue. Los cambios en el módulo del enrutador, la raíz de la aplicación o los recursos nativos pueden requerir reiniciar la aplicación. Este comportamiento se aplica sólo en desarrollo.
