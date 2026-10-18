# Guards

Guards globais e `beforeEnter` funcionam como no Vue Router 4: retorne `false` para cancelar, uma localização para redirecionar, ou nada para continuar. Podem ser assíncronos. Um terceiro argumento diz que tipo de navegação é:

```ts
router.beforeEach((to, from, { type }) => {
  // type: 'push' | 'replace' | 'back'
  if (to.meta.requiresAuth && !session.user) {
    return { name: 'login', query: { next: to.fullPath } }
  }
})
```

<Clip name="ios-guards" caption="Account redireciona para o login. Digitar um nome ativa o guard de saída, que pode manter a página aberta. Simulador iOS 26." />

`beforeResolve`, `afterEach` e `onError` também existem, com as assinaturas do Vue Router.

## Leave guards

O `onBeforeRouteLeave` roda quando sua página está prestes a ser removida da pilha: no back, no replace ou no `clearHistory`, e também no botão de voltar do Android, que o router intercepta para o seu guard ter voz. Empurrar outra página por cima mantém a página viva, então o guard não roda nessa hora.

```ts
const dirty = computed(() => draft.value.trim() !== '')

onBeforeRouteLeave(() => Dialogs.confirm('Descartar o rascunho?'), { when: dirty })
```

O `when` é opcional, e importa no iOS. Um swipe de voltar não consegue esperar um guard assíncrono, então enquanto um leave guard está ativo o router desliga o swipe de voltar daquela página. Com `when`, o guard só bloqueia enquanto ele é verdadeiro: com o rascunho vazio, a página sai no swipe como sempre.

## O que a plataforma faz enquanto um guard está ativo

| Gesto                                         | Comportamento                                                                                 |
| --------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Botão de voltar do Android, ou soltar o swipe | Passa pelo guard.                                                                             |
| Swipe de voltar do iOS                        | Desligado para aquela página, já que não consegue esperar uma resposta assíncrona.            |
| Botão de voltar da ActionBar no iOS (iOS 16+) | Parece o mesmo, mas passa pelo guard como o `router.back()`. No iOS 15 o pop continua nativo. |
| Modal puxado para baixo, ou toque fora dele   | Roda o guard com o sheet parado, e fecha o modal se ele permitir. O Mail faz isso.            |

No resto do tempo, um pop nativo é nativo: o router mantém a pilha em sincronia e roda o `afterEach`, mas nada consegue vetá-lo.
