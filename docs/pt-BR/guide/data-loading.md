# Carregamento de dados da rota (experimental)

Declare o carregamento na rota e mostre os estados de espera, sucesso e erro dentro da mesma Page nativa. Esta API opcional usa o router e as pilhas existentes. Rotas explícitas continuam sendo o padrão; não exige rotas por arquivos, Vue Router, Nuxt nem biblioteca de cache.

Um `component: () => import('./Product.vue')` carrega **o código da página**. Um loader de rota busca **dados**. A busca não bloqueia a apresentação nativa: `router.push()` termina quando a navegação termina, independentemente da requisição.

## Defina um loader tipado

Mantenha a definição em um módulo compartilhado pela tabela de rotas e pela página:

```ts
// product-data.ts
import { defineRouteLoader } from 'vue-router-ns'

type Product = { id: string; title: string; price: number }

export const productData = defineRouteLoader(async ({ to }) => {
  const response = await fetch(
    `https://api.example.com/products/${encodeURIComponent(String(to.params.id))}`,
  )
  if (!response.ok) throw new Error('Não foi possível carregar o produto')
  return response.json() as Promise<Product>
})
```

```ts
// router.ts
import { createRouter } from 'vue-router-ns'
import { productData } from './product-data'

export const router = createRouter({
  routes: [
    { path: '/', component: () => import('./Home.vue') },
    {
      path: '/products/:id',
      component: () => import('./Product.vue'),
      meta: { loaders: productData },
    },
  ],
})
```

```vue
<!-- Product.vue -->
<script setup lang="ts">
import { useRouteData } from 'vue-router-ns'
import { productData } from './product-data'

const product = useRouteData(productData)
// Refs no nível superior são desembrulhadas no template; data é Product | undefined.
const { data, status } = product
function retry() {
  void product.reload()
}
</script>

<template>
  <Page>
    <ActionBar title="Produto" />
    <StackLayout padding="24">
      <StackLayout v-if="status === 'pending'">
        <ActivityIndicator :busy="true" />
        <Label text="Carregando produto…" />
      </StackLayout>
      <StackLayout v-else-if="status === 'error'">
        <Label text="Não foi possível carregar. Tente novamente." textWrap />
        <Button text="Tentar novamente" @tap="retry" />
      </StackLayout>
      <StackLayout v-else-if="data">
        <Label :text="data.title" />
        <Label :text="'$' + data.price" />
      </StackLayout>
    </StackLayout>
  </Page>
</template>
```

Chame `useRouteData(definition)` no setup da página roteada, com o mesmo objeto de definição declarado na rota. A chamada lança erro fora de página roteada ou para uma definição não declarada. Consumidores na mesma entrada recebem o mesmo estado. Entradas, pilhas e routers diferentes têm estados separados, mesmo com URLs e definições iguais.

`data`, `error` e `status` são refs somente leitura. Os resultados são rasos: o router não transforma os objetos retornados em proxies profundos. `status` pode ser `pending`, `success`, `error` ou `cancelled`. Um loader bem-sucedido pode retornar `undefined`; use `status` para distinguir isso de uma requisição pendente.

`await product.ready` aguarda a **tentativa atual** e sempre resolve, inclusive em falha ou cancelamento. Consulte `status`/`error` depois. `reload()` limpa os dados/erro anteriores, cancela a tentativa pendente e inicia outra nessa entrada; sua Promise segue as mesmas regras. Não altera a Page nem o histórico. Não há retry automático. Depois do descarte da entrada, a chamada não faz nada.

## Autorização e ciclo de vida

A transação existente executa guards de saída, `beforeEach`, middleware, `beforeEnter`, imports da página/layout e `beforeResolve` antes de iniciar a busca de dados. Depois da autorização, loaders independentes começam em paralelo durante a criação da entrada; a apresentação nativa não aguarda suas Promises. Uma navegação abortada, redirecionada ou substituída antes do commit não executa os loaders daquele destino. Falhas no import do código também impedem a busca.

| Operação                                                 | Comportamento dos dados                                                      |
| -------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Rota inicial, push, replace, `force`, novos params/query | Uma nova entrada recebe um novo estado do loader.                            |
| Navegação duplicada sem `force`                          | Não cria entrada nem inicia busca.                                           |
| Voltar, trocar de aba, revelar página coberta            | Preserva o estado; não busca novamente por padrão.                           |
| Reconstrução de pilha salva                              | Novos loaders após guards; dados/resultados não são serializados.            |
| Deep link ou `setStack`                                  | Entradas novas carregam; o prefixo comum preservado mantém seus dados.       |
| Modal                                                    | Entrada própria; fechar cancela sua publicação pendente.                     |
| Remoção, Back nativo ou descarte do router/janela        | Cancela tentativas pendentes, limpa resultados e ignora respostas atrasadas. |
| Cobrir uma página com outra página/modal                 | A entrada preservada pode terminar sua requisição.                           |

`meta.loaders` aceita uma definição/nome ou um array. As declarações de pais e filhos correspondentes se somam; `[]` no filho não remove loaders do pai. O mesmo objeto executa uma vez por entrada, inclusive quando aparece por nome e por referência direta. Nomes desconhecidos/definições inválidas rejeitam a navegação antes de iniciar qualquer loader irmão.

Exceções e Promises rejeitadas viram estado `error`, inclusive depois da apresentação. Não rejeitam `router.push()` nem chamam `router.onError()`. Falhas de configuração, import do componente e navegação nativa continuam com o tratamento de erros de navegação. Trate ou registre erros de dados pelo estado retornado ou pelo seu cliente de dados.

## Cancelamento e cache existente

O contexto contém `to`, `from` (rota de origem da pilha), `isCancelled()` e `onCancel(callback)`. `onCancel` retorna uma função para remover a inscrição. Executa quando uma tentativa **pendente** é substituída ou sua entrada é descartada, e imediatamente se registrado após o cancelamento. Tentativas concluídas liberam os callbacks. O cancelamento resolve `ready` imediatamente e impede a publicação de sucesso/erro atrasados, mesmo se a requisição continuar.

O contrato não expõe um `AbortSignal` de navegador. O sinal do NativeScript Core 9.1.3 usa o contrato de eventos de Observable; não é intercambiável com o sinal de qualquer cliente HTTP. Para interromper trabalho exclusivo dessa chamada, adapte `onCancel` à API de cancelamento do seu cliente. O router não cancela requisições compartilhadas indiscriminadamente.

Por exemplo, reutilize um cache de Promises pertencente ao app:

```ts
const products = new Map<string, Promise<Product>>()

