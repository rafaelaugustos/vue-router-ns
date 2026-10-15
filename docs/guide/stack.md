# Setting the whole stack

Like SwiftUI's `NavigationStack(path:)`, the stack can be set as a list, and the pages follow:

```ts
await router.setStack(['/', '/orders', { name: 'order', params: { id: 42 } }])
```

The router keeps the pages both stacks share from the bottom up, goes back to the last of them, then pushes the rest. Only the last step animates. Guards run for every step, and the first failure stops it. A modal route in the list becomes a plain page: the list describes one frame's stack.

It takes `frame`, `animated` and `transition` as a second argument. It's what [`withParents`](./deep-links#bringing-the-parents-along) and [restoring a saved stack](./restore) are built on.

The list cannot be empty. If a guard interrupts reconciliation, completed steps remain: `setStack()` is not a transaction. In a `RouterSplitView`, the list stays pinned as the first entry, even when omitted from the argument.

## Going back without animating

`back()`, `backTo()` and `backToRoot()` take `animated: false`. `go(delta)` only accepts the offset; use `backTo()` or `backToRoot()` when you need options. A frame animates a pop the way the page being popped came in, so the router sets that on the page before popping.
