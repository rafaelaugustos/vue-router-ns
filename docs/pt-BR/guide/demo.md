# Exemplos e vídeos por funcionalidade

Estes clipes foram gravados nos exemplos NativeScript-Vue de [`demo/`](https://github.com/rafaelaugustos/vue-router-ns/tree/main/demo), em simuladores e emuladores. O Airbnb NS reúne recursos de navegação em um app de acomodações; o app de e-mail e os exemplos específicos demonstram APIs individuais. Os dois apps usam dados locais de exemplo.

Os clipes não têm áudio, repetem enquanto estão visíveis e têm controles de reprodução. Com Reduzir Movimento ativado, esperam você dar play.

Escolha uma funcionalidade, veja o resultado e copie o trecho correspondente. Os exemplos usam componentes NativeScript e a tabela de rotas do demo. Em páginas roteadas, obtenha `router` com `useRouter()` no `<script setup>`; na configuração do app, use a instância criada com `createRouter()`. Importe os componentes do router de `vue-router-ns`. Os trechos de template entram no componente indicado, não substituem a configuração inicial do app.

[Instalação](./install) · [Transição a partir de um elemento](./transitions#card-com-routerlink) · [Demo completo](https://github.com/rafaelaugustos/vue-router-ns/tree/main/demo)

## Airbnb NS: um app de acomodações

<Clip name="ios-airbnb" :width="320" caption="Airbnb NS: abas nativas, zoom do card e retorno por gesto, prévias por toque longo e favoritos. Trecho editado de uma gravação no simulador iPhone 17 / iOS 26, com as animações na velocidade original." />

A gravação de 27 segundos mostra o app usando `vue-router-ns` 0.1.0-rc.2. Ele tem uma home em português com carrosséis horizontais, favoritos persistentes, abas nativas e páginas de detalhes que ocultam a barra inferior.

| No app                                          | Recurso do router                                                                                                                          |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Tocar na foto e voltar por gesto                | `RouterLink zoom`, com `SharedTransition` como alternativa                                                                                 |
| Pressionar um card                              | `RouterLink menu`: prévia UIKit e ação de favorito; menu popup no Android                                                                  |
| Explorar e Favoritos                            | Pilhas nomeadas de `RouterView`, `RouterTabs` nativo, badges e propriedades públicas de cor                                                |
| Abrir uma acomodação                            | `meta.tabBarVisibility: 'hidden'` nos hosts nativos compatíveis                                                                            |
| Aplicar filtros de busca                        | Sheet que devolve o resultado com `pushForResult()`                                                                                        |
| Carregar detalhes sem sobrecarregar a transição | Loader experimental com catálogo offline e `<Deferred>`                                                                                    |
| Retomar a navegação ao reabrir                  | `restore` e `usePageState()` para históricos, posição vertical, categoria e foto da galeria; o app persiste a aba selecionada e os filtros |

A gravação mostra as quatro primeiras linhas; busca e restauração após encerrar o processo são fluxos separados. Catálogo e fotos acompanham o app, e o botão de reserva mostra um resumo fictício. Viagens, mensagens e perfil são telas de exemplo ainda sem essas funcionalidades.

Após a [configuração da demo](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/README.md#airbnb-inspired-navigation-demo), execute em `demo/`:

```sh
npm run airbnb:ios
# ou: npm run airbnb:android
```

[Tabela de rotas](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/airbnb/router.ts) · [Abas nativas](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/airbnb/App.vue) · [Página da acomodação](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/airbnb/pages/Stay.vue) · [Código completo e limites por plataforma](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/README.md#airbnb-inspired-navigation-demo)

## Dados do produto, erro e retry

Declare um loader tipado na rota e mostre espera/erro/sucesso dentro da mesma Page nativa. Voltar e tentar novamente preservam a navegação; o cache do app pode compartilhar requisições entre entradas. [Exemplo completo e vídeos](./data-loading).

## Abrir uma página a partir de um card

<Clip name="ios-zoom" caption="O card abre a mensagem com o zoom do UIKit e recebe a transição de volta. Simulador iOS 26." />

O elemento tocado pode ser a origem do zoom nativo do UIKit. Use um único filho em `RouterLink`; no Android e em runtimes sem a API de zoom, a navegação usa a transição normal.

```vue
<RouterLink :to="{ name: 'message', params: { id: 1 } }" zoom>
  <StackLayout padding="24" borderRadius="16" backgroundColor="#dbeafe">
    <Label text="Ana" color="#1e3a8a" />
    <Label text="Lunch on Friday?" color="#1e3a8a" />
  </StackLayout>
</RouterLink>
```

[Exemplo completo: card, lista com `zoomFrom`, destino e rotas](./transitions#card-com-routerlink). O zoom requer iOS 18+ e suporte do runtime. No demo, abra Settings → Zoom from a card.

## Abas com históricos independentes

Abra uma mensagem, troque de aba e volte para a mesma mensagem. Toque na aba selecionada novamente para voltar à raiz. [Configure as abas nativas](./tabs).

<div class="clips">
<Clip name="ios-tabs" caption="Abas do UIKit no iPhone, incluindo o retorno à raiz ao selecionar de novo." />
<Clip name="android-tabs" aspect="9 / 20" caption="A mesma navegação com abas do Material no Android." />
</div>

<Clip name="ipad-tabs" :width="480" aspect="3 / 4" caption="A sidebar do UIKit seleciona as mesmas pilhas nomeadas no iPad." />

```vue
<RouterTabs sidebar>
  <RouterTab name="inbox" title="Inbox" icon="tray.fill">
    <RouterView name="inbox" initial="/" backToRootOnReselect />
  </RouterTab>
  <RouterTab name="settings" title="Settings" icon="gearshape.fill">
    <RouterView name="settings" initial="/settings" backToRootOnReselect />
  </RouterTab>
</RouterTabs>
```

No componente raiz do app. `sidebar` habilita a sidebar no iPad; cada `RouterView` mantém sua própria pilha. Navegar com `{ frame: 'settings' }` também seleciona essa aba. [Código completo](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/App.vue).

## Push, voltar e lista/detalhe

O caminho no rodapé é a pilha do router ao vivo. Abrir outra mensagem adiciona uma entrada; Back to inbox remove os detalhes em uma navegação. Uma janela larga mantém a lista visível. [Navegação](./navigating) · [Lista e detalhe](./split-view).

<div class="clips">
<Clip name="ios-navigation" caption="Abra duas mensagens e volte à caixa de entrada no iPhone." />
<Clip name="ipad-split" :width="360" aspect="3 / 4" caption="Abra mensagens no painel de detalhes enquanto a caixa de entrada continua visível no iPad." />
</div>

```ts
await router.push({ name: 'message', params: { id: 1 } })
await router.push({ name: 'message', params: { id: 2 } })
await router.backToRoot()
```

Em uma janela larga, substitua o `RouterView` da caixa de entrada por:

```vue
<RouterSplitView name="inbox" list="/" :breakpoint="840" :listWidth="320" />
```

Abaixo do breakpoint, lista e detalhe usam a navegação de uma coluna. Acima dele, a lista fica visível ao abrir detalhes. [Código completo](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/pages/Message.vue).

## Sheets nas duas plataformas

Compose usa uma sheet do UIKit com detents no iOS e uma bottom sheet do Material no Android. Ambas contêm uma página roteada com sua própria barra de navegação nativa. [Modais e resultados](./modals).

<div class="clips">
<Clip name="ios-sheet" caption="Abra, expanda e feche a sheet de composição no iPhone." />
<Clip name="android-sheet" aspect="9 / 20" caption="Abra a sheet do Material e feche com o Voltar do sistema." />
</div>

```ts
router.push('/compose', {
  modal: {
    ios: { detents: ['medium', 'large'], grabber: true },
    android: { sheet: { state: 'expanded', height: 520 } },
  },
})
```

Toque em Compose, arraste a sheet e feche com Cancel ou Voltar. Adicione Material ao build de release Android, como descrito no [guia](./modals). [Código completo](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/pages/Inbox.vue).

## Prévia antes de navegar

Uma pressão longa mostra a prévia da mensagem e suas ações. Tocar na prévia abre a rota. [Menus de contexto](./context-menus).

<Clip name="ios-context-menu" caption="A prévia nativa do UIKit e a página da mensagem aberta a partir dela." />

```vue
<RouterLink to="/messages/1" :menu="{ preview: MessagePreview, props: { id: 1 } }">
  <Label text="Lunch on Friday?" padding="24" />
</RouterLink>
```

Importe `MessagePreview` de `demo/src/components/MessagePreview.vue`. A prévia não adiciona uma página à pilha; tocar nela confirma a navegação. No Android, as mesmas opções abrem um menu, sem prévia ao vivo. [Código completo](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/pages/Inbox.vue).

## Guards e restauração de formulário

Account exige uma sessão. O guard redireciona para o login, e digitar um nome ativa um guard de saída. No Android, esse formulário também pode sobreviver ao encerramento do processo em segundo plano. [Guards](./guards) · [Restauração](./restore).

<div class="clips">
<Clip name="ios-guards" caption="Stay mantém o nome digitado; Leave permite fechar a página." />
<Clip name="android-restore" aspect="9 / 20" caption="Digite um nome, coloque o demo em segundo plano, encerre seu processo e reabra com o formulário restaurado." />
</div>

```ts
import { Dialogs } from '@nativescript/core'
import { ref } from 'nativescript-vue'
import { onBeforeRouteLeave, usePageState } from 'vue-router-ns'

const name = ref('')
onBeforeRouteLeave(() => Dialogs.confirm('Discard this draft?'), {
  when: () => name.value.trim() !== '',
})
usePageState<{ name: string }>('form', {
  save: () => ({ name: name.value }),
  restore: (saved) => {
    name.value = saved.name
  },
})
```

Vincule `name` a um `<TextField v-model="name" />`. Para persistir após o encerramento do processo, configure também [`restore.save` e `restore.load`](./restore). O guard de autenticação fica em [`demo/src/router.ts`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/router.ts). [Código completo](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/pages/Login.vue).

## Busca e drawer nativos

A busca filtra a página atual sem adicionar rotas. O drawer do Android usa a política de links do router para abrir destinos e fecha antes que uma página saia da pilha. [Busca nativa](./native-bars) · [Drawer](./drawer).

<div class="clips">
<Clip name="ios-search" caption="A página controla seu campo de busca nativo e a consulta." />
<Clip name="android-drawer" aspect="9 / 20" caption="Selecione Settings pelo drawer e depois feche o drawer com o Voltar do sistema." />
</div>

```ts
import { computed, ref } from 'nativescript-vue'
import { useNativeSearch } from 'vue-router-ns'

const query = ref('')
const messages = [{ subject: 'Lunch on Friday?' }, { subject: 'Release notes' }]
const search = useNativeSearch({ query, placeholder: 'Search messages' })
const filtered = computed(() =>
  messages.filter((message) =>
    message.subject.toLowerCase().includes(query.value.toLowerCase()),
  ),
)
```

Use `filtered` como `:items` de um `ListView` e chame `search.activate()` em um `ActionItem`. Para o drawer, no componente raiz, declare `const menuOpen = ref(false)` e use um botão para alterná-lo:

```vue
<RouterDrawer v-model:open="menuOpen">
  <template #drawer>
    <StackLayout>
      <Button text="Inbox" @tap="router.push('/')" />
      <Button text="Settings" @tap="router.push('/settings')" />
    </StackLayout>
  </template>
  <RouterView />
</RouterDrawer>
```

Este exemplo mínimo tem uma pilha. O demo completo combina drawer e abas; no iOS o conteúdo continua visível e o drawer é omitido. [Código completo](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/App.vue).

## Escolha as convenções por arquivos

O exemplo separado de coleção usa rotas geradas, layout nativo, middleware de autenticação e modal com resultado tipado. Os dois estilos usam o mesmo router nativo. [Configuração opcional e código](./file-routing).

<div class="clips">
<Clip name="ios-file-routing" caption="Rotas geradas no iOS: detalhe, resultado de modal e conta protegida." />
<Clip name="android-file-routing" aspect="9 / 20" caption="O mesmo fluxo da coleção em Pages nativas no Android." />
</div>

```text
src/pages/
  index.vue          → /
  messages/[id].vue  → /messages/:id
  compose.vue        → /compose
```

Escolha o plugin de [webpack ou Vite](./file-routing) para gerar essa tabela. Os exemplos de [layouts](./layouts) e [middleware](./middleware) mostram como adicionar convenções; declarar `routes` em TypeScript continua sendo uma opção independente. [Código completo](https://github.com/rafaelaugustos/vue-router-ns/blob/main/examples/file-routing/README.md).

## Receber um resultado de outra página

<Clip name="ios-modal-result" caption="Reply abre o modal; Send devolve o texto à mensagem de origem com pushForResult. Simulador iOS 26." />

Abra Reply em uma mensagem. Ao enviar, a resposta aparece na página que abriu o modal.

```ts
import { ref } from 'nativescript-vue'
import { useRouter } from 'vue-router-ns'

const router = useRouter()
const reply = ref<string>()
async function compose() {
  reply.value = await router.pushForResult<string>('/compose')
}
```

Na página Compose, chame `router.back({ result: text.value })`. Fechar sem enviar resolve com `undefined`. O tipo descreve o contrato entre as páginas. [Guia](./modals) · [Código completo](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/pages/Message.vue).

## Abrir um link na aba correta

<Clip name="ios-deep-link" caption="O sistema entrega vuerouterns://settings/account. Settings é selecionada e o guard abre o login. Simulador iOS 26." />

Na configuração do app, use os mesmos nomes de pilha de `RouterTabs`.

```ts
const router = createRouter({
  routes,
  links: {
    schemes: ['https', 'vuerouterns'],
    hosts: ['vue-router-ns.rafaelaugusto.dev'],
    frame: (to) => (to.path.startsWith('/settings') ? 'settings' : 'inbox'),
  },
})

await router.openLink('vuerouterns://messages/1')
```

Teste também `vuerouterns://settings/account` sem sessão: o guard deve abrir o login na aba Settings. Para entregar URLs pelo sistema, configure o scheme/associação de domínio nativos; `openLink()` testa o encaminhamento dentro do app. [Configuração e exemplos de notificações](./deep-links).

## Atalhos no ícone do aplicativo

<Clip name="ios-shortcuts" caption="Pressione o ícone do demo e escolha New message para abrir a rota pelo atalho nativo. Simulador iOS 26." />

Publique os destinos depois que o app estiver pronto, como em `demo/src/app.ts`.

```ts
router.setShortcuts([
  {
    id: 'compose',
    title: 'New message',
    to: '/compose',
    icon: { ios: 'square.and.pencil' },
  },
  { id: 'settings', title: 'Settings', to: '/settings' },
])
```

Pressione o ícone do app no launcher/SpringBoard e escolha New message. A rota passa pelos mesmos guards. Use `setShortcuts([])` para remover atalhos dinâmicos ao sair da conta. [Limites e atalhos fixados](./deep-links).

## Anexar um documento do sistema

<Clip name="ios-document-picker" caption="Attach abre o seletor de documentos do iOS. Cancelar retorna ao formulário com Picker cancelled, sem adicionar uma rota." />

No setup de uma página roteada, prepare o picker e chame `attach()` pelo botão Anexar.

```ts
import { ref } from 'nativescript-vue'
import { createDocumentPicker, useNativeFlow } from 'vue-router-ns'

const attachments = ref<string[]>([])
const picker = useNativeFlow(createDocumentPicker())
async function attach() {
  const outcome = await picker.run({ types: ['application/pdf'], multiple: true })
  if (outcome.status === 'completed') attachments.value = outcome.value.uris
  else if (outcome.status === 'failed') console.error(outcome.error)
}
```

Escolha um PDF ou cancele. A página permanece na mesma entrada do histórico; cancelar mantém a seleção anterior. URIs não garantem permissão permanente: leitura e persistência de acesso pertencem ao app. [Picker completo e ciclo de vida](./native-flows).

## Devolver o foco ao botão que abriu o modal

Com VoiceOver ou TalkBack ativado, abra e feche Reply. O foco deve retornar ao botão de origem.

```ts
import { useNavigationFocus, useRouter } from 'vue-router-ns'

const router = useRouter()
const focus = useNavigationFocus({ initial: 'heading', return: 'reply' })
async function reply() {
  focus.remember('reply')
  await router.pushForResult('/compose')
}
```

```vue
<Label id="heading" text="Message" accessible="true" />
<Button id="reply" text="Reply" @tap="reply" />
```

Coloque os controles dentro da página. O foco é de acessibilidade, não de teclado. O padrão `motion: 'system'` respeita movimento reduzido. [Exemplo completo e limites](./accessibility).

## Reconstruir uma pilha com retorno previsível

Use uma lista de destinos quando a entrada do usuário exigir um histórico específico.

```ts
await router.setStack(['/', '/messages/1', '/messages/2'])
await router.back()
await router.backToRoot({ animated: false })
```

Depois de `setStack`, Voltar abre a mensagem 1; o último comando retorna à caixa de entrada sem animação. Guards podem interromper a sequência, e etapas já concluídas permanecem. [Definindo a pilha](./stack).

## Mais exemplos completos

- [Comandos de teclado](./keyboard): Cmd/Ctrl, Escape e escopo por página.
- [Rotas tipadas](./typed-routes): nomes e parâmetros verificados pelo TypeScript.
- [Destinos nativos](./native-destinations): integrar UIViewController e Fragment (experimental).
- [Predictive back](./android-back): prévia e cancelamento do gesto no Android.
- [Diagnóstico](./diagnostics): observar falhas, transições e histórico.

Os vídeos são gravações de navegação nativa. O exemplo de foco inclui passos para VoiceOver/TalkBack: um vídeo sem áudio não demonstra o anúncio do leitor de tela.

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

O demo resolve `vue-router-ns` pelo diretório `dist` local. Use `npm run dev` em outro terminal enquanto altera o router. Veja no [README do demo](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/README.md) as APIs usadas por cada página.
