# Modais e resultados

Marque uma rota com `modal: true`, ou passe `ModalOptions` (`fullscreen`, `animated`, `cancelable`, `ios.presentationStyle`…):

```ts
{ path: '/compose', component: Compose, modal: { fullscreen: true } }
```

`router.push('/compose')` apresenta a rota dentro do próprio frame, então ela tem uma ActionBar e a própria pilha. As páginas de dentro empurram dentro do modal. `router.back()` na primeira página do modal o fecha. Puxar para baixo, tocar fora ou apertar o botão de voltar do Android também fecham, passando pelos leave guards das páginas dele. O router acompanha e roda o `afterEach`.

O `push` também aceita `modal` como opção, para apresentar qualquer rota como modal independente do que o record diz.

## Sheets no iOS

Os sheets do iOS podem parar na altura média, na altura cheia ou numa fração da tela, mostrar um grabber, e manter a página de trás usável, como o Maps. Configure isso em `ios` nas opções do modal:

```ts
{
  path: '/filters',
  component: Filters,
  modal: {
    ios: {
      detents: ['medium', 'large'], // ou uma fração da tela: 0.4 (iOS 16)
      selectedDetent: 'medium', // a altura em que abre
      largestUndimmedDetent: 'medium', // a página de trás continua usável até aqui
      grabber: true,
      cornerRadius: 24,
    },
  },
}
```

O sheet é configurado antes de ser apresentado, então abre na altura certa. O `push` pode passar as mesmas opções em `modal.ios`, mescladas com as do record. O Android não tem equivalente no `showModal` e as ignora.

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

## Fechamento e versões

`cancelable: false` impede o fechamento pelo usuário (como back do Android na raiz do modal); o código ainda pode chamar `router.back()`, passando pelos guards. Uma página acima da raiz do modal ainda pode voltar dentro da pilha.

Sheets com alturas `'medium'` e `'large'` exigem iOS 15+; alturas fracionárias exigem iOS 16+. A apresentação precisa ser compatível com sheets. Opções `ios` são ignoradas no Android. O resultado de `pushForResult<T>()` não é validado em runtime: `T` descreve o contrato entre as páginas.
