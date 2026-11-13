# Visualizador de diagnósticos

[Abra o visualizador de relatórios](/diagnostics-viewer/index.html?lang=pt-BR). Importe o JSON de `router.diagnostics.export()` para comparar o histórico lógico e nativo, inspecionar spans de navegação e acompanhar redirects. Não é necessário conectar o visualizador ao aplicativo.

<Clip name="diagnostic-replay" :width="780" aspect="1440 / 1100" caption="Viewer offline real com capturas nativas do iOS 18.6: divergência e recuperação, seleção de guard/cancelamento, modal, reproduzir/pausar, lacunas após limpeza/truncamento e compatibilidade v1. Arquivos com ordem danificada são explicitamente sintéticos; não é nova execução nativa." />

## Coletar e abrir um relatório

Ative o collector opt-in já existente na aplicação:

```ts
const router = createRouter({
  routes,
  diagnostics: __DEV__ ? { maxEvents: 1000 } : false,
})

// Use o mecanismo de arquivo/compartilhamento do app para salvar como JSON.
const report = router.diagnostics?.export()
```

No visualizador, escolha **Abrir relatórios JSON**. Até oito arquivos independentes são retidos, cada um com no máximo 10 MiB. V1 aceita até 10.000 eventos; v2 também aplica os limites declarados de registros/bytes, até 10.000 registros e 8 MiB de dados compactos. JSON inválido, versões incompatíveis e campos malformados geram um erro por arquivo sem substituir relatórios abertos. Campos extras desconhecidos são descartados, não exibidos como payloads arbitrários.

**Explorar relatórios de exemplo** substitui os arquivos abertos por três relatórios didáticos explicitamente sintéticos: investigação de navegação, buffer truncado e janela independente. O guard de 350 ms e o mount de 80 ms ilustram a linha do tempo; não são benchmarks nem limites de desempenho.

## Replay de observações v2 {#replay-v2-observations}

