# Hosts nativos

::: warning Experimental
O contrato de host é novo e pode mudar entre versões beta. Mudanças incrementam `NATIVE_HOST_VERSION` e aparecem no changelog. Veja a [política de versionamento](#politica-de-versionamento).
:::

Um **host** é o contêiner nativo em que o router conduz uma pilha. O `<RouterView>` entrega ao router um `Frame` do NativeScript; o `<RouterSplitView>` entrega dois; uma rota modal recebe um frame dentro de um modal nativo. Todos passam pelo mesmo contrato, então o router mantém uma única implementação de matching, guards, resultados, histórico e reconciliação, enquanto o host cuida da apresentação, dos gestos e dos handles nativos.

O contrato existe para que drawers nativos, sheets e controllers de plataforma possam ser adicionados sem bifurcar o router nem reimplementar guards dentro de cada adaptador. Os hosts embutidos são os primeiros a usá-lo: `createFrameHost(frame)`, `createFrameHost(frame, { modal: true })` e `createSplitFrameHost(list, detail, options)`.

## O que um host faz

```ts
import type { NativeHost } from 'vue-router-ns'
```

| Membro                       | Papel                                                                                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `version`                    | A versão do contrato que ele implementa. Precisa ser igual a `NATIVE_HOST_VERSION`.                                                                          |
| `kind`                       | Um nome curto para diagnóstico e erros, como `'frame'`.                                                                                                      |
| `capabilities`               | O que ele faz nativamente. Veja [capacidades](#capacidades).                                                                                                 |
| `native`                     | O contêiner, `null` depois de descartado.                                                                                                                    |
| `loaded`                     | `false` enquanto o contêiner ainda não consegue mostrar páginas, como uma aba que o iOS nunca exibiu. Os pushes dele esperam; as outras pilhas não.          |
| `attach(delegate)`           | Chamado uma vez antes do primeiro push. O host guarda o delegate e reporta por ele.                                                                          |
| `pages()`                    | Páginas na ordem nativa, de baixo para cima, montadas pelo router ou não. O router reconcilia a partir disso depois de cada mudança.                         |
| `visible()`                  | Opcional. As páginas na tela agora, quando pode haver mais de uma. O `onPageActivated` segue isso.                                                           |
| `push(component, options)`   | Monta o componente como uma página nova no topo. Reporte a conclusão com `delegate.changed()`. Lance ou rejeite para falhar a navegação.                     |
| `back(target, options)`      | Volta para `target`, uma página de `pages()`, descartando o que está acima. `null` fecha o host. Reporte com `changed()` ou `closed()`.                      |
| `holdDismissal(hold)`        | Opcional. Segura a dispensa feita pelo usuário enquanto um leave guard está ativo. Reporte as tentativas com `delegate.dismissAttempted()`.                  |
| `previewBack(top, below, …)` | Opcional. Predictive back do Android 14+: mostra `below` enquanto o swipe se move e chama `commit` quando ele termina. Veja [`BackPreview`](./android-back). |
| `ownsSystemBack()`           | Opcional. Se o botão de voltar do sistema da janela atual cai neste host.                                                                                    |
| `willAnimate(options)`       | Opcional. `false` quando a próxima página aparece num painel que ainda não está na tela, para pular zoom e elementos compartilhados.                         |
| `parts()`                    | Opcional. Os contêineres nativos para o [diagnóstico](./diagnostics), cada um com papel, handle nativo, `loaded` e suas páginas.                             |
| `dispose()`                  | Para de ouvir e libera os handles. Chamado quando a pilha fecha. Pode ser chamado duas vezes.                                                                |

O delegate que o router passa em `attach()` tem cinco métodos: `changed()` depois de cada mudança nativa, `closed()` quando o host sumiu sozinho, `dismissAttempted()` para uma dispensa segurada, `backPressed()` para um voltar do sistema que o host reivindica, e `backGesture()` para começar um voltar interativo. Um host que reporta uma mudança que não fez, como um swipe no iOS, recebe o mesmo tratamento de um `<RouterView>`: o router espelha, descarta as páginas que saíram e roda o `afterEach`.

## Capacidades

O router pergunta em vez de adivinhar. Uma navegação que precisa de uma capacidade que o host não tem é rejeitada com um erro explícito, então um `clearHistory` sem suporte nunca parece ter funcionado.

| Capacidade             | Significado                                                                                                                   | Sem ela                                             |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `replace`              | O `replace` descarta a página do topo nativamente, no mesmo passo do push.                                                    | `router.replace()` rejeita.                         |
| `clearHistory`         | O `clearHistory` descarta todas as páginas abaixo nativamente, no mesmo passo do push.                                        | `push(to, { clearHistory: true })` rejeita.         |
| `pinnedRoot`           | A primeira página fica, como a lista de um split view. `clearHistory` a mantém, voltar nunca a remove e `setStack` a prefixa. | A primeira página é uma entrada comum.              |
| `close`                | O host inteiro pode ser fechado, como um modal. `back(null)` o fecha.                                                         | Voltar na raiz não faz nada.                        |
| `cancellableDismissal` | O host consegue segurar uma dispensa iniciada pelo usuário até os leave guards rodarem.                                       | Os guards só veem navegações iniciadas pelo router. |
| `multipleVisible`      | Mais de uma página pode estar na tela. `visible()` diz quais.                                                                 | Só a página do topo fica ativa.                     |

Transições, `animated` e fontes de zoom são apresentação: um host pode ignorá-las. As opções que um host recebe são `NativeHostPushOptions` (`initial`, `animated`, `transition`, `replace`, `clearHistory`) e `NativeHostBackOptions` (`animated`).

## Montando um host

O `<RouterView>` faz isso para um Frame. Para o seu próprio contêiner, monte o host com um nome e navegue nele com `{ frame: name }`, exatamente como uma view nomeada:

```ts
import { mountNativeHost } from 'vue-router-ns'

const unmount = mountNativeHost(router, 'sidebar', host, '/menu')
await router.push('/menu/settings', { frame: 'sidebar' })
unmount()
```

Os nomes são compartilhados com os `<RouterView>`s e precisam ser únicos. Desmontar fecha a pilha: resultados pendentes resolvem com `undefined`, leave guards não rodam e o host é descartado.

## Alcançando o contêiner nativo

Dentro de uma página roteada, `useNativeHost()` dá o host em que a pilha da página vive. Tipifique o contêiner você mesmo:

```ts
import { useNativeHost } from 'vue-router-ns'
import type { Frame } from '@nativescript/core'

const host = useNativeHost<Frame>()
host.kind // 'frame', 'modal-frame', 'split-frame' ou o seu
host.capabilities.close
host.native?.ios // o UINavigationController, no iOS
```

`native` é `null` depois que a página saiu da pilha ou o host se foi. Leia quando precisar em vez de guardar: o handle pertence ao host, e o frame de um modal não sobrevive ao modal.

## Escrevendo um host

O menor host completo é o exemplo em memória contra o qual a suíte de contrato roda: [`test/hosts/memory.ts`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/hosts/memory.ts). Ele não tem contêiner nativo nenhum; monta páginas com `createNativeView`, guarda numa lista e reporta num tick posterior, como uma transição faria. Um host baseado em Frame pode reaproveitar `createFrameHost()` e envolvê-lo, que é como os hosts embutidos de modal e split são montados.

Do que o router depende:

- `pages()` é a verdade. Inclua páginas que o router não montou; o diagnóstico as reporta como `unknown-native-page` em vez de o router adivinhar.
- Chame `delegate.changed()` uma vez por mudança nativa, depois que ela terminou e `pages()` a reflete. Chame também para os pushes e backs do próprio router: é assim que ele sabe que terminaram.
- Não finja o que não consegue fazer. Declare em `capabilities`.
- Descarte por completo. Depois de `dispose()`, `native` é `null`, os listeners se foram e eventos de plataforma posteriores são ignorados.
- Empacote dependências nativas com o adaptador. Um host que precisa do Android Material ou de um wrapper Swift vira um plugin próprio; o router fica livre disso.

Rode a suíte de contrato contra o host antes de declarar suporte. Ela fica em [`test/host-contract.ts`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/host-contract.ts) e confere ordem, pops externos, navegações canceladas e concorrentes, descarte, operações sem suporte e resultados resolvidos exatamente uma vez. Ela roda contra o host de Frame, o de split e o de memória. Ela não substitui verificações em aparelho: gestos do sistema, morte do processo e acessibilidade precisam da plataforma real, registradas nos [relatórios de validação](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-validation.md).

## Política de versionamento

- `NATIVE_HOST_VERSION` é `1`. Um host declara a versão que implementa, e o router recusa uma diferente com um erro explícito em vez de rodá-la sobre suposições que não compartilha.
- Enquanto experimental, o contrato pode mudar numa versão beta. Qualquer mudança incompatível incrementa a versão, aparece no changelog e atualiza juntos os hosts embutidos, o exemplo em memória e a suíte de contrato.
- Adicionar um membro ou capacidade opcional não incrementa a versão. Hosts que não implementam um membro opcional mantêm o comportamento atual.
- Quando o contrato deixar de ser experimental, a versão seguirá o semver deste pacote: mudanças incompatíveis de host só em uma versão major.