export const productData = defineRouteLoader(({ to }) => {
  const id = String(to.params.id)
  let request = products.get(id)
  if (!request) {
    request = fetchProduct(id) // Seu cliente existente, retornando Promise<Product>.
    products.set(id, request)
    const own = request
    void own.catch(() => {
      if (products.get(id) === own) products.delete(id)
    })
  }
  return request
})
```

Duas entradas podem reutilizar uma requisição; remover uma só descarta a publicação do resultado dela. A outra ainda recebe os dados. O app controla escopo do cache, separação de contas, validade, invalidação e cancelamento de rede. `reload()` chama o loader novamente; invalide o cache antes se quiser uma nova requisição. Este exemplo remove falhas para permitir retry explícito, mas mantém sucessos até o app invalidá-los.

## Rotas por arquivos opcionais

Registre as definições nomeadas no mesmo router:

```ts
createRouter({ routes, loaders: { product: productData } })
```

Declare um nome literal com os [metadados de rotas por arquivos](./file-routing):

```vue
<script setup lang="ts">
import { definePageMeta } from 'vue-router-ns/file-routing'
definePageMeta({ meta: { loaders: ['product'] } })
</script>
```

Com HMR nativo do Vite, use o `.route.json` da página, como nos demais metadados:

```json
{ "meta": { "loaders": ["product"] } }
```

Os nomes são resolvidos no registro daquele router, capturado na criação. A página ainda importa `productData` e chama `useRouteData(productData)` para obter os tipos. Não há descoberta implícita nem auto-import. HMR só de template pode manter o estado da entrada; substituir a definição ou alterar seu registro exige recarga completa para alinhar as referências da página e do registro. Mudanças na tabela de rotas se aplicam às novas entradas.

## Quando o destino precisa esperar

Um [guard](./guards) assíncrono continua sendo a alternativa para trabalho que precisa terminar antes de navegar. Por exemplo, um guard de autorização pode retornar `false` ou redirecionar; um `beforeResolve` posterior pode aguardar o cache do app. Isso atrasa a navegação e usa o tratamento de erros de navegação se lançar uma exceção. Mantenha a autorização antes de buscar dados protegidos. Não inicie outra navegação dentro de um loader para implementar autorização.

Esta API oferece estado reativo explícito para a interface. Não adiciona uma boundary automática de Suspense nem exige setup assíncrono; mantenha a Page raiz síncrona. A integração com Suspense está separada na [#119](https://github.com/rafaelaugustos/vue-router-ns/issues/119).

## Exemplo nativo e gravações

O [exemplo completo](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/testing/loaders-app.ts) usa um endpoint HTTP local real e cache do app. As duas gravações mostram espera, sucesso, falha HTTP, retry na mesma Page e retorno enquanto uma requisição está pendente.

<div class="clips">
<Clip name="ios-loaders" caption="iOS: Pages nativas continuam responsivas durante a busca do produto." />
<Clip name="android-loaders" aspect="9 / 20" caption="Android: erro HTTP e retry preservam a Page nativa e o histórico." />
</div>

Execute o demo com `--env.loadersTest` e `node scripts/native/loaders/server.mjs`. O endpoint local precisa de configuração de transporte exclusiva do teste e encaminhamento de porta no Android. Veja [reprodução e validação](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-route-data.md) para os comandos exatos e o escopo verificado.
