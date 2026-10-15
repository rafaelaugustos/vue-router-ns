# Foco de acessibilidade e movimento

O NativeScript já anuncia páginas após a navegação nativa e tenta restaurar o último elemento focado ao voltar. O router preserva isso por padrão. Use `useNavigationFocus({ initial?, return? })` no setup da página quando precisar escolher elementos explícitos.

```ts
const focus = useNavigationFocus({ initial: 'heading', return: 'reply' })
async function reply() {
  focus.remember('reply')
  await router.pushForResult('/compose')
}
```

Os alvos são ids estáveis de views, views/refs de template ou getters retornando a view (ou null/undefined). Configure ids em controles nativos acessíveis, como `<Label id="heading" accessible="true" textWrap="true" />` e `<Button id="reply" />`. O alvo precisa estar carregado, visível e pertencer à página.

Após a transição nativa confirmada, push usa `initial` e back usa `return`. O anúncio da página é substituído por uma notificação de mudança de layout do UIKit ou uma ação de foco de acessibilidade Android, sem um segundo anúncio paralelo. Recusa de guard ou cancelamento do gesto não muda foco. Alvos ausentes, removidos ou destruídos voltam ao comportamento normal do NativeScript. Nenhuma chamada pede foco de teclado ou abre o IME. `accessibilityAnnouncePageEnabled="false"` mantém os anúncios automáticos desabilitados.

`remember(target?)` identifica o elemento e a página que iniciam um modal; sem argumento usa `return`. Funciona também na lista de um split expandido com detalhe visível: fechar o modal devolve foco à lista iniciadora. Sem iniciador explícito, retorna ao topo da pilha. `focus.focus('initial' | 'return')` tenta foco imediatamente e retorna boolean, útil para conteúdo assíncrono que aparece depois da transição.

Páginas que optam pelo recurso ocultam conteúdo coberto da árvore de acessibilidade e restauram o estado original ao reaparecer/destruir. O split mantém as duas colunas expandidas acessíveis, ocultando colunas cobertas/vazias. Redimensionar não anuncia uma nova rota. O preview Android também exclui temporariamente a página inferior durante o gesto, restaurando-a ao terminar/cancelar.

Evite anúncios em todo `onPageActivated`: ele ocorre antes do fim da transição e pode ativar as duas colunas do split. Continue usando controles nativos, fontes escaláveis e quebra de linha.

## Redução de movimento

`createRouter({ routes, motion: 'system' })` é o padrão: consulta Reduce Motion do UIKit ou a preferência de animadores do Android a cada navegação/gesto. `motion: 'reduced'` omite preview/zoom/shared transitions do router e pede push/back/modal sem animação. `motion: 'full'` mantém as opções normais disponíveis; o sistema ainda pode aplicar suas próprias preferências.

A redução não altera rotas, guards, resultados de modal ou histórico. O estado de shared transitions ignoradas é liberado. Gestos e transições fora do router continuam sob responsabilidade nativa.

Veja a [receita completa em inglês](/guide/accessibility), o relatório `test/native-accessibility.md` no repositório, [guards](./guards) e [transições](./transitions). Valide VoiceOver/TalkBack, fontes grandes, modal com alterações, gesto cancelado e as duas larguras do split na aplicação real.
