# Pré-carregamento de dados de rotas (experimental) {#route-data-preloading-experimental}

Prepare um loader que permitiu explicitamente a antecipação quando o usuário tocar em um card. O destino consome dados válidos preparados/em andamento somente depois dos guards normais. A preparação não importa componentes, monta views Vue/nativas, revela abas, altera histórico nem executa guards de navegação. Os loaders existentes e o [pré-carregamento de código](./preloading) continuam independentes; não há tráfego especulativo automático nem framework de cache obrigatório.

## Autorizar um loader seguro para antecipação {#authorize-an-explicitly-safe-loader}

Passe uma política `preload` como segundo argumento de `defineRouteLoader()`. `scope()` deve retornar um objeto estável para a sessão/época de permissões atual, ou `null`/`undefined` para negar preparação. `authorize({ to, from })` precisa retornar o booleano `true` de forma síncrona. Deve ser uma verificação de permissão sem efeitos colaterais; políticas assíncronas são negadas. Resolva autenticação assíncrona no app antes de permitir preparação. Essas verificações não substituem autorização do servidor nem guards.

```ts
import { defineRouteLoader } from 'vue-router-ns'

type Session = { accessToken: string; mayReadProducts: boolean }
type Product = { id: string; title: string }
let session: Session | null = null

export function updateSession(next: Session | null) {
  session = next ? { ...next } : null
}
export const productData = defineRouteLoader(
  async ({ to }) => {
    const account = session
    if (!account?.mayReadProducts) throw new Error('Product access denied')
    const response = await fetch(
      `https://api.example.com/products/${encodeURIComponent(String(to.params.id))}`,
      { headers: { Authorization: `Bearer ${account.accessToken}` } },
    )
    if (!response.ok) throw new Error('Could not load product')
    return response.json() as Promise<Product>
  },
  {
    preload: {
      scope: () => session,
      authorize: () => session?.mayReadProducts === true,
    },
  },
)
```

O exemplo captura as credenciais na invocação. Substitua o objeto de escopo quando a conta, as credenciais ou as permissões mudarem. Não retorne um novo objeto a cada leitura. Depois de atualizar a sessão, limpe o trabalho preparado como mostrado abaixo.

Declare a mesma definição do loader nos metadados da rota. Definições nomeadas e declarações em rotas ancestrais também funcionam. A preparação seleciona apenas a definição solicitada; loaders irmãos não iniciam. A configuração mostra os padrões de um pool separado para dados:

```ts
const router = createRouter({
  routes: [
    { path: '/', component: () => import('./Home.vue') },
    {
      path: '/products/:id',
      name: 'product',
      component: () => import('./Product.vue'),
      meta: { loaders: productData },
    },
  ],
  preloadData: { concurrency: 2, maxEntries: 16, ttl: 30_000 },
})
```

## Preparar a partir de uma página {#prepare-from-a-page}

Capture `useRouteDataPreload()` no setup da página roteada. Conecte estas funções ao início do toque, arrasto abandonado/cancelamento e liberação usando o [handler completo](./preloading#prepare-from-a-page); mantenha o botão comum acessível como outro caminho para abrir. O helper libera o interesse no descarte da página/escopo. Mantenha o handle até a navegação terminar para que guards assíncronos possam reaproveitá-lo. Identificadores e rótulos do exemplo estão em inglês.

```ts
import { useRouter, useRouteDataPreload, type RoutePreload } from 'vue-router-ns'
import { productData } from './product-data'

const router = useRouter()
const prepare = useRouteDataPreload()
const to = { name: 'product', params: { id: '42' } } as const
let interest: RoutePreload | undefined

