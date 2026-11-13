# Pré-carregamento de código de rotas (experimental) {#route-code-preloading-experimental}

Prepare o código de um destino lazy quando o usuário tocar em um card. A navegação seguinte pode reaproveitar esse trabalho. A preparação resolve o destino e os redirects declarativos e carrega apenas o componente final da rota. Não navega, revela uma aba, cria uma janela, monta views Vue/nativas, executa guards ou inicia loaders de dados. Páginas ancestrais e layouts carregam normalmente durante a navegação.

É opcional e experimental. O router só inicia trabalho especulativo quando você chama `router.preload(to)` ou a função retornada por `useRoutePreload()`.

## Preparar a partir de uma página {#prepare-from-a-page}

Limite as fábricas lazy à importação de código. A configuração abaixo mostra os padrões:

```ts
const router = createRouter({
  routes: [
    { path: '/', component: () => import('./Home.vue') },
    { path: '/products/:id', name: 'product', component: () => import('./Product.vue') },
  ],
  preload: { concurrency: 2, maxEntries: 16, ttl: 30_000 },
})
```

Capture `useRoutePreload()` no setup da página roteada. Cada chamada mantém seu próprio interesse no código; o descarte da página ou do escopo libera seus interesses automaticamente. Cancele ao abandonar o gesto. Mantenha o interesse até a navegação terminar para que um guard assíncrono ainda possa reaproveitá-lo. O botão comum oferece um caminho acessível sem exigir que se mantenha o toque. Os rótulos do exemplo estão em inglês.

```vue
<script setup lang="ts">
import type { TouchGestureEventData } from '@nativescript/core'
import { useRouter, useRoutePreload, type RoutePreload } from 'vue-router-ns'

const router = useRouter()
const prepare = useRoutePreload()
const to = { name: 'product', params: { id: '42' } } as const
let interest: RoutePreload | undefined
let inside = false

function abandon() {
  inside = false
  interest?.cancel()
  interest = undefined
}
async function open() {
  const held = interest
  interest = undefined
  try {
    await router.push(to)
  } finally {
    held?.cancel()
  }
}
function touch(event: TouchGestureEventData) {
  if (event.action === 'down') {
    abandon()
    inside = true
    interest = prepare(to)
  } else if (event.action === 'cancel') {
    abandon()
  } else if (event.action === 'move') {
    const size = event.view.getActualSize()
    if (
      event.getX() < 0 ||
      event.getY() < 0 ||
      event.getX() > size.width ||
      event.getY() > size.height
    )
      abandon()
  } else if (event.action === 'up' && inside) {
    inside = false
    void open().catch(console.error)
  }
}
</script>

<template>
  <Page>
    <ActionBar title="Products" />
    <StackLayout>
      <GridLayout height="160" backgroundColor="#19385c" @touch="touch">
        <Label text="Hold to prepare, release to open" color="white" />
      </GridLayout>
      <Button text="Open product" @tap="open().catch(console.error)" />
    </StackLayout>
  </Page>
</template>
```

## Resultados e propriedade {#outcomes-and-ownership}

`RoutePreload` expõe `state` somente leitura, a promise `ready` e `cancel()`. O estado atual é `queued`, `loading`, `ready`, `error` ou `cancelled`. Um erro traz `error`; o cancelamento traz `reason`: `cancelled`, `expired`, `invalidated`, `disposed` ou `capacity`.

`ready` nunca rejeita. Resolve uma vez com o primeiro resultado de prontidão, erro ou cancelamento. Um interesse que estava pronto pode ser cancelado ou expirar depois; seu estado muda, mas a promise mantém o resultado original. Estar pronto não autoriza navegar nem garante retenção futura no cache.

```ts
const interest = router.preload({ name: 'product', params: { id: 42 } })
const result = await interest.ready
if (result.status === 'error') console.error(result.error)
interest.cancel()
router.clearPreloads()
```

O helper da página cancela no descarte da página ou do escopo do componente. Uma chamada direta a `router.preload(to)` pertence ao router; um router vinculado à pilha libera seus interesses quando ela fecha. O fechamento permanente do router/janela invalida toda a preparação. Dois routers têm pools independentes. A resolução segue `router.resolve()`, incluindo a pilha do chamador para params relativos, sem mudar o foco.

## Limites e invalidação {#budgets-and-invalidation}

| Opção         | Padrão    | Política                                                                                                                                                                     |
| ------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `concurrency` | 2         | Máximo de fábricas especulativas em execução. A navegação autorizada pode promover seu destino enfileirado sem esperar por outro trabalho.                                   |
| `maxEntries`  | 16        | Máximo de registros pendentes/prontos. Ao atingir o limite, remove o registro pronto usado há mais tempo; retorna `capacity` para novos interesses se todos estão pendentes. |
| `ttl`         | 30.000 ms | Prazo máximo desde a primeira solicitação do registro, incluindo fila/carregamento. Reuso não o estende.                                                                     |

Os valores devem ser inteiros positivos e finitos. Uma importação em execução cancelada continua ocupando sua vaga até terminar. Trabalho enfileirado sem consumidores nunca executa. Consumidores de params diferentes da mesma rota compartilham código, não estado da página ou dados. Cancelar um consumidor não cancela os outros nem a navegação autorizada que já compartilha a importação. A navegação normal também compartilha uma importação que ela iniciou primeiro.

Remover/substituir uma rota, aplicar HMR à tabela gerada ou mudar a fábrica do componente invalida a preparação antiga. Use `router.clearPreloads()` ao sair/trocar de conta ou invalidar explicitamente. Um término tardio não repovoa esse pool especulativo. O HMR que altera um componente Vue no lugar continua pertencendo ao Vue. Nenhuma preparação é persistida após morte do processo.

O limite controla referências especulativas retidas pelo router e contagem de trabalho, não bytes dos módulos importados. Cancelar não interrompe uma importação JavaScript em execução, desfaz seus efeitos de inicialização, descarrega o cache de módulos JavaScript nem limpa o cache normal de componentes do router após navegação. Preparação expirada/com erro recorre ao carregamento normal quando a navegação é autorizada.

## Autorização e evidência nativa {#authorization-and-native-evidence}

Pré-carregar código executa a fábrica lazy e a inicialização do módulo antes dos guards de navegação. Não coloque buscas protegidas, credenciais ou efeitos de navegação ali. Mantenha dados protegidos nos [loaders autorizados da rota](./data-loading). A navegação real sempre executa seus guards; um redirect de guard pode escolher outro destino. Para dados, use a API separada de [preparação explicitamente autorizada](./data-preloading). Nenhuma exige framework de cache.

<Clip name="route-code-preload" :width="480" aspect="3 / 4" caption="Toque frio/preparado, arrasto abandonado, recusa do guard e descarte do dono. A fábrica inclui atraso controlado de 900 ms; os tempos não são benchmark de importação. Simulador iOS 18.6; rótulos em inglês." />

A fixture nativa conta construções de Page, Frame, UIViewController e apps Vue antes do commit, compara o histórico exato da origem e registra chamadas de guard/dados. A sequência com toque real demonstra preparação sem essas alocações, recusa e descarte. A evidência nativa vem de simulador iOS; não certifica hardware físico, entrada nativa no Android nem coleta de memória. Os testes de contrato cobrem consumidores compartilhados, limites, invalidação e janelas. Veja o [relatório de validação](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-route-preload-stage1.md) e a [referência da API](./api#route-code-preloading).
