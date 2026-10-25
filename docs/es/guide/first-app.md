# Crea tu primera aplicación {#build-your-first-app}

Construye **Pocket notes**: busca en una lista, abre una nota, edítala en un modal nativo y devuelve el texto guardado. Un guard de salida protege el borrador sin guardar. Al volver, la lista conserva su búsqueda.

Este tutorial usa rutas explícitas y APIs públicas. Presupone conocimientos básicos de componentes Vue de un solo archivo y un [proyecto NativeScript-Vue preparado](./install). Las notas son ficticias y se almacenan en memoria; el ejemplo no implementa persistencia, autenticación ni un backend.

<Clip name="first-app" caption="Pocket notes en un simulador iOS 26: búsqueda conservada, editor modal nativo, cancelación rechazada y resultado guardado. La demo ejecuta el mismo código del tutorial." />

## 1. Crea los archivos {#_1-create-the-files}

Después de instalar el router, coloca estos **siete archivos completos** en el directorio `src` de la aplicación. Sustituye la entrada y la raíz del proyecto inicial por los archivos siguientes; conserva sus recursos nativos y su configuración de compilación. El código se incorpora directamente desde el [tutorial ejecutable](https://github.com/rafaelaugustos/vue-router-ns/tree/main/demo/src/tutorial), por lo que todas las traducciones comparten la implementación. Los textos de la aplicación de ejemplo están en inglés.

```text
src/
  app.ts
  App.vue
  router.ts
  notes.ts
  pages/
    Home.vue
    Note.vue
    Edit.vue
```

El `RouterView` de la raíz crea un Frame nativo. Cada componente de ruta renderiza una Page. No envuelvas este RouterView en otro Frame.

**`src/router.ts`**: `/` contiene la lista, `:id` selecciona una nota y `modal: true` da al editor su propio Frame. `props: true` pasa los parámetros de ruta a la página.

<<< ../../../demo/src/tutorial/router.ts

**`src/app.ts`**: instala el router antes de iniciar la aplicación.

<<< ../../../demo/src/tutorial/app.ts

**`src/App.vue`**: mantén montado el host de navegación.

<<< ../../../demo/src/tutorial/App.vue

## 2. Añade los datos y la lista {#_2-add-data-and-the-list}

**`src/notes.ts`**: datos compartidos por la lista, el detalle y el editor. Guardar modifica este array reactivo; no escribe en disco.

<<< ../../../demo/src/tutorial/notes.ts

**`src/pages/Home.vue`**: `query` pertenece a esta página. Abrir una nota cubre Home; no destruye la página ni su búsqueda.

<<< ../../../demo/src/tutorial/pages/Home.vue

Esta lista de dos elementos usa componentes Button nativos. Para un catálogo grande, usa una lista virtualizada. TextField proporciona una búsqueda sencilla; la [búsqueda nativa en el encabezado](./native-bars) puede añadirse después.

## 3. Abre el detalle y espera un resultado {#_3-open-a-detail-and-wait-for-a-result}

**`src/pages/Note.vue`**: la prop `id` pertenece a esta entrada de ruta. `pushForResult<string>` espera al editor; cerrar sin resultado devuelve `undefined`. La comprobación explícita permite guardar intencionadamente una cadena vacía.

<<< ../../../demo/src/tutorial/pages/Note.vue

El detalle de origen sigue montado mientras el modal está abierto. El tipo genérico describe el contrato entre estas dos páginas; no valida datos arbitrarios en tiempo de ejecución.

## 4. Protege el borrador y guarda {#_4-protect-the-draft-then-save}

**`src/pages/Edit.vue`**: el borrador pertenece al editor. El guard de salida solo pide confirmación cuando el borrador difiere de la nota guardada. Guardar permite temporalmente la salida y devuelve el borrador mediante `back({ result })`.

<<< ../../../demo/src/tutorial/pages/Edit.vue

**Cancel** solicita salir a través del guard. **Keep editing** mantiene el editor montado con su borrador. **Discard** lo cierra sin cambiar la nota. Guardar devuelve el valor al detalle, donde el código de la aplicación actualiza `notes`.

Un guard de salida protege la eliminación de una página, no el hecho de cubrirla. En iOS, un guard activo cambia qué gestos pueden cerrar o retirar la página. Consulta la [matriz de comportamiento por plataforma](./guards#what-the-platform-does-while-a-guard-is-active); no todos los gestos pueden esperar a un diálogo.

## 5. Ejecuta y comprueba el flujo completo {#_5-run-and-check-the-complete-flow}

En el proyecto NativeScript-Vue que has creado:

```sh
ns run ios
# or:
ns run android
```

1. Escribe `coast` en **Find a note**. Solo queda **Along the coast**.
2. Abre esa nota y pulsa **Edit in a modal**.
3. Cambia el texto. Pulsa **Cancel → Keep editing** y comprueba que se conserva el borrador.
4. Pulsa **Save note**. El detalle original muestra el texto devuelto.
5. Vuelve con el control nativo. Home sigue mostrando `coast` y la misma lista filtrada.
6. Abre otra vez el editor, cambia el texto y elige **Cancel → Discard**. El último texto guardado no cambia.

Si prefieres la versión del repositorio, sigue la [preparación del checkout y los recursos](./native-showcase#run-from-a-checkout) y ejecuta `npm run tutorial:ios` o `npm run tutorial:android` desde `demo`. Pasa `-- --device <id>` para elegir un dispositivo. El tutorial comparte el identificador de aplicación de la demo; instalarlo sustituye la otra variante de la demo en ese dispositivo.

## Qué construir después {#what-to-build-next}

Ahora tienes un stack retenido, otro modal, un borrador local de página y un resultado gestionado por la aplicación. Consulta el [modelo interactivo](./mental-model) para explorar sus ciclos de vida.

Continúa con [Fieldnotes](./native-showcase) para añadir un drawer, búsqueda nativa perteneciente a cada página, acciones compartidas entre encabezados y menús, y gestión explícita del foco. Elige [pestañas o navegación dividida](./capabilities) cuando necesites otra estructura. Añade [almacenamiento y restauración persistentes](./restore) cuando el estado deba sobrevivir a la terminación del proceso.
