# Barras e busca nativas

Use a `ActionBar` do NativeScript para títulos e ações reativos. Ela mantém a Toolbar/UINavigationBar, os delegates e o botão de voltar. No iOS, `iosLargeTitle="true"` habilita o título grande que recolhe ao rolar uma lista nativa. A ActionBar padrão do Android não oferece a mesma política de título grande.

## Busca da página

```vue
<script setup lang="ts">
import { ref } from 'nativescript-vue'
import { useNativeSearch } from 'vue-router-ns'

const query = ref('')
const search = useNativeSearch({ query, placeholder: 'Buscar mensagens' })
</script>

<template>
  <Page>
    <ActionBar title="Mensagens" iosLargeTitle="true">
      <ActionItem text="Buscar" ios.position="right" @tap="search.activate()" />
    </ActionBar>
    <!-- Filtre sua lista usando query. -->
    <Label :text="query" />
  </Page>
</template>
```

`useNativeSearch({ query, placeholder?, onSubmit?, ios?: { hidesWhenScrolling?, placement? } })` deve ser chamado uma vez no setup da página roteada. `query` é um ref gravável da aplicação: na página ele dura enquanto ela existir no histórico; em uma store pode durar além da remoção da página. Digitar não navega nem altera a query da rota. Navegue explicitamente em `onSubmit(query)` se necessário. `placeholder` aceita string, ref ou getter.

O retorno contém `active` (ref somente leitura), `activate(): boolean` e `dismiss(): boolean`. A ativação exige uma página carregada, atual no próprio Frame, na aba selecionada e sem modal cobrindo-a. Ao fechar, a busca mantém o texto e dispensa o teclado. Voltar à página não abre o teclado automaticamente. As duas colunas visíveis de um split podem ter buscas independentes. Um guard que recusa a saída mantém a busca.

| Plataforma | Apresentação                                                                                                                                                                                                                                                                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| iOS 11+    | `UISearchController` próprio no `UINavigationItem` da página. `ios.hidesWhenScrolling` vale `true` por padrão. `ios.placement` aceita `automatic`, `stacked`, `inline` ou `integrated` (iOS 26, na base da tela). Dentro de um `TabView` o padrão é `stacked`, sob o título: no iOS 26 o posicionamento automático coloca a barra na base, atrás da tab bar. |
| Android    | `SearchBar` do NativeScript (`androidx.appcompat.widget.SearchView`) como título temporário da ActionBar existente. Ao fechar, restaura o título anterior e mantém os ActionItems.                                                                                                                                                                           |

Um searchController existente é preservado: `activate()` retorna false e o build de desenvolvimento explica o conflito. Os bindings são removidos ao destruir a página/host ou substituir a página por HMR. Nenhum delegate global ou `backAction` do guard é substituído.

## Aparência

Prefira `color`, `backgroundColor`, `flat`, `title`, `titleView` e ActionItems da ActionBar. Para uma aparência exclusiva do UIKit, configure `standardAppearance` e `scrollEdgeAppearance` no **navigationItem da página**, com `UINavigationBarAppearance` (iOS 13+), em um handler de `loaded`. Evite alterar a barra compartilhada, delegates de navegação ou `backAction`. Preserve valores anteriores se mais de um recurso da aplicação modifica o mesmo item. O UIKit restaura o item da página anterior ao voltar ou cancelar o gesto.

Veja a [receita completa em inglês](/guide/native-bars), [ActionBar do NativeScript](https://docs.nativescript.org/ui/action-bar) e [ciclo de vida](./pages).
