# Zoom e elementos compartilhados

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
