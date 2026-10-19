# Rotas por arquivos opcionais (experimental)

O gerador produz um array de rotas tipado para o router nativo existente. O aplicativo pode declarar rotas em JavaScript/TypeScript, gerá-las a partir de páginas Vue nativas ou combinar tabelas independentes. Pages, Frames, guards, resultados e histórico continuam seguindo os mesmos contratos.

Esta entrega fornece APIs de build. A instalação pronta para webpack, os auto-imports e o exemplo completo de configuração ficam na [#92](https://github.com/rafaelaugustos/vue-router-ns/issues/92). A biblioteca não executa o Nuxt nem o Vue Router web.

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

Importe `definePageMeta` explicitamente, com alias se quiser, e chame uma vez como declaração no nível superior de `<script setup>`. O build precisa executar `transformPageMeta(source, filename)` **antes do compilador SFC do Vue**, usando `code` e o source `map` retornados. A transformação remove a chamada/import do macro e preserva o restante do script/template. Um macro sem transformação lança erro no setup. Descoberta e imports automáticos ficam fora deste gerador.

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

A fixture `--env.filesTest` do repositório usa um loader webpack local e snapshots gerados para validar a saída no iOS/Android. O watcher de filesystem e as atualizações nativas da tabela são testados separadamente; a integração pronta entre watch e dispositivo fica na #92.
