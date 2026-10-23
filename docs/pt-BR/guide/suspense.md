# Composição nativa com Suspense (experimental)

Mantenha a **Page roteada síncrona** e coloque o `Suspense` do Vue ao redor do
conteúdo assíncrono. Page, ActionBar, transição e histórico continuam sob controle
do router nativo. Esta receita é opcional e não adiciona componente nem wrapper
automático ao router.

## Primeiro, a compatibilidade do renderer

Com **NativeScript-Vue 3.1.2 / Vue 3.5.44**, o Suspense original lança
`No known component for element div.` O Vue pede ao renderer um container oculto
para preparar o conteúdo; esse elemento não está registrado. Exportar `Suspense`
não basta para torná-lo utilizável nas páginas nativas.

O exemplo registra explicitamente esse nome como layout nativo antes de iniciar o app:

```ts
import { GridLayout } from '@nativescript/core'
import { getViewMeta, registerElement } from 'nativescript-vue'

registerElement('div', () => GridLayout, getViewMeta('GridLayout'))
```

Esse é um **registro de compatibilidade global ao app**, feito com APIs públicas
do renderer. O nome deve estar livre; não sobrescreva outro registro nem execute
a chamada em cada página. O Vue prepara a árvore pendente em um GridLayout nativo
desconectado e depois move o ramo resolvido para a árvore visível. Não usa HTML,
renderização de navegador nem WebView.

Use a receita apenas com versões validadas. O Suspense do Vue é experimental,
e o nome desse container é um detalhe de implementação do runtime testado.
Reavalie a adaptação ao atualizar qualquer renderer; uma implementação nativa
futura pode dispensá-la. O comportamento original e a receita adaptada são
verificados separadamente no [relatório de compatibilidade](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-suspense.md).

## Consuma o loader explicitamente

Declare `productData` pelo [carregamento de dados da rota](./data-loading).
A rota inicia a requisição após autorização. O filho consome a tentativa já
existente daquela entrada:

```vue
<!-- ProductContent.vue -->
<script setup lang="ts">
import { useRouteData } from 'vue-router-ns'
import { productData } from './product-data'

const product = useRouteData(productData)
const ready = product.ready
await ready
const current = product.ready === ready
if (current && product.status.value === 'error') throw product.error.value
const data = current ? product.data.value : undefined
</script>

<template>
  <StackLayout v-if="data">
    <Label :text="data.title" />
    <Label :text="'$' + data.price" />
  </StackLayout>
</template>
```

`ready` resolve em sucesso, erro **e cancelamento**. Consulte o estado; resolver
não significa sucesso. O `await` no setup do filho é a dependência assíncrona;
retornar uma Promise no loader, sozinho, não suspende um componente Vue.
A comparação de identidade descarta uma tentativa substituída. O filho não busca novamente. `data` guarda intencionalmente o resultado dessa
tentativa, permitindo manter o conteúdo anterior durante um timeout posterior.

A página síncrona captura erros e controla o retry explícito:

```vue
<script setup lang="ts">
import { onErrorCaptured, ref } from 'nativescript-vue'
import { useRouteData } from 'vue-router-ns'
import ProductContent from './ProductContent.vue'
import { productData } from './product-data'

const product = useRouteData(productData)
const error = ref(false)
const attempt = ref(0)
onErrorCaptured(() => {
  error.value = true
  return false
})
function retry() {
  // Invalide o cache do app aqui se ele mantiver a requisição que falhou.
  void product.reload()
  error.value = false
  attempt.value++
}
</script>

<template>
  <Page>
    <ActionBar title="Produto" />
    <StackLayout padding="24">
      <Label text="Detalhes do produto" />
      <StackLayout v-if="error">
        <Label text="Não foi possível carregar. Tente novamente." />
        <Button text="Tentar novamente" @tap="retry" />
      </StackLayout>
      <Suspense v-else :timeout="0">
        <ProductContent :key="attempt" />
        <template #fallback>
          <StackLayout>
            <ActivityIndicator :busy="true" />
            <Label text="Carregando produto…" />
          </StackLayout>
        </template>
      </Suspense>
    </StackLayout>
  </Page>
</template>
```

