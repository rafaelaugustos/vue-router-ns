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
import { computed, ref } from 'nativescript-vue'
import { Dialogs } from '@nativescript/core'
import { onBeforeRouteLeave } from 'vue-router-ns'

const draft = ref('')
const dirty = computed(() => draft.value.trim() !== '')

onBeforeRouteLeave(() => Dialogs.confirm('Descartar o rascunho?'), { when: dirty })
```

O `when` é opcional, e importa no iOS. Um swipe de voltar não consegue esperar um guard assíncrono, então enquanto um leave guard está ativo o router desliga o swipe de voltar daquela página. Com `when`, o guard só bloqueia enquanto ele é verdadeiro: com o rascunho vazio, a página sai no swipe como sempre.

## O que a plataforma faz enquanto um guard está ativo

| Gesto                                         | Comportamento                                                                                                                                                                     |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Botão de voltar do Android, ou soltar o swipe | Passa pelo guard.                                                                                                                                                                 |
| Swipe de voltar do iOS                        | Desligado para aquela página, já que não consegue esperar uma resposta assíncrona.                                                                                                |
| Back/histórico da ActionBar no iOS (16+)      | Usa temporariamente um item nativo controlado pelo router enquanto uma página removível tem guard ativo; toque e histórico passam pelos guards. No iOS 15, o pop continua nativo. |
| Modal puxado para baixo, ou toque fora dele   | Roda o guard com o sheet parado, e fecha o modal se ele permitir. O Mail faz isso.                                                                                                |

No resto do tempo, um pop nativo é nativo: o router mantém a pilha em sincronia e roda o `afterEach`, mas nada consegue vetá-lo.

Um salto pelo histórico nativo pode remover várias páginas, por isso a ActionBar protegida inclui guards abaixo da página atual. O menu usa endereços estáveis e o fluxo existente de guards, resultados e descarte. Uma confirmação pendente nunca autoriza selecionar uma nova ocorrência da mesma rota. O cabeçalho é estendido pelo `ActionBar.update()` público da Page e restaurado na devolução do controle ou no descarte; os delegates de navegação continuam intactos. Isso se aplica a Pages roteadas do NativeScript com ActionBar. O iOS 15 mantém o limite anterior de pop nativo.

Guards globais sozinhos não desabilitam gestos nativos nem ativam esse controle. Sem guard de saída ativo no histórico removível, o Back nativo continua sendo reconciliado após o pop do sistema. Use `onBeforeRouteLeave` com `when` para estado que precisa de proteção contra o histórico nativo. Um guard na raiz não substitui o controle porque selecionar a raiz a mantém na pilha.

Atualizações no cabeçalho ou nos guards fecham qualquer menu de contexto aberto no cabeçalho; callbacks de uma página coberta, alterada ou descartada são ignorados.

<Clip name="guarded-back-history" :width="480" aspect="3 / 4" caption="Back nativo protegido: guards no topo/em página coberta, confirmação Stay/Leave, seleção da ocorrência exata, cabeçalho e restauração. Simulador iOS 18.6; rótulos em inglês." />

## Continue aprendendo

Execute o [tutorial do editor modal](./first-app) para praticar recusa, salvar e descartar com código completo. Veja as restrições dos gestos em [páginas, pilhas e estado](./mental-model).
