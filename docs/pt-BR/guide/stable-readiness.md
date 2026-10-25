# Prontidão para a versão estável e a 1.0

A `0.1.0-rc.3` está publicada. A próxima decisão é se o escopo documentado e não experimental está pronto para a **0.1.0**, sem exigir todas as propostas do roadmap. A revisão para a 1.0 abaixo é uma decisão separada sobre compatibilidade, não uma mudança automática de versão. Ter poucas issues abertas não é um critério de aceitação.

## O que já foi entregue

As propostas e fundações do roadmap original (#43 e #46–#63), convenções opcionais (#88–#92), dados de rota/Suspense (#118–#119), estilo/visibilidade de abas (#122–#123) e experiência de navegação da rc.3 (#117 e #133–#138) concluíram suas issues com escopo definido. Encerrar uma investigação comprova a pesquisa realizada, não uma API universal pronta para produção.

O [mapa de capacidades](./capabilities) explica os responsáveis nativos. O [guia de compatibilidade](./compatibility#escopo-da-api) define a API congelada e as funcionalidades que continuam experimentais. Encerrar o protótipo de transições preditivas Android não publicou sua implementação upstream no Core.

## Critérios para publicar

| Critério                      | Evidência necessária para decidir                                                                                                                                                 | Registro atual                                                                                                                         |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Escopo da API                 | Congelar a API documentada não experimental; qualquer correção incompatível exige nova candidata e instruções de migração                                                         | [Compatibilidade](./compatibility)                                                                                                     |
| Artefato reproduzível         | Versão exata do npm e lockfile, sem alias local do router ou patch não publicado do Core; compilar e executar um consumidor iOS e Android                                         | [Aceitação do consumidor #152](https://github.com/rafaelaugustos/vue-router-ns/issues/152)                                             |
| Comportamento nativo          | Push/replace/back, gestos cancelados, guards, resultados de modais, stacks retidos e descarte aprovados na matriz nativa completa, no commit do release                           | [Relatório de contratos nativos](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-contracts.md) e artefatos da CI |
| Acessibilidade e preferências | Registrar teclado, texto grande, Reduzir Movimento do sistema e leitores de tela em aparelhos físicos; distinguir resultados falados/manuais das asserções automatizadas          | [Relatório de acessibilidade](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-accessibility.md), #152            |
| Defeitos conhecidos           | Resolver falhas que bloqueiem o escopo prometido; limites de plataforma/upstream precisam de reprodução, versões afetadas, composição suportada e decisão explícita do mantenedor | [Direção herdada #139](https://github.com/rafaelaugustos/vue-router-ns/issues/139)                                                     |
| Documentação                  | Exemplos EN/pt-BR/es/zh-CN coerentes com APIs exportadas; instalação, responsabilidades, limites experimentais e migração acessíveis pela trilha de aprendizado                   | [Primeiro app](./first-app), [compatibilidade](./compatibility), [capacidades](./capabilities)                                         |
| Publicação                    | CI e suítes nativas completas aprovadas no mesmo commit; tarball final validado em instalações novas; publicação autorizada pelo mantenedor                                       | [Validação do release](./compatibility)                                                                                                |

Uma candidata verde comprova aquela revisão, não dispensa os testes de um commit posterior. Cobertura física ausente continua **não verificada** até ser testada ou aceita explicitamente como limitação documentada pelo mantenedor. Um teste físico em iOS beta complementa a matriz de simuladores suportada. Tempo de uso ou número de downloads, isoladamente, não provam prontidão.

## Próximos trabalhos e decisões das investigações

- **#139:** a causa no Core está isolada e a [NativeScript #11587](https://github.com/NativeScript/NativeScript/pull/11587) propõe a correção. A [PR #160](https://github.com/rafaelaugustos/vue-router-ns/pull/160) registra a validação nativa. O Core 9.1.3 publicado continua afetado. É preciso adotar uma correção publicada e repetir a matriz de consumidor/contratos nativos, ou excluir explicitamente a composição afetada antes de decidir o release.
- **#152:** o [relatório do consumidor publicado](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-rc3-consumer.md) registra a saída do serviço VoiceOver no iPhone e o procedimento/resultados de TalkBack no emulador, separados das asserções de interface. Sem Android físico disponível, o mantenedor aceitou validar no emulador e registrar esse limite. Consulte os limites de fala e gestos antes de interpretar o resultado como certificação geral de acessibilidade.
- **#145:** a [proposta v1 de observação](https://github.com/rafaelaugustos/vue-router-ns/blob/main/research/transition-observation/README.md) registra a evidência nativa de ciclo de vida e a decisão de manter o adaptador privado. Falta de identidade autoritativa das entradas e troca concorrente de destino sem suporte impedem um controlador público. Progresso contínuo do UIKit e adaptador Jolt continuam fora dos requisitos da versão estável.
- **#64:** manter o roadmap como índice do escopo entregue e dos próximos trabalhos, sem promover integrações experimentais a estáveis de forma implícita.

Correções que mudem comportamento ou a API congelada podem exigir outra candidata. Com evidência para os critérios acima e aceitação dos limites documentados, a 0.1.0 pode ser publicada pelo workflow de release. Uma futura 1.0.0 precisa de sua própria decisão sobre compatibilidade da API e experiência em aplicativos; não decorre de zerar a lista de issues.

## Revisão para a 1.0 — 25/10/2026

**Ainda não está pronta para publicar a 1.0.** Há implementação e evidência nativa substanciais, mas merge de documentação ou pacote preview upstream não equivalem a uma candidata com as dependências finais.

| Área                        | Resultado                                                                                                                                                          | Próxima ação                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Entradas públicas           | Revisadas a entrada principal, cinco entradas de file routing, system search e metadados do pacote. Sete referências nominais ausentes foram adicionadas à API.    | Aprovar o compromisso de compatibilidade 1.x abaixo.                                          |
| Comportamento documentado   | Guards, resultados, entradas retidas, stacks nomeados, descarte e responsabilidades nativas estão documentados. Integrações experimentais continuam identificadas. | Revalidar comportamentos alterados pela atualização final de dependências.                    |
| Defeito conhecido           | #139 reproduz no Core publicado; a correção proposta passou no exemplo isolado.                                                                                    | Adotar e validar um Core corrigido publicado, ou excluir explicitamente a composição afetada. |
| Consumidor e acessibilidade | #152 registra consumidor exato da rc.3, VoiceOver físico e TalkBack no emulador. Limites de hardware/gestos estão explícitos.                                      | Preservar esses limites nas notas e repetir a aceitação pertinente no artefato final.         |
| Documentação e idiomas      | Inglês, português, espanhol e chinês simplificado compartilham rotas de guias e exemplos de código.                                                                | Verificar cobertura, links e âncoras; tradução não amplia suporte de plataforma.              |
| Publicação                  | O workflow valida o tarball e a matriz nativa completa.                                                                                                            | Executá-lo no commit escolhido para o release e obter aprovação do mantenedor.                |

### Compromisso proposto para a compatibilidade 1.x

- Imports públicos são as entradas declaradas em `package.json#exports`, seus valores/tipos documentados e contratos dos componentes Vue. Arquivos presentes em `src/` ou `dist/` não criam deep imports suportados.
- Compatibilidade estável abrange defaults, falhas/resultados, ordem de guards, propriedade/ciclo de vida das entradas e comportamento nas plataformas suportadas, não apenas nomes de funções.
- Experimental significa suporte e evidência limitados. Antes da 1.0, é preciso decidir se a API será preservada na série 1.x ou ficará atrás de um novo contrato opt-in explicitamente versionado. Um export existente na entrada principal não deve quebrar silenciosamente em uma minor porque seu guia diz experimental.
- Mudanças incompatíveis no contrato estável exigem major e instruções de migração. Adições e correções compatíveis podem sair em minor/patch. Esta revisão não remove nem promove APIs.
- Nenhum modo adicional de drawer, controlador DevTools ao vivo, adaptador Jolt ou protótipo preditivo é obrigatório apenas para completar o roadmap. Novos casos de uso podem justificar trabalhos separados.

O [relatório da revisão](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/release-readiness.md) registra revisão de código, verificações e limites. Esta análise não autoriza publicação nem comprova um novo teste físico para cada API exportada.
