# Restaurando a pilha depois que o app é morto

O Android mata apps em segundo plano o tempo todo, e traz um app nativo de volta na tela em que ele estava, com a back stack. Aqui toda página é um path, então a pilha é uma lista de strings e o router pode salvá-la para você:

```ts
import { ApplicationSettings } from '@nativescript/core'

const router = createRouter({
  routes,
  restore: {
    save: (state) => ApplicationSettings.setString('stacks', JSON.stringify(state)),
    load: () => JSON.parse(ApplicationSettings.getString('stacks', 'null')),
  },
})
```

O `save` roda depois de cada navegação com os paths de cada `<RouterView>` nomeado, e com `null` quando o app sai por conta própria, para um início depois que o usuário saiu continuar limpo. Quando um `<RouterView>` monta, o router chama o `load` uma vez (pode ser assíncrono) e reconstrói a pilha salva sem animar, passando pelos guards, então uma página que precisa de sessão ainda manda você para o login.

Saves mais velhos que `maxAge` (30 minutos por padrão) são ignorados; passe `Infinity` para restaurar sempre.

## O que não volta

Modais, e `props` passadas pelo `push`. Uma página que depende delas deve lidar com a ausência, lendo os params no lugar. Se um path salvo não corresponde mais a nenhuma rota, depois de uma atualização por exemplo, a pilha começa do `initial`.
