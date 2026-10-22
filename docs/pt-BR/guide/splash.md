# Splash sobre a primeira página

Mantenha o splash de abertura acima do `<RouterView>` para que a primeira página nativa possa montar por baixo dele. Remover a camada revela essa mesma página, sem adicionar uma entrada de splash ao histórico de navegação.

Se o splash for uma rota, chamar `replace()` cria o destino quando o splash está saindo. No Android, esse trabalho pode disputar a thread de UI com a animação de saída. Uma camada sobreposta permite terminar a criação da página antes de iniciar a animação de saída; ela não transfere a inicialização para outra thread.

## Mantenha o RouterView montado

Depois da [instalação normal do router](./install), salve este exemplo como `App.vue` e o próximo componente como `Splash.vue` no mesmo diretório:

<<< ../../snippets/SplashApp.vue

Os dois filhos ocupam a mesma célula do `GridLayout`. O splash vem por último, acima do router. O layout que envolve a página impede interação por toque e navegação pelo leitor de tela no conteúdo coberto até a remoção do splash.

Só a camada sobreposta tem `v-if`. Não coloque `<RouterView>` atrás de `v-if="!showSplash"`: isso adiaria a criação da página até o splash desaparecer. Também não espere `router.isReady()` antes de `createApp(App).use(router).start()`: o router precisa que sua view monte primeiro.

## Revele a página

Este componente espera a navegação inicial, faz o fade da camada e emite `done`. Ele permanece visível com uma mensagem de erro se a inicialização lançar uma exceção ou o guard inicial deixar o app sem destino:

<<< ../../snippets/Splash.vue

O fade é uma animação do aplicativo. Passe `:fade="false"` quando a preferência de movimento reduzido do app estiver ativa; a [política de movimento](./accessibility#reducao-de-movimento) do router controla transições de rotas, não essa animação personalizada.

`isReady()` espera a navegação inicial, não todas as abas ocultas nem as requisições de rede da própria página. Inclua qualquer inicialização obrigatória do app na condição de prontidão. Para onboarding, emita `done` quando a pessoa concluir as etapas; mantenha `<RouterView>` montado durante todo o processo.

## Combine com a tela de abertura do iOS

Defina `iosOverflowSafeArea="true"` no layout raiz da camada para que o fundo se estenda além da área segura. Use o mesmo fundo, imagem, tamanho e posicionamento de `App_Resources/iOS/LaunchScreen.storyboard` para evitar um salto visual quando o iOS entregar o controle ao app. Confira o alinhamento nos tamanhos de iPhone e iPad suportados.

Essa camada aparece depois que o NativeScript inicia. Ela complementa a tela de abertura do sistema operacional; não substitui a tela exibida antes de o JavaScript executar. `iosOverflowSafeArea` é específico do iOS.

## Os guards continuam rodando por baixo

A navegação inicial, os redirects e os [guards](./guards) executam normalmente enquanto o splash está visível. Ele oculta a página visualmente; não adia a autenticação nem ignora os guards. Redirecione uma visita inicial sem autenticação para uma página de login utilizável. O splash não é uma barreira de controle de acesso.

Não é preciso mudar a API do router, criar outra rota nem chamar `push()` ou `replace()` para remover a camada. Voltar percorre o histórico real do app e não traz o splash de volta.
