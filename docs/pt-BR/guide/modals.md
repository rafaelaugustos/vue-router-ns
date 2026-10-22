# Modais e resultados

Marque uma rota com `modal: true`, ou passe `ModalOptions` (`fullscreen`, `animated`, `cancelable`, `ios.presentationStyle`…):

```ts
{ path: '/compose', component: Compose, modal: { fullscreen: true } }
```

<div class="clips">
<Clip name="ios-sheet" caption="Compose abre em uma sheet nativa com alturas média e grande. Simulador iOS 26." />
<Clip name="android-sheet" aspect="9 / 20" caption="Compose abre em uma bottom sheet do Material; o Voltar do sistema a fecha. Emulador Android 16." />
</div>

`router.push('/compose')` apresenta a rota dentro do próprio frame, então ela tem uma ActionBar e a própria pilha. As páginas de dentro empurram dentro do modal. `router.back()` na primeira página do modal o fecha. Puxar para baixo, tocar fora ou apertar o botão de voltar do Android também fecham, passando pelos leave guards das páginas dele. O router acompanha e roda o `afterEach`.

O `push` também aceita `modal` como opção, para apresentar qualquer rota como modal independente do que o record diz.

## Sheets no iOS

Os sheets do iOS podem parar na altura média, na altura cheia ou numa fração da tela, mostrar um grabber, e manter a página de trás usável, como o Maps. Configure isso em `ios` nas opções do modal:

```ts
{
  path: '/filters',
  component: Filters,
  modal: {
    ios: {
      detents: ['medium', 'large'], // ou uma fração da tela: 0.4 (iOS 16)
      selectedDetent: 'medium', // a altura em que abre
      largestUndimmedDetent: 'medium', // a página de trás continua usável até aqui
      grabber: true,
      cornerRadius: 24,
    },
  },
}
```

O sheet é configurado antes de ser apresentado, então abre na altura certa. O `push` pode passar as mesmas opções em `modal.ios`, mescladas com as do record. O Android as ignora; ele tem [bottom sheets](#bottom-sheets-no-android) próprios.

## Bottom sheets no Android

O Android não tem detents. O bottom sheet do Material tem estados de repouso: recolhido numa altura de espiada, meio expandido numa fração da tela, ou expandido até o conteúdo. Defina `sheet` em `android` nas opções do modal para apresentar a rota em um, com `true` para os padrões do Material:

```ts
{
  path: '/filters',
  component: Filters,
  modal: {
    ios: { detents: ['medium', 'large'] },
    android: {
      sheet: {
        peekHeight: 320, // a altura recolhida, em pixels independentes de densidade
        state: 'expanded', // ou 'collapsed' (o padrão) ou 'halfExpanded'
        fitToContents: false, // necessário para o estado meio expandido
        halfExpandedRatio: 0.6,
        skipCollapsed: true, // esconder a partir de expandido pula a parada recolhida
        height: 520, // a altura do conteúdo; por padrão, a altura que o conteúdo tiver
      },
    },
  },
}
```

A rota continua com um Frame próprio, então as páginas empurram dentro do sheet, `pushForResult()` funciona e `router.back()` na primeira página o fecha. Arrastar o sheet para fora, tocar fora ou apertar voltar o fecham passando pelos leave guards: enquanto um guard está ativo o sheet não pode ser arrastado para fora, e um toque fora ou o voltar perguntam ao guard. O Material não tem callback para recusar o gesto de ocultar: um sheet bloqueado ainda pode recolher, mas não pode ser arrastado até o estado oculto. `cancelable: false` impede o usuário de fechá-lo. O `push` mescla o seu `modal.android.sheet` com o do record, como no `ios`.

Use um `ScrollView` nativo para conteúdo longo. O `height` do sheet limita a área visível, e a rolagem aninhada nativa permite rolar seu conteúdo. O voltar primeiro fecha um teclado aberto antes de atuar no histórico do sheet.

O sheet usa o tratamento de voltar do router para executar os guards antes do fechamento. A animação interativa de predictive back do sheet Material não é suportada. Veja o [relatório de validação nativa](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-bottom-sheets.md) para os comportamentos conferidos e limites de plataforma.

Dentro das páginas dele, `useNativeHost()` reporta `kind: 'bottom-sheet'`, e `native` é o Frame.

::: warning Adicione o Material aos builds de release
O runtime Android do NativeScript só inclui `com.google.android.material` em builds de debug. Adicione-o ao `App_Resources/Android/app.gradle` antes de publicar um sheet:

```groovy
dependencies {
  implementation "com.google.android.material:material:1.12.0"
}
```

Sem ele, o `push` rejeita com um erro que diz isso, em vez de apresentar um diálogo comum. `supportsBottomSheets()` informa em runtime.
:::

## Recebendo um resultado de volta

<Clip name="ios-modal-result" caption="Reply abre o modal; Send devolve o texto à mensagem de origem com pushForResult. Simulador iOS 26." />

Uma página pode devolver um valor para quem a abriu. Funciona com modais e com páginas comuns:

```ts
// Message.vue
const reply = await router.pushForResult<string>('/compose')
if (reply) send(reply)
```

```ts
// Compose.vue
router.back({ result: text.value })
```

Se a página fecha de qualquer outro jeito (um swipe, o botão de voltar) ou um guard a impede de abrir, a promise resolve com `undefined`.

## Fechamento e versões

`cancelable: false` impede o fechamento pelo usuário (como back do Android na raiz do modal); o código ainda pode chamar `router.back()`, passando pelos guards. Uma página acima da raiz do modal ainda pode voltar dentro da pilha.

Sheets com alturas `'medium'` e `'large'` exigem iOS 15+; alturas fracionárias exigem iOS 16+. A apresentação precisa ser compatível com sheets. Opções `ios` são ignoradas no Android e opções `android` são ignoradas no iOS. O resultado de `pushForResult<T>()` não é validado em runtime: `T` descreve o contrato entre as páginas.
