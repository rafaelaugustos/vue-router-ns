# Cada página guarda sua rota

Empurrar uma página não destrói a de baixo: ela continua montada até sair da pilha. Por isso o `useRoute()` dentro de uma página retorna a rota daquela página, e ela nunca muda. Enquanto `/messages/2` está em cima de `/messages/1`, a primeira página continua vendo `id: '1'`, e nada roda de novo porque outra página se moveu.

Fora das páginas (no `App.vue`, por exemplo), o `useRoute()` acompanha a página na tela. `router.currentRoute` é sempre a página na tela, e `router.stack` é a pilha inteira, de baixo para cima, reativa:

```ts
const { stack } = useRouter()
const canGoBack = computed(() => stack.value.length > 1)
```

O `useRouter()` dentro de uma página navega na pilha em que aquela página vive: sua aba, ou seu modal.

## Props

O `props` de um record de rota funciona como no Vue Router: `true` passa os params como props, um objeto é passado como está, uma função mapeia a rota. Além disso, o `push` aceita `props` para valores que não cabem em params, como um objeto para mostrar enquanto o real carrega.

## Quando uma página volta a aparecer

Uma página que fica na pilha não é montada de novo quando você volta a ela, então o `onMounted` não ajuda a atualizá-la. Use estes:

```ts
onPageActivated(() => refresh()) // mostrada, e toda vez que o usuário volta
onPageDeactivated(() => pause()) // coberta por outra página ou um modal
```

Quando a página sai da pilha ela é desmontada, então a limpeza vai no `onUnmounted`.
