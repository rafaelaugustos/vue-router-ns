# Diagnóstico de navegação

Veja [capacidades nativas e escolha de containers](./capabilities) para responsabilidades, limites por plataforma e diferenças entre rc.2 e rc.3.

[Abra o visualizador de relatórios](./diagnostics-viewer) para importar o JSON exportado, comparar pilhas e inspecionar a linha do tempo sem conectar ao app.

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

Cada host informa papel (`main`, `list`, `detail`), estado de carregamento, ID opcional de janela e IDs das entradas nativas. Páginas nativas desconhecidas têm ID `null`. Placeholders do split são omitidos. O ID de janela fica disponível quando o Frame pertence a uma NativeWindow; cores anteriores podem omiti-lo. IDs são identidades de diagnóstico do processo, não chaves de restauração, handles nativos ou API de navegação em múltiplas janelas. Coletores de routers separados permanecem independentes; veja [propriedade e reconstrução de janelas](./windows) para o modelo de roteamento implementado.

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

O pacote fornece um formato JSON independente e o inspector do demo nativo. O [visualizador de relatórios](./diagnostics-viewer) opcional lê essas exportações sem depender de uma extensão privada de devtools do NativeScript-Vue. Você também pode inspecionar o coletor por uma referência pertencente ao app no Chrome DevTools. Nenhum inspector global ou transporte de rede é instalado automaticamente.

`toJSON()` retorna `{ version: 1, routerId, clock: 'monotonic', startedAt, droppedEvents, events, snapshot }`. Eventos antigos são descartados ao atingir a capacidade; o final retido de um span pode ter perdido seu início. `clear()` limpa o buffer e o contador de descartes, preservando IDs e origem do relógio.

`stop()` libera as fontes vivas e assinaturas, congela o último snapshot e retém apenas o relatório limitado de dados simples. É permanente para aquele coletor e não para a navegação. O unmount do app o interrompe automaticamente; o Vue chama esse hook antes de descartar os componentes raiz, então o snapshot final ainda pode descrever a última pilha viva. Remova explicitamente listeners de página no unmount dela.

## Privacidade e demo nativo

Rotas são representadas pelo **padrão** correspondente, como `/messages/:id(\\d+)`. Params/paths resolvidos, query, hash, metadata, props, resultados, objetos nativos, mensagens e stacks de exceções nunca são exportados. Padrões de rota e nomes de pilha são identificadores definidos pelo app: mantenha dados de usuário fora dessas definições. O coletor não tem uma opção que copie dados arbitrários da rota/página.

No demo de debug, abra **Settings → Navigation diagnostics**. Compare um guard de 350 ms com setup síncrono de 80 ms, insira uma Page nativa sem gestão do router para observar divergência e recuperação e copie um relatório JSON sem os valores de rota. Checks nativos são registrados separadamente dos testes com shim; os tempos desses fixtures não são garantias de desempenho.

## Contrato experimental de gravação {#experimental-recording-contract}

Ative separadamente para preservar observações intermediárias das pilhas nativa e lógica:

```ts
const router = createRouter({
  routes,
  diagnostics: {
    maxEvents: 500,
    recording: { maxRecords: 500, maxBytes: 1024 * 1024 },
  },
})
const inspector = router.diagnostics!
inspector.checkpoint() // e.g. after an app-owned tab selection
const capture = inspector.recording() // readonly v2 object; no live sampling
const recordingJSON = JSON.stringify(capture)
const legacyJSON = inspector.export() // unchanged v1, for the current viewer
```

O [viewer](./diagnostics-viewer#replay-v2-observations) importa v1 e v2, valida gravações e oferece replay offline sincronizado e análise da divergência observada. Ler uma gravação nunca executa guards, busca dados, navega no app ou restaura objetos nativos.

`recording: true` usa os padrões acima. `maxRecords` aceita 1–10.000 e `maxBytes` aceita 1.024–8.388.608. Ambos limitam o buffer v2 separado; `maxEvents` continua limitando v1. `retainedBytes` conta a serialização UTF-8 compacta do array de registros, incluindo colchetes e vírgulas. O pequeno envelope do relatório, espaços de formatação, cópias exportadas e alocações temporárias de snapshots ficam fora desse orçamento. É um limite de retenção, não de heap.

O envelope v2 inclui `captureId`, `routerId`, `clock`, `startedAt`, `stopped`, `epoch`, `limits`, `retainedBytes`, `droppedRecords`, `clearedRecords`, `overhead` e `records`. Cada registro tem uma `sequence` crescente, sua `epoch` e um `time` monotônico. Eventos preservam os IDs de correlação v1. Checkpoints contêm um `snapshot` completo, `observations`, uma `boundary` e um `eventId` opcional que os originou. São independentes: descartar um checkpoint anterior não invalida um posterior.

O coletor observa inicialização, eventos, reconciliação nativa antes e depois da atualização lógica, checkpoints explícitos, limpeza e parada. O histórico nativo vem das páginas observadas no host, não dos nomes de operações. Só os instantes dos checkpoints são observados: não há gravação contínua nem interpolação entre eles. Mudanças externas de aba aparecem na próxima observação; chame `checkpoint()` após a seleção quando esse instante importar. Não são adicionados polling nem listeners nativos.

`active` continua sendo um indicador do ciclo de vida da entrada. `hostVisible` descreve páginas visíveis dentro do host, sem considerar obstrução por outro modal/janela. `selected` e `tab` registram pertencimento e índice nativo selecionado quando disponíveis. `routerFocused` identifica a pilha de destino do router; `inputFocused` é sempre desconhecido. Observações nulas devem continuar desconhecidas. IDs estáveis de entrada/pilha/host/janela/aba valem dentro da captura; não una capturas independentes por IDs locais iguais.

Descartar o início incrementa `droppedRecords`. Limpar avança `epoch`, conta os registros descartados em `clearedRecords`, emite uma lacuna de limpeza e observa um novo checkpoint. Sequências e identidades não reiniciam. Registros grandes demais viram lacunas de tamanho; falhas de inspeção viram lacunas de inspeção sem dados de exceção nem estado parcial. Um buffer pequeno pode reter apenas uma lacuna ou evento: isso não significa uma pilha vazia. Um intervalo pode perder uma de suas pontas. Parar congela a gravação; a navegação pode continuar.

Não diagnostique uma divergência estável a partir de um checkpoint ocupado ou anterior à reconciliação. Uma observação posterior comparável pode mostrar a primeira **observação retida** de discordância, nunca sua causa ou início exato; registros ausentes ampliam essa incerteza. A mesma política de omissão de dados do v1 se aplica. `overhead` mede trabalho síncrono do coletor v2, excluindo listeners, exportação e renderização. A gravação acrescenta custo de inspeção/serialização e pode afetar os tempos de navegação; não é medição de FPS.

<Clip name="diagnostic-recording" :width="480" aspect="3 / 4" caption="Captura real no iOS 18.6: sucesso, recusa do guard, cancelamento, ciclo do modal, divergência nativa intencional e recuperação, limites de retenção, limpeza e parada. Rótulos do fixture em inglês; sem replay sintético." />

Dez checks nativos passaram. O trabalho medido do coletor e os tamanhos dos arquivos são medidas do fixture, não garantias de desempenho do dispositivo. Veja o [relatório de validação](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-diagnostic-recording-stage1.md) e o [driver reproduzível](https://github.com/rafaelaugustos/vue-router-ns/blob/main/scripts/native/recording/README.md).
