# Caminho para a 0.1.0 estável

A `0.1.0-rc.3` está publicada. A próxima decisão é se o escopo documentado e não experimental está pronto para a **0.1.0**, sem exigir todas as propostas do roadmap nem mudar a meta para 1.0.0. Ter poucas issues abertas não é um critério de aceitação.

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
| Documentação                  | Exemplos EN/pt-BR coerentes com APIs exportadas; instalação, responsabilidades, limites experimentais e migração acessíveis pela trilha de aprendizado                            | [Primeiro app](./first-app), [compatibilidade](./compatibility), [capacidades](./capabilities)                                         |
| Publicação                    | CI e suítes nativas completas aprovadas no mesmo commit; tarball final validado em instalações novas; publicação autorizada pelo mantenedor                                       | [Validação do release](./compatibility)                                                                                                |

Uma candidata verde comprova aquela revisão, não dispensa os testes de um commit posterior. Cobertura física ausente continua **não verificada** até ser testada ou aceita explicitamente como limitação documentada pelo mantenedor. Um teste físico em iOS beta complementa a matriz de simuladores suportada. Tempo de uso ou número de downloads, isoladamente, não provam prontidão.

## Trabalho restante e backlog

- **#139:** isolar o crash de direção CSS herdada. A correção específica do Drawer não comprova uma solução genérica no Core. A issue permanece aberta até haver evidência nativa da responsabilidade e da decisão tomada.
- **#152:** concluir o relatório do consumidor publicado e tornar visíveis os testes físicos de acessibilidade pendentes. Labels e flags de foco não comprovam a navegação falada de VoiceOver/TalkBack.
- **#145:** especificar e prototipar observação opcional de transições em hosts nativos. É pesquisa/backlog; controlador universal de seek/cancel, progresso contínuo do UIKit e adaptador Jolt não são requisitos da versão estável.
- **#64:** manter o roadmap como índice do escopo entregue e dos próximos trabalhos, sem promover integrações experimentais a estáveis de forma implícita.

Correções que mudem comportamento ou a API congelada podem exigir outra candidata. Com evidência para os critérios acima e aceitação dos limites documentados, a 0.1.0 pode ser publicada pelo workflow de release. Uma futura 1.0.0 precisa de sua própria decisão sobre compatibilidade da API e experiência em aplicativos; não decorre de zerar a lista de issues.
