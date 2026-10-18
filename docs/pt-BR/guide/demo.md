# Veja o router no aparelho

Estes clipes foram gravados no app de e-mail NativeScript-Vue de [`demo/`](https://github.com/rafaelaugustos/vue-router-ns/tree/master/demo), em simuladores iOS 26 e iPadOS 26 e um emulador Android 16. O guia de cada funcionalidade inclui sua gravação junto do código. O app usa mensagens de exemplo locais; não se conecta a um serviço de e-mail.

Os clipes não têm áudio, repetem enquanto estão visíveis e têm controles de reprodução. Com Reduzir Movimento ativado, esperam você dar play.

## Abas com históricos independentes

Abra uma mensagem, troque de aba e volte para a mesma mensagem. Toque na aba selecionada novamente para voltar à raiz. [Configure as abas nativas](./tabs).

<div class="clips">
<Clip name="ios-tabs" caption="Abas do UIKit no iPhone, incluindo o retorno à raiz ao selecionar de novo." />
<Clip name="android-tabs" aspect="9 / 20" caption="A mesma navegação com abas do Material no Android." />
</div>

<Clip name="ipad-tabs" :width="480" aspect="3 / 4" caption="A sidebar do UIKit seleciona as mesmas pilhas nomeadas no iPad." />

## Push, voltar e lista/detalhe

O caminho no rodapé é a pilha do router ao vivo. Abrir outra mensagem adiciona uma entrada; Back to inbox remove os detalhes em uma navegação. Uma janela larga mantém a lista visível. [Navegação](./navigating) · [Lista e detalhe](./split-view).

<div class="clips">
<Clip name="ios-navigation" caption="Abra duas mensagens e volte à caixa de entrada no iPhone." />
<Clip name="ipad-split" :width="360" aspect="3 / 4" caption="Abra mensagens no painel de detalhes enquanto a caixa de entrada continua visível no iPad." />
</div>

## Sheets nas duas plataformas

Compose usa uma sheet do UIKit com detents no iOS e uma bottom sheet do Material no Android. Ambas contêm uma página roteada com sua própria barra de navegação nativa. [Modais e resultados](./modals).

<div class="clips">
<Clip name="ios-sheet" caption="Abra, expanda e feche a sheet de composição no iPhone." />
<Clip name="android-sheet" aspect="9 / 20" caption="Abra a sheet do Material e feche com o Voltar do sistema." />
</div>

## Prévia antes de navegar

Uma pressão longa mostra a prévia da mensagem e suas ações. Tocar na prévia abre a rota. [Menus de contexto](./context-menus).

<Clip name="ios-context-menu" caption="A prévia nativa do UIKit e a página da mensagem aberta a partir dela." />

## Guards e restauração de formulário

Account exige uma sessão. O guard redireciona para o login, e digitar um nome ativa um guard de saída. No Android, esse formulário também pode sobreviver ao encerramento do processo em segundo plano. [Guards](./guards) · [Restauração](./restore).

<div class="clips">
<Clip name="ios-guards" caption="Stay mantém o nome digitado; Leave permite fechar a página." />
<Clip name="android-restore" aspect="9 / 20" caption="Digite um nome, coloque o demo em segundo plano, encerre seu processo e reabra com o formulário restaurado." />
</div>

## Busca e drawer nativos

A busca filtra a página atual sem adicionar rotas. O drawer do Android usa a política de links do router para abrir destinos e fecha antes que uma página saia da pilha. [Busca nativa](./native-bars) · [Drawer](./drawer).

<div class="clips">
<Clip name="ios-search" caption="A página controla seu campo de busca nativo e a consulta." />
<Clip name="android-drawer" aspect="9 / 20" caption="Selecione Settings pelo drawer e depois feche o drawer com o Voltar do sistema." />
</div>

## Rode o mesmo app

Instale a [CLI do NativeScript](https://docs.nativescript.org/setup/) e compile o router local a partir da raiz do repositório:

```sh
npm install
npm run build
cd demo
npm install
ns run ios
# ou: ns run android
```

O demo resolve `vue-router-ns` pelo diretório `dist` local. Use `npm run dev` em outro terminal enquanto altera o router. Veja no [README do demo](https://github.com/rafaelaugustos/vue-router-ns/blob/master/demo/README.md) as APIs usadas por cada página.
