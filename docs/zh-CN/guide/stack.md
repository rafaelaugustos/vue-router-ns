# 设置整个导航栈 {#setting-the-whole-stack}

与SwiftUI的`NavigationStack(path:)`一样，导航栈可以设置为列表，页面如下：

```ts
await router.setStack(['/', '/orders', { name: 'order', params: { id: 42 } }])
```

路由器从下往上保留导航栈共享的页面，返回到最后一个，然后推送其余的页面。只有最后一步有动画。守卫每一步都在奔跑，第一次失败就会阻止它。列表中的模态路由变成普通页面：列表描述一帧的导航栈。

它采用 `frame`、`animated` 和 `transition` 作为第二个参数。这是 [`withParents`](./deep-links#bringing-the-parents-along) 和 [恢复保存的 导航栈](./restore) 的基础。

列表不能为空。如果 导航守卫 中断协调，则会保留已完成的步骤：`setStack()` 不是事务。在 `RouterSplitView` 中，列表保持固定为第一个条目，即使从参数中省略也是如此。

## 不带动画返回 {#going-back-without-animating}

`back()`、`backTo()` 和 `backToRoot()` 取 `animated: false`。 `go(delta)` 只接受偏移量；当您需要选项时，请使用 `backTo()` 或 `backToRoot()`。框架以弹出页面的方式呈现弹出动画，因此路由器在弹出之前将其设置在页面上。