Ative o [contrato experimental de gravação](./diagnostics#experimental-recording-contract) para reter estados intermediários. Arquivos v1 continuam sendo relatórios do snapshot final, sem controles de replay.

```ts
const router = createRouter({
  routes,
  diagnostics: { recording: { maxRecords: 500, maxBytes: 1024 * 1024 } },
})
const recordingJSON = JSON.stringify(router.diagnostics!.recording())
// Save with the app's own file-sharing mechanism, then open it in the viewer.
```

**Observações gravadas** oferece reproduzir/pausar, anterior/próxima e um controle de posição acessível por teclado. A reprodução avança uma observação retida por segundo; não reproduz o tempo original. Nunca navega no app, executa guards ou busca dados. Só começa quando solicitada e pausa ao importar, trocar captura/filtro/idioma, limpar ou ocultar a aba.

Cada posição exibe apenas seu próprio checkpoint gravado. Pilhas nativa e lógica, códigos de issue, instante e detalhes de visibilidade/seleção mudam juntos. Na **Linha do tempo**, selecionar uma linha pausa a reprodução e seleciona seu checkpoint explicitamente vinculado; uma linha com span completo seleciona o evento de término. Links de redirects mantêm o filtro por requisição, e requisições concorrentes permanecem separadas. A linha do tempo retida inteira continua visível: eventos posteriores não comprovam o futuro do estado selecionado. Filtros não redefinem a ordem do replay nem a análise da primeira divergência.

Um evento sem checkpoint vinculado retido mostra uma lacuna. O visualizador nunca escolhe um snapshot próximo, reaproveita estado anterior através de uma lacuna, interpola estados ou os reconstrói por nomes de operação. Prefixos descartados, épocas após limpeza, inspeções grandes demais/com falha, registros internos ausentes e metadados de retenção inconsistentes ficam explícitos. Identidades duplicadas, sequências ou relógios invertidos e épocas misturadas desabilitam o replay de pilhas do arquivo afetado. Estruturas inválidas e limites excedidos rejeitam o arquivo sem substituir capturas existentes. Um checkpoint posterior independente e válido ainda pode ser inspecionado após uma lacuna de registros ausentes.

**Primeira divergência observada** leva à primeira discordância comparável retida. Pilhas ocupadas e observações anteriores à reconciliação adiam a comparação. A observação comparável anterior, quando existe, delimita um intervalo de incerteza; não se afirma o início exato nem a causa. O resultado considera o arquivo inteiro, mesmo se filtros ocultam algumas pilhas. Não observar divergência não comprova o histórico ausente.

Expanda **Visibilidade, seleção e foco** para distinguir atividade da entrada, visibilidade local do host, aba/índice selecionado e pilha de destino do router. Foco de entrada do SO e observações indisponíveis permanecem desconhecidos. Arquivos importados separadamente nunca são unidos, mesmo quando os IDs locais ou da captura coincidem. Uma lacuna não significa pilha vazia.

O vídeo usa gravações reais do iOS 18.6 da etapa anterior; arquivos danificados de propósito têm **SYNTHETIC** no nome. Esta etapa valida a ferramenta offline no navegador, não uma nova execução nativa ou benchmark de desempenho. Veja o [relatório de validação](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/diagnostic-replay-stage2.md).

## Comparar o snapshot

A barra lateral seleciona a captura. Arquivos permanecem independentes mesmo quando seus IDs de router, pilha ou janela coincidem: os IDs são locais ao processo/collector, e arquivos exportados separadamente não formam uma gravação contínua.

**Comparação de pilhas** mostra as entradas lógicas ao lado das entradas nativas ordenadas, com papel do host, janela e estado carregado. `null` identifica uma página nativa sem dono. O visualizador destaca posições diferentes e lista separadamente os códigos de issue reportados pelo collector. Uma pilha ocupada adia a comparação, sem declarar uma transição em andamento como corrupção. Coleções grandes de pilhas e históricos usam paginação.

Uma entrada **ativa** está descoberta em sua pilha. Isso não comprova que sua aba/janela esteja com foco. O filtro de janela usa os IDs registrados nos hosts/eventos; IDs ausentes aparecem como desconhecidos. Uma pilha com hosts em várias janelas mantém os rótulos desses hosts, sem adivinhar um único dono. As issues do snapshot e os indicadores do resumo sempre descrevem a captura inteira, mesmo quando o filtro de janela reduz as pilhas ou a linha do tempo exibidas.

O relatório é pontual, não um estado persistido de navegação. O visualizador não edita a pilha nativa nem restaura o aplicativo.

## Ler a linha do tempo

**Linha do tempo** associa início/fim pelo ID do span na captura selecionada, correlaciona requisições por ID de navegação e vincula redirects à requisição pai. Filtre por fase, resultado, requisição ou janela; selecione uma linha para ver os identificadores e campos registrados. Requisições sobrepostas permanecem separadas. Linhas do tempo grandes exibem 100 linhas por página; filtros e paginação permitem explorar todo o buffer retido.

| Observação            | Interpretação                                                                                                          |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Guard demorado        | Filtre `guard`. A duração mede aquela invocação; `detail` identifica a categoria de guard.                             |
| Mount síncrono grande | Filtre `mount`. Ele inclui setup do Vue **e** criação de views nativas; não isola o custo de setup.                    |
| Navegação rejeitada   | Filtre `aborted` ou `cancelled`; inspecione o ID de navegação e seus guards.                                           |
| Redirect              | `redirected` encerra a requisição original; o link de pai na requisição filha seleciona o ID original.                 |
| Início ausente        | A duração do fim aparece como **reportada**, com um ponto no fim registrado. Não se inventa a posição inicial ausente. |
| Fim ausente           | Um ponto marca o início retido; não se infere duração ou conclusão a partir do horário do snapshot.                    |
| Limites conflitantes  | Limites duplicados ou inconsistentes são marcados como ambíguos e não recebem uma duração inventada.                   |

A escala permanece vinculada ao intervalo completo de eventos retidos quando os filtros mudam. As fases se sobrepõem: `transition` inclui montagem, e guards/filas podem se intercalar entre requisições. Não some as durações das linhas para obter o tempo total de navegação. Os indicadores de maior guard/mount consideram durações reportadas retidas e não reconstroem eventos descartados. Um span sem início ainda pode conter uma duração reportada; o aviso de truncamento continua visível.

Descartes do buffer, limites ausentes e capturas vazias são explícitos. `clear()` também pode remover eventos anteriores sem aumentar o contador de descartes. A origem de relógio civil é um contexto aproximado; os valores da linha do tempo usam o relógio monotônico do collector. Essas medidas não comprovam FPS, latência até os primeiros pixels ou uso do heap nativo. Use um profiler nativo para isso.

## Uso local e offline

O visualizador lê os arquivos na memória da aba. Não há endpoint de upload, transporte ao vivo, analytics, armazenamento no navegador ou conexão com o runtime. Recarregar ou escolher **Limpar relatórios** remove as capturas abertas. A página é independente do shell da documentação; o HTML compilado bloqueia conexões de rede por Content Security Policy e contém seu próprio script/CSS.

Escolha **Baixar visualizador offline** para salvar esse HTML. Abra o arquivo no navegador e importe relatórios sem conexão de rede. A barra superior permite alternar entre inglês, português, espanhol e chinês simplificado. Se um navegador gerenciado bloquear scripts em arquivos locais, sirva a pasta compilada em localhost.

Para compilar ou desenvolver a partir de um checkout:

```sh
npm ci
npm run diagnostics:build
# Abra docs/public/diagnostics-viewer/index.html no navegador.

npm run diagnostics:dev
npm run diagnostics:typecheck
```

`docs:build` também compila o visualizador. Seu código fica em `tools/diagnostics-viewer`, fora de `src`/`dist` publicados no runtime; nenhum listener ou dependência do visualizador é instalado no app NativeScript. Os testes de navegador e a instalação opcional do Playwright estão descritos em `scripts/diagnostics-viewer/README.md`.

As [regras de privacidade](./diagnostics#privacidade-e-demo-nativo) do collector permanecem iguais: padrões de rota e nomes definidos pela aplicação, sem params, query, props, resultados ou payloads de exceção. Mantenha dados pessoais fora desses nomes. A validação da importação não certifica que as strings de um relatório alterado manualmente estejam livres de dados sensíveis.
