# Modais e resultados

Marque uma rota com `modal: true`, ou passe `ModalOptions` (`fullscreen`, `animated`, `cancelable`, `ios.presentationStyle`…):

```ts
{ path: '/compose', component: Compose, modal: { fullscreen: true } }
```

`router.push('/compose')` apresenta a rota dentro do próprio frame, então ela tem uma ActionBar e a própria pilha. As páginas de dentro empurram dentro do modal. `router.back()` na primeira página do modal o fecha. Puxar para baixo, tocar fora ou apertar o botão de voltar do Android também fecham, passando pelos leave guards das páginas dele. O router acompanha e roda o `afterEach`.

O `push` também aceita `modal` como opção, para apresentar qualquer rota como modal independente do que o record diz.

## Recebendo um resultado de volta

Uma página pode devolver um valor para quem a abriu. Funciona com modais e com páginas comuns:

```ts
// Message.vue
const reply = await router.pushForResult<string>('/compose')
if (reply) send(reply)
```

```ts
// Compose.vue
router.back({ result: text.value })
```

Se a página fecha de qualquer outro jeito (um swipe, o botão de voltar) ou um guard a impede de abrir, a promise resolve com `undefined`.
