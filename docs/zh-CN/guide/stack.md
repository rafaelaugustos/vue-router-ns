# 设置整个导航栈 {#setting-the-whole-stack}

## 选择精确的保留条目 {#selecting-an-exact-retained-entry}

`router.stack` 列出路由。`router.history` 提供冻结的快照，按栈底到栈顶的顺序，为每个保留条目提供当前实例的地址。路径相同的两个条目具有不同地址：

```ts
const snapshot = router.getHistory({ frame: 'inbox' })
const selected = snapshot?.entries[1]
if (selected) await router.backToEntry(selected, { animated: false })
```

`history.value` 跟随调用方的导航栈：在应用 router 上是当前聚焦的栈，在页面内则是页面所属的栈。`getHistory()` 读取相同作用域；`{ frame }` 选择此 router/窗口中的具名 frame。读取不会显示标签页或触发导航。使用 `computed(() => router.getHistory({ frame: 'inbox' }))` 可获得具名栈的响应式视图。作用域不存在或已关闭时返回 `undefined`。已关闭页面的历史不会转而代表其他栈。

每个快照包含 `scope` 和 `entries`。作用域包含 `id`、`name`、`kind`（`frame` 或 `modal`）、绑定原生窗口时的 `windowId`，以及 `pinnedRoot`。每个条目包含：

| 字段            | 含义                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------ |
| `scopeId`, `id` | `backToEntry()` 接受的精确实例地址。只要栈和条目仍然存在，地址就保持不变，包括临时卸载和页面 HMR 期间。      |
| `key`           | 页面状态标识。版本 2 的恢复会保留此标识，但创建新的实例地址。                                                |
| `route`         | 独立复制的 `path`、`fullPath`、`name`、`params`、`query` 和 `hash`。不包含路由记录、组件、元数据或原生句柄。 |
| `restored`      | 此页面从已保存的栈重建而来，包括旧版仅含路径的快照。它是一个新的原生对象。                                   |

快照、条目、路由数据以及参数/query 中的嵌套数组均被冻结。旧快照仍然表示当时的观察结果；请重新读取以获取当前条目。保留快照不会使 router 的原生 Pages 一直存活。

`backToEntry(selected, { animated, result })` 选择条目所属的栈，即使焦点已转移到另一个具名栈。导航前会显示该栈所在的标签页。不支持通过 `frame` 改写目标，也不会退回到按路径匹配其他条目。指定的结果只交给被移除的栈顶页面；其他被移除页面的结果以 `undefined` 完成。离开守卫通过现有 Back 流程从栈顶向下执行，包括守卫重定向、原生完成确认和资源释放。

- 选择当前栈顶条目会返回 `duplicated` 导航失败，不执行守卫或更改历史。
- 条目不存在、属于其他 router/窗口，或栈已关闭/替换时，Promise 以错误拒绝。重用 frame 名称或恢复相同路径/键不会让旧地址重新有效。
- 守卫拒绝时返回 `aborted` 并保留栈。等待期间发生更新的导航、所有者关闭，或原生操作改变了受守卫保护的栈顶/目标时，返回 `cancelled`。
- 已保留但尚未加载的栈会将 Back 排队，直到 host 加载；其他栈仍可继续导航。尚未打开的栈没有可选择的保留条目。
- split 的固定根条目可以被选择，并继续保持固定。选择操作绝不会移除它。
- 存在打开的模态窗口时，只能选择最上层模态栈内的条目。选择被遮挡的历史会拒绝，不会关闭模态窗口；请先使用现有的模态 Back 流程。选择模态根条目会保持模态窗口打开。

请通过[恢复机制](./restore)持久化应用路由和页面状态，不要持久化这些实例地址。弹出的条目已经消失：没有前进历史，重建也不会复活原来的原生对象。原生 Back 控件仍然保留。可选的历史菜单属于后续阶段；此 API 不安装菜单。

<Clip name="entry-history" :width="480" aspect="3 / 4" caption="两个原生栈：重复路径的精确选择、守卫拒绝、旧地址拒绝、取消/完成原生 Back，以及关闭所有者。iOS 18.6 模拟器；演示应用的标签为英文。" />

## 协调路由列表 {#reconciling-a-list-of-routes}

与SwiftUI的`NavigationStack(path:)`一样，导航栈可以设置为列表，页面如下：

```ts
await router.setStack(['/', '/orders', { name: 'order', params: { id: 42 } }])
```

路由器从下往上保留导航栈共享的页面，返回到最后一个，然后推送其余的页面。只有最后一步有动画。守卫每一步都在奔跑，第一次失败就会阻止它。列表中的模态路由变成普通页面：列表描述一帧的导航栈。

它采用 `frame`、`animated` 和 `transition` 作为第二个参数。这是 [`withParents`](./deep-links#bringing-the-parents-along) 和 [恢复保存的 导航栈](./restore) 的基础。

列表不能为空。如果 导航守卫 中断协调，则会保留已完成的步骤：`setStack()` 不是事务。在 `RouterSplitView` 中，列表保持固定为第一个条目，即使从参数中省略也是如此。

## 不带动画返回 {#going-back-without-animating}

`back()`、`backTo()` 和 `backToRoot()` 取 `animated: false`。 `go(delta)` 只接受偏移量；当您需要选项时，请使用 `backTo()` 或 `backToRoot()`。框架以弹出页面的方式呈现弹出动画，因此路由器在弹出之前将其设置在页面上。
