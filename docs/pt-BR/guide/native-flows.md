# Pickers do sistema e fluxos nativos

Alguns destinos não são páginas: o seletor de documentos, a activity de outro app, uma folha de compartilhamento. O sistema é dono deles, eles sobrevivem a uma rotação de tela, e nada sobre eles pertence à pilha de voltar. Um **fluxo nativo** dá a eles uma entrada tipada, um resultado tipado e um de três desfechos, resolvido exatamente uma vez.

```ts
import { createDocumentPicker, useNativeFlow } from 'vue-router-ns'

const picker = useNativeFlow(createDocumentPicker())

async function attach() {
  const outcome = await picker.run({
    types: ['application/pdf', 'image/*'],
    multiple: true,
  })
  if (outcome.status === 'completed') attachments.value = outcome.value.uris
}
```

O `run` resolve com `{ status: 'completed', value }`, `{ status: 'cancelled', reason }` ou `{ status: 'failed', error }`. Os motivos: `'user'` quando a UI do sistema foi dispensada, `'guard'` quando a opção `before` disse não, `'replaced'` quando a mesma página rodou o fluxo de novo, e `'disposed'` quando a página saiu da pilha antes, caso em que um resultado que chega depois é descartado. `running` é um ref que fica `true` do lançamento até o desfecho. A página que iniciou o fluxo continua ativa e nada entra no histórico: `onPageDeactivated` não dispara para uma UI do sistema que o router não controla.

Faça as verificações antes de lançar, não depois: `picker.run(input, { before: () => session.user !== '' })` cancela com `'guard'` em vez de tentar interceptar uma dispensa que o sistema não anuncia.

## O seletor de documentos

`createDocumentPicker()` abre o `ACTION_OPEN_DOCUMENT` no Android e o `UIDocumentPickerViewController` no iOS 14 ou mais novo, apresentado a partir do view controller da própria página. `types` são tipos MIME, `multiple` permite vários. O resultado são URIs com escopo: `content://` no Android, URLs `file://` com escopo de segurança no iOS. Ler, manter acesso persistente e copiar o que o app precisa é tarefa do app, com as APIs da própria plataforma; o router nunca entrega caminhos de arquivo que não tem.

## Escrevendo um fluxo

Um fluxo é um objeto com um `kind`, um `supported()` opcional e um `start(input, context)`. O contexto tem a página, um `requestCode` Android reservado com `onActivityResult(handler)` ligado ao evento `activityResult` do core, e `complete`, `cancel` e `fail`. Devolva uma função do `start` para ser avisado quando a tentativa for abandonada, para dispensar um controller por exemplo. Os request codes vêm de uma faixa própria, então não colidem com os de outros plugins, e tentativas concorrentes resolvem de forma independente.

```ts
const share: NativeFlow<string, void> = {
  kind: 'share',
  start(text, context) {
    const controller =
      UIActivityViewController.alloc().initWithActivityItemsApplicationActivities(
        [text],
        null,
      )
    controller.completionWithItemsHandler = (_, completed) =>
      completed ? context.complete() : context.cancel()
    context.page?.ios.presentViewControllerAnimatedCompletion(controller, true, null)
  },
}
```

## Rotação e morte do processo

Uma activity Android recriada durante o fluxo, por uma rotação, ainda recebe o resultado: a tentativa é indexada pelo request code no processo JavaScript, que sobrevive. A morte do processo não: não há promise para resolver quando o app volta, e o resultado que o sistema entrega ao novo processo é descartado. Uma página que precisa sobreviver a isso guarda "um seletor estava aberto" no seu [estado de página](./restore#estado-da-pagina) e pergunta de novo, ou lê o que o sistema já concedeu.
