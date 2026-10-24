# Zoom e elementos compartilhados

Toque em um card e faça a página crescer a partir dele. Ao voltar, ela encolhe para o mesmo elemento. Esse é o zoom nativo do UIKit, disponível no iOS 18+ quando o runtime expõe `UIViewControllerTransition`. Android e runtimes sem essa API usam a transição normal ou o fallback explícito.

<Clip name="ios-zoom" caption="O card abre a mensagem com o zoom do UIKit e recebe a transição de volta. Simulador iOS 26." />

## Card com RouterLink

Salve como `Inbox.vue`. O único filho de `RouterLink` é o elemento de origem; não é necessário obter um ref nem criar uma animação em JavaScript.

<<< ../../snippets/ZoomCard.vue

## Destino e configuração

Salve o destino como `Message.vue`:

<<< ../../snippets/ZoomMessage.vue

Registre as duas páginas no router e instale-o no app, como no [guia de instalação](./install):

```ts
import { createRouter } from 'vue-router-ns'

export const router = createRouter({
  routes: [
    { path: '/', component: () => import('./Inbox.vue') },
    {
      path: '/messages/:id',
      name: 'message',
      component: () => import('./Message.vue'),
      props: true,
    },
  ],
})
```

No componente raiz, use `<RouterView />`. Teste primeiro em uma única pilha: o primeiro detalhe de um split expandido aparece em outro painel, sem zoom a partir da lista.

## Linha de lista com zoomFrom

Substitua `Inbox.vue` por esta versão para usar a view entregue pelo `itemTap`. O destino acima também tem a tag necessária para a transição compartilhada usada como fallback.

<<< ../../snippets/ZoomList.vue

### O que observar

- Toque em uma linha: a mensagem deve abrir na mesma pilha.
- Com o zoom disponível, a página cresce a partir da linha. Voltar deve retornar à origem.
- Com movimento reduzido ativado, o router pede uma transição sem animação.
- No Android, as labels com a mesma `sharedTransitionTag` participam da transição compartilhada.
- Uma animação lateral comum não comprova o zoom. Verifique a API disponível no runtime e evite `Frame.defaultTransition` nesse frame.

O [Inbox do demo](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/pages/Inbox.vue) usa `zoomFrom` com fallback. Para reproduzir o vídeo, abra Settings → Zoom from a card no demo. Essa página usa uma pilha simples; [veja seu código](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/pages/Transitions.vue).

## Referência das transições

O `transition` aceita o `SharedTransition` do NativeScript, que transforma as views que têm o mesmo `sharedTransitionTag` de uma página na outra, nas duas plataformas:

```vue
<!-- na lista -->
<Image :src="photo.thumb" :sharedTransitionTag="`photo-${photo.id}`" />

<!-- na página da foto -->
<Image :src="photo.full" :sharedTransitionTag="`photo-${photo.id}`" />
```

```ts
import { PageTransition, SharedTransition } from '@nativescript/core'

router.push(`/photos/${photo.id}`, {
  transition: SharedTransition.custom(new PageTransition()),
})
```

Voltar toca a animação ao contrário. O dismiss interativo dele (`interactive: { dismiss }`, só no iOS) é um pop nativo, como o swipe de voltar: o router acompanha, mas um leave guard não consegue impedir.

No iOS 18 ou mais novo, o `zoomFrom` entrega a animação ao zoom do UIKit: a página cresce a partir de uma view, e encolhe de volta para ela quando fecha, pelo botão de voltar, por um swipe da borda ou arrastando para baixo. Enquanto um leave guard está ativo, o arrastar fica segurado, como o swipe de voltar.

```ts
function open({ index, view }: ItemEventData) {
  router.push(`/photos/${photos[index].id}`, { zoomFrom: view })
}
```

O `zoomFrom` aceita uma view, o elemento de um template ref ou um componente, e o `<RouterLink zoom>` faz o zoom a partir do próprio filho. Se a view já não existir quando a página fechar, ela fecha sem zoom. Onde o zoom não se aplica (Android, iOS antes do 18, `animated: false`), a página usa a transição de sempre, então passar os dois dá a cada plataforma a sua:

```ts
router.push(to, {
  zoomFrom: view, // iOS 18
  transition: SharedTransition.custom(new PageTransition()), // em todo o resto
})
```

Uma transição padrão definida no frame (`Frame.defaultTransition`) toma a animação do UIKit de volta, então deixe-a sem definir onde você usar o zoom.

Veja [controle e limites das transições interativas](./interactive-transitions) antes de criar adaptadores de gestos.
