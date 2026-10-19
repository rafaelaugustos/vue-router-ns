# Layouts nativos opcionais

Rotas declaradas explicitamente continuam sendo o padrão. Registre layouts quando quiser compartilhar a estrutura de uma `Page` nativa, sua `ActionBar` e o corpo das páginas. Layouts usam componentes e slots do NativeScript-Vue, com as mesmas entradas, guards e histórico nativos. Nenhum runtime do Nuxt, Vue Router ou WebView é adicionado.

## Um responsável por Page e ActionBar

O layout selecionado monta a **única `Page` raiz** daquela entrada e sua **única `ActionBar` opcional**, diretamente dentro da Page. Seu slot padrão renderiza o destino uma vez. O componente da rota fornece o corpo, sem outra `Page` ou `ActionBar`.

```vue
<!-- layouts/Default.vue -->
<script setup lang="ts">
import { useRoute } from 'vue-router-ns'

const route = useRoute()
</script>

<template>
  <Page>
    <ActionBar :title="String(route.meta.title ?? 'Meu app')" />
    <GridLayout padding="16">
      <slot />
    </GridLayout>
  </Page>
</template>
```

```vue
<!-- pages/Account.vue: conteúdo para um layout configurado -->
<script setup lang="ts">
import { ref } from 'nativescript-vue'

const name = ref('')
</script>

<template>
  <StackLayout>
    <Label text="Conta" />
    <TextField v-model="name" hint="Seu nome" />
  </StackLayout>
</template>
```

Coloque ActionItems, botões de navegação e propriedades nativas da Page no layout. Ele pode usar `useRoute().meta` da entrada para escolher título e ações. Layouts Nuxt para navegador e marcação HTML não são convertidos em views nativas.

## Registre e selecione explicitamente

```ts
import { createRouter } from 'vue-router-ns'

const router = createRouter({
  layouts: {
    default: () => import('./layouts/Default.vue'),
    compact: () => import('./layouts/Compact.vue'),
  },
  defaultLayout: 'default',
  routes: [
    {
      path: '/account',
      component: () => import('./pages/Account.vue'),
      meta: { title: 'Conta' },
    },
    {
      path: '/preview',
      component: () => import('./pages/PreviewBody.vue'),
      meta: { layout: 'compact', title: 'Prévia' },
      modal: true,
    },
    {
      path: '/legacy',
      component: () => import('./pages/LegacyPage.vue'),
      meta: { layout: false },
    },
  ],
})
```

`layouts` aceita componentes ou factories, incluindo imports lazy de `.vue`. O registro é capturado na criação do router. `defaultLayout` é `false` até ser definido explicitamente: registrar um componente chamado `default` não o ativa sozinho. `meta.layout` escolhe um nome registrado ou `false` para não usar layout. Sem layout selecionado, o destino mantém o contrato atual e monta sua própria `Page` raiz, como `LegacyPage.vue` no exemplo.

Metadados são mesclados do pai para o filho. O filho herda o layout, salvo quando define outro nome ou `false`. A seleção e o carregamento acontecem após os guards de entrada e middleware, junto do carregamento do componente, antes de `beforeResolve`; escolha o layout no registro da rota ou em um guard anterior. Um padrão desconhecido falha na criação do router. Um nome de rota desconhecido ou import com erro rejeita a navegação e chega a `onError()` antes de montar uma página nativa. Imports que falharam podem ser tentados novamente.

Esta API de runtime não descobre arquivos automaticamente. Rotas por arquivos e integração de build continuam sendo entregas separadas do roadmap; layouts já funcionam com arrays explícitos de rotas.

## Ciclo de vida e comportamento nativo

O código do layout pode ficar em cache, mas **cada entrada nativa recebe suas próprias instâncias do layout e do destino**. Refs locais não são compartilhados entre visitas, incluindo caminhos repetidos. Uma entrada coberta continua montada; voltar revela sua Page e seu estado existentes. Remover ou substituir a entrada desmonta seu layout e conteúdo junto da página nativa.

Os dois componentes recebem o mesmo `useRoute()` da entrada, `useRouter()` da pilha e host nativo. Props da rota e `props` da navegação vão para o destino. Hooks de ativação, leave guards, resultados de modais e foco de acessibilidade usam o ciclo de vida existente. Um guard registrado no layout pode proteger aquela entrada como um guard no conteúdo.

Layout e conteúdo compartilham os registros de hooks da entrada: dê chaves distintas a `usePageState()` e instale apenas um `useNavigationFocus()` responsável por ela. Seus alvos podem estar em qualquer um dos componentes. Os limites nativos de gestos continuam valendo; veja [guards](./guards) e [acessibilidade](./accessibility).

O layout pertence a uma página, enquanto `RouterTabs`, `RouterDrawer` e `RouterSplitView` são containers persistentes do app. Mantenha esses containers fora do layout da página. Selecionar outro layout não deve criar outro Frame, substituir a barra de abas nem achatar a pilha.

## Mudanças, HMR e diagnósticos

O layout escolhido fica fixo quando a entrada é criada. Alterar os metadados de uma rota ou o `meta.layout` de uma entrada viva não troca sua Page nativa. Para mostrar outro layout, navegue para outra entrada ou substitua a atual explicitamente (`force: true` ao substituir o mesmo caminho). Alterar o registro ou `defaultLayout` exige criar outro router; não há API de mutação dinâmica do registro.

Em desenvolvimento, HMR de script do layout ou do destino usa a substituição nativa de Page existente no NativeScript-Vue. Se outra página cobre a entrada no mesmo Frame, a substituição aguarda o retorno. Se a entrada for descartada, o reload pendente também é descartado. A identidade da entrada e o histórico são mantidos; remontar pode reiniciar refs locais do setup. Atualizações apenas de template seguem o HMR normal do Vue.

Diagnósticos em desenvolvimento identificam falta de Page raiz, Page aninhada no destino, ActionBars conflitantes/fora de posição e slot omitido/repetido. São avisos de autoria, não um renderer de produção nem um mecanismo de correção: árvores nativas inválidas continuam sem suporte e podem ser rejeitadas pelo NativeScript-Vue/Core. Mantenha uma Page raiz pertencente ao layout e renderize seu slot padrão uma vez.