Use uma raiz nativa por slot. Capture erros em um pai síncrono da boundary,
renderize uma interface de erro separada e retorne `false` para erros tratados.
O fallback de carregamento do Suspense não é um tratador de erros. Registre
injeções e hooks antes do `await` em um `async setup()` comum; o await no nível
superior compilado restaura o contexto do Vue, mas não muda quem controla a requisição.

## Ciclo de vida do conteúdo

| Caso                                                | Contrato                                                                                                                          |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Primeiro filho pendente                             | Mostra fallback nativo dentro da Page existente.                                                                                  |
| Resolução                                           | Substitui o fallback; Page, ActionBar e histórico continuam intactos.                                                             |
| Apenas `reload()`                                   | Não executa novamente o setup já montado nem mostra fallback automaticamente.                                                     |
| Trocar a chave da raiz do slot padrão               | Cria outro filho assíncrono. `timeout="0"` mostra fallback imediatamente; um timeout positivo mantém o ramo anterior até expirar. |
| Novo conteúdo assíncrono abaixo de uma raiz mantida | Não faz a boundary externa voltar automaticamente ao estado pendente. Use uma boundary interna explícita quando necessário.       |
| `<Suspense suspensible>` aninhado                   | A boundary interna participa do controle de dependências assíncronas do pai.                                                      |
| Página coberta ou aba inativa                       | A requisição pode terminar; resolver não seleciona a página.                                                                      |
| Voltar ou fechar modal                              | O router cancela a publicação; o Vue descarta a subárvore removida.                                                               |
| Cancelar o gesto nativo de voltar                   | Mantém Page, filho pendente e requisição.                                                                                         |

O exemplo registra os eventos `pending`, `fallback` e `resolve`. Eles descrevem
o conteúdo Vue, não a conclusão da navegação nativa. O [guia do Vue](https://vuejs.org/guide/built-ins/suspense.html)
define essas regras; a receita não oferece renderização concorrente nem APIs de
transição do React.

O app controla cache e rede. Duas páginas podem aguardar uma requisição; remover
uma não deve abortar o trabalho compartilhado. Um setup assíncrono continua sendo
JavaScript e pode continuar após o descarte do componente. Proteja efeitos
colaterais e use o contrato de cancelamento do loader para trabalho exclusivo da
entrada. Não navegue ao concluir uma requisição para publicar numa página removida.

## Page, Deferred e acessibilidade

Um Suspense ao redor de `RouterView` não envolve os apps de página montados
separadamente. Não torne a Page assíncrona, coloque a Page dentro do fallback,
nem envolva todo o navegador nativo com esta receita. Imports de rota carregam
código antes da apresentação; loaders iniciam dados; Suspense aguarda um
componente de conteúdo assíncrono. São três etapas distintas.

`Deferred` espera a ativação nativa antes de montar o conteúdo, não a rede.
Coloque Suspense **dentro** de Deferred quando precisar dos dois comportamentos;
o loader pode estar executando enquanto o filho ainda espera para montar.

Mantenha ActionBar e um título acessível fora do conteúdo que muda. O exemplo usa
`useNavigationFocus` com esse título estável. Não move o foco novamente quando o
HTTP termina nem adiciona animação ao conteúdo; a política nativa de movimento
continua com o router. A identidade da Page e do título é verificada automaticamente;
isso não significa que os anúncios de VoiceOver/TalkBack tenham sido auditados
manualmente. A receita não introduz outro layout de safe area ou teclado.

## Exemplo nativo

O [exemplo completo](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/testing/suspense-app.ts)
inclui o teste negativo do renderer original, o registro explícito, cache HTTP do
app, filhos com setup assíncrono/SFC/import dinâmico e verificações de ciclo de vida.
Veja [comandos e escopo testado](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-suspense.md).

<div class="clips">
<Clip name="ios-suspense" caption="iOS: conteúdo pendente, erro capturado e retry dentro da mesma Page nativa." />
<Clip name="android-suspense" aspect="9 / 20" caption="Android: Suspense do Vue com container nativo explícito e dados compartilhados da rota." />
</div>
