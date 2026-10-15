# Diagnóstico de navegação

Ative uma timeline limitada e uma comparação somente de leitura entre o histórico lógico do router e seus Frames nativos:

```ts
const router = createRouter({
  routes,
  diagnostics: __DEV__ ? { maxEvents: 500 } : false,
})

const inspector = router.diagnostics
inspector?.snapshot()
inspector?.events
inspector?.export() // string JSON com versão
```

`diagnostics` é `false` por padrão. `true` usa capacidade de 500 eventos; `maxEvents` deve ser um inteiro de 1 a 10.000. Um coletor desligado é `undefined`: não lê relógio, inspeciona janelas nativas, registra listeners nativos de diagnóstico ou mantém um buffer de eventos. A coleta usa os eventos de ciclo de vida que o router já acompanha.

## Lendo a timeline

Eventos possuem `id` crescente, `routerId` opaco, `time` decorrido em milissegundos, `phase` e `status`. Spans têm o mesmo `spanId` no `start`/`end`; o final traz `duration` e `outcome`. Spans de uma navegação compartilham `navigationId`. Um redirecionamento termina com `redirected`, e o novo pedido tem `parentNavigationId`. Correlacione pedidos intercalados pelos IDs, sem presumir que sejam aninhados.

| Fase           | O que observa                                                                                       |
| -------------- | --------------------------------------------------------------------------------------------------- |
| `navigation`   | Um pedido resolvido do router até sua conclusão, rejeição ou falha. Back na raiz é `noop`.          |
| `queue`        | Espera por operações nativas já confirmadas.                                                        |
| `guard`        | Cada chamada de guard; `detail` identifica `leave`, `beforeEach`, `beforeEnter` ou `beforeResolve`. |
| `load`         | Resolução do componente, incluindo `cached` para um record já carregado.                            |
| `mount`        | Trabalho síncrono de `$navigateTo`/`$showModal`, incluindo setup Vue e criação de views nativas.    |
| `transition`   | O commit até o sinal de conclusão do Frame/modal, incluindo sua montagem.                           |
| `native`       | Conclusão de Frame, `pop` iniciado externamente ou outra sincronização nativa.                      |
| `page`, `host` | Link/unlink de páginas e conexão/descarte de hosts.                                                 |
| `hmr`          | Reload pedido, adiado enquanto coberto, aplicado ou religado a uma Page substituta.                 |
| `result`       | Resolução do resultado de uma entrada, sem seu valor.                                               |
| `issue`        | Uma violação de invariantes observada.                                                              |

São medidas do pedido ao router até sua conclusão. Excluem trabalho anterior à entrada do pedido resolvido, como recebimento de input do sistema ou espera pela navegação inicial. `transition` se sobrepõe a `mount`; não some suas durações. A conclusão nativa não determina quando os primeiros pixels apareceram, mede FPS ou substitui um profiler nativo. O trabalho dos subscribers pode afetar os tempos medidos.

O tempo usa relógio monotônico (`performance.now`, com fallbacks de uptime Android/iOS), independente de ajustes no relógio de parede. Exports incluem `startedAt` de parede para correlação aproximada com logs da plataforma. Use [as ferramentas de debugging e profiling nativo do NativeScript](https://docs.nativescript.org/guide/debugging) para investigar renderização, CPU e retenção de objetos nativos.

## Comparando histórico nativo e lógico

`snapshot()` retorna dados congelados e independentes dos objetos vivos. Cada pilha tem ID estável, `name` definido pelo app, estado de modal/ocupação, entradas lógicas e hosts nativos. Entradas incluem padrão de rota, estado de ciclo de vida `active` e `awaitingResult`. `active` significa visível dentro daquela pilha; não prova que a aba/janela esteja em foco.

Cada host informa papel (`main`, `list`, `detail`), estado de carregamento, ID opcional de janela e IDs das entradas nativas. Páginas nativas desconhecidas têm ID `null`. Placeholders do split são omitidos. O ID de janela fica disponível quando o Frame pertence a uma NativeWindow; cores anteriores podem omiti-lo. IDs são identidades de diagnóstico do processo, não chaves de restauração, handles nativos ou API de navegação em múltiplas janelas. Coletores de routers separados permanecem independentes; propriedade/roteamento de janelas está na #46.

As `issues` do snapshot detectam divergência na ordem das pilhas, páginas nativas desconhecidas, entradas descartadas ainda presentes nativamente e hosts ausentes/fechados. Comparações esperam enquanto o pedido atual ou uma operação nativa da pilha está em andamento. A timeline registra novas issues vistas na sincronização; um snapshot explícito também pode detectar mudanças antes de um evento nativo. O coletor observa essas condições e não repara o histórico. `duplicate-result` detecta sinais repetidos de resolução de resultado. Falhas de inspeção informam um código sem copiar o erro original.

## Assinando e exportando

```ts
const stopListening = inspector?.subscribe((event) => {
  // Alimente um viewer/logger do app. Mantenha este callback rápido.
  consume(event)
})

const json = inspector?.export()
const data = inspector?.toJSON()
stopListening?.()
```

O pacote fornece um formato JSON independente e o inspector do demo nativo, sem depender de uma extensão privada de devtools do NativeScript-Vue. Você pode inspecionar o coletor por uma referência pertencente ao app no Chrome DevTools ou criar um viewer a partir dos dados públicos. Nenhum inspector global ou transporte de rede é instalado automaticamente.

`toJSON()` retorna `{ version: 1, routerId, clock: 'monotonic', startedAt, droppedEvents, events, snapshot }`. Eventos antigos são descartados ao atingir a capacidade; o final retido de um span pode ter perdido seu início. `clear()` limpa o buffer e o contador de descartes, preservando IDs e origem do relógio.

`stop()` libera as fontes vivas e assinaturas, congela o último snapshot e retém apenas o relatório limitado de dados simples. É permanente para aquele coletor e não para a navegação. O unmount do app o interrompe automaticamente; o Vue chama esse hook antes de descartar os componentes raiz, então o snapshot final ainda pode descrever a última pilha viva. Remova explicitamente listeners de página no unmount dela.

## Privacidade e demo nativo

Rotas são representadas pelo **padrão** correspondente, como `/messages/:id(\\d+)`. Params/paths resolvidos, query, hash, metadata, props, resultados, objetos nativos, mensagens e stacks de exceções nunca são exportados. Padrões de rota e nomes de pilha são identificadores definidos pelo app: mantenha dados de usuário fora dessas definições. O coletor não tem uma opção que copie dados arbitrários da rota/página.

No demo de debug, abra **Settings → Navigation diagnostics**. Compare um guard de 350 ms com setup síncrono de 80 ms, insira uma Page nativa sem gestão do router para observar divergência e recuperação e copie um relatório JSON sem os valores de rota. Checks nativos são registrados separadamente dos testes com shim; os tempos desses fixtures não são garantias de desempenho.
