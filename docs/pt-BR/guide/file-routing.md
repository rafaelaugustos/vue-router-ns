# Rotas por arquivos opcionais (experimental)

O gerador produz um array de rotas tipado para o router nativo existente. O aplicativo pode declarar rotas em JavaScript/TypeScript, gerá-las a partir de páginas Vue nativas ou combinar tabelas independentes. Pages, Frames, guards, resultados e histórico continuam seguindo os mesmos contratos.

Os plugins opcionais de webpack e Vite cuidam da geração, compilação de metadados e HMR nativo. Aplicativos com rotas explícitas não precisam alterar o build. Todas as telas usam componentes NativeScript; a biblioteca não executa Nuxt, Vue Router web, renderer DOM ou navegação em WebView, nem converte templates web.

## Configuração com NativeScript webpack

Instale `@vue/compiler-sfc@^3.5` e `webpack@^5` como dependências de desenvolvimento, junto ao `@nativescript/webpack` do aplicativo. O compilador continua sendo um peer opcional; o bundler pertence ao app e o plugin verifica o webpack 5 quando é aplicado. Adicione ao `webpack.config.js` existente:

```js
const webpack = require('@nativescript/webpack')
const { NativeFileRoutesPlugin } = require('vue-router-ns/file-routing/webpack')

module.exports = (env) => {
  webpack.init(env)
  webpack.chainWebpack((config) => {
    config.plugin('native-file-routes').use(NativeFileRoutesPlugin, [
      {
        platform: env.android ? 'android' : 'ios',
        pagesDir: 'src/pages',
        outDir: 'src/generated/router',
        layoutsDir: 'src/layouts', // descoberta opcional
        middlewareDir: 'src/middleware', // descoberta opcional
        autoImports: true, // somente o macro definePageMeta
      },
    ])
  })
  return webpack.resolveConfig()
}
```

Os caminhos são relativos ao contexto do projeto no webpack (`rootDir` permite sobrescrevê-lo). A saída deve ficar fora dos diretórios escaneados. Inclua os arquivos gerados no `include` do TypeScript e ignore-os no Git. Omita `layoutsDir`/`middlewareDir` ou use `false` para manter o registro explícito.

```ts
import { createRouter } from 'vue-router-ns'
import { routes, layouts, installFileRouting } from './generated/router'

export const router = createRouter({ routes, layouts, defaultLayout: 'default' })
const disposeFileRouting = installFileRouting(router)
// Depois, app.use(router). Descarte a integração quando encerrar o app/janela.
```

Crie o router uma vez. `installFileRouting` registra os middlewares descobertos e aceita HMR da tabela nessa instância; retorna uma função de limpeza. Remova `layouts` e `defaultLayout` se não usar layout. O aplicativo monta `RouterView`/outros containers nativos normalmente.

A geração ocorre antes da compilação, inclusive no watch de `ns run`. Antes de executar `tsc --noEmit` separadamente, prepare os tipos com as mesmas opções num script Node:

```js
import { prepareFileRouting } from 'vue-router-ns/file-routing/setup'

await prepareFileRouting({
  platform: 'android',
  pagesDir: 'src/pages',
  outDir: 'src/generated/router',
  layoutsDir: 'src/layouts',
  middlewareDir: 'src/middleware',
  autoImports: true,
})
```

Compartilhe as opções entre o script e o webpack. O `index.d.ts` gerado descreve a **última plataforma preparada**: prepare e verifique os tipos de cada plataforma em sequência. Não gere ambas simultaneamente no mesmo diretório de saída. O NativeScript seleciona `index.android.ts`/`index.ios.ts` em runtime. Os módulos Node de setup/plugin/compilador nunca devem ser importados pelo app.

## Configuração com NativeScript Vite

