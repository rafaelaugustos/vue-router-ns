# Transições interativas: controle e limites

Um gesto interativo envolve mais que uma animação com progresso. O host nativo decide quais páginas participam, se o gesto pode começar, quando ele confirma e quando as páginas podem ser descartadas. O router precisa manter histórico, guards e promises de resultado coerentes com essa decisão.

Esta investigação da rc.3 **não** adiciona uma API unificada de transições interativas. A base publicada analisada é NativeScript Core 9.1.3, NativeScript-Vue 3.1.2, runtime iOS 9.1.0 e Android 9.1.1. Protótipos upstream são tratados separadamente.

<Clip name="interactive-transitions" aspect="402 / 874" caption="Simulador iOS 26 real: reversão e confirmação de gestos, zoom, guards e remoção da origem." />

## Matriz de capacidades

| Superfície                                | Responsável e progresso                                                                   | Confirmação/cancelamento                                                     | Integração e limites                                                                                                                                                                           |
| ----------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `push` / `back` programáticos             | Core Frame ou o host selecionado controla a transição; `transition` escolhe a animação    | Sem controle público para buscar ou reverter uma posição                     | Guards executam antes da navegação. Aguarde sua conclusão; duração de diagnóstico não é progresso de gesto.                                                                                    |
| Voltar pela borda no Frame iOS            | O navigation controller do UIKit controla a transição                                     | O UIKit decide pelo gesto real                                               | O router acompanha o histórico confirmado. Guards de saída ativos impedem o início. `useBackGesture()` retorna `null` no iOS.                                                                  |
| `zoomFrom` no iOS 18+                     | `preferredTransition` do UIKit, quando exposta pelo runtime                               | UIKit controla zoom e dispensa interativa                                    | O router fornece uma referência fraca à origem e uma condição síncrona de admissão. Origem ausente/descarregada retorna `nil`. Uma transição padrão explícita no Frame pode substituir o zoom. |
| Dispensa interativa de `SharedTransition` | A implementação iOS do Core controla reconhecedor e animação                              | Pop nativo, sem sessão reversível controlada pelo router                     | Guard de saída não pode impedir essa dispensa. Não use para proteger edição pendente. Shared elements no Android não implicam dispensa interativa equivalente.                                 |
| Voltar preditivo no Android 14+           | Callback AndroidX fornece progresso; preview padrão do router apresenta a página anterior | Cancelar restaura a apresentação; soltar executa Back e guards               | `useBackGesture()` observa, mas não controla histórico ou transação Fragment. Raiz, raiz de modal e página protegida têm comportamentos diferentes.                                            |
| Preview experimental no Core Android      | Proposta de sessão Frame `beginBackPreview`, versão 1                                     | `update/cancel/finish/dispose` só alteram apresentação; `finish` não faz pop | Exige o candidato fixado abaixo. Core publicado usa fallback. Não é pop preditivo de FragmentManager.                                                                                          |
| UIKit split / hosts personalizados        | Cada host controla seus controllers e ciclo de vida                                       | Depende do host                                                              | Evidência de Frame não comprova paridade em colunas split, múltiplas janelas ou hosts externos.                                                                                                |

As APIs suportadas estão em [zoom/shared elements](./transitions), [Voltar no Android](./android-back), [guards](./guards) e [hosts nativos](./native-hosts).

## Observar não dá controle

Os callbacks Android podem animar decoração pertencente à página. Não autorizam chamar `popBackStack`, descartar páginas ou resolver resultados de modal. Com `backPreview: false`, o app pode animar seu conteúdo usando `useBackGesture()`; a navegação continua com o router.

O transition coordinator do UIKit expõe contexto de interação/conclusão. O fixture observa esse contexto sem substituir delegate ou reconhecedor. `percentComplete` **não** é um contrato documentado de progresso contínuo e uniforme: a descrição da Apple o vincula à passagem para a fase não interativa. Um observador futuro precisa expressar indisponibilidade, sem inventar valores `0…1` em todos os hosts.

O Frame Android mantém seu próprio histórico e substitui Fragments; não cria histórico no FragmentManager. Adicionar `addToBackStack` apenas para obter animação interativa mudaria replace, clear-history, modais e recriação. Isso é trabalho de arquitetura no Core, não um adaptador de animação.

## Ordem dos guards e ciclo de vida

