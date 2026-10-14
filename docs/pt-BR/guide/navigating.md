# Navegando

```ts
router.push('/messages/42?from=push')
router.push({ name: 'message', params: { id: 42 }, query: { from: 'push' } })
router.replace('/login')
router.back()
router.go(-2)
router.backTo({ name: 'inbox' }) // a página mais próxima abaixo que corresponde
router.backToRoot() // a primeira página da pilha
```

Tudo retorna uma promise que resolve quando a página está na tela, com um `NavigationFailure` quando um guard a impediu, como no Vue Router.

## Opções

Um segundo argumento recebe o que só faz sentido num aparelho:

```ts
router.push('/messages/42', {
  transition: 'slideLeft', // ou um objeto de transição completo do NativeScript
  animated: false,
  clearHistory: true, // não sobra nada para onde voltar
  props: { preview }, // qualquer valor, diferente dos params
  frame: 'profile', // um <RouterView> nomeado
  modal: true, // apresenta como modal, diga o que disser a rota
  withParents: true, // empurra os pais da rota antes
  zoomFrom: thumbnail, // iOS 18: cresce a partir desta view
})
```

`back()` recebe `animated`, `frame` e `result` (veja [Modais e resultados](./modals)).

## Toque duplo

As navegações entram numa fila atrás das transições nativas, então um toque duplo num botão abre a página uma vez: o segundo `push` encontra a página já no topo e resolve com uma falha `duplicated`.

## `<RouterLink>`

O `RouterLink` faz seu único filho navegar no toque, sem adicionar uma view:

```vue
<RouterLink to="/settings">
  <Button text="Settings" />
</RouterLink>
```

Ele aceita `to`, `replace`, `clearHistory`, `withParents`, `zoom`, `transition` e `frame`.