function touchDown() {
  interest?.cancel()
  interest = prepare(to, productData)
}
function abandon() {
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
```

Fora da página, chame `router.preloadData(to, productData)`. Um router vinculado à pilha possui seus interesses até ela fechar; interesses da raiz pertencem ao router/janela. O destino deve resolver e a definição precisa estar declarada e permitir antecipação; caso contrário, o handle relata erro. Código pode ser preparado separadamente com `router.preload(to)`.

## Resultados, correspondência e navegação {#results-matching-and-navigation}

O resultado é o mesmo handle `RoutePreload`: `state` vivo somente leitura, promise `ready` do primeiro resultado e `cancel()`. Ele nunca expõe o payload preparado. Os estados são `queued`, `loading`, `ready`, `error` e `cancelled`. A recusa de permissão de dados usa o motivo `unauthorized`; os demais são `cancelled`, `expired`, `invalidated`, `disposed` e `capacity`. A promise nunca rejeita e mantém seu primeiro resultado mesmo se a prontidão expirar depois.

O compartilhamento exige o mesmo loader, identidade de sessão, registros de rota, destino completo e origem completa, incluindo params/query/hash. A origem faz parte da chave porque loaders podem depender dela. Routers/janelas têm pools separados. Consumidores têm interesses independentes; cancelar um não cancela outro nem uma entrada já consumindo a requisição. Um carregamento normal iniciado antes da preparação não entra retroativamente no pool; o cache do app pode unir esse trabalho.

Depois de todos os guards normais, uma nova entrada adquire a preparação correspondente e continua sendo apresentada sem esperar dados. `useRouteData(productData)` expõe o estado normal dessa entrada. Valores prontos e requisições em andamento podem ser reutilizados; expiração ou falha especulativa recorre ao carregamento normal. Mudanças de conta/permissão e invalidação explícita cancelam uma publicação pendente compartilhada sem repetir silenciosamente trabalho protegido. Recusa ou redirect da navegação não cria uma entrada para o destino preparado.

`RouteLoaderContext.preloading` distingue a invocação especulativa do carregamento normal. `reload()` sempre inicia uma tentativa normal em vez de consumir preparação de novo. Carregamentos normais sem preparação continuam independentes. Entradas retidas por Back/abas mantêm seu estado. Valores compartilhados são referências rasas, sem cópia ou congelamento profundo: trate resultados preparados como imutáveis. Dados nunca são serializados com pilhas salvas.

## Limites, cancelamento e troca de conta {#budgets-cancellation-and-account-changes}

`RouterOptions.preloadData` tem limites independentes de `concurrency` (2), `maxEntries` (16) e `ttl` (30.000 ms). Os valores devem ser inteiros positivos e finitos. O limite conta trabalhos de loaders/resultados retidos, não bytes ou conteúdo do cache do app. O TTL começa na primeira solicitação, incluindo fila, e o reaproveitamento não o estende. Resultados prontos usam remoção LRU; um pool cheio de trabalhos pendentes retorna `capacity`. A navegação autorizada pode promover sua requisição enfileirada sem esperar outra especulação.

Trabalho enfileirado sem consumidores nunca executa. O último interesse pendente libera o contexto compartilhado do loader e invoca seus callbacks `onCancel()`. Uma requisição em execução continua ocupando uma vaga até sua promise terminar, mesmo cancelada. Conecte o callback ao cliente HTTP apenas quando a invocação possuir a requisição ou sua própria assinatura no cache. Cancelar sempre impede publicação pelo router; só aborta o transporte se o cliente suportar e implementar esse adaptador. A fixture nativa deixa o HTTP terminar de propósito após o cancelamento.

Chame isto imediatamente ao sair/trocar de conta ou mudar permissões, e invalide o cache correspondente do app:

```ts
updateSession(nextSession)
router.clearPreloads()
```

Escopo e permissão são verificados antes da execução, reaproveitamento e publicação. Mudanças de escopo não são observadas continuamente: limpar dá cancelamento imediato; as verificações também rejeitam respostas tardias sem a limpeza. Remoção/substituição de rota, HMR da tabela gerada e mudanças de fábrica invalidam a preparação. Use `router.clearPreloads()` após mudanças de metadados no mesmo objeto ou atualização explícita. Substituir registros de loaders nomeados exige o recarregamento completo do router já existente.

A limpeza afeta preparação de código e dados, incluindo entradas ainda esperando trabalho preparado. Ela não apaga valores já consumidos por entradas vivas ou pelo cache do app; o app controla o descarte das páginas da conta e dos dados em cache. Reload e descarte dos dados normais mantêm o comportamento existente. Nenhum resultado preparado sobrevive à morte do processo.

## Evidência nativa {#native-evidence}

<Clip name="route-data-preload" :width="480" aspect="3 / 4" caption="HTTP real frio/preparado, arrasto abandonado, especulação negada, recusa do guard, troca de conta durante HTTP e descarte do dono. Atraso controlado de 900 ms no servidor; não é benchmark de rede. Simulador iOS 18.6; rótulos em inglês." />

A fixture conta construções antes do commit e verifica identidade da Page/histórico da origem. Seu servidor HTTP confere independentemente a contagem de requisições, incluindo zero na recusa e requisições separadas das contas A/B. Veja o [relatório de validação](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-route-preload-stage2.md) e o [driver reproduzível](https://github.com/rafaelaugustos/vue-router-ns/blob/main/scripts/native/preload/README.md). A evidência nativa cobre simulador iOS; não comprova toque nativo no Android, desempenho em hardware físico ou coleta de memória.
