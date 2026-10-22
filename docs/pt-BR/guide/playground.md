# Experimente com StackBlitz

[Abrir o playground do router no StackBlitz](https://stackblitz.com/fork/github/rafaelaugustos/vue-router-ns/tree/main/examples/playground?file=src%2Frouter.ts)

Edite um app NativeScript-Vue no navegador e execute sua interface nativa em um celular ou tablet pelo [NativeScript Preview](https://preview.nativescript.org/). O navegador hospeda o editor e a compilação; ele não emula views do UIKit ou Android.

## Iniciando uma sessão

1. Instale o NativeScript Preview no aparelho pelos links do site.
2. Abra o playground acima. O StackBlitz instala as dependências e inicia `ns preview` pela integração oficial do NativeScript.
3. Espere o QR code do Preview e escaneie com o aparelho. Mantenha a sessão aberta enquanto edita.
4. Abra `src/router.ts` para mudar rotas, ou uma página em `src/pages/` para mudar a interface.

O [código do exemplo](https://github.com/rafaelaugustos/vue-router-ns/tree/main/examples/playground) é independente e fixa `vue-router-ns@0.1.0-beta.15`. Não exige compilar este repositório nem resolver um alias para `../dist`.

## O que experimentar

| Exercício                                                   | Onde                                          |
| ----------------------------------------------------------- | --------------------------------------------- |
| Empurrar vários itens e voltar por eles                     | `src/pages/Home.vue`, `src/pages/Item.vue`    |
| Abrir um modal e devolver uma resposta                      | `src/pages/Item.vue`, `src/pages/Compose.vue` |
| Cancelar um rascunho preenchido para executar o leave guard | `src/pages/Compose.vue`                       |
| Manter lista e detalhe visíveis em uma janela larga         | `src/App.vue` (`RouterSplitView`)             |
| Inspecionar a rota de cada página e o histórico combinado   | `src/pages/Item.vue`                          |

Veja [navegação](./navigating), [guards](./guards), [resultados de modais](./modals) e [split view](./split-view) para as APIs correspondentes.

## Recursos nativos

O Preview fornece um app nativo pré-compilado. O runtime, as bibliotecas e o manifesto instalados nele determinam quais APIs estão disponíveis; adicionar uma dependência npm não adiciona uma biblioteca nativa ausente nesse app. Mudanças no seu `App_Resources` exigem um build nativo completo.

Em particular, o progresso do predictive back no Android 14/15 exige ativação no manifesto, e o zoom do iOS exige iOS 18+ e runtime compatível. Uma sessão Preview não confirma o funcionamento dessas funções no manifesto do seu app de produção. Use o [demo local](./install#o-app-de-demonstracao) para testar configuração nativa, restauração após morte do processo e builds de release.

O exemplo segue o [template oficial Vue 3 para StackBlitz](https://github.com/nativescript-vue/nativescript-vue/tree/main/packages/stackblitz-template). Checar TypeScript e bundles por plataforma é diferente de testar uma sessão Preview completa em um aparelho conectado; este exemplo não afirma que essa última etapa foi verificada.

## Se a sessão não iniciar

Confira erros de instalação/build no terminal do StackBlitz e o [suporte de navegadores](https://developer.stackblitz.com/platform/webcontainers/browser-support). Confirme que o Preview está atualizado e consegue conectar à sessão. Para testar o mesmo código localmente, instale o NativeScript CLI, rode `npm install` em `examples/playground` e então `ns preview`.

O demo local completo continua disponível se o runtime do Preview não oferecer algum recurso. Mais detalhes: [integração e limitações do NativeScript Preview](https://blog.nativescript.org/nativescript-preview-announcement/).