A entrada opcional `vue-router-ns/file-routing/vite` gera as mesmas rotas nativas e remove `definePageMeta` antes da compilação Vue. Requer Vite 8 e `@vue/compiler-sfc@^3.5` como dependências de desenvolvimento. O plugin verifica a versão ativa do Vite durante a configuração; instalar só o router não resolve um peer de Vite. Comece pela [configuração Vue do NativeScript Vite](https://docs.nativescript.org/configuration/vite) e adicione o plugin:

```ts
// vite.config.mts
import { defineConfig, mergeConfig } from 'vite'
import { getCliFlags } from '@nativescript/vite'
import { vueConfig } from '@nativescript/vite/vue'
import { nativeFileRoutes } from 'vue-router-ns/file-routing/vite'

export default defineConfig(({ mode }) => {
  const flags = {
    ...getCliFlags(),
    ...JSON.parse(process.env.NATIVESCRIPT_BUNDLER_ENV ?? '{}'),
  }
  if (!flags.android && !flags.ios) throw new Error('Select an Android or iOS build')
  return mergeConfig(vueConfig({ mode }), {
    plugins: [
      nativeFileRoutes({
        platform: flags.android ? 'android' : 'ios',
        pagesDir: 'src/pages',
        outDir: 'src/generated/router',
        layoutsDir: 'src/layouts',
        middlewareDir: 'src/middleware',
        metadataFiles: true, // .route.json ao lado da página; HMR nativo sem macro
      }),
    ],
  })
})
```

Defina `bundler: 'vite'` e `bundlerConfigPath: 'vite.config.mts'` em `nativescript.config.ts`. Inclua `vite/client` nos tipos do TypeScript para o `import.meta.hot` gerado. Nas chamadas independentes de `prepareFileRouting()`, use também `bundler: 'vite'`. `installFileRouting`, layouts nativos, middleware e composição com rotas explícitas usam a mesma API do exemplo acima.

Execute `ns run android` ou `ns run ios --emulator` com HMR ativado e use JSON ao lado da página, como abaixo. A tabela gerada e edições de middlewares existentes atualizam o router nativo instalado sem reconstruir suas páginas abertas.

::: warning definePageMeta e HMR nativo do Vite
O HMR nativo do Vite ainda exige metadados JSON com `@nativescript/vite` 8.0.20: continua aberta a issue separada em que o compilador nativo de SFCs pula transformações anteriores à compilação ([NativeScript#11556](https://github.com/NativeScript/NativeScript/issues/11556)). `definePageMeta` funciona no build Vite empacotado (`--no-hmr`) e no webpack. Para HMR nativo do Vite, remova a chamada e use `metadataFiles: true`; o plugin informa como corrigir se um macro permanecer. O fluxo JSON não exige patches nas dependências.
:::

Validado com `@nativescript/vite` 8.0.20 sem patches, Vite 8.3.4, Node 22.23.3, Android API 36 e iOS 26. A fixture nativa cobre edição de template, substituição de middleware existente, metadados, criação/renomeação/remoção e recuperação após metadados inválidos. A inspeção dos bundles exclui compilador/gerador e router web.

O compilador nativo Vite testado também exige um bloco de script não vazio nos SFCs; compilar páginas somente com template continua sendo uma limitação da plataforma. As páginas do exemplo incluem scripts. `@nativescript/vite` 8.0.20 inclui o [NativeScript#11555](https://github.com/NativeScript/NativeScript/pull/11555), que corrige a identificação de pacotes Vue e os imports dos helpers de navegação no HMR. Atualize a dependência e o lockfile do aplicativo para receber a correção. O exemplo mantém `install-links=true` para testar o router local como pacote, no mesmo formato publicado; esta validação não cobre links diretos de workspace.

## Metadados ao lado da página

Ative `metadataFiles: true` nas opções do plugin e de `prepareFileRouting`. Webpack e Vite aceitam esse formato opcional; o padrão continua `false`. Para `src/pages/products/[id].vue`, crie `src/pages/products/[id].route.json`:

```json
{
  "name": "product",
  "layout": "default",
  "middleware": ["auth"],
  "props": true,
  "meta": { "requiresAuth": true }
}
```

Os campos correspondem a `definePageMeta`; o gerador valida os dados JSON e gera registros tipados sem importar JSON ou ferramentas de build no aplicativo. Use uma fonte de metadados por página: macro e arquivo JSON juntos geram erro, mesmo com macro vazio. Sem JSON, valem as convenções de arquivos. Metadados inválidos preservam a última tabela até a correção; apagar o JSON restaura os padrões do arquivo.

O JSON pertence ao **SFC exato selecionado**: `product.android.vue` lê `product.android.route.json`; `product.vue` lê `product.route.json`. Não há fallback nem combinação entre esses arquivos. Duplique os metadados compartilhados nas variantes de plataforma quando necessário. Editar o JSON atualiza o matching futuro; entradas abertas mantêm os snapshots de rota e seu estado nativo.

## Descoberta e imports opcionais

`layouts/default.vue` registra `default`; `layouts/account/settings.vue` registra `account-settings`. A descoberta não ativa um layout padrão: defina `defaultLayout` ou os metadados da página. O layout é responsável pela única `Page` nativa; seu conteúdo roteado não deve criar outra `Page`. Veja [layouts](./layouts).

Middlewares exportam uma função `RouteMiddleware` como default. `middleware/auth.ts` registra `auth`; `middleware/01-audit.global.ts` registra middleware global em ordem determinística de nomes de arquivos. Prefixos numéricos permitem expressar a ordem. Middlewares nomeados executam quando selecionados nos metadados da página. `router.addRouteMiddleware()` continua disponível; a descoberta não sobrescreve nomes duplicados silenciosamente. Veja [middleware e helpers](./middleware).

Os dois diretórios aceitam variantes `.ios`/`.android` antes da extensão, como `auth.global.android.ts`. Nomes permitem letras, números, underscores e hífens; pastas aninhadas são unidas por `-`. Ambiguidades geram erro. Entradas ocultas/com prefixo `_` são ignoradas e symlinks rejeitados. Diretórios configurados devem existir.

Com `autoImports: true`, somente uma chamada sem binding local de `definePageMeta()` no nível superior do `<script setup>` de uma página pode omitir o import. A declaração gerada fornece seu tipo. Bindings locais e imports de outros módulos preservam seu significado. Helpers de runtime sempre usam imports explícitos. Com o padrão `autoImports: false`, escreva `import { definePageMeta } from 'vue-router-ns/file-routing'`.

## Exemplo nativo e suporte verificado

O [exemplo de rotas por arquivos](https://github.com/rafaelaugustos/vue-router-ns/tree/main/examples/file-routing) inclui coleção/detalhe, rascunho editável, duas pilhas em abas nativas, layout, middleware de autenticação e modal com resultado tipado. Também combina `/about` explícita com as rotas geradas. O [playground existente](https://github.com/rafaelaugustos/vue-router-ns/tree/main/examples/playground) mantém a configuração explícita.

<div class="clips">
  <Clip name="ios-file-routing" caption="iOS: lista/detalhe nativos, resultado de modal e autenticação com rotas geradas." />
  <Clip name="android-file-routing" caption="Android: as mesmas convenções sobre Pages e Frames nativos." aspect="9 / 20" />
</div>

| Camada                     | Configuração verificada                                                   |
| -------------------------- | ------------------------------------------------------------------------- |
| Integração                 | Subpaths opcionais experimentais; API explícita permanece disponível      |
| NativeScript-Vue / Core    | 3.1.2 / 9.1.3; uma instância de cada no bundle inspecionado               |
| Builder / compilador       | `@nativescript/webpack` 5.0.39, webpack 5.112, `@vue/compiler-sfc` 3.5.44 |
| Node / tipos do exemplo    | Node 20.19.4 local e Node 22 no CI; TypeScript 6.0.3                      |
| Android                    | Runtime 9.1.1; API 36 local, API 34 no CI nativo                          |
| iOS                        | Runtime 9.1.0; simulador iOS 26, aceitação nativa local                   |
| Outros builders/frameworks | Webpack e Vite suportados; HMR nativo Vite usa JSON. Sem runtime Nuxt     |

`scripts/native/conventions-watch.mjs android|ios` executa o exemplo pelo CLI NativeScript real e edita os arquivos enquanto o app está aberto. Verifica identidade de Page, rascunhos, Voltar, cancelamento, redirects de autenticação, resultados de modal, visibilidade de acessibilidade/alvos de foco e recuperação do watch. Restaura suas alterações temporárias ao sair. A fixture não verifica anúncios audíveis de leitores de tela; a cobertura de acessibilidade separada do router continua valendo.

Cada plugin usa o watcher do seu bundler. Criar, renomear ou apagar uma página e editar apenas seus metadados atualiza o matching futuro sem recriar entradas abertas ou outras pilhas. Geração inválida apresenta erro de build e preserva a última saída válida; corrigir a fonte retoma a compilação. Alterar script/template Vue segue o HMR do Vue e pode remontar o componente/perder estado local. Adicionar, remover ou renomear registros de layouts/middlewares exige reiniciar o app; editar middlewares existentes atualiza os guards futuros sem reconstruir o router. Edições de script Vue podem remontar componentes; edições compatíveis de template preservam o estado verificado da página.

Para voltar às rotas explícitas, troque os imports gerados por suas tabelas de rotas/layouts, registre middlewares explicitamente e remova `installFileRouting`, o plugin, seu script de preparação e declarações geradas. Mova os campos de `definePageMeta` para os registros de rota e remova as chamadas. O router nativo e sua API de navegação permanecem os mesmos.

## Gerar o módulo

Instale `@vue/compiler-sfc@^3.5` como **dependência de desenvolvimento** para usar o gerador. É um peer opcional; aplicativos com rotas explícitas não precisam dele. Execute no Node antes da compilação do app:

```js
import { writeFileRoutes } from 'vue-router-ns/file-routing/generator'

await writeFileRoutes({
  pagesDir: 'src/pages',
  outFile: 'src/generated/routes.android.ts',
  platform: 'android',
  exclude: ['components'],
})
```

Para iOS, use `platform: 'ios'` e outro arquivo de saída. Os imports apontam para o SFC selecionado, relativamente ao módulo gerado. O NativeScript resolve um import comum `./generated/routes` para o arquivo da plataforma; configure também a resolução do TypeScript ou importe o módulo específico:

```ts
import { createRouter } from 'vue-router-ns'
import { routes } from './generated/routes.android'

export const router = createRouter({ routes })
router.push({ name: 'products-id', params: { id: 42 } })
```

A saída exporta `routes`, `FileRouteMap`, `FileRouteName` e `FileRouteParams<Name>`. As factories lazy têm retorno explícito para evitar ciclos de inferência entre páginas e router. O [registro de tipos](./typed-routes) existente estende os nomes/parâmetros aos composables e links. O módulo gerado não importa filesystem, compilador ou gerador em runtime.

## Convenções

| Arquivo                | Caminho           | Nome             | Parâmetros                                |
| ---------------------- | ----------------- | ---------------- | ----------------------------------------- |
| `index.vue`            | `/`               | `index`          | nenhum                                    |
| `products.vue`         | `/products`       | `products`       | nenhum                                    |
| `products/index.vue`   | `/products`       | `products-index` | nenhum                                    |
| `products/[id].vue`    | `/products/:id`   | `products-id`    | `id: string`                              |
| `settings/[[tab]].vue` | `/settings/:tab?` | `settings-tab`   | `tab?: string`                            |
| `files/[...path].vue`  | `/files/:path+`   | `files-path`     | `path: string[]`, um ou mais segmentos    |
| `any/[[...path]].vue`  | `/any/:path*`     | `any-path`       | `path?: string[]`, zero ou mais segmentos |

O nome mantém `index` para que adicionar um arquivo pai não renomeie o destino existente. `definePageMeta({ name: '...' })` substitui o nome. Arquivos/pastas aceitam letras ASCII, números, `_` e `-`; parâmetros usam caracteres de palavra. Segmentos mistos como `product-[id]`, grupos e regex customizada geram erro com localização. As rotas explícitas preservam as capacidades atuais do matcher. Catch-all deve ser o último segmento.

Pastas sozinhas não criam Pages ou Frames. O arquivo pai mais próximo, como `products.vue`, vira pai de `products/[id].vue`. Com `withParents: true`, o router empilha a Page do pai antes do detalhe. Arquivos `index` nunca são pais. Quando existem `products.vue` e `products/index.vue`, navegar pelo caminho `/products` seleciona o index; o nome permite selecionar o pai. Um caminho customizado do pai se propaga aos filhos, salvo override absoluto no filho; parâmetros obrigatórios do pai precisam continuar disponíveis para `withParents`.

A geração é determinística e o matcher existente ordena os destinos. Nomes duplicados, padrões equivalentes sem distinção entre maiúsculas/minúsculas, parâmetros repetidos e nomes de arquivo não suportados geram diagnóstico com arquivo/linha/coluna. Pai e index são a exceção intencional de mesmo caminho.

Arquivos/pastas ocultos, nomes iniciados em `_` e `node_modules` são ignorados. `exclude` aceita arquivos relativos exatos ou prefixos de diretórios, sem globs. Exclua links simbólicos. O diretório configurável pode estar vazio.

`page.ios.vue`/`page.android.vue` substituem `page.vue` na plataforma correspondente. Uma página exclusiva fica ausente na outra plataforma. Informe `platform` quando houver variantes. Mantenha nomes/caminhos consistentes entre elas se o app precisar compartilhar o mapa de rotas; cada saída tipa sua própria tabela.

## Metadados na página

```vue
<script setup lang="ts">
import { definePageMeta } from 'vue-router-ns/file-routing'

definePageMeta({
  name: 'product',
  layout: 'default',
  middleware: ['auth'],
  props: true,
  transition: 'fade',
  meta: { requiresAuth: true },
})
</script>

<template>
  <StackLayout><Label text="Produto" /></StackLayout>
</template>
```

Registre o [layout](./layouts) e o [middleware](./middleware) no router. Aqui o layout é dono da `Page`; sem layout, o destino precisa montá-la. `layout: false` desativa o layout. Para um modal nativo, use `modal: true` ou opções literais, como `modal: { fullscreen: true }`. Sheets e transições seguem seus contratos de plataforma existentes.

O macro aceita `name`, `path`, `layout`, `middleware`, `meta`, `props`, `modal` e `transition`. `layout`/`middleware` do nível superior viram metadados da rota; campos do aplicativo ficam em `meta`. Os tipos gerados verificam o formato das opções normais. `name`/`path` explícitos prevalecem sobre as convenções do arquivo.

Os valores precisam ser dados literais: strings, números finitos, booleanos, null, arrays e objetos simples. Wrappers TypeScript `as`/`satisfies` são aceitos. Constantes importadas, variáveis do setup, chamadas, funções, spreads, getters e chaves calculadas são rejeitados sem execução. Registre guards/layouts funcionais no router e referencie seus nomes. Use rotas explícitas para props por callback, redirects ou objetos de transição que precisem ser construídos em runtime.

Chame o macro uma vez no nível superior de `<script setup>`. Imports explícitos podem usar aliases. Os plugins de build webpack e Vite fazem a transformação automaticamente; a limitação de HMR nativo Vite acima continua valendo. Num builder próprio, execute `transformPageMeta(source, filename, { autoImports: false })` **antes do compilador SFC do Vue**, usando `code` e o source `map` retornados. A transformação remove a chamada/import do macro e preserva o restante. Um macro sem transformação lança erro no setup. A descoberta pertence à API opcional de setup, não ao gerador de baixo nível.

## Combinar com rotas explícitas

```ts
import { mergeFileRoutes } from 'vue-router-ns/file-routing'

const router = createRouter({
  routes: mergeFileRoutes(routes, [
    { path: '/help', name: 'help', component: () => import('./Help.vue') },
  ]),
})
```

`mergeFileRoutes()` preserva os tipos literais e rejeita conflitos de nomes/padrões. Não há prioridade implícita entre tabelas. Exclua o arquivo antes de declarar sua substituição explicitamente. `addRoute()`/`removeRoute()` mantêm o comportamento existente.

## Regeneração e páginas abertas

`generateFileRoutes()` retorna código, árvore de páginas, fontes e caminhos sem escrever. `writeFileRoutes()` escreve atomicamente apenas se a saída mudou. Uma falha na geração mantém o último módulo válido; compilação e diagnósticos de tipos continuam sob responsabilidade do builder.

`watchFileRoutes(options, { onGenerated, onError })` oferece um watcher Node para integrações de build. Ele serializa a regeneração ao criar/editar/renomear/apagar arquivos, relata erros e retoma após correções. Aguarde `close()` no handle retornado para encerrá-lo. Os callbacks devem relatar erros sem lançar exceções. O suporte segue o Node/filesystem. O builder cuida de compilação, diagnóstico, encerramento e entrega do módulo atualizado ao aplicativo.

Num aplicativo que já recebe HMR do módulo gerado, registre o updater após criar o router:

```ts
import { createFileRouteUpdater } from 'vue-router-ns/file-routing'

const fileRoutes = createFileRouteUpdater(router, routes)
// No callback de aceitação de HMR do builder:
fileRoutes.update(nextModule.routes)
```

A atualização altera o **matching futuro por caminho/nome**. Entradas abertas mantêm Page, snapshot da rota, layout, guards e rascunhos, mesmo se o arquivo foi removido/renomeado. Voltar ainda retorna a essas entradas; tentar abrir um destino removido por caminho/nome falha. Localizações relativas a uma entrada retida continuam usando o registro original, incluindo seus metadados, conforme a semântica existente de `addRoute`/`removeRoute`. Use caminho ou nome para resolver pela tabela atualizada. HMR do script/template Vue é uma operação separada, com o contrato existente de HMR das páginas. O updater não recria o router nem reinicia outras pilhas.

Conflitos com destinos explícitos e registros alterados externamente são rejeitados antes de modificar a tabela. Se `addRoute`/`removeRoute` substituiu um registro gerado, recrie o updater com a tabela gerada realmente instalada. Remova filhos adicionados manualmente antes de atualizar seu pai gerado. Assim, o registro direto continua sendo respeitado.

IDs de arquivos e nomes de rotas são separados da chave de restauração de cada entrada nativa. Renomear um arquivo pode mudar o nome da rota; declare um nome estável quando necessário. Caminhos salvos, migrações e destinos indisponíveis seguem a [restauração](./restore) existente. Gerar outra tabela não migra dados salvos do app.

A fixture `--env.filesTest` continua validando a saída de baixo nível no iOS/Android. O exemplo separado de convenções exercita o plugin público e o HMR entre filesystem e dispositivo descrito acima.
