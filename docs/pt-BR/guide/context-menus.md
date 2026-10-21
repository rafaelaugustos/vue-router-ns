# Pré-visualização por menu de contexto

Pressione uma linha, veja aonde ela leva e decida. No iOS, `UIContextMenuInteraction` mostra uma prévia do destino com um menu de ações, e tocar na prévia confirma a navegação. O Android não tem prévia ao vivo, então as mesmas opções viram um popup: a rota primeiro, depois as ações.

```vue
<script setup lang="ts">
import { vRoutePreview, type RoutePreviewOptions } from 'vue-router-ns'
import MessagePreview from '../components/MessagePreview.vue'

function menuFor(item: Message): RoutePreviewOptions {
  return {
    to: { name: 'message', params: { id: item.id } },
    preview: MessagePreview,
    props: { id: item.id },
    actions: [
      { title: 'Responder', image: 'arrowshape.turn.up.left', run: () => reply(item) },
    ],
  }
}
</script>

<template>
  <ListView :items="messages" @itemTap="open">
    <template #default="{ item }">
      <GridLayout v-route-preview="menuFor(item)" columns="auto, *" />
    </template>
  </ListView>
</template>
```

<Clip name="ios-context-menu" caption="Uma pressão longa mostra a prévia; tocar nela abre a rota da mensagem. Simulador iOS 26." />

`v-route-preview` funciona em qualquer view, inclusive linhas de lista: as opções são lidas de novo a cada pressão, então uma linha reciclada mostra o item atual. `<RouterLink>` aceita as mesmas opções, sem o `to`, no prop `menu`.

| Opção              | Significado                                                                                                                         |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `to`               | O destino, confirmado com `router.push` (ou `replace`). `clearHistory`, `withParents`, `frame`, `transition` e `zoom` também valem. |
| `preview`, `props` | O componente da prévia do UIKit, montado com esses props.                                                                           |
| `canPreview`       | Chamado na hora da pressão. `false` deixa conteúdo protegido fora da prévia; as ações continuam aparecendo.                         |
| `size`             | Em pixels independentes de densidade. Sem altura, o conteúdo é medido na largura da origem.                                         |
| `actions`          | `{ title, image?, destructive?, to?, run? }`. `image` é um SF Symbol no iOS; `to` navega pelos guards, `run` faz qualquer coisa.    |
| `openTitle`        | Android: o primeiro item do popup, "Open" por padrão.                                                                               |

A prévia é um app Vue próprio, descartado quando o menu fecha. Não é uma entrada da pilha: nenhum guard roda para ela, `afterEach` não dispara, nada é persistido e nenhuma promise de resultado é resolvida. Confirmar roda a navegação normal, e a página monta do zero; a prévia nunca é reaproveitada como página. Autorização fica em `canPreview`; um guard que redireciona para o login roda na confirmação.

No iOS 13+ a interação fica na view, com um `UIMenu` de `UIAction`s e a prévia num view controller de layout dimensionado pelo conteúdo. No Android, um `PopupMenu` de títulos: views avulsas usam o gesto de pressão longa; linhas de lista usam o long click da própria lista, para que nenhum gesto faça a linha engolir seus toques. Veja a [receita completa em inglês](/guide/context-menus) e o relatório `test/native-context-menus.md` no repositório.
