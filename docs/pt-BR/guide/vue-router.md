# Diferenças do Vue Router

| Vue Router                                  | vue-router-ns                                                                                                         |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `createWebHistory()` e afins                | Sem opção de histórico: a pilha nativa é o histórico.                                                                 |
| `<RouterView>` troca componentes            | `<RouterView>` é um `Frame`. Cada navegação é uma página na pilha dele.                                               |
| `useRoute()` é a rota atual                 | Dentro de uma página, é a rota daquela página.                                                                        |
| `onBeforeRouteLeave` roda em qualquer saída | Roda quando a página sai da pilha. Um push por cima a mantém viva.                                                    |
| `onBeforeRouteUpdate`                       | Não existe: params diferentes significam uma página nova.                                                             |
| `router.forward()`, `go(n > 0)`             | Não há histórico para frente.                                                                                         |
| `<RouterView>` aninhado via `children`      | `children` aninham paths e mesclam `meta`. UI aninhada é outro `<RouterView>`.                                        |
| `beforeEnter` roda ao voltar                | Voltar revela uma página que já existe, então só leave guards e guards globais rodam.                                 |
| Redirecionamento de guard ao voltar         | Vira um push para o destino do redirecionamento.                                                                      |
| `next()` nos guards                         | Só valores de retorno.                                                                                                |
| Paths desconhecidos não renderizam nada     | `push` rejeita com `No route matches`. Adicione uma rota pega-tudo (`/:pathMatch(.*)*`) se quiser uma página de erro. |
| `scrollBehavior`                            | Não se aplica. O `hash` é mantido nas localizações por paridade.                                                      |

## O que só existe aqui

`backTo()`, `backToRoot()`, `setStack()`, `pushForResult()`, `back({ result })`, `onPageActivated()`, `onPageDeactivated()`, `useBackGesture()`, rotas modais, frames nomeados, `withParents`, `restore`, e um `router.stack` reativo.
