# Destinos nativos (experimental)

`defineNativeDestination()` permite que uma rota mostre um `UIViewController` UIKit ou um `Fragment` AndroidX existente. Use o retorno como `component` da rota. A navegação continua usando Frames e Pages nativos, com o histórico, guards e resultados do router.

O router controla a Page contêiner e a associação do controller/Fragment. O SDK controla a interface da tela. Diferentemente de um [fluxo nativo](./native-flows), o destino ocupa uma entrada no histórico.

## Definir um destino

```ts
import { defineNativeDestination, createRouter } from 'vue-router-ns'

const Editor = defineNativeDestination<{ documentId: string }, { saved: boolean }>({
  id: 'vendor.document-editor',
  input: (route) => ({ documentId: String(route.params.id) }),
  ios(context) {
    const editor = makeUIKitEditor(context.input.documentId)
    editor.onSave = () => context.complete({ saved: true })
    editor.onCancel = () => context.cancel()
    return {
      native: editor,
      dispose() {
        editor.onSave = null
        editor.onCancel = null
      },
    }
  },
  android(context) {
    const editor = makeAndroidXEditor(context.input.documentId)
    editor.setOnSave(() => context.complete({ saved: true }))
    editor.setOnCancel(() => context.cancel())
    return {
      native: editor,
      dispose() {
        editor.setOnSave(null)
        editor.setOnCancel(null)
      },
    }
  },
})

const router = createRouter({
  routes: [
    { path: '/', component: Home },
    {
      path: '/documents/:id',
      name: 'document-editor',
      component: Editor,
      meta: { layout: false },
    },
  ],
})

const result = await router.pushForResult<{ saved: boolean }>({
  name: 'document-editor',
  params: { id: '42' },
})
```

`makeUIKitEditor` e `makeAndroidXEditor` representam as fábricas do seu SDK, não exports do router. Cada chamada deve devolver, de forma síncrona, um objeto nativo novo e sem contêiner pai. A ausência da fábrica da plataforma gera um erro claro antes de entrar na rota.

O mapeador de entrada também recebe as props da rota no segundo argumento. O contexto fornece `route`, `input` e o getter `page`. A Page fica disponível após a montagem e vira `null` após o descarte. Apresente diálogos adicionais do SDK a partir do controller ou Activity dessa Page para preservar a janela correta.

O destino controla sua própria Page e não aceita layouts Vue nomeados. Use `meta.layout: false` quando houver um layout padrão. Também é possível usar uma rota modal.

## Resultados, guards e fechamento externo

| Operação                              | Comportamento                                                                                          |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `context.complete(value)`             | Solicita voltar pelo router com resultado tipado; devolve uma falha de navegação se um guard bloquear. |
| `context.cancel()`                    | Solicita voltar sem resultado, passando pelos guards.                                                  |
| `context.beforeLeave(guard)`          | Registra um guard de saída e devolve a função de remoção.                                              |
| Pop UIKit / voltar da Page Android    | A reconciliação do host remove a entrada e resolve o resultado pendente.                               |
| SDK remove seu Fragment Android       | O listener do FragmentManager filho observa a remoção e reconcilia a Page.                             |
| SDK remove seu controller filho UIKit | Chame `context.dismissed()` no callback do SDK depois que a remoção acontecer.                         |

`dismissed()` informa uma alteração irreversível. Não executa guards nem promete desfazer um fechamento já concluído pelo SDK. Quando o SDK permite interceptar a intenção de fechar, chame e aguarde `cancel()` ou `complete()` **antes** de remover a interface.

O gesto de voltar do UIKit fica desabilitado enquanto houver um guard de saída ativo, como nas páginas Vue. Chamadas diretas do SDK a `popViewController` não podem ser vetadas depois da conclusão. O adaptador não substitui delegates do SDK nem intercepta globalmente métodos UIKit.

Callbacks de entradas já fechadas, ou cobertas por outra entrada, não fazem nada. Um destino raiz não tem página anterior; `dismissed()` rejeita a remoção de uma raiz não modal. Use uma página Vue inicial ou um modal quando a tela precisar fechar.

## Ciclo de vida e restauração

No iOS, o controller é filho do controller da Page. No Android, o adaptador usa o FragmentManager **filho** do Fragment da Page, sem acrescentar transações do SDK ao histórico da Activity.

A fábrica pode executar novamente quando o NativeScript reconstruir uma view nativa. `dispose()` executa uma vez por instância, após desassociá-la do contêiner. Libere listeners, assinaturas e referências do aplicativo nesse callback. Mantenha o estado serializável fora da instância nativa; não reutilize controllers ou Fragments descartados.

A [restauração de histórico](./restore) existente recria a rota e chama a fábrica registrada com a entrada reconstruída. Mantenha estáveis a identidade/caminho da rota e o `id` da fábrica; migre rotas salvas ao renomeá-las. Controllers, Fragments, callbacks e Promises de resultado não são serializados. Isso não promete recuperação automática do estado privado do SDK nem restauração de cenas com múltiplas janelas.

## Dependências e exemplos

O router não inclui SDKs de terceiros. Adicione as dependências nativas ao aplicativo. Um `UIHostingController` SwiftUI, uma integração Compose ou um SDK com APIs inacessíveis à ponte NativeScript pode exigir um wrapper Swift/Kotlin compilado. Os exemplos deste protótipo usam UIKit e AndroidX diretamente.

A [fixture executável](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/testing/destinations-app.ts) contém as duas fábricas, botões, cancelamento e callbacks de fechamento. Após compilar o pacote, execute `ns build ios --emulator --env.destinationsTest` ou `ns build android --env.destinationsTest` em `demo`.

A integração segue os contratos de [contenção UIKit](https://developer.apple.com/documentation/uikit/creating-a-custom-container-view-controller) e [transações Fragment AndroidX](https://developer.android.com/guide/fragments/transactions). O [relatório nativo](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-destinations.md) registra as versões verificadas e os limites.
