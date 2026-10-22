# Pickers do sistema e fluxos nativos

Alguns destinos não são páginas: o seletor de documentos, a activity de outro app, uma folha de compartilhamento. O sistema é dono deles, eles podem sobreviver a uma rotação de tela, e nada sobre eles pertence à pilha de voltar. Um **fluxo nativo** dá a eles uma entrada tipada, um resultado tipado e um de três desfechos, resolvido exatamente uma vez.

<Clip name="ios-document-picker" caption="Attach abre o seletor de documentos do iOS. Cancelar retorna ao formulário com Picker cancelled, sem adicionar uma rota." />

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

`createDocumentPicker()` abre `ACTION_OPEN_DOCUMENT` pelo registro AndroidX Activity Result da Activity da página de origem, ou `UIDocumentPickerViewController` pelo controller dessa página no iOS 14 ou superior. A página precisa estar montada. `types` aceita tipos MIME, incluindo `image/*`, `audio/*`, `video/*`, `text/*` e `*/*`; `multiple` permite vários documentos.

O resultado contém strings de URI: `content://` no Android e `file://` no iOS. Uma URI não é um caminho de arquivo nem uma permissão permanente. Ler/copiar dados, manter permissões persistentes no Android e gerenciar URLs com escopo de segurança/bookmarks no iOS são responsabilidades do app. Use um adaptador próprio se precisar dos objetos nativos originais para gerenciar esse acesso.

Handles separados podem executar fluxos independentes no Android. O UIKit oferece um espaço de apresentação por janela: um segundo seletor simultâneo resolve como `failed`, sem deixar uma Promise pendente. Aguarde a dispensa antes de apresentar outro controller. Uma nova chamada no mesmo handle substitui a tentativa anterior; guards assíncronos não lançam uma chamada antiga por cima de uma mais recente.

## Escrevendo um fluxo

Um fluxo tem `kind`, `supported()` opcional e `start(input, context)`. O contexto fornece a `page` de origem, `id` de correlação, `complete`, `cancel` e `fail`. Retorne uma função de limpeza de `start`: ela executa em **todo desfecho**, incluindo sucesso, cancelamento, falha e descarte. Libere delegates/listeners e dispense a UI nativa que o adaptador controla.

No Android, use `context.launchActivity(intent, (resultCode, intent) => { ... })`. Ele registra na Activity AndroidX de origem, lança uma vez e remove o registro quando o fluxo termina. Interprete o resultado e chame `complete`, `cancel` ou `fail`. Exceções nessa interpretação viram resultados `failed`. O registro não usa uma Activity global escolhida pelo foreground.

`requestCode` e `onActivityResult(handler)` continuam disponíveis para adaptadores antigos. A faixa numérica reservada não garante ausência de colisão com plugins que usem os mesmos códigos; novos adaptadores devem usar `launchActivity`.

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

O adaptador AndroidX salva a chave de registro da tentativa no estado da Activity e registra novamente essa chave após a recriação **enquanto a página de origem e a tentativa JavaScript continuarem vivas**. Ele não lança a Activity externa duas vezes. A destruição da Activity de origem sem mudança de configuração cancela com `disposed`.

A vida da página tem precedência. O router mantém os apps das páginas em Frames durante `Activity.recreate()`, permitindo que o fluxo pendente se registre na Activity substituta e receba seu resultado uma vez. Remover a rota ou fechar permanentemente sua janela ainda cancela com `cancelled/disposed`; um resultado tardio não resolve aquela tentativa novamente nem completa outra.

Nenhuma Promise sobrevive à morte do processo. Persista um marcador “seletor estava aberto” no [estado de página](./restore#estado-da-pagina) ou no armazenamento do app; após reiniciar, decida se deve tentar novamente ou recuperar um acesso já concedido. O router não entrega um resultado antigo a um fluxo novo. Persistir o marcador não persiste a permissão do documento.

`useNativeFlow` descarta tentativas junto com a página. Quem usa `startNativeFlow` diretamente deve chamar o `dispose()` retornado quando o dono fechar. A UI do sistema não cria entradas no histórico nem dispara desativação de página do router; os eventos normais de background/foreground da plataforma continuam valendo.
