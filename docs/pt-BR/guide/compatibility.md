# Escopo da RC e compatibilidade

A candidata `0.1.0-rc.3` congela a API documentada não experimental enquanto validamos a versão estável. A tabela explícita de rotas em JavaScript/TypeScript continua sendo o padrão. Convenções de arquivos são opcionais; ambas usam navegação nativa, sem runtime de Vue Router ou Nuxt.

## Base suportada

| Dependência        | Requisito da RC                           | Base de validação                                          |
| ------------------ | ----------------------------------------- | ---------------------------------------------------------- |
| NativeScript Core  | `^9.1.3`                                  | 9.1.3                                                      |
| NativeScript-Vue   | `^3.1.2`                                  | 3.1.2                                                      |
| Node.js            | `>=20.19.4`                               | Instalação em 20.19.4 e 22.23.3; builds nativos em Node 22 |
| npm                | Compatível com a versão escolhida do Node | 10.8.2 e 11.21.1                                           |
| webpack (opcional) | webpack 5, NativeScript webpack 5         | webpack 5.112.0 / NativeScript webpack 5.0.38              |
| Vite (opcional)    | Vite 8, NativeScript Vite 8.0.20+         | Vite 8.3.4 / NativeScript Vite 8.0.20                      |

A RC restringe as declarações da beta, Core `>=8.9.0` e NativeScript-Vue `^3.0.0`, à base validada. Atualize essas dependências antes do router. Um intervalo compatível não significa que cada versão intermediária foi testada.

O CI nativo cobre emuladores Android API 34/35/36 e simuladores iOS/iPadOS 18.6. Execuções adicionais em iOS 26 e acessibilidade em aparelhos físicos estão nos [relatórios de validação](https://github.com/rafaelaugustos/vue-router-ns/tree/main/test). Cada relatório identifica a revisão testada; não representa um novo teste físico em todo release.

## Escopo da API

A RC congela rotas explícitas e destinos tipados; push/replace/back e resultados; guards e ciclo de navegação; RouterView, RouterLink, abas, drawer e split com Frames; rotas modais; restauração opcional do estado das páginas; e as integrações nativas documentadas fora da lista experimental abaixo. Correções continuam possíveis. Uma correção incompatível indispensável antes da estável exige uma nova candidata com instruções de migração.

Continuam **experimentais e opcionais**:

- [Múltiplas janelas nativas](./windows): um router por janela, restauração independente de tasks/cenas e reconexão no mesmo processo na base documentada.
- [Composição nativa com Suspense](./suspense): registro explícito de compatibilidade do renderer e conteúdo assíncrono dentro de uma Page estável.
- [Carregamento de dados da rota](./data-loading): estado e cancelamento por entrada, sem bloquear a apresentação nativa.
- [Rotas por arquivos](./file-routing), incluindo o contrato de geração e integração com bundlers. Rotas explícitas não dependem disso.
- [Hosts nativos personalizados](./native-hosts) e [destinos com controllers/Fragments](./native-destinations). Mudanças incompatíveis exigem uma nova versão do contrato de hosts.
- `backPreview: 'core'`, que depende do protótipo upstream fixado no [relatório de predictive back](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-predictive-back.md). O Core publicado usa o fallback existente.

O controle e a restauração de múltiplas janelas estão incluídos como recursos experimentais, com evidências de validação e limites de plataforma no [guia de janelas](./windows) e no [relatório de estado das páginas](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-page-state.md). O roadmap não é um compromisso de release. A rc.3 adiciona o [drawer iOS e a apresentação adaptativa](./drawer), [ações compartilhadas por página](./page-actions), o [visualizador de relatórios](./diagnostics-viewer) e o [exemplo integrado](./native-showcase). O overlay Android existente continua disponível; a apresentação adaptativa e as ações compartilhadas são opcionais. Veja o [mapa de capacidades](./capabilities) para responsabilidades nativas e composições suportadas.

## Limites conhecidos

- CSS `direction` herdado do NativeScript ao redor de navegação nativa genérica pode causar um crash no grafo de gestos do iOS 18.6. `RouterDrawer` usa sua própria prop `direction` e tratamento limitado ao container UIKit; layouts genéricos continuam sob [investigação (#139)](https://github.com/rafaelaugustos/vue-router-ns/issues/139). Uma reprodução apenas com Core agora dispara a mesma falha quando a árvore nativa com LTR herdado é montada antes de `Application.run()`; Vue e router não são necessários. O controle que adia a direção não é uma solução alternativa certificada para aplicativos.
- Flags, labels e declarações de foco verificadas automaticamente não certificam a navegação falada com VoiceOver/TalkBack. A [validação do exemplo integrado](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-showcase.md) e os relatórios de cada recurso identificam as verificações manuais restantes.

- HMR nativo com Vite usa metadados `.route.json`. `definePageMeta` funciona com webpack e Vite empacotado, mas não durante HMR nativo do Vite. Adicionar/remover registros de layouts ou middleware exige reiniciar o app; editar scripts pode remontar páginas. Veja [rotas por arquivos](./file-routing).
- Com npm 10, preserve um lockfile funcional do NativeScript Vite: a árvore de peers opcionais dele pode falhar em instalações sem lockfile. O crash de instalação do router com npm 10 foi corrigido na beta.15. Veja [instalação](./install).
- A morte do processo nunca preserva Promises JavaScript. Persista pequenos estados do app e inicie uma nova operação após recuperar. O router mantém os apps das páginas em Frames durante a recriação da Activity Android nas dependências publicadas suportadas, permitindo registrar novamente um fluxo nativo pendente. Remover a rota ou fechar permanentemente sua janela ainda cancela esse fluxo. Veja [fluxos nativos](./native-flows) e [restauração](./restore).
- Abas/sheets Material exigem a dependência nativa no app distribuído, inclusive em builds de release. Os helpers de disponibilidade consultam o que está presente; não instalam dependências. Indexação/ranking do Spotlight e comportamento de SDKs externos continuam sob responsabilidade do sistema/provedor.

## Validação do release

Uma versão nova em `main` só é publicada após os workflows completos de CI e contratos nativos passarem naquele mesmo commit. O tarball final do npm é instalado em projetos novos com rotas explícitas, webpack e Vite antes da publicação; o pacote e os logs ficam como artefato do workflow. Uma suíte obrigatória com falha ou cancelada bloqueia a publicação. Testes com protótipos upstream não substituem testes com dependências publicadas.

As RCs usam a tag `next` do npm. Como nas betas, `latest` também acompanha o prerelease mais novo até existir uma versão estável. Fixe uma versão exata e versione o lockfile para builds reproduzíveis do app.

Veja o [caminho para a 0.1.0 estável](./stable-readiness) para os critérios, evidências e trabalho restante.