1. O estado ativo do guard de saída precisa ser conhecido **antes** da dispensa nativa iOS. Uma pergunta assíncrona não consegue segurar retroativamente um gesto já controlado pelo UIKit. Use o botão Voltar protegido ou `router.back()` para perguntar.
2. No Android, um guard de saída ativo suprime o preview. Guards globais/assíncronos ainda podem recusar após soltar; a apresentação deve ser restaurada.
3. Cancelar mantém entrada, Page e resultado pendente. Confirmar remove a entrada e resolve seu resultado uma vez. Cancelamento não deve virar pop seguido de novo push.
4. Nova navegação, descarregamento do host, mudança de destino/topo e remoção da origem invalidam premissas do início. Callbacks precisam verificar a identidade da entrada/sessão antes de alterar estado.
5. Dispensar um modal e voltar dentro do seu Frame são operações distintas. Um pop interno não resolve o modal nem altera a pilha que o apresentou.

A limitação de dispensa interativa de SharedTransition continua explícita. Guards globais não garantem veto a qualquer transição nativa UIKit.

## Decisão e possível limite de um adaptador

Manter as APIs atuais na rc.3. Não criar `router.transition.progress`, `seek()` ou `cancel()` universal a partir desta evidência.

Uma proposta futura de **capacidade do host** deve separar:

- **Observação:** progresso opcional, fim da interação e conclusão nativa, identificados por host/janela, entrada e sessão. Progresso desconhecido permanece indisponível. Conclusão diferencia confirmação, cancelamento e interrupção.
- **Controle da apresentação:** sessão opcional e versionada, pertencente ao host. Pode atualizar/cancelar/finalizar apresentação, sem alterar histórico. Admissão síncrona; guards, histórico e resultados pertencem ao router.
- **Limpeza:** um único resultado terminal; remover listeners e views temporárias ao descarregar, substituir, cancelar ou falhar a admissão. Callback antigo não pode remover uma entrada nova. Assinar apenas quando necessário; sem loop JS permanente no router publicado.
- **Fallback:** navegação nativa normal quando host/runtime não fornece o contrato, sem prometer paridade visual. Movimento reduzido suprime transformações opcionais preservando navegação e resultados.

Um adaptador Jolt opcional poderia animar decoração do app ou implementar uma sessão de apresentação explicitamente suportada. Não deve assumir o delegate do UIKit, tratar preview Android como busca em uma transação Fragment, nem se tornar dependência de runtime. A implementação fica para depois da comprovação do contrato e da limpeza.

## Evidência e estado upstream

O fixture iOS opcional e o runner Android ficam em [`scripts/native/transitions`](https://github.com/rafaelaugustos/vue-router-ns/tree/main/scripts/native/transitions). O [relatório de validação](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-interactive-transitions.md) identifica versões, cenários e lacunas. São verificações em simulador/emulador, não medições de desempenho em aparelho físico.

A proposta [NativeScript #11558](https://github.com/NativeScript/NativeScript/pull/11558) continuava aberta e sem merge na consulta de 2026-10-24. O candidato fixado é `fadb58f034e403933028f86746280375ea9811ff`; esta entrega não troca dependências publicadas. A [evidência anterior](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-predictive-back.md) cobre matriz API 34/35/36 e correção de recriação do Frame, sem representar comportamento já publicado no Core.

Movimento reduzido é consultado na admissão da navegação/gesto (`motion: 'system'`, `'reduced'` ou `'full'`). Controles nativos continuam disponíveis como alternativa acessível aos gestos. Input automatizado e rótulos não comprovam fala VoiceOver/TalkBack, restauração de foco com tecnologia assistiva ou conforto de movimento em aparelhos físicos.

## Referências primárias

- [Apple: admissão da interação de zoom](https://developer.apple.com/documentation/uikit/uiviewcontroller/transition/zoomoptions/interactioncontext)
- [Apple: semântica da porcentagem do coordinator](https://developer.apple.com/documentation/uikit/uiviewcontrollertransitioncoordinatorcontext/percentcomplete)
- [Android: progresso e animações personalizadas](https://developer.android.com/guide/navigation/custom-back/support-animations-views)
- [Android: requisitos de transições Fragment](https://developer.android.com/guide/fragments/animate)

[O follow-up de capacidades #145](https://github.com/rafaelaugustos/vue-router-ns/issues/145) fica fora das condições para publicar a rc.3.
