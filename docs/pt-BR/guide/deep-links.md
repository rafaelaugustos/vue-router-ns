# Deep links

Rotas são paths, então onde quer que seu app receba um link (um handler de URL, o payload de uma notificação), entregue o path ao router:

```ts
router.push('/messages/42')
```

Isso é seguro num cold start: uma navegação pedida antes da primeira página aparecer espera por ela e empilha por cima, então o back ainda cai na sua página inicial.

## Trazendo os pais junto

Um link para uma página aninhada pode trazer os pais dela, para o back subir pela hierarquia do app em vez de pular para a home:

```ts
router.push('/settings/account', { withParents: true })
// pilha: / → /settings → /settings/account
```

Os pais vêm do aninhamento por `children` na tabela de rotas, e só os que têm componente viram páginas:

```ts
{
  path: '/settings',
  component: Settings,
  children: [{ path: 'account', name: 'account', component: Account }],
}
```

Pais que já estão no topo são pulados, só a última página anima, e os guards rodam para cada página. Com `clearHistory`, os pais e a página viram a pilha inteira. O `<RouterLink>` também aceita `withParents`.

## Recebendo URLs do sistema

O router recebe localizações do app; não registra schemes, Android App Links ou iOS Universal Links. Configure essa integração no app e transforme a URL recebida em um path conhecido antes de chamar `push`. Valide o scheme/host e use os guards de autenticação também para links externos.

A opção `frame` escolhe uma pilha, mas não seleciona a aba do `TabView`. Para abrir uma aba ainda não carregada, selecione-a antes de esperar a navegação. Veja [abas](./tabs).
