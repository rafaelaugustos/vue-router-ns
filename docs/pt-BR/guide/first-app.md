# Crie seu primeiro app

Construa o **Pocket notes**: busque em uma lista pequena, abra uma nota, edite em um modal nativo e receba o texto salvo. Um leave guard protege o rascunho. O Back retorna à mesma lista, com a busca preservada.

O tutorial usa rotas explícitas e APIs públicas. Pressupõe conhecimento básico de componentes Vue e um [projeto NativeScript-Vue preparado](./install). As notas são fictícias e ficam em memória; o exemplo não implementa persistência, autenticação ou backend.

<Clip name="first-app" caption="Pocket notes em simulador iOS 26: busca preservada, editor modal nativo, cancelamento recusado e resultado salvo. O mesmo código do tutorial executa no demo." />

## 1. Crie os arquivos

Depois de instalar o router, coloque estes **sete arquivos completos** no diretório `src` do app. Substitua a entrada e a raiz do starter pelos arquivos abaixo; mantenha seus recursos nativos e configuração de build. O código é incorporado diretamente da [fonte executável do tutorial](https://github.com/rafaelaugustos/vue-router-ns/tree/main/demo/src/tutorial), então todos os idiomas usam a mesma implementação. Os textos da interface do exemplo estão em inglês.

```text
src/
  app.ts
  App.vue
  router.ts
  notes.ts
  pages/
    Home.vue
    Note.vue
    Edit.vue
```

O `RouterView` da raiz cria um Frame nativo. Cada componente de rota renderiza uma Page. Não envolva esse RouterView em outro Frame.

**`src/router.ts`** — `/` contém a lista, `:id` seleciona uma nota e `modal: true` dá ao editor seu próprio Frame. `props: true` passa os params da rota para a página.

<<< ../../../demo/src/tutorial/router.ts

**`src/app.ts`** — instale o router antes de iniciar o app.

<<< ../../../demo/src/tutorial/app.ts

**`src/App.vue`** — mantenha o container de navegação montado.

<<< ../../../demo/src/tutorial/App.vue

## 2. Adicione os dados e a lista

**`src/notes.ts`** — dados compartilhados pela lista, detalhe e editor. Salvar altera esse array reativo; não grava em disco.

<<< ../../../demo/src/tutorial/notes.ts

**`src/pages/Home.vue`** — `query` pertence a esta página. Abrir uma nota cobre Home; não destrói a página nem sua busca.

<<< ../../../demo/src/tutorial/pages/Home.vue

A lista com dois itens usa Buttons nativos comuns. Em um catálogo grande, use uma lista virtualizada. O TextField é uma busca simples para começar; [busca nativa no header](./native-bars) é uma evolução posterior.

## 3. Abra o detalhe e espere um resultado

**`src/pages/Note.vue`** — a prop `id` pertence àquela entrada da rota. `pushForResult<string>` espera pelo editor; fechar sem resultado devolve `undefined`. A verificação explícita também permite salvar uma string vazia intencionalmente.

<<< ../../../demo/src/tutorial/pages/Note.vue

O detalhe de origem continua montado enquanto o modal está aberto. O tipo genérico descreve o contrato entre essas duas páginas; não valida dados arbitrários em runtime.

## 4. Proteja o rascunho e salve

**`src/pages/Edit.vue`** — o rascunho é local ao editor. O leave guard condicional pergunta apenas enquanto o texto difere da nota salva. Salvar permite a saída temporariamente e devolve o rascunho por `back({ result })`.

<<< ../../../demo/src/tutorial/pages/Edit.vue

Cancel solicita navegação passando pelo guard. **Keep editing** mantém o editor montado com o rascunho. **Discard** fecha sem alterar a nota. Salvar devolve o valor ao detalhe, onde o código da aplicação atualiza `notes`.

Leave guards tratam a remoção de uma página, não sua cobertura por outra. No iOS, um guard ativo altera quais gestos podem fechar ou remover a página. Consulte a [matriz de plataformas dos guards](./guards) em vez de presumir que todo gesto pode esperar um diálogo.

## 5. Execute e confira o fluxo completo

No projeto NativeScript-Vue que você criou:

```sh
ns run ios
# ou:
ns run android
```

1. Digite `coast` em **Find a note**. Apenas **Along the coast** permanece.
2. Abra a nota e toque em **Edit in a modal**.
3. Altere o texto. Toque em **Cancel → Keep editing** e confirme que o rascunho continua lá.
4. Toque em **Save note**. O detalhe original mostra o texto devolvido.
5. Use o Back nativo. Home ainda contém `coast` e a lista continua filtrada.
6. Abra o editor de novo, altere o texto e escolha **Cancel → Discard**. O último texto salvo permanece inalterado.

Se preferir a versão do repositório, siga a [preparação do checkout/recursos](./native-showcase#run-from-a-checkout) e execute `npm run tutorial:ios` ou `npm run tutorial:android` no diretório `demo`. Passe `-- --device <id>` para selecionar o aparelho. O tutorial usa o ID do demo, então sua instalação substitui a outra entrada nesse aparelho.

## O que construir depois

Agora você tem uma pilha preservada, uma pilha modal, um rascunho local e um resultado tratado pela aplicação. Reveja o [modelo interativo de pilhas](./mental-model) para separar esses ciclos de vida.

Continue com o [Fieldnotes](./native-showcase) para adicionar drawer, busca nativa da página, ações compartilhadas entre header/menu e foco explícito de navegação. Escolha [abas ou split](./capabilities) quando o app precisar de outra estrutura. Adicione [armazenamento persistente/restauração](./restore) quando o estado precisar sobreviver ao encerramento do processo.
